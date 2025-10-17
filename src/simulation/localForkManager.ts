import { spawn, ChildProcess } from 'child_process';
import { ethers } from 'ethers';
import { ForkHandle, ForkState } from '../types';
import { simLogger } from '../utils/logger';
import retry from 'async-retry';

export class LocalForkManager {
  private anvilProcesses: Map<number, ChildProcess> = new Map();
  private forkStates: Map<number, ForkState> = new Map();
  private basePort = 8545;
  private forkRpcUrl: string;

  constructor(forkRpcUrl?: string) {
    this.forkRpcUrl = forkRpcUrl || process.env.MAINNET_RPC_URL || '';
  }

  async createFreshFork(blockNumber?: number): Promise<ForkHandle> {
    const forkId = Date.now();
    const port = this.basePort + this.anvilProcesses.size;

    simLogger.info({ forkId, port, blockNumber }, 'Creating new Anvil fork');

    const args = [
      '--fork-url',
      this.forkRpcUrl,
      '--host',
      '127.0.0.1',
      '--port',
      port.toString(),
      '--silent',
      '--accounts',
      '10',
      '--balance',
      '10000',
    ];

    if (blockNumber) {
      args.push('--fork-block-number', blockNumber.toString());
    }

    const anvilProcess = spawn('anvil', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    anvilProcess.stderr?.on('data', (data) => {
      simLogger.error({ forkId, error: data.toString() }, 'Anvil error');
    });

    anvilProcess.on('exit', (code) => {
      simLogger.warn({ forkId, code }, 'Anvil process exited');
      this.anvilProcesses.delete(forkId);
      this.forkStates.delete(forkId);
    });

    this.anvilProcesses.set(forkId, anvilProcess);

    // Wait for Anvil to be ready
    const rpcUrl = `http://127.0.0.1:${port}`;
    await this.waitForReady(rpcUrl);

    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Pre-warm common contracts
    await this.preloadContracts(provider);

    // Get current fork state
    const block = await provider.getBlock('latest');
    if (block) {
      this.forkStates.set(forkId, {
        blockNumber: block.number,
        timestamp: block.timestamp,
        stateRoot: block.stateRoot || '',
      });
    }

    simLogger.info({ forkId, port }, 'Anvil fork ready');

    return {
      id: forkId,
      provider,
      cleanup: async () => this.cleanupFork(forkId),
    };
  }

  private async waitForReady(rpcUrl: string, maxRetries = 30): Promise<void> {
    await retry(
      async () => {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        await provider.getBlockNumber();
      },
      {
        retries: maxRetries,
        minTimeout: 100,
        maxTimeout: 1000,
        onRetry: (error, attempt) => {
          simLogger.debug({ rpcUrl, attempt, error: error.message }, 'Waiting for Anvil...');
        },
      }
    );
  }

  private async preloadContracts(provider: ethers.JsonRpcProvider): Promise<void> {
    try {
      // Impersonate whale accounts for realistic testing
      const whaleAccounts = [
        '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', // Vitalik
        '0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503', // Binance
      ];

      for (const whale of whaleAccounts) {
        await provider.send('hardhat_impersonateAccount', [whale]);
        await provider.send('hardhat_setBalance', [whale, '0x56BC75E2D63100000']); // 100 ETH
      }

      // Cache common contract code
      const commonContracts = [
        '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2 Router
        '0xE592427A0AEce92De3Edee1F18E0157C05861564', // Uniswap V3 Router
      ];

      await Promise.all(
        commonContracts.map((address) => provider.getCode(address))
      );

      simLogger.debug('Contracts preloaded successfully');
    } catch (error) {
      simLogger.warn({ error }, 'Failed to preload some contracts');
    }
  }

  private async cleanupFork(forkId: number): Promise<void> {
    const process = this.anvilProcesses.get(forkId);
    if (process) {
      process.kill('SIGTERM');
      this.anvilProcesses.delete(forkId);
      this.forkStates.delete(forkId);
      simLogger.info({ forkId }, 'Fork cleaned up');
    }
  }

  async cleanupAll(): Promise<void> {
    const cleanupPromises = Array.from(this.anvilProcesses.keys()).map((id) =>
      this.cleanupFork(id)
    );
    await Promise.all(cleanupPromises);
    simLogger.info('All forks cleaned up');
  }

  getForkState(forkId: number): ForkState | undefined {
    return this.forkStates.get(forkId);
  }

  getActiveForks(): number {
    return this.anvilProcesses.size;
  }
}
