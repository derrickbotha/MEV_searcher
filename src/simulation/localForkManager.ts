import { Connection, PublicKey, AccountInfo, Commitment } from '@solana/web3.js';
import { ForkHandle, ForkState } from '../types';
import { simLogger } from '../utils/logger';
import retry from 'async-retry';

/**
 * Represents a snapshot of account state at a specific slot
 */
interface AccountSnapshot {
  pubkey: PublicKey;
  account: AccountInfo<Buffer> | null;
  slot: number;
}

/**
 * Manages local state forks for Solana transaction simulation
 * Unlike Ethereum's Anvil, Solana doesn't have native fork providers,
 * so we implement snapshot-based state tracking
 */
export class LocalForkManager {
  private connections: Map<number, Connection> = new Map();
  private forkStates: Map<number, ForkState> = new Map();
  private accountSnapshots: Map<number, Map<string, AccountSnapshot>> = new Map();
  private rpcUrls: string[];
  private currentRpcIndex = 0;

  constructor(rpcUrls?: string | string[]) {
    if (Array.isArray(rpcUrls)) {
      this.rpcUrls = rpcUrls;
    } else if (rpcUrls) {
      this.rpcUrls = [rpcUrls];
    } else {
      this.rpcUrls = [
        process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
        'https://solana-api.projectserum.com',
        'https://rpc.ankr.com/solana',
      ].filter(Boolean);
    }

    if (this.rpcUrls.length === 0) {
      throw new Error('No RPC URLs configured for fork manager');
    }
  }

  /**
   * Creates a fresh fork at the specified slot
   * In Solana, this means creating a connection and snapshotting relevant accounts
   */
  async createFreshFork(slot?: number): Promise<ForkHandle> {
    const forkId = Date.now();
    const rpcUrl = this.getNextRpcUrl();

    simLogger.info({ forkId, rpcUrl, slot }, 'Creating new Solana fork');

    // Create connection with optimal commitment levels
    const connection = new Connection(rpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
      wsEndpoint: rpcUrl.replace('https://', 'wss://').replace('http://', 'ws://'),
    });

    this.connections.set(forkId, connection);
    this.accountSnapshots.set(forkId, new Map());

    // Wait for connection to be ready
    await this.waitForReady(connection);

    // Get current slot if not specified
    const currentSlot = slot || (await connection.getSlot('confirmed'));

    // Initialize fork state
    this.forkStates.set(forkId, {
      slot: currentSlot,
      timestamp: Math.floor(Date.now() / 1000),
      blockhash: '', // Will be populated on first use
    });

    // Preload critical accounts (DEX programs, system programs)
    await this.preloadAccounts(connection, forkId);

    // Get blockhash for this fork
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    const state = this.forkStates.get(forkId);
    if (state) {
      state.blockhash = blockhash;
    }

    simLogger.info({ forkId, slot: currentSlot, blockhash }, 'Solana fork ready');

