import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { Connection, PublicKey } from '@solana/web3.js';
import { PendingTx, RPCConfig, HealthStatus } from '../types';
import { PriorityQueue } from '../utils/priorityQueue';
import { wsLogger } from '../utils/logger';

interface SubscriptionMessage {
  id: number;
  method: string;
  params: any[];
}

interface SolanaTransactionNotification {
  signature: string;
  err: any;
  slot: number;
}

export class WebSocketManager extends EventEmitter {
  private connections: Map<string, Connection> = new Map();
  private subscriptions: Map<string, number> = new Map(); // RPC name -> subscription ID
  private pendingTxQueue: PriorityQueue<PendingTx>;
  private reconnectIntervals: Map<string, NodeJS.Timeout> = new Map();
  private healthStatuses: Map<string, HealthStatus> = new Map();
  private maxQueueSize: number;

  constructor(maxQueueSize = 10000) {
    super();
    this.maxQueueSize = maxQueueSize;
    this.pendingTxQueue = new PriorityQueue<PendingTx>(
      (a, b) => a.priorityFee > b.priorityFee // Higher priority fee = higher priority
    );
  }

  async connectPrimaryRPCs(rpcConfigs: RPCConfig[]): Promise<void> {
    const connectionPromises = rpcConfigs.map((config) => this.connectToRPC(config));
    await Promise.allSettled(connectionPromises);

    wsLogger.info(
      { connectedRPCs: this.connections.size, totalConfigs: rpcConfigs.length },
      'Solana RPC connections established'
    );
  }

  private async connectToRPC(config: RPCConfig): Promise<void> {
    try {
      // Create Solana connection
      const connection = new Connection(config.httpUrl, {
        commitment: config.commitment || 'confirmed',
        wsEndpoint: config.wsUrl,
      });

      this.connections.set(config.name, connection);

      // Test connection
      const slot = await connection.getSlot();
      wsLogger.info({ rpc: config.name, slot }, 'Solana RPC connected');

      this.healthStatuses.set(config.name, {
        healthy: true,
        lastChecked: Date.now(),
        errorCount: 0,
        slotHeight: slot,
      });

      // Subscribe to account changes and transactions
      await this.subscribeToTransactions(connection, config.name);

    } catch (error: any) {
      wsLogger.error({ rpc: config.name, error: error.message }, 'Failed to connect to Solana RPC');
      this.updateHealthStatus(config.name, false);
      this.scheduleReconnect(config);
    }
  }

  private async subscribeToTransactions(connection: Connection, rpcName: string): Promise<void> {
    try {
      // Subscribe to signature notifications (new transactions)
      // Note: Solana doesn't have a direct "pending transaction" subscription
      // We need to monitor specific accounts or use signature subscriptions

      // For MEV purposes, we typically monitor:
      // 1. DEX program accounts
      // 2. Specific pools
      // 3. Large token accounts

      // Example: Subscribe to Raydium program account
      const raydiumProgramId = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');

      const subscriptionId = connection.onAccountChange(
        raydiumProgramId,
        (accountInfo, context) => {
          this.handleAccountChange(rpcName, accountInfo, context);
        },
        'confirmed'
      );

      this.subscriptions.set(rpcName, subscriptionId);

      wsLogger.info({ rpc: rpcName, subscriptionId }, 'Subscribed to Solana transactions');
    } catch (error: any) {
      wsLogger.error(
        { rpc: rpcName, error: error.message },
        'Failed to subscribe to transactions'
      );
    }
  }

  private handleAccountChange(rpcName: string, accountInfo: any, context: any): void {
    try {
      // Process account change - would need to decode and classify transaction
      wsLogger.debug(
        { rpc: rpcName, slot: context.slot },
        'Account change detected'
      );

      // In production, would:
      // 1. Decode the account data
      // 2. Extract transaction details
      // 3. Create PendingTx object
      // 4. Add to queue if meets criteria

      // Mock pending transaction for demonstration
      const pendingTx: PendingTx = {
        signature: 'mock_signature_' + Date.now(),
        account: new PublicKey('11111111111111111111111111111112'),
        instructions: [],
        computeUnits: 200000,
        priorityFee: BigInt(100000),
        slot: context.slot,
        timestamp: Date.now(),
      };

      this.addToQueue(pendingTx);

    } catch (error: any) {
      wsLogger.error(
        { rpc: rpcName, error: error.message },
        'Error handling account change'
      );
    }
  }

