import { WebSocketManager } from '../../../dist/monitoring/websocketManager';
import { RPCConfig } from '../../../dist/types';

describe('WebSocketManager', () => {
  let wsManager: WebSocketManager;

  beforeEach(() => {
    wsManager = new WebSocketManager(1000);
  });

  afterEach(async () => {
    await wsManager.disconnect();
  });

  describe('constructor', () => {
    test('initializes with correct queue size', () => {
      expect(wsManager.getQueueSize()).toBe(0);
    });
  });

  describe('connectPrimaryRPCs', () => {
    test('attempts to connect to all provided RPCs', async () => {
      const mockConfigs: RPCConfig[] = [
        {
          name: 'test-rpc',
          httpUrl: 'https://test.rpc',
          wsUrl: 'wss://test.rpc',
          priority: 1,
          maxRetries: 3,
          timeoutMs: 5000,
        },
      ];

      // This will fail to connect but should not throw
      await expect(wsManager.connectPrimaryRPCs(mockConfigs)).resolves.not.toThrow();
    });

    test('handles connection failures gracefully', async () => {
      const invalidConfigs: RPCConfig[] = [
        {
          name: 'invalid-rpc',
          httpUrl: 'https://invalid.url',
          wsUrl: 'wss://invalid.url',
          priority: 1,
          maxRetries: 1,
          timeoutMs: 1000,
        },
      ];

      await wsManager.connectPrimaryRPCs(invalidConfigs);
      expect(wsManager.getAllHealthStatuses().size).toBe(0);
    });
  });

  describe('getQueueSize', () => {
    test('returns 0 for empty queue', () => {
      expect(wsManager.getQueueSize()).toBe(0);
    });
  });

  describe('getHealthStatus', () => {
    test('returns undefined for non-existent RPC', () => {
      expect(wsManager.getHealthStatus('non-existent')).toBeUndefined();
    });
  });

  describe('disconnect', () => {
    test('closes all connections', async () => {
      await expect(wsManager.disconnect()).resolves.not.toThrow();
    });
  });
});
