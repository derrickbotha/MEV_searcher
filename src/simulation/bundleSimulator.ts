import { ethers } from 'ethers';
import { Bundle, ProfitEstimate, ForkHandle } from '../types';
import { LocalForkManager } from './localForkManager';
import { simLogger } from '../utils/logger';

export interface SimulationResult {
  success: boolean;
  profit?: ProfitEstimate;
  error?: string;
  gasUsed?: bigint;
  revertReason?: string;
}

export class BundleSimulator {
  private forkManager: LocalForkManager;
  private maxConcurrency: number;
  private timeoutMs: number;

  constructor(forkManager: LocalForkManager, maxConcurrency = 10, timeoutMs = 5000) {
    this.forkManager = forkManager;
    this.maxConcurrency = maxConcurrency;
    this.timeoutMs = timeoutMs;
  }

  async simulate(bundle: Bundle, fork?: ForkHandle): Promise<SimulationResult> {
    const useFork = fork || (await this.forkManager.createFreshFork(bundle.blockNumber));

    try {
      return await this.simulateWithTimeout(bundle, useFork);
    } finally {
      if (!fork) {
        await useFork.cleanup();
      }
    }
  }

  private async simulateWithTimeout(
    bundle: Bundle,
    fork: ForkHandle
  ): Promise<SimulationResult> {
    return Promise.race([
      this.simulateBundle(bundle, fork),
      new Promise<SimulationResult>((_, reject) =>
        setTimeout(() => reject(new Error('Simulation timeout')), this.timeoutMs)
      ),
    ]).catch((error) => ({
      success: false,
      error: error.message,
    }));
  }

  private async simulateBundle(bundle: Bundle, fork: ForkHandle): Promise<SimulationResult> {
    try {
      let totalGasUsed = BigInt(0);
      let balanceBefore = BigInt(0);
      let balanceAfter = BigInt(0);

      // Get searcher address from first transaction
      const firstTx = await fork.provider.parseTransaction(bundle.txs[0]);
      if (!firstTx || !firstTx.from) {
        return {
          success: false,
          error: 'Invalid transaction format',
        };
      }

      const searcherAddress = firstTx.from;
      balanceBefore = await fork.provider.getBalance(searcherAddress);

      // Simulate each transaction in the bundle
      for (const signedTx of bundle.txs) {
        const tx = await fork.provider.parseTransaction(signedTx);
        if (!tx) {
          return {
            success: false,
            error: 'Failed to parse transaction',
          };
        }

        // Send transaction to fork
        const txResponse = await fork.provider.broadcastTransaction(signedTx);
        const receipt = await txResponse.wait();

        if (!receipt) {
          return {
            success: false,
            error: 'Transaction receipt not found',
          };
        }

        if (receipt.status === 0) {
          return {
            success: false,
            error: 'Transaction reverted',
            revertReason: await this.getRevertReason(fork.provider, tx),
          };
        }

        totalGasUsed += receipt.gasUsed;
      }

      balanceAfter = await fork.provider.getBalance(searcherAddress);

      // Calculate profit
      const netProfit = balanceAfter - balanceBefore;
      const gasPrice = bundle.txs[0] ? await this.extractGasPrice(bundle.txs[0]) : BigInt(0);
      const gasCost = totalGasUsed * gasPrice;

      const profit: ProfitEstimate = {
        grossProfitWei: netProfit + gasCost,
        gasCostWei: gasCost,
        netProfitWei: netProfit,
        netProfitUSD: this.weiToUSD(netProfit),
        gasPrice,
      };

      simLogger.debug(
        {
          bundleSize: bundle.txs.length,
          netProfitWei: profit.netProfitWei.toString(),
          netProfitUSD: profit.netProfitUSD,
          gasUsed: totalGasUsed.toString(),
        },
        'Simulation successful'
      );

      return {
        success: true,
        profit,
        gasUsed: totalGasUsed,
      };
    } catch (error: any) {
      simLogger.error({ error: error.message }, 'Simulation failed');
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async simulateParallel(
    bundles: Bundle[],
    options: { maxConcurrency?: number; timeoutMs?: number } = {}
  ): Promise<SimulationResult[]> {
    const concurrency = options.maxConcurrency || this.maxConcurrency;
    const timeout = options.timeoutMs || this.timeoutMs;

    simLogger.info({ bundleCount: bundles.length, concurrency }, 'Starting parallel simulation');

    const results: SimulationResult[] = [];
    const chunks = this.chunkArray(bundles, concurrency);

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map((bundle) => this.simulate(bundle))
      );
      results.push(...chunkResults);
    }

    simLogger.info(
      {
        total: results.length,
        successful: results.filter((r) => r.success).length,
      },
      'Parallel simulation complete'
    );

    return results;
  }

  private async extractGasPrice(signedTx: string): Promise<bigint> {
    try {
      const tx = ethers.Transaction.from(signedTx);
      return tx.gasPrice || tx.maxFeePerGas || BigInt(0);
    } catch {
      return BigInt(0);
    }
  }

  private async getRevertReason(
    provider: ethers.JsonRpcProvider,
    tx: ethers.Transaction
  ): Promise<string> {
    try {
      await provider.call({
        to: tx.to,
        data: tx.data,
        value: tx.value,
        from: tx.from,
      });
      return 'Unknown revert reason';
    } catch (error: any) {
      return error.message || 'Transaction reverted';
    }
  }

  private weiToUSD(wei: bigint, ethPriceUSD = 2000): number {
    const eth = Number(wei) / 1e18;
    return eth * ethPriceUSD;
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}
