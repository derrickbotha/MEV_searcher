import { HighPerformanceMEVEngine, MEVEngineConfig } from '../../../dist/engine/highPerformanceEngine';

describe('HighPerformanceMEVEngine', () => {
  let engine: HighPerformanceMEVEngine;
  let config: MEVEngineConfig;

  beforeEach(() => {
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

  describe('constructor', () => {
    test('initializes with valid config', () => {
      expect(() => {
        engine = new HighPerformanceMEVEngine(config);
      }).not.toThrow();
    });

    test('throws error if C++ addon cannot be loaded', () => {
      // Mock require to throw error
      const originalRequire = require;
      (global as any).require = jest.fn(() => {
        throw new Error('Module not found');
      });

      expect(() => {
        new HighPerformanceMEVEngine(config);
      }).toThrow('Failed to load C++ MEV engine');

      (global as any).require = originalRequire;
    });
  });

  describe('initialize', () => {
    beforeEach(() => {
      engine = new HighPerformanceMEVEngine(config);
    });

    test('initializes successfully', async () => {
      await expect(engine.initialize()).resolves.not.toThrow();
    });

    test('throws error if already initialized', async () => {
      await engine.initialize();

      await expect(engine.initialize()).rejects.toThrow('Engine already initialized');
    });

    test('sets up event callbacks', async () => {
      const opportunitySpy = jest.fn();
      const bundleSpy = jest.fn();

      engine.on('opportunity', opportunitySpy);
      engine.on('bundle', bundleSpy);

      await engine.initialize();

      // Callbacks should be set up (we can't easily test the native calls)
      expect(opportunitySpy).not.toHaveBeenCalled();
      expect(bundleSpy).not.toHaveBeenCalled();
    });
  });

  describe('processTransaction', () => {
    beforeEach(async () => {
      engine = new HighPerformanceMEVEngine(config);
      await engine.initialize();
    });

    test('throws error if not initialized', () => {
      const uninitializedEngine = new HighPerformanceMEVEngine(config);
      const rawTx = Buffer.from('fake-tx-data');

      expect(() => {
        uninitializedEngine.processTransaction(rawTx);
      }).toThrow('Engine not initialized');
    });

    test('processes valid transaction buffer', () => {
      const rawTx = Buffer.from('fake-rlp-encoded-tx', 'hex');

      // This will call the native method, which may return false for fake data
      const result = engine.processTransaction(rawTx);
      expect(typeof result).toBe('boolean');
    });

    test('handles empty buffer', () => {
      const emptyTx = Buffer.alloc(0);

      const result = engine.processTransaction(emptyTx);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getMetrics', () => {
    beforeEach(async () => {
      engine = new HighPerformanceMEVEngine(config);
      await engine.initialize();
    });

    test('returns metrics object with expected properties', () => {
      const metrics = engine.getMetrics();

      expect(metrics).toHaveProperty('txsProcessed');
      expect(metrics).toHaveProperty('opportunitiesFound');
      expect(metrics).toHaveProperty('bundlesSubmitted');
      expect(metrics).toHaveProperty('totalProfitWei');
      expect(metrics).toHaveProperty('avgParseTimeUs');
      expect(metrics).toHaveProperty('avgFilterTimeUs');
      expect(metrics).toHaveProperty('avgSimulateTimeUs');
      expect(metrics).toHaveProperty('avgOptimizeTimeUs');
      expect(metrics).toHaveProperty('avgBuildTimeUs');
      expect(metrics).toHaveProperty('avgTotalTimeUs');

      // All should be numbers
      Object.values(metrics).forEach(value => {
        expect(typeof value).toBe('number');
      });
    });

    test('throws error if not initialized', () => {
      const uninitializedEngine = new HighPerformanceMEVEngine(config);

      expect(() => {
        uninitializedEngine.getMetrics();
      }).toThrow('Engine not initialized');
    });
  });

  describe('shutdown', () => {
    test('shuts down gracefully when initialized', async () => {
      engine = new HighPerformanceMEVEngine(config);
      await engine.initialize();

      await expect(engine.shutdown()).resolves.not.toThrow();
    });

    test('handles shutdown when not initialized', async () => {
      engine = new HighPerformanceMEVEngine(config);

      await expect(engine.shutdown()).resolves.not.toThrow();
    });
  });

  describe('printPerformanceReport', () => {
    beforeEach(async () => {
      engine = new HighPerformanceMEVEngine(config);
      await engine.initialize();
    });

    test('prints report without throwing', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      expect(() => {
        engine.printPerformanceReport();
      }).not.toThrow();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Event emission', () => {
    beforeEach(async () => {
      engine = new HighPerformanceMEVEngine(config);
      await engine.initialize();
    });

    test('emits opportunity events', (done) => {
      const testOpportunity = {
        frontrunAmount: '1000000000000000000',
        backrunAmount: '2000000000000000000',
        expectedProfit: '500000000000000000',
        validatorTip: 10,
        confidence: 0.85,
      };

      engine.on('opportunity', (opportunity) => {
        expect(opportunity).toEqual(testOpportunity);
        done();
      });

      // Simulate native callback (this would normally come from C++)
      engine.emit('opportunity', testOpportunity);
    });

    test('emits bundle events', (done) => {
      const testBundle = Buffer.from('encoded-bundle-data');

      engine.on('bundle', (bundle) => {
        expect(bundle).toEqual(testBundle);
        done();
      });

      // Simulate native callback
      engine.emit('bundle', testBundle);
    });
  });

  describe('Configuration validation', () => {
    test('accepts valid configuration ranges', () => {
      const validConfigs = [
        { ...config, minProfitWei: '1' },
        { ...config, maxGasPrice: 1 },
        { ...config, maxSlippageBps: 1 },
        { ...config, numThreads: 1 },
      ];

      validConfigs.forEach(validConfig => {
        expect(() => {
          new HighPerformanceMEVEngine(validConfig);
        }).not.toThrow();
      });
    });

    test('handles edge case configurations', () => {
      const edgeConfigs = [
        { ...config, minProfitWei: '0' },
        { ...config, maxGasPrice: 0 },
        { ...config, maxSlippageBps: 0 },
        { ...config, numThreads: 0 },
      ];

      edgeConfigs.forEach(edgeConfig => {
        expect(() => {
          new HighPerformanceMEVEngine(edgeConfig);
        }).not.toThrow();
      });
    });
  });
});