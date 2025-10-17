import { Counter, Gauge, Histogram, Registry } from 'prom-client';
import express from 'express';
import { metricsLogger } from '../utils/logger';

export class MetricsRegistry {
  private registry: Registry;

  // Latency metrics
  public bundleSubmissionLatency: Histogram<string>;
  public rpcLatency: Histogram<string>;
  public simulationLatency: Histogram<string>;

  // Success rate metrics
  public simulationSuccessRate: Gauge<string>;
  public bundleInclusionRate: Gauge<string>;

  // Counters
  public bundlesSubmitted: Counter<string>;
  public bundlesIncluded: Counter<string>;
  public simulationFailures: Counter<string>;
  public failedGasBurn: Counter<string>;
  public opportunitiesDetected: Counter<string>;
  public profitEarned: Counter<string>;

  // Gauges
  public queueSize: Gauge<string>;
  public activeForks: Gauge<string>;
  public healthyRPCs: Gauge<string>;

  constructor() {
    this.registry = new Registry();

    // Initialize latency histograms
    this.bundleSubmissionLatency = new Histogram({
      name: 'bundle_submission_latency_ms',
      help: 'Bundle submission latency in milliseconds',
      labelNames: ['relay'],
      buckets: [10, 25, 50, 75, 100, 150, 200, 300, 500],
      registers: [this.registry],
    });

    this.rpcLatency = new Histogram({
      name: 'rpc_request_latency_ms',
      help: 'RPC request latency in milliseconds',
      labelNames: ['method', 'provider'],
      buckets: [5, 10, 25, 50, 100, 200, 500],
      registers: [this.registry],
    });

    this.simulationLatency = new Histogram({
      name: 'simulation_latency_ms',
      help: 'Bundle simulation latency in milliseconds',
      buckets: [50, 100, 200, 500, 1000, 2000, 5000],
      registers: [this.registry],
    });

    // Initialize gauges
    this.simulationSuccessRate = new Gauge({
      name: 'simulation_success_rate',
      help: 'Simulation success rate (0-1)',
      registers: [this.registry],
    });

    this.bundleInclusionRate = new Gauge({
      name: 'bundle_inclusion_rate',
      help: 'Bundle inclusion rate (0-1)',
      registers: [this.registry],
    });

    this.queueSize = new Gauge({
      name: 'pending_tx_queue_size',
      help: 'Current size of pending transaction queue',
      registers: [this.registry],
    });

    this.activeForks = new Gauge({
      name: 'active_forks_count',
      help: 'Number of active Anvil forks',
      registers: [this.registry],
    });

    this.healthyRPCs = new Gauge({
      name: 'healthy_rpcs_count',
      help: 'Number of healthy RPC connections',
      registers: [this.registry],
    });

    // Initialize counters
    this.bundlesSubmitted = new Counter({
      name: 'bundles_submitted_total',
      help: 'Total number of bundles submitted',
      labelNames: ['relay'],
      registers: [this.registry],
    });

    this.bundlesIncluded = new Counter({
      name: 'bundles_included_total',
      help: 'Total number of bundles included',
      labelNames: ['relay'],
      registers: [this.registry],
    });

    this.simulationFailures = new Counter({
      name: 'simulation_failures_total',
      help: 'Total number of simulation failures',
      labelNames: ['reason'],
      registers: [this.registry],
    });

    this.failedGasBurn = new Counter({
      name: 'failed_gas_burn_wei',
      help: 'Total gas burned on failed transactions (in wei)',
      registers: [this.registry],
    });

    this.opportunitiesDetected = new Counter({
      name: 'opportunities_detected_total',
      help: 'Total number of opportunities detected',
      labelNames: ['strategy'],
      registers: [this.registry],
    });

    this.profitEarned = new Counter({
      name: 'profit_earned_usd',
      help: 'Total profit earned in USD',
      labelNames: ['strategy'],
      registers: [this.registry],
    });

    metricsLogger.info('Metrics registry initialized');
  }

  getRegistry(): Registry {
    return this.registry;
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  // Helper method to time async operations
  async timeAsync<T>(
    histogram: Histogram<string>,
    labels: Record<string, string | number>,
    fn: () => Promise<T>
  ): Promise<T> {
    const end = histogram.startTimer(labels);
    try {
      return await fn();
    } finally {
      end();
    }
  }
}

// Singleton instance
export const metrics = new MetricsRegistry();

// Express middleware for metrics endpoint
export function createMetricsServer(port: number): express.Application {
  const app = express();

  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', metrics.getRegistry().contentType);
      const metricsData = await metrics.getMetrics();
      res.send(metricsData);
    } catch (error: any) {
      metricsLogger.error({ error: error.message }, 'Failed to generate metrics');
      res.status(500).send('Error generating metrics');
    }
  });

  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  app.listen(port, () => {
    metricsLogger.info({ port }, 'Metrics server started');
  });

  return app;
}
