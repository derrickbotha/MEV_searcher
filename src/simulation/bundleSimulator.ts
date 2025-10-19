import { Connection, Transaction, VersionedTransaction, PublicKey, Keypair } from '@solana/web3.js';
import { Bundle, ProfitEstimate, ForkHandle } from '../types';
import { LocalForkManager } from './localForkManager';
import { simLogger } from '../utils/logger';

export interface SimulationResult {
  success: boolean;
  profit?: ProfitEstimate;
  error?: string;
  computeUnitsUsed?: number;
  revertReason?: string;
  logs?: string[];
}

/**
 * Solana Bundle Simulator
 * 
 * Simulates transaction bundles on Solana to:
 * - Estimate profit before submission
 * - Validate transaction execution
 * - Calculate compute units and fees
 * - Detect potential failures
 */
export class BundleSimulator {
  private forkManager: LocalForkManager;
  private connection: Connection;
  private maxConcurrency: number;
  private timeoutMs: number;

  constructor(
    forkManager: LocalForkManager,
    connection: Connection,
    maxConcurrency = 10,
    timeoutMs = 5000
  ) {
    this.forkManager = forkManager;
    this.connection = connection;
    this.maxConcurrency = maxConcurrency;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Simulate a single bundle on a Solana fork
   */
  async simulate(bundle: Bundle, fork?: ForkHandle): Promise<SimulationResult> {
    const useFork = fork || (await this.forkManager.createFreshFork(bundle.slot));

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

  /**
   * Core simulation logic for Solana bundles
   */
  private async simulateBundle(bundle: Bundle, fork: ForkHandle): Promise<SimulationResult> {
    try {
      let totalComputeUnits = 0;
      let balanceBefore = BigInt(0);
      let balanceAfter = BigInt(0);
      const allLogs: string[] = [];

      // Extract payer/searcher address from first transaction
      const firstTx = bundle.transactions[0];
      if (!firstTx) {
        return {
          success: false,
          error: 'Empty bundle',
        };
      }

      const searcherPubkey = this.extractPayer(firstTx);
      if (!searcherPubkey) {
        return {
          success: false,
          error: 'Could not extract payer from transaction',
        };
      }

      // Get balance before simulation
      balanceBefore = BigInt(await fork.connection.getBalance(searcherPubkey));

      // Simulate each transaction in the bundle
      for (let i = 0; i < bundle.transactions.length; i++) {
        const tx = bundle.transactions[i];

        simLogger.debug(
          { txIndex: i, totalTxs: bundle.transactions.length },
          'Simulating transaction'
        );

        // Simulate transaction
        const simulation = await this.simulateTransaction(tx, fork);

        if (simulation.err) {
          return {
            success: false,
            error: `Transaction ${i} failed: ${JSON.stringify(simulation.err)}`,
            revertReason: this.extractRevertReason(simulation.err),
            logs: simulation.logs || [],
          };
        }

        // Accumulate compute units
        if (simulation.unitsConsumed) {
          totalComputeUnits += simulation.unitsConsumed;
        }

        // Accumulate logs
        if (simulation.logs) {
          allLogs.push(...simulation.logs);
        }
      }

      // Get balance after simulation
      balanceAfter = BigInt(await fork.connection.getBalance(searcherPubkey));

      // Calculate profit
      const netProfit = balanceAfter - balanceBefore;
      
      // Estimate priority fees based on compute units
      const priorityFeePerCU = 100; // microlamports per compute unit (adjustable)
      const priorityFeeLamports = BigInt(totalComputeUnits * priorityFeePerCU);

      const profit: ProfitEstimate = {
        grossProfitLamports: netProfit + priorityFeeLamports,
        priorityFeeLamports,
        netProfitLamports: netProfit,
        netProfitUSD: this.lamportsToUSD(netProfit),
        priorityFeePerCU,
      };

      simLogger.info(
        {
          bundleSize: bundle.transactions.length,
          netProfitLamports: profit.netProfitLamports.toString(),
          netProfitUSD: profit.netProfitUSD,
          computeUnits: totalComputeUnits,
        },
        'Bundle simulation successful'
      );

      return {
        success: true,
        profit,
        computeUnitsUsed: totalComputeUnits,
        logs: allLogs,
      };
    } catch (error: any) {
      simLogger.error({ error: error.message }, 'Bundle simulation failed');
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Simulate a single transaction
   */
  private async simulateTransaction(
    tx: Transaction | VersionedTransaction,
    fork: ForkHandle
  ): Promise<any> {
    try {
      if (tx instanceof VersionedTransaction) {
        const simulation = await fork.connection.simulateTransaction(tx, {
          sigVerify: false, // Skip signature verification for faster simulation
          commitment: 'confirmed',
        });
        return simulation.value;
      } else {
        // For regular Transaction, we need to compile it first
        const recentBlockhash = await fork.connection.getLatestBlockhash();
        tx.recentBlockhash = recentBlockhash.blockhash;

        const simulation = await fork.connection.simulateTransaction(tx, undefined, {
          sigVerify: false,
          commitment: 'confirmed',
        });
        return simulation.value;
      }
    } catch (error: any) {
      simLogger.error({ error: error.message }, 'Transaction simulation error');
      return {
        err: error.message,
        logs: [],
      };
    }
  }

  /**
   * Simulate multiple bundles in parallel
   */
  async simulateParallel(
    bundles: Bundle[],
    options: { maxConcurrency?: number; timeoutMs?: number } = {}
  ): Promise<SimulationResult[]> {
    const concurrency = options.maxConcurrency || this.maxConcurrency;

    simLogger.info(
      { bundleCount: bundles.length, concurrency },
      'Starting parallel bundle simulation'
    );

    const results: SimulationResult[] = [];
    const chunks = this.chunkArray(bundles, concurrency);

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map((bundle) => this.simulate(bundle))
      );
      results.push(...chunkResults);
    }

    const successful = results.filter((r) => r.success).length;
    const totalProfit = results
      .filter((r) => r.success && r.profit)
      .reduce((sum, r) => sum + r.profit!.netProfitUSD, 0);

    simLogger.info(
      {
        total: results.length,
        successful,
        failed: results.length - successful,
        totalProfitUSD: totalProfit,
      },
      'Parallel simulation complete'
    );

    return results;
  }

  /**
   * Extract payer (fee payer) from transaction
   */
  private extractPayer(tx: Transaction | VersionedTransaction): PublicKey | null {
    try {
      if (tx instanceof VersionedTransaction) {
        // For VersionedTransaction, the first account is the payer
        const accountKeys = tx.message.staticAccountKeys;
        return accountKeys.length > 0 ? accountKeys[0] : null;
      } else {
        // For regular Transaction, feePayer is set
        return tx.feePayer || null;
      }
    } catch (error) {
      simLogger.error({ error }, 'Failed to extract payer');
      return null;
    }
  }

  /**
   * Extract human-readable revert reason from error
   */
  private extractRevertReason(err: any): string {
    if (typeof err === 'string') {
      return err;
    }

    if (err && typeof err === 'object') {
      if ('InstructionError' in err) {
        return `Instruction error: ${JSON.stringify(err.InstructionError)}`;
      }
      if ('InsufficientFundsForFee' in err) {
        return 'Insufficient funds for fee';
      }
      if ('InvalidAccountData' in err) {
        return 'Invalid account data';
      }
      if ('AccountInUse' in err) {
        return 'Account in use';
      }
    }

    return JSON.stringify(err);
  }

  /**
   * Estimate profit for a bundle without full simulation (fast path)
   */
  async estimateProfitFast(bundle: Bundle): Promise<ProfitEstimate> {
    // Quick estimation without fork simulation
    // Useful for initial filtering before expensive simulation

    const estimatedComputeUnits = bundle.transactions.length * 100000; // 100k CU per tx estimate
    const priorityFeePerCU = 100; // microlamports
    const priorityFeeLamports = BigInt(estimatedComputeUnits * priorityFeePerCU);

    // Estimate gross profit based on bundle type
    // This would be more sophisticated in production
    const estimatedGrossProfitLamports = BigInt(50000000); // 0.05 SOL estimate

    const netProfitLamports = estimatedGrossProfitLamports - priorityFeeLamports;

    return {
      grossProfitLamports: estimatedGrossProfitLamports,
      priorityFeeLamports,
      netProfitLamports,
      netProfitUSD: this.lamportsToUSD(netProfitLamports),
      priorityFeePerCU,
    };
  }

  /**
   * Validate bundle before simulation
   */
  validateBundle(bundle: Bundle): { valid: boolean; error?: string } {
    if (bundle.transactions.length === 0) {
      return { valid: false, error: 'Empty bundle' };
    }

    if (bundle.transactions.length > 5) {
      return { valid: false, error: 'Bundle too large (max 5 transactions)' };
    }

    // Check if all transactions are valid
    for (let i = 0; i < bundle.transactions.length; i++) {
      const tx = bundle.transactions[i];
      if (!tx) {
        return { valid: false, error: `Transaction ${i} is null or undefined` };
      }
    }

    // Check slot validity
    if (bundle.slot <= 0) {
      return { valid: false, error: 'Invalid slot number' };
    }

    return { valid: true };
  }

  /**
   * Get compute unit estimate for a bundle
   */
  async getComputeUnitEstimate(bundle: Bundle): Promise<number> {
    let totalUnits = 0;

    for (const tx of bundle.transactions) {
      try {
        // Simulate individual transaction to get compute units
        const simulation = await this.simulateTransaction(
          tx,
          { connection: this.connection, id: 0, cleanup: async () => {} }
        );

        if (simulation.unitsConsumed) {
          totalUnits += simulation.unitsConsumed;
        } else {
          // Fallback estimate
          totalUnits += 100000; // 100k CU per tx
        }
      } catch {
        totalUnits += 100000; // Fallback estimate
      }
    }

    return totalUnits;
  }

  private lamportsToUSD(lamports: bigint, solPriceUSD = 200): number {
    const sol = Number(lamports) / 1e9;
    return sol * solPriceUSD;
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Get detailed simulation metrics
   */
  async getSimulationMetrics(bundle: Bundle): Promise<{
    totalComputeUnits: number;
    avgComputePerTx: number;
    estimatedPriorityFee: bigint;
    estimatedExecutionTime: number; // in milliseconds
  }> {
    const totalComputeUnits = await this.getComputeUnitEstimate(bundle);
    const avgComputePerTx = totalComputeUnits / bundle.transactions.length;
    
    const priorityFeePerCU = 100; // microlamports
    const estimatedPriorityFee = BigInt(totalComputeUnits * priorityFeePerCU);

    // Solana processes transactions very fast, estimate based on compute units
    const estimatedExecutionTime = (totalComputeUnits / 1000000) * 400; // ~400ms per 1M CU

    return {
      totalComputeUnits,
      avgComputePerTx,
      estimatedPriorityFee,
      estimatedExecutionTime,
    };
  }
}
