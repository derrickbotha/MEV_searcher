/**
 * Integrated Sub-10ms MEV Engine
 * 
 * Orchestrates all three phases:
 * Phase A: <2ms ingestion
 * Phase B: 2-5ms decision
 * Phase C: <3ms execution
 * 
 * Total target: 7-10ms from transaction detection to bundle submission
 */

import { Connection, Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { FastTransactionStream, FastTransaction } from './FastTransactionStream';
import {
  FastDecisionEngine,
  SandwichParams,
  PoolState,
  OptimalSizing,
} from './FastDecisionEngine';
import { FastBundleSubmitter, FastBundle } from './FastBundleSubmitter';
import { performance } from 'perf_hooks';
import { logger } from '../utils/logger';

interface MEVOpportunity {
  type: 'sandwich' | 'arbitrage';
  phaseALatency: number;
  phaseBLatency: number;
  phaseCLatency: number;
  totalLatency: number;
  expectedProfit: bigint;
  executed: boolean;
}

interface LatencyBreakdown {
  ingestion: number; // ms
  decision: number; // ms
  execution: number; // ms
  total: number; // ms
}

/**
 * Main low-latency MEV engine
 */
export class LowLatencyMEVEngine {
  private connection: Connection;
  private txStream: FastTransactionStream;
  private decisionEngine: FastDecisionEngine;
  private bundleSubmitter: FastBundleSubmitter;
  private searcherKeypair: Keypair;
  private jitoTipAccount: PublicKey;
  
  private isRunning = false;
  private opportunities: MEVOpportunity[] = [];
  private stats = {
    totalOpportunities: 0,
    executedOpportunities: 0,
    totalProfit: 0n,
    avgLatency: 0,
    sub10msCount: 0,
  };

  constructor(
    rpcUrl: string,
    jitoRelayUrls: string[],
    searcherKeypair: Keypair,
    jitoTipAccount: PublicKey
  ) {
    this.connection = new Connection(rpcUrl, { commitment: 'processed' });
    this.searcherKeypair = searcherKeypair;
    this.jitoTipAccount = jitoTipAccount;

    // Initialize all three phases
    this.txStream = new FastTransactionStream(rpcUrl, 10000);
    this.decisionEngine = new FastDecisionEngine();
    this.bundleSubmitter = new FastBundleSubmitter(jitoRelayUrls);

    logger.info('🚀 LowLatencyMEVEngine initialized - Target: <10ms end-to-end');
  }

  /**
   * Start the ultra-low-latency MEV engine
   */
  async start(): Promise<void> {
    this.isRunning = true;

    // Start Phase A: Transaction ingestion
    await this.txStream.start();

    // Start blockhash updater (runs every 100 slots ~40s)
    this.startBlockhashUpdater();

    // Start main processing loop
    this.processingLoop();

    logger.info('✅ Low-latency MEV engine started');
  }

  /**
   * Main processing loop - orchestrates all three phases
   */
  private async processingLoop(): Promise<void> {
    logger.info('🔄 Starting ultra-low-latency processing loop');

    while (this.isRunning) {
      try {
        // Get batch of transactions for better throughput
        const txBatch = this.txStream.getBatch(10);

        if (txBatch.length === 0) {
          // Use setImmediate for non-blocking wait
          await new Promise((resolve) => setImmediate(resolve));
          continue;
        }

        // Process transactions in parallel
        const promises = txBatch.map((tx) => this.processSingleTransaction(tx));
        await Promise.all(promises);
      } catch (error) {
        logger.error({ error }, 'Error in processing loop');
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }

  /**
   * Process single transaction through all three phases
   * Target: <10ms total
   */
  private async processSingleTransaction(fastTx: FastTransaction): Promise<void> {
    const overallStart = performance.now();
    const latency: LatencyBreakdown = {
      ingestion: 0,
      decision: 0,
      execution: 0,
      total: 0,
    };

    try {
      // Phase A latency (already measured during ingestion)
      const phaseAStart = fastTx.ingestTimestamp / 1000; // Convert μs to ms
      const phaseAEnd = performance.now();
      latency.ingestion = phaseAEnd - phaseAStart;

      // Phase B: Decision (Target: 2-5ms)
      const phaseBStart = performance.now();
      
      // Check if this could be a sandwich opportunity
      if (fastTx.isDexSwap && fastTx.estimatedValue > 100_000_000) {
        // This looks like a victim transaction
        const decision = await this.evaluateSandwich(fastTx);
        
        latency.decision = performance.now() - phaseBStart;

        if (decision.shouldExecute && decision.sizing) {
          // Phase C: Execution (Target: <3ms)
          const phaseCStart = performance.now();
          
          await this.executeSandwich(fastTx, decision.sizing, decision.tip);
          
          latency.execution = performance.now() - phaseCStart;

          // Track opportunity
          this.trackOpportunity('sandwich', latency, decision.sizing.expectedProfit, true);
        }
      } else {
        // Check for arbitrage opportunities
        const arbDecision = await this.evaluateArbitrage(fastTx);
        
        latency.decision = performance.now() - phaseBStart;

        if (arbDecision.shouldExecute) {
          const phaseCStart = performance.now();
          
          await this.executeArbitrage(fastTx, arbDecision.profit);
          
          latency.execution = performance.now() - phaseCStart;

          this.trackOpportunity('arbitrage', latency, arbDecision.profit, true);
        }
      }

      latency.total = performance.now() - overallStart;

      // Log if we hit our target
      if (latency.total < 10.0) {
        this.stats.sub10msCount++;
        logger.debug(
          {
            signature: fastTx.signature,
            latency: latency.total.toFixed(3),
            breakdown: {
              ingestion: latency.ingestion.toFixed(3),
              decision: latency.decision.toFixed(3),
              execution: latency.execution.toFixed(3),
            },
          },
          '⚡ Sub-10ms execution achieved'
        );
      } else if (latency.total > 10.0) {
        logger.warn(
          {
            signature: fastTx.signature,
            latency: latency.total.toFixed(3),
            breakdown: latency,
          },
          '⚠️  Exceeded 10ms target'
        );
      }
    } catch (error) {
      logger.error({ error, signature: fastTx.signature }, 'Error processing transaction');
    }
  }

  /**
   * Evaluate sandwich opportunity (Phase B)
   */
  private async evaluateSandwich(victimTx: FastTransaction): Promise<{
    shouldExecute: boolean;
    sizing: OptimalSizing | null;
    tip: bigint;
  }> {
    try {
      // Mock pool state - in production, fetch from cache
      const poolState: PoolState = {
        reserveA: 1000_000_000_000n, // 1000 SOL
        reserveB: 1000_000_000_000n, // 1000 SOL
        feeRate: 30, // 0.3%
        programId: new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'),
      };

      const params: SandwichParams = {
        victimAmount: BigInt(victimTx.estimatedValue),
        victimSlippage: 100, // 1%
        poolState,
      };

      const decision = await this.decisionEngine.decideSandwich(params);

      return {
        shouldExecute: decision.shouldExecute,
        sizing: decision.sizing,
        tip: decision.tip,
      };
    } catch (error) {
      return { shouldExecute: false, sizing: null, tip: 0n };
    }
  }

  /**
   * Evaluate arbitrage opportunity (Phase B)
   */
  private async evaluateArbitrage(tx: FastTransaction): Promise<{
    shouldExecute: boolean;
    profit: bigint;
  }> {
    // Simplified arbitrage logic - in production, compare multiple pools
    return { shouldExecute: false, profit: 0n };
  }

  /**
   * Execute sandwich attack (Phase C)
   */
  private async executeSandwich(
    victimTx: FastTransaction,
    sizing: OptimalSizing,
    tip: bigint
  ): Promise<void> {
    try {
      // Create placeholder swap instructions
      // In production, these would be actual DEX swap instructions
      const frontRunIx = this.createMockSwapInstruction(sizing.frontRunAmount);
      const backRunIx = this.createMockSwapInstruction(sizing.backRunAmount);

      // Build bundle
      const builder = this.bundleSubmitter.getTransactionBuilder();
      
      // For now, we'll create a simplified bundle
      // In production, you'd include the actual victim transaction
      logger.info(
        {
          frontRun: sizing.frontRunAmount.toString(),
          expectedProfit: sizing.expectedProfit.toString(),
          tip: tip.toString(),
        },
        '🎯 Sandwich opportunity detected (simulation mode)'
      );

      // Submit bundle
      // const bundle = builder.buildSandwichBundle(...);
      // const results = await this.bundleSubmitter.submitBundle(bundle, this.searcherKeypair);

    } catch (error) {
      logger.error({ error }, 'Failed to execute sandwich');
    }
  }

  /**
   * Execute arbitrage (Phase C)
   */
  private async executeArbitrage(tx: FastTransaction, profit: bigint): Promise<void> {
    logger.info({ signature: tx.signature, profit: profit.toString() }, 'Arbitrage executed');
  }

  /**
   * Create mock swap instruction (replace with actual DEX instructions)
   */
  private createMockSwapInstruction(amount: bigint): TransactionInstruction {
    return {
      programId: new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'),
      keys: [],
      data: Buffer.from([]),
    };
  }

  /**
   * Track opportunity metrics
   */
  private trackOpportunity(
    type: 'sandwich' | 'arbitrage',
    latency: LatencyBreakdown,
    profit: bigint,
    executed: boolean
  ): void {
    const opportunity: MEVOpportunity = {
      type,
      phaseALatency: latency.ingestion,
      phaseBLatency: latency.decision,
      phaseCLatency: latency.execution,
      totalLatency: latency.total,
      expectedProfit: profit,
      executed,
    };

    this.opportunities.push(opportunity);
    this.stats.totalOpportunities++;

    if (executed) {
      this.stats.executedOpportunities++;
      this.stats.totalProfit += profit;
    }

    this.stats.avgLatency =
      (this.stats.avgLatency * (this.stats.totalOpportunities - 1) + latency.total) /
      this.stats.totalOpportunities;
  }

  /**
   * Background blockhash updater
   */
  private startBlockhashUpdater(): void {
    setInterval(async () => {
      try {
        await this.bundleSubmitter.updateBlockhash(this.connection);
      } catch (error) {
        logger.warn({ error }, 'Failed to update blockhash');
      }
    }, 40000); // Every 40 seconds (~100 slots)
  }

  /**
   * Get comprehensive statistics
   */
  getStats() {
    return {
      engine: {
        totalOpportunities: this.stats.totalOpportunities,
        executedOpportunities: this.stats.executedOpportunities,
        executionRate:
          this.stats.totalOpportunities > 0
            ? (
                (this.stats.executedOpportunities / this.stats.totalOpportunities) *
                100
              ).toFixed(2) + '%'
            : '0%',
        totalProfitSOL: (Number(this.stats.totalProfit) / 1e9).toFixed(6),
        avgLatencyMs: this.stats.avgLatency.toFixed(3),
        sub10msRate:
          this.stats.totalOpportunities > 0
            ? ((this.stats.sub10msCount / this.stats.totalOpportunities) * 100).toFixed(2) + '%'
            : '0%',
      },
      phaseA: this.txStream.getStats(),
      phaseB: this.decisionEngine.getStats(),
      phaseC: this.bundleSubmitter.getStats(),
      recentOpportunities: this.opportunities.slice(-10),
    };
  }

  /**
   * Get latency percentiles
   */
  getLatencyPercentiles() {
    if (this.opportunities.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    const latencies = this.opportunities.map((o) => o.totalLatency).sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];

    return {
      p50: p50?.toFixed(3) || 0,
      p95: p95?.toFixed(3) || 0,
      p99: p99?.toFixed(3) || 0,
    };
  }

  /**
   * Stop the engine
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    await this.txStream.stop();
    logger.info('Low-latency MEV engine stopped');
  }
}

export { MEVOpportunity, LatencyBreakdown };
