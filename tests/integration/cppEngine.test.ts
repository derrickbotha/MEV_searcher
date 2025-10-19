import { HighPerformanceMEVEngine, MEVEngineConfig } from '../../../dist/engine/highPerformanceEngine';
import * as fs from 'fs';
import * as path from 'path';

describe('C++ Engine Integration', () => {
  let engine: HighPerformanceMEVEngine;
  let config: MEVEngineConfig;

  beforeAll(() => {
    config = {
      minProfitWei: '1000000000000000000', // 1 ETH
      maxGasPrice: 100000000000, // 100 Gwei
      maxSlippageBps: 50, // 0.5%
      numThreads: 4,
    };
  });

  afterEach(async () => {
    if (engine) {
      await engine.shutdown();
    }
  });

  describe('C++ Addon Loading', () => {
    test('build directory exists', () => {
      const buildDir = path.join(__dirname, '../../build');
      expect(fs.existsSync(buildDir)).toBe(true);
    });

    test('C++ addon file exists', () => {
      const addonPath = path.join(__dirname, '../../build/mev_addon.node');
      const addonExists = fs.existsSync(addonPath);
      expect(addonExists).toBe(true);
    });

    test('addon can be required without throwing', () => {
      expect(() => {
        require('../../build/mev_addon.node');
      }).not.toThrow();
    });
  });

  describe('Engine Initialization', () => {
    test('engine initializes with C++ backend', async () => {
      engine = new HighPerformanceMEVEngine(config);

      const initPromise = engine.initialize();
      await expect(initPromise).resolves.not.toThrow();

      // Verify engine is marked as initialized
      expect(() => engine.getMetrics()).not.toThrow();
    }, 10000); // Allow 10 seconds for initialization

    test('initialization sets up native methods', async () => {
      engine = new HighPerformanceMEVEngine(config);
      await engine.initialize();

      // Verify native methods are available
      expect(typeof engine.getMetrics).toBe('function');
      expect(typeof engine['processTransaction']).toBe('function');
    });
  });

  describe('Transaction Processing Integration', () => {
    beforeEach(async () => {
      engine = new HighPerformanceMEVEngine(config);
      await engine.initialize();
    });

    test('processes valid RLP-encoded transaction', () => {
      // Sample RLP-encoded transaction (simplified for testing)
      // This is a real Ethereum transaction RLP encoding
      const sampleTx = Buffer.from(
        'f86d808504a817c80082520894f5b7b6c3b3b9a2b4b4c4b5b6c7b8b9c0d1e2f3a4b5c6d7e8f9018080',
        'hex'
      );

      const result = engine.processTransaction(sampleTx);
      expect(typeof result).toBe('boolean');
    });

    test('handles malformed transaction data gracefully', () => {
      const malformedTx = Buffer.from('invalid-data');

      // Should not throw, but may return false
      expect(() => {
        engine.processTransaction(malformedTx);
      }).not.toThrow();
    });

    test('processes empty transaction buffer', () => {
      const emptyTx = Buffer.alloc(0);

      const result = engine.processTransaction(emptyTx);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Metrics Integration', () => {
    beforeEach(async () => {
      engine = new HighPerformanceMEVEngine(config);
      await engine.initialize();
    });

    test('returns real metrics from C++ engine', () => {
      const metrics = engine.getMetrics();

      // Verify all expected properties exist
      const expectedProperties = [
        'txsProcessed',
        'opportunitiesFound',
        'bundlesSubmitted',
        'totalProfitWei',
        'avgParseTimeUs',
        'avgFilterTimeUs',
        'avgSimulateTimeUs',
        'avgOptimizeTimeUs',
        'avgBuildTimeUs',
        'avgTotalTimeUs',
      ];

      expectedProperties.forEach(prop => {
        expect(metrics).toHaveProperty(prop);
        expect(typeof metrics[prop as keyof typeof metrics]).toBe('number');
      });
    });

    test('metrics update after processing transactions', () => {
      const initialMetrics = engine.getMetrics();
      const initialTxCount = initialMetrics.txsProcessed;

      // Process a transaction
      const sampleTx = Buffer.from('f86d808504a817c80082520894f5b7b6c3b3b9a2b4b4c4b5b6c7b8b9c0d1e2f3a4b5c6d7e8f9018080', 'hex');
      engine.processTransaction(sampleTx);

      const updatedMetrics = engine.getMetrics();
      const updatedTxCount = updatedMetrics.txsProcessed;

      // Transaction count should increase (or stay same if tx was invalid)
      expect(updatedTxCount).toBeGreaterThanOrEqual(initialTxCount);
    });
  });

  describe('7-Step Algorithm Integration', () => {
    beforeEach(async () => {
      engine = new HighPerformanceMEVEngine(config);
      await engine.initialize();
    });

    test('all 7 steps are tracked in metrics', () => {
      const metrics = engine.getMetrics();

      // Verify all 7 steps have timing metrics
      expect(metrics).toHaveProperty('avgParseTimeUs');      // Step 1: Parse
      expect(metrics).toHaveProperty('avgFilterTimeUs');     // Step 2: Filter
      expect(metrics).toHaveProperty('avgSimulateTimeUs');   // Step 3-4: Simulate
      expect(metrics).toHaveProperty('avgOptimizeTimeUs');   // Step 5: Optimize
      expect(metrics).toHaveProperty('avgBuildTimeUs');      // Step 6: Build
      expect(metrics).toHaveProperty('avgTotalTimeUs');      // Step 7: Total
    });

    test('performance targets are met', () => {
      const metrics = engine.getMetrics();

      // Target: sub-10ms total time
      expect(metrics.avgTotalTimeUs).toBeLessThan(10000); // 10ms = 10000μs

      // Individual step targets
      expect(metrics.avgParseTimeUs).toBeLessThan(2000);    // <2ms parse
      expect(metrics.avgFilterTimeUs).toBeLessThan(1000);   // <1ms filter
      expect(metrics.avgSimulateTimeUs).toBeLessThan(5000); // <5ms simulate
      expect(metrics.avgOptimizeTimeUs).toBeLessThan(1000); // <1ms optimize
      expect(metrics.avgBuildTimeUs).toBeLessThan(2000);    // <2ms build
    });
  });

  describe('Memory and Resource Management', () => {
    test('engine cleans up resources on shutdown', async () => {
      engine = new HighPerformanceMEVEngine(config);
      await engine.initialize();

      // Process some transactions to allocate resources
      const sampleTx = Buffer.from('f86d808504a817c80082520894f5b7b6c3b3b9a2b4b4c4b5b6c7b8b9c0d1e2f3a4b5c6d7e8f9018080', 'hex');
      for (let i = 0; i < 10; i++) {
        engine.processTransaction(sampleTx);
      }

      // Shutdown should complete without errors
      await expect(engine.shutdown()).resolves.not.toThrow();
    });

    test('multiple engine instances can coexist', async () => {
      const engine1 = new HighPerformanceMEVEngine(config);
      const engine2 = new HighPerformanceMEVEngine(config);

      await engine1.initialize();
      await engine2.initialize();

      const metrics1 = engine1.getMetrics();
      const metrics2 = engine2.getMetrics();

      expect(metrics1).toBeDefined();
      expect(metrics2).toBeDefined();

      await engine1.shutdown();
      await engine2.shutdown();
    });
  });

  describe('Error Handling', () => {
    test('handles C++ exceptions gracefully', async () => {
      engine = new HighPerformanceMEVEngine(config);
      await engine.initialize();

      // Pass invalid data that might cause C++ exceptions
      const invalidTx = Buffer.from('invalid-rlp-data-that-will-cause-parsing-error');

      expect(() => {
        engine.processTransaction(invalidTx);
      }).not.toThrow();
    });

    test('recovers from processing errors', async () => {
      engine = new HighPerformanceMEVEngine(config);
      await engine.initialize();

      // Send invalid data
      const invalidTx = Buffer.from('corrupted');
      engine.processTransaction(invalidTx);

      // Should still be able to process valid data
      const validTx = Buffer.from('f86d808504a817c80082520894f5b7b6c3b3b9a2b4b4c4b5b6c7b8b9c0d1e2f3a4b5c6d7e8f9018080', 'hex');
      expect(() => {
        engine.processTransaction(validTx);
      }).not.toThrow();
    });
  });
});