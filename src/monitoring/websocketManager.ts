import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { PendingTx, RPCConfig, HealthStatus } from '../types';
import { PriorityQueue } from '../utils/priorityQueue';
import { wsLogger } from '../utils/logger';

interface SubscriptionMessage {
  id: number;
  method: string;
  params: any[];
}

export class WebSocketManager extends EventEmitter {
  private subscriptions: Map<string, WebSocket> = new Map();
  private pendingTxQueue: PriorityQueue<PendingTx>;
  private reconnectIntervals: Map<string, NodeJS.Timeout> = new Map();
  private healthStatuses: Map<string, HealthStatus> = new Map();
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private maxQueueSize: number;

  constructor(maxQueueSize = 10000) {
    super();
    this.maxQueueSize = maxQueueSize;
    this.pendingTxQueue = new PriorityQueue<PendingTx>(
      (a, b) => a.gasPrice > b.gasPrice // Higher gas price = higher priority
    );
  }

  async connectPrimaryRPCs(rpcConfigs: RPCConfig[]): Promise<void> {
    const connections = rpcConfigs.map((config) => this.connectToRPC(config));
    await Promise.allSettled(connections);

    wsLogger.info(
      { connectedRPCs: this.subscriptions.size, totalConfigs: rpcConfigs.length },
      'RPC connections established'
    );
  }

  private async connectToRPC(config: RPCConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(config.wsUrl, {
          handshakeTimeout: config.timeoutMs,
        });

        ws.on('open', async () => {
          wsLogger.info({ rpc: config.name }, 'WebSocket connected');
          this.subscriptions.set(config.name, ws);
          this.healthStatuses.set(config.name, {
            healthy: true,
            lastChecked: Date.now(),
            errorCount: 0,
          });

          // Subscribe to pending transactions
          await this.subscribeToPendingTxs(ws, config.name);
          resolve();
        });

        ws.on('message', (data: WebSocket.RawData) => {
          this.handleMessage(config.name, data);
        });

        ws.on('error', (error) => {
          wsLogger.error({ rpc: config.name, error }, 'WebSocket error');
          this.updateHealthStatus(config.name, false);
        });

        ws.on('close', () => {
          wsLogger.warn({ rpc: config.name }, 'WebSocket closed');
          this.subscriptions.delete(config.name);
          this.scheduleReconnect(config);
        });

        // Timeout handling
        setTimeout(() => {
          if (!this.subscriptions.has(config.name)) {
            reject(new Error(`Connection timeout for ${config.name}`));
          }
        }, config.timeoutMs);
      } catch (error) {
        wsLogger.error({ rpc: config.name, error }, 'Failed to connect');
        reject(error);
      }
    });
  }

  private async subscribeToPendingTxs(ws: WebSocket, rpcName: string): Promise<void> {
    const subscriptionRequest: SubscriptionMessage = {
      id: 1,
      method: 'eth_subscribe',
      params: ['newPendingTransactions'],
    };

    ws.send(JSON.stringify(subscriptionRequest));
    wsLogger.debug({ rpc: rpcName }, 'Subscribed to pending transactions');
  }

  private handleMessage(rpcName: string, data: WebSocket.RawData): void {
    try {
      const message = JSON.parse(data.toString());

      // Handle subscription confirmation
      if (message.id === 1 && message.result) {
        wsLogger.info({ rpc: rpcName, subscriptionId: message.result }, 'Subscription confirmed');
        return;
      }

      // Handle pending transaction notifications
      if (message.method === 'eth_subscription' && message.params) {
        const txHash = message.params.result;
        this.emit('pendingTx', { hash: txHash, rpc: rpcName });
      }
    } catch (error) {
      wsLogger.error({ rpc: rpcName, error }, 'Failed to parse message');
    }
  }

  private handlePendingTx(tx: PendingTx): void {
    if (this.isHighValueTx(tx)) {
      if (this.pendingTxQueue.size() >= this.maxQueueSize) {
        // Remove lowest priority tx if queue is full
        wsLogger.warn('Pending tx queue full, dropping oldest transaction');
        this.pendingTxQueue.dequeue();
      }

      const priority = this.calculatePriority(tx);
      this.pendingTxQueue.enqueue(tx, priority);
      this.emit('highValueTx', tx);

      wsLogger.debug(
        {
          hash: tx.hash,
          gasPrice: tx.gasPrice.toString(),
          priority,
          queueSize: this.pendingTxQueue.size(),
        },
        'High-value tx enqueued'
      );
    }
  }

  private isHighValueTx(tx: PendingTx): boolean {
    const minGasPrice = BigInt(10) * BigInt(1e9); // 10 Gwei
    const minValue = BigInt(1e17); // 0.1 ETH

    return tx.gasPrice >= minGasPrice || tx.value >= minValue;
  }

  private calculatePriority(tx: PendingTx): number {
    // Priority = gasPrice (in Gwei) + value bonus
    const gasPriceGwei = Number(tx.gasPrice) / 1e9;
    const valueEth = Number(tx.value) / 1e18;
    return gasPriceGwei + valueEth * 100;
  }

  private updateHealthStatus(rpcName: string, healthy: boolean): void {
    const current = this.healthStatuses.get(rpcName);
    if (current) {
      this.healthStatuses.set(rpcName, {
        healthy,
        lastChecked: Date.now(),
        errorCount: healthy ? 0 : current.errorCount + 1,
      });
    }
  }

  private scheduleReconnect(config: RPCConfig): void {
    if (this.reconnectIntervals.has(config.name)) {
      return;
    }

    wsLogger.info({ rpc: config.name }, 'Scheduling reconnection');

    const interval = setInterval(async () => {
      try {
        await this.connectToRPC(config);
        clearInterval(interval);
        this.reconnectIntervals.delete(config.name);
      } catch (error) {
        wsLogger.error({ rpc: config.name, error }, 'Reconnection failed');
      }
    }, 5000); // Retry every 5 seconds

    this.reconnectIntervals.set(config.name, interval);
  }

  async failoverToBackup(config: RPCConfig): Promise<void> {
    wsLogger.warn({ rpc: config.name }, 'Initiating failover to backup');
    this.emit('failover', config.name);
    // Backup connection logic would be implemented here
  }

  getNextPendingTx(): PendingTx | undefined {
    return this.pendingTxQueue.dequeue();
  }

  getQueueSize(): number {
    return this.pendingTxQueue.size();
  }

  getHealthStatus(rpcName: string): HealthStatus | undefined {
    return this.healthStatuses.get(rpcName);
  }

  getAllHealthStatuses(): Map<string, HealthStatus> {
    return new Map(this.healthStatuses);
  }

  async disconnect(): Promise<void> {
    // Clear reconnect intervals
    this.reconnectIntervals.forEach((interval) => clearInterval(interval));
    this.reconnectIntervals.clear();

    // Close all WebSocket connections
    const closePromises = Array.from(this.subscriptions.values()).map(
      (ws) =>
        new Promise<void>((resolve) => {
          ws.close();
          ws.once('close', () => resolve());
        })
    );

    await Promise.all(closePromises);
    this.subscriptions.clear();
    wsLogger.info('All WebSocket connections closed');
  }
}