  private addToQueue(tx: PendingTx): void {
    // Check queue size limit
    if (this.pendingTxQueue.size() >= this.maxQueueSize) {
      wsLogger.warn({ queueSize: this.pendingTxQueue.size() }, 'Queue full, dropping transaction');
      return;
    }

    // Filter based on criteria
    if (!this.shouldProcessTransaction(tx)) {
      return;
    }

    this.pendingTxQueue.enqueue(tx);

    wsLogger.debug(
      {
        signature: tx.signature,
        priorityFee: tx.priorityFee.toString(),
        queueSize: this.pendingTxQueue.size(),
      },
      'Transaction added to queue'
    );

    // Emit event for processing
    this.emit('pendingTx', tx);
  }

  private shouldProcessTransaction(tx: PendingTx): boolean {
    // Filter out low-value transactions
    const minPriorityFee = BigInt(10000); // 0.00001 SOL minimum
    const minComputeUnits = 50000;

    return tx.priorityFee >= minPriorityFee || tx.computeUnits >= minComputeUnits;
  }

  private calculatePriority(tx: PendingTx): number {
    // Higher priority for transactions with higher fees and more compute units
    const priorityFeeSOL = Number(tx.priorityFee) / 1e9;
    const computeScore = tx.computeUnits / 1000;

    return priorityFeeSOL * 100 + computeScore;
  }

  private updateHealthStatus(rpcName: string, healthy: boolean): void {
    const current = this.healthStatuses.get(rpcName) || {
      healthy: true,
      lastChecked: Date.now(),
      errorCount: 0,
    };

    this.healthStatuses.set(rpcName, {
      ...current,
      healthy,
      lastChecked: Date.now(),
      errorCount: healthy ? 0 : current.errorCount + 1,
    });

    if (!healthy && current.errorCount >= 3) {
      wsLogger.error({ rpc: rpcName }, 'RPC health check failed multiple times');
      this.emit('rpcUnhealthy', rpcName);
    }
  }

  private scheduleReconnect(config: RPCConfig): void {
    const existing = this.reconnectIntervals.get(config.name);
    if (existing) {
      clearInterval(existing);
    }

    const interval = setInterval(async () => {
      wsLogger.info({ rpc: config.name }, 'Attempting to reconnect');
      await this.connectToRPC(config);

      if (this.connections.has(config.name)) {
        clearInterval(interval);
        this.reconnectIntervals.delete(config.name);
      }
    }, 5000); // Retry every 5 seconds

    this.reconnectIntervals.set(config.name, interval);
  }

  async getNextPendingTx(): Promise<PendingTx | null> {
    return this.pendingTxQueue.dequeue() || null;
  }

  getBatchOfPendingTxs(count: number): PendingTx[] {
    const batch: PendingTx[] = [];

    for (let i = 0; i < count; i++) {
      const tx = this.pendingTxQueue.dequeue();
      if (!tx) break;
      batch.push(tx);
    }

    return batch;
  }

  getQueueSize(): number {
    return this.pendingTxQueue.size();
  }

  getHealthStatuses(): Map<string, HealthStatus> {
    return new Map(this.healthStatuses);
  }

  getHealthyRPCs(): string[] {
    return Array.from(this.healthStatuses.entries())
      .filter(([_, status]) => status.healthy)
      .map(([name]) => name);
  }

  async close(): Promise<void> {
    wsLogger.info('Closing all Solana RPC connections');

    // Remove all subscriptions
    for (const [rpcName, subscriptionId] of this.subscriptions) {
      const connection = this.connections.get(rpcName);
      if (connection) {
        try {
          await connection.removeAccountChangeListener(subscriptionId);
        } catch (error) {
          wsLogger.error({ rpc: rpcName, error }, 'Error removing subscription');
        }
      }
    }

    this.connections.clear();
    this.subscriptions.clear();

    // Clear reconnect intervals
    for (const interval of this.reconnectIntervals.values()) {
      clearInterval(interval);
    }
    this.reconnectIntervals.clear();

    this.removeAllListeners();
  }
}
