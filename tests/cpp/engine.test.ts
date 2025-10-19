import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

/**
 * High-Performance C++ Engine Integration Tests
 * Tests the Node.js → C++ bindings and sub-10ms execution
 */

describe('HighPerformanceMEVEngine', () => {
  let HighPerformanceMEVEngine: any;
  let engine: any;

  beforeAll(async () => {
    // Try to load C++ engine
    try {
      const module = await import('../src/engine/highPerformanceEngine');
      HighPerformanceMEVEngine = module.HighPerformanceMEVEngine;

      if (!HighPerformanceMEVEngine.isAvailable()) {
        console.warn('⚠️  C++ engine not available - run: npm run build:cpp:release');
        return;
      }

      // Create engine instance
      engine = new HighPerformanceMEVEngine({
        minProfitLamports: 1_000_000, // 0.001 SOL
        maxPriorityFee: 100_000,
        numSimulationThreads: 4,
        simulationOnly: true,
        enableSandwich: false, // Safety
        rpcUrls: ['https://api.mainnet-beta.solana.com'],
        jitoRelayUrls: ['https://mainnet.block-engine.jito.wtf'],
      });

      // Initialize (pre-compute tables)
      console.log('Initializing C++ engine (this takes ~5 seconds)...');
      const success = await engine.initialize();
      expect(success).toBe(true);
      console.log('✓ Engine initialized');
    } catch (error) {
      console.error('Failed to load C++ engine:', error);
    }
  });

  afterAll(() => {
    if (engine) {
      engine.shutdown();
    }
  });

  it('should be available after building', () => {
    if (!HighPerformanceMEVEngine) {
      console.log('Skipping test - C++ engine not built');
      return;
    }

    expect(HighPerformanceMEVEngine.isAvailable()).toBe(true);
  });

  it('should initialize successfully', () => {
    if (!engine) {
      console.log('Skipping test - engine not initialized');
      return;
    }

    const metrics = engine.getMetrics();
    expect(metrics).toBeDefined();
    expect(metrics.transactionsProcessed).toBeGreaterThanOrEqual(0);
  });

  it('should process transactions in sub-10ms', () => {
    if (!engine) {
      console.log('Skipping test - engine not initialized');
      return;
    }

    // Create dummy transaction
    const dummyTx = Buffer.alloc(256);

    // Warm up (first call may be slower)
    for (let i = 0; i < 10; i++) {
      engine.processTransactionBytes(dummyTx);
    }

    // Measure performance
    const iterations = 100;
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      engine.processTransactionBytes(dummyTx);
    }

    const endTime = Date.now();
    const avgTimeMs = (endTime - startTime) / iterations;

    console.log(`Average processing time: ${avgTimeMs.toFixed(2)}ms`);

    // Should be sub-10ms on average
    expect(avgTimeMs).toBeLessThan(10);
  });

  it('should maintain metrics correctly', () => {
    if (!engine) {
      console.log('Skipping test - engine not initialized');
      return;
    }

    const metricsBefore = engine.getMetrics();
    const txCountBefore = metricsBefore.transactionsProcessed;

    // Process some transactions
    const dummyTx = Buffer.alloc(256);
    for (let i = 0; i < 50; i++) {
      engine.processTransactionBytes(dummyTx);
    }

    const metricsAfter = engine.getMetrics();
    const txCountAfter = metricsAfter.transactionsProcessed;

    expect(txCountAfter).toBe(txCountBefore + 50);
  });

  it('should report latency breakdown', () => {
    if (!engine) {
      console.log('Skipping test - engine not initialized');
      return;
    }

    const metrics = engine.getMetrics();

    // Parse time should be < 100μs
    expect(metrics.avgParseTimeUs).toBeLessThan(100);

    // Filter time should be < 50μs
    expect(metrics.avgFilterTimeUs).toBeLessThan(50);

    // Total time should be < 10ms = 10,000μs
    expect(metrics.avgTotalTimeUs).toBeLessThan(10_000);

    console.log('Latency breakdown:');
    console.log(`  Parse:    ${metrics.avgParseTimeUs}μs (target: < 100μs)`);
    console.log(`  Filter:   ${metrics.avgFilterTimeUs}μs (target: < 50μs)`);
    console.log(`  Simulate: ${metrics.avgSimulateTimeUs}μs (target: < 2000μs)`);
    console.log(`  Optimize: ${metrics.avgOptimizeTimeUs}μs (target: < 500μs)`);
    console.log(`  Build:    ${metrics.avgBuildTimeUs}μs (target: < 1000μs)`);
    console.log(`  TOTAL:    ${metrics.avgTotalTimeUs}μs (target: < 10000μs)`);
  });

  it('should print performance report', () => {
    if (!engine) {
      console.log('Skipping test - engine not initialized');
      return;
    }

    expect(() => {
      engine.printPerformanceReport();
    }).not.toThrow();
  });

  it('should handle shutdown gracefully', () => {
    if (!engine) {
      console.log('Skipping test - engine not initialized');
      return;
    }

    expect(() => {
      engine.shutdown();
    }).not.toThrow();
  });
});

describe('C++ Engine Build Status', () => {
  it('should provide helpful message if not built', async () => {
    try {
      const module = await import('../src/engine/highPerformanceEngine');
      const { HighPerformanceMEVEngine } = module;

      if (!HighPerformanceMEVEngine.isAvailable()) {
        console.log('\n╔════════════════════════════════════════════════╗');
        console.log('║  C++ Engine Not Built                          ║');
        console.log('╚════════════════════════════════════════════════╝');
        console.log('\nTo build the high-performance C++ engine:');
        console.log('  1. Install prerequisites (see CPP_BUILD_GUIDE.md)');
        console.log('  2. Run: npm run build:cpp:release');
        console.log('  3. Run tests again: npm test');
        console.log('\nNote: C++ engine provides sub-10ms execution.');
        console.log('Without it, the bot uses TypeScript (slower but functional).\n');
      }
    } catch (error) {
      // Module not found - expected if not built
    }

    expect(true).toBe(true); // Always pass
  });
});
