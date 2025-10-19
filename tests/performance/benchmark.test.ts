import { HighPerformanceMEVEngine, MEVEngineConfig } from '../../src/engine/highPerformanceEngine';

describe('Performance Benchmarks', () => {
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

  beforeEach(async () => {
    engine = new HighPerformanceMEVEngine(config);
    await engine.initialize();
  }, 15000); // Allow 15 seconds for initialization

  afterEach(async () => {
    if (engine) {
      await engine.shutdown();
    }
  });

  describe('7-Step Algorithm Performance', () => {
    test('meets sub-10ms target for single transaction', () => {
      const sampleTx = Buffer.from(
        'f86d808504a817c80082520894f5b7b6c3b3b9a2b4b4c4b5b6c7b8b9c0d1e2f3a4b5c6d7e8f9018080',
        'hex'
      );

      const startTime = process.hrtime.bigint();
      engine.processTransaction(sampleTx);
      const endTime = process.hrtime.bigint();

      const durationUs = Number(endTime - startTime) / 1000; // Convert to microseconds

      console.log(`Single transaction processing time: ${durationUs.toFixed(2)} μs`);

      // Target: sub-10ms (10000 μs)
      expect(durationUs).toBeLessThan(10000);
    });

    test('averages sub-10ms over 100 transactions', () => {
      const sampleTx = Buffer.from(
        'f86d808504a817c80082520894f5b7b6c3b3b9a2b4b4c4b5b6c7b8b9c0d1e2f3a4b5c6d7e8f9018080',
        'hex'
      );

      const iterations = 100;
      const startTime = process.hrtime.bigint();

      for (let i = 0; i < iterations; i++) {
        engine.processTransaction(sampleTx);
      }

      const endTime = process.hrtime.bigint();
      const totalDurationUs = Number(endTime - startTime) / 1000;
      const avgDurationUs = totalDurationUs / iterations;

      console.log(`Average processing time over ${iterations} transactions: ${avgDurationUs.toFixed(2)} μs`);

      // Target: sub-10ms average
      expect(avgDurationUs).toBeLessThan(10000);
    });

    test('individual step timings meet targets', () => {
      // Process enough transactions to get meaningful metrics
      const sampleTx = Buffer.from(
        'f86d808504a817c80082520894f5b7b6c3b3b9a2b4b4c4b5b6c7b8b9c0d1e2f3a4b5c6d7e8f9018080',
        'hex'
      );

      for (let i = 0; i < 50; i++) {
        engine.processTransaction(sampleTx);
      }

      const metrics = engine.getMetrics();

      console.log('\n7-Step Algorithm Performance:');
      console.log(`  Step 1 (Parse):     ${metrics.avgParseTimeUs.toFixed(2)} μs (target: <2000)`);
      console.log(`  Step 2 (Filter):    ${metrics.avgFilterTimeUs.toFixed(2)} μs (target: <1000)`);
      console.log(`  Step 3-4 (Simulate): ${metrics.avgSimulateTimeUs.toFixed(2)} μs (target: <5000)`);
      console.log(`  Step 5 (Optimize):  ${metrics.avgOptimizeTimeUs.toFixed(2)} μs (target: <1000)`);
      console.log(`  Step 6 (Build):     ${metrics.avgBuildTimeUs.toFixed(2)} μs (target: <2000)`);
      console.log(`  Total:              ${metrics.avgTotalTimeUs.toFixed(2)} μs (target: <10000)`);

      // Individual step targets
      expect(metrics.avgParseTimeUs).toBeLessThan(2000);    // <2ms parse
      expect(metrics.avgFilterTimeUs).toBeLessThan(1000);   // <1ms filter
      expect(metrics.avgSimulateTimeUs).toBeLessThan(5000); // <5ms simulate
      expect(metrics.avgOptimizeTimeUs).toBeLessThan(1000); // <1ms optimize
      expect(metrics.avgBuildTimeUs).toBeLessThan(2000);    // <2ms build

      // Overall target
      expect(metrics.avgTotalTimeUs).toBeLessThan(10000);   // <10ms total
    });
  });

  describe('Throughput Performance', () => {
    test('handles high transaction volume', () => {
      const sampleTx = Buffer.from(
        'f86d808504a817c80082520894f5b7b6c3b3b9a2b4b4c4b5b6c7b8b9c0d1e2f3a4b5c6d7e8f9018080',
        'hex'
      );

      const iterations = 1000;
      const startTime = process.hrtime.bigint();

      for (let i = 0; i < iterations; i++) {
        engine.processTransaction(sampleTx);
      }

      const endTime = process.hrtime.bigint();
      const totalDurationMs = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      const throughput = iterations / (totalDurationMs / 1000); // transactions per second

      console.log(`\nThroughput Test (${iterations} transactions):`);
      console.log(`  Total time: ${totalDurationMs.toFixed(2)} ms`);
      console.log(`  Throughput: ${throughput.toFixed(0)} tx/s`);

      // Should handle at least 100 tx/s
      expect(throughput).toBeGreaterThan(100);
    });

    test('maintains performance under load', () => {
      const sampleTx = Buffer.from(
        'f86d808504a817c80082520894f5b7b6c3b3b9a2b4b4c4b5b6c7b8b9c0d1e2f3a4b5c6d7e8f9018080',
        'hex'
      );

      const iterations = 500;
      const timings: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = process.hrtime.bigint();
        engine.processTransaction(sampleTx);
        const endTime = process.hrtime.bigint();
        const durationUs = Number(endTime - startTime) / 1000;
        timings.push(durationUs);
      }

      const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
      const maxTime = Math.max(...timings);
      const minTime = Math.min(...timings);
      const p95Time = timings.sort((a, b) => a - b)[Math.floor(timings.length * 0.95)];

      console.log(`\nLoad Test Performance (${iterations} transactions):`);
      console.log(`  Average: ${avgTime.toFixed(2)} μs`);
      console.log(`  Min:     ${minTime.toFixed(2)} μs`);
      console.log(`  Max:     ${maxTime.toFixed(2)} μs`);
      console.log(`  P95:     ${p95Time.toFixed(2)} μs`);

      // Performance should be consistent
      expect(avgTime).toBeLessThan(10000);
      expect(p95Time).toBeLessThan(15000); // Allow some variance for 95th percentile
    });
  });

  describe('Memory Performance', () => {
    test('memory usage remains stable', () => {
      const sampleTx = Buffer.from(
        'f86d808504a817c80082520894f5b7b6c3b3b9a2b4b4c4b5b6c7b8b9c0d1e2f3a4b5c6d7e8f9018080',
        'hex'
      );

      const initialMemory = process.memoryUsage();
      console.log(`\nInitial memory usage: ${Math.round(initialMemory.heapUsed / 1024 / 1024)} MB`);

      // Process many transactions
      for (let i = 0; i < 1000; i++) {
        engine.processTransaction(sampleTx);
      }

      const finalMemory = process.memoryUsage();
      console.log(`Final memory usage: ${Math.round(finalMemory.heapUsed / 1024 / 1024)} MB`);

      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)} MB`);

      // Memory increase should be reasonable (< 50MB for 1000 transactions)
      expect(memoryIncreaseMB).toBeLessThan(50);
    });
  });

  describe('Concurrent Performance', () => {
    test('handles concurrent transaction processing', async () => {
      const sampleTx = Buffer.from(
        'f86d808504a817c80082520894f5b7b6c3b3b9a2b4b4c4b5b6c7b8b9c0d1e2f3a4b5c6d7e8f9018080',
        'hex'
      );

      const numConcurrent = 10;
      const txsPerWorker = 50;

      const worker = async (workerId: number) => {
        const startTime = process.hrtime.bigint();
        for (let i = 0; i < txsPerWorker; i++) {
          engine.processTransaction(sampleTx);
        }
        const endTime = process.hrtime.bigint();
        const durationMs = Number(endTime - startTime) / 1000000;
        return { workerId, durationMs, throughput: txsPerWorker / (durationMs / 1000) };
      };

      const startTime = process.hrtime.bigint();
      const promises = Array.from({ length: numConcurrent }, (_, i) => worker(i));
      const results = await Promise.all(promises);
      const endTime = process.hrtime.bigint();

      const totalDurationMs = Number(endTime - startTime) / 1000000;
      const totalTxs = numConcurrent * txsPerWorker;
      const totalThroughput = totalTxs / (totalDurationMs / 1000);

      console.log(`\nConcurrent Performance (${numConcurrent} workers, ${txsPerWorker} txs each):`);
      console.log(`  Total transactions: ${totalTxs}`);
      console.log(`  Total time: ${totalDurationMs.toFixed(2)} ms`);
      console.log(`  Total throughput: ${totalThroughput.toFixed(0)} tx/s`);

      results.forEach(result => {
        console.log(`  Worker ${result.workerId}: ${result.throughput.toFixed(0)} tx/s`);
      });

      // Should maintain good throughput under concurrency
      expect(totalThroughput).toBeGreaterThan(200);
    });
  });

  describe('Benchmark Comparison', () => {
    test('performance meets or exceeds benchmarks', () => {
      // Process transactions to get metrics
      const sampleTx = Buffer.from(
        'f86d808504a817c80082520894f5b7b6c3b3b9a2b4b4c4b5b6c7b8b9c0d1e2f3a4b5c6d7e8f9018080',
        'hex'
      );

      for (let i = 0; i < 100; i++) {
        engine.processTransaction(sampleTx);
      }

      const metrics = engine.getMetrics();

      // Expected performance targets based on design
      const targets = {
        avgTotalTimeUs: 10000,     // 10ms target
        avgParseTimeUs: 2000,      // 2ms target
        avgFilterTimeUs: 1000,     // 1ms target
        avgSimulateTimeUs: 5000,   // 5ms target
        avgOptimizeTimeUs: 1000,   // 1ms target
        avgBuildTimeUs: 2000,      // 2ms target
      };

      console.log('\nBenchmark Comparison:');
      Object.entries(targets).forEach(([metric, target]) => {
        const actual = metrics[metric as keyof typeof metrics] as number;
        const status = actual <= target ? '✓' : '✗';
        console.log(`  ${metric}: ${actual.toFixed(2)} μs / ${target} μs ${status}`);
      });

      // All targets should be met
      expect(metrics.avgTotalTimeUs).toBeLessThanOrEqual(targets.avgTotalTimeUs);
      expect(metrics.avgParseTimeUs).toBeLessThanOrEqual(targets.avgParseTimeUs);
      expect(metrics.avgFilterTimeUs).toBeLessThanOrEqual(targets.avgFilterTimeUs);
      expect(metrics.avgSimulateTimeUs).toBeLessThanOrEqual(targets.avgSimulateTimeUs);
      expect(metrics.avgOptimizeTimeUs).toBeLessThanOrEqual(targets.avgOptimizeTimeUs);
      expect(metrics.avgBuildTimeUs).toBeLessThanOrEqual(targets.avgBuildTimeUs);
    });
  });
});