    return {
      id: forkId,
      connection,
      cleanup: async () => this.cleanupFork(forkId),
    };
  }

  /**
   * Snapshots an account's state at the current slot
   */
  async snapshotAccount(
    forkId: number,
    pubkey: PublicKey,
    commitment: Commitment = 'confirmed'
  ): Promise<AccountSnapshot | null> {
    const connection = this.connections.get(forkId);
    if (!connection) {
      throw new Error(`Fork ${forkId} not found`);
    }

    const snapshots = this.accountSnapshots.get(forkId);
    if (!snapshots) {
      throw new Error(`Fork ${forkId} has no snapshot storage`);
    }

    try {
      const account = await connection.getAccountInfo(pubkey, commitment);
      const slot = await connection.getSlot(commitment);

      const snapshot: AccountSnapshot = {
        pubkey,
        account,
        slot,
      };

      snapshots.set(pubkey.toBase58(), snapshot);
      simLogger.debug({ forkId, pubkey: pubkey.toBase58(), slot }, 'Account snapshot created');

      return snapshot;
    } catch (error) {
      simLogger.error({ forkId, pubkey: pubkey.toBase58(), error }, 'Failed to snapshot account');
      return null;
    }
  }

  /**
   * Snapshots multiple accounts in parallel
   */
  async snapshotAccounts(
    forkId: number,
    pubkeys: PublicKey[],
    commitment: Commitment = 'confirmed'
  ): Promise<AccountSnapshot[]> {
    const connection = this.connections.get(forkId);
    if (!connection) {
      throw new Error(`Fork ${forkId} not found`);
    }

    const snapshots = this.accountSnapshots.get(forkId);
    if (!snapshots) {
      throw new Error(`Fork ${forkId} has no snapshot storage`);
    }

    try {
      // Batch request for efficiency
      const accountInfos = await connection.getMultipleAccountsInfo(pubkeys, commitment);
      const slot = await connection.getSlot(commitment);

      const results: AccountSnapshot[] = [];

      for (let i = 0; i < pubkeys.length; i++) {
        const snapshot: AccountSnapshot = {
          pubkey: pubkeys[i],
          account: accountInfos[i],
          slot,
        };

        snapshots.set(pubkeys[i].toBase58(), snapshot);
        results.push(snapshot);
      }

      simLogger.debug({ forkId, count: pubkeys.length, slot }, 'Accounts snapshot created');

      return results;
    } catch (error) {
      simLogger.error({ forkId, count: pubkeys.length, error }, 'Failed to snapshot accounts');
      return [];
    }
  }

  /**
   * Gets a cached account snapshot
   */
  getAccountSnapshot(forkId: number, pubkey: PublicKey): AccountSnapshot | undefined {
    const snapshots = this.accountSnapshots.get(forkId);
    if (!snapshots) {
      return undefined;
    }

    return snapshots.get(pubkey.toBase58());
  }

  /**
   * Restores fork state to a specific slot (limited capability)
   * Note: Solana doesn't support true fork restoration like Ethereum
   * This method mainly updates cached snapshots
   */
  async restoreToSlot(forkId: number, targetSlot: number): Promise<boolean> {
    const connection = this.connections.get(forkId);
    const state = this.forkStates.get(forkId);

    if (!connection || !state) {
      return false;
    }

    try {
      // Update fork state
      state.slot = targetSlot;
      state.timestamp = Math.floor(Date.now() / 1000);

      // Clear snapshots as they're now stale
      const snapshots = this.accountSnapshots.get(forkId);
      if (snapshots) {
        snapshots.clear();
      }

      simLogger.info({ forkId, targetSlot }, 'Fork state restored');
      return true;
    } catch (error) {
      simLogger.error({ forkId, targetSlot, error }, 'Failed to restore fork state');
      return false;
    }
  }

  /**
   * Gets the connection for a specific fork
   */
  getConnection(forkId: number): Connection | undefined {
    return this.connections.get(forkId);
  }

  /**
   * Gets the state of a specific fork
   */
  getForkState(forkId: number): ForkState | undefined {
    return this.forkStates.get(forkId);
  }

  /**
   * Gets the number of active forks
   */
  getActiveForks(): number {
    return this.connections.size;
  }

  /**
   * Gets total snapshot count across all forks
   */
  getTotalSnapshots(): number {
    let total = 0;
    for (const snapshots of this.accountSnapshots.values()) {
      total += snapshots.size;
    }
    return total;
  }

  /**
   * Waits for connection to be ready
   */
  private async waitForReady(connection: Connection, maxRetries = 30): Promise<void> {
    await retry(
      async () => {
        await connection.getSlot('confirmed');
      },
      {
        retries: maxRetries,
        minTimeout: 100,
        maxTimeout: 1000,
        onRetry: (error, attempt) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          simLogger.debug({ attempt, error: errorMessage }, 'Waiting for connection...');
        },
      }
    );
  }

  /**
   * Preloads critical accounts for faster simulation
   */
  private async preloadAccounts(connection: Connection, forkId: number): Promise<void> {
    try {
      // Critical Solana program IDs
      const criticalPrograms = [
        '11111111111111111111111111111111', // System Program
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Token Program
        'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', // Associated Token Program
        'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter Aggregator v6
        '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium AMM v4
        'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', // Orca Whirlpool
        'JitoXr8Gn5CK5LvVT42Dct8nQHs1mWqDf3VqL8GZnWC3', // Jito Block Engine (example)
      ];

      const pubkeys = criticalPrograms.map((addr) => new PublicKey(addr));

      // Snapshot these critical accounts
      await this.snapshotAccounts(forkId, pubkeys, 'confirmed');

      // Also cache some high-liquidity token mints
      const popularMints = [
        'So11111111111111111111111111111111111111112', // Wrapped SOL
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
      ];

      const mintPubkeys = popularMints.map((addr) => new PublicKey(addr));
      await this.snapshotAccounts(forkId, mintPubkeys, 'confirmed');

      simLogger.debug({ forkId }, 'Critical accounts preloaded successfully');
    } catch (error) {
      simLogger.warn({ forkId, error }, 'Failed to preload some accounts');
    }
  }

  /**
   * Round-robin RPC URL selection
   */
  private getNextRpcUrl(): string {
    const url = this.rpcUrls[this.currentRpcIndex];
    this.currentRpcIndex = (this.currentRpcIndex + 1) % this.rpcUrls.length;
    return url;
  }

  /**
   * Cleans up a specific fork
   */
  private async cleanupFork(forkId: number): Promise<void> {
    // Clear snapshots
    const snapshots = this.accountSnapshots.get(forkId);
    if (snapshots) {
      const snapshotCount = snapshots.size;
      snapshots.clear();
      this.accountSnapshots.delete(forkId);
      simLogger.debug({ forkId, snapshotCount }, 'Snapshots cleared');
    }

    // Remove connection
    this.connections.delete(forkId);

    // Remove state
    this.forkStates.delete(forkId);

    simLogger.info({ forkId }, 'Fork cleaned up');
  }

  /**
   * Cleans up all forks
   */
  async cleanupAll(): Promise<void> {
    const cleanupPromises = Array.from(this.connections.keys()).map((id) => this.cleanupFork(id));
    await Promise.all(cleanupPromises);
    simLogger.info('All forks cleaned up');
  }

  /**
   * Gets memory usage statistics
   */
  getMemoryStats(): {
    activeForks: number;
    totalSnapshots: number;
    snapshotsPerFork: Map<number, number>;
  } {
    const snapshotsPerFork = new Map<number, number>();

    for (const [forkId, snapshots] of this.accountSnapshots.entries()) {
      snapshotsPerFork.set(forkId, snapshots.size);
    }

    return {
      activeForks: this.getActiveForks(),
      totalSnapshots: this.getTotalSnapshots(),
      snapshotsPerFork,
    };
  }

  /**
   * Prunes old snapshots to manage memory
   */
  pruneOldSnapshots(forkId: number, maxAge: number = 300000): number {
    const snapshots = this.accountSnapshots.get(forkId);
    if (!snapshots) {
      return 0;
    }

    const connection = this.connections.get(forkId);
    if (!connection) {
      return 0;
    }

    let prunedCount = 0;
    const currentTime = Date.now();

    for (const [key, snapshot] of snapshots.entries()) {
      // Rough age estimation (400ms per slot)
      const estimatedAge = (Date.now() - forkId) + (snapshot.slot * 400);

      if (estimatedAge > maxAge) {
        snapshots.delete(key);
        prunedCount++;
      }
    }

    if (prunedCount > 0) {
      simLogger.debug({ forkId, prunedCount, maxAge }, 'Pruned old snapshots');
    }

    return prunedCount;
  }
}
