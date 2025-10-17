import dotenv from 'dotenv';
import { ethers } from 'ethers';
import { WebSocketManager } from './monitoring/websocketManager';
import { TxClassifier } from './monitoring/txClassifier';
import { LocalForkManager } from './simulation/localForkManager';
import { BundleSimulator } from './simulation/bundleSimulator';
import { StrategyRegistry } from './strategies/registry';
import { MultiRelaySubmitter, FlashbotsRelayClient, EdenRelayClient } from './submission/multiRelaySubmitter';
import { createMetricsServer, metrics } from './monitoring/metrics';
import { logger } from './utils/logger';
import { RPCConfig } from './types';

// Load environment variables
dotenv.config();

class MEVSearcher {
  private wsManager: WebSocketManager;
  private txClassifier: TxClassifier;
  private forkManager: LocalForkManager;
  private bundleSimulator: BundleSimulator;
  private strategyRegistry: StrategyRegistry;
  private multiRelaySubmitter: MultiRelaySubmitter;
  private isRunning = false;

  constructor() {
    logger.info('Initializing MEV Searcher Bot...');

    // Initialize components
    this.wsManager = new WebSocketManager(
      parseInt(process.env.MAX_PENDING_TX_QUEUE_SIZE || '10000')
    );
    
    this.txClassifier = new TxClassifier(
      parseInt(process.env.MIN_PROFIT_THRESHOLD_USD || '10')
    );
    
    this.forkManager = new LocalForkManager(process.env.ANVIL_FORK_URL);
    
    this.bundleSimulator = new BundleSimulator(
      this.forkManager,
      parseInt(process.env.MAX_CONCURRENT_SIMULATIONS || '10'),
      parseInt(process.env.SIMULATION_TIMEOUT_MS || '5000')
    );
    
    this.strategyRegistry = new StrategyRegistry(
      process.env.SIMULATION_ONLY === 'true'
    );
    
    this.multiRelaySubmitter = new MultiRelaySubmitter();

    logger.info('MEV Searcher Bot initialized');
  }

  async start(): Promise<void> {
    try {
      logger.info('Starting MEV Searcher Bot...');

      // Start metrics server
      const metricsPort = parseInt(process.env.METRICS_PORT || '9090');
      createMetricsServer(metricsPort);

      // Initialize RPC connections
      await this.initializeRPCConnections();

      // Initialize relay clients
      await this.initializeRelayClients();

      // Register strategies
      this.registerStrategies();

      // Start processing loop
      this.isRunning = true;
      this.processingLoop();

      logger.info('MEV Searcher Bot started successfully');
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to start MEV Searcher Bot');
      throw error;
    }
  }

  async stop(): Promise<void> {
    logger.info('Stopping MEV Searcher Bot...');
    this.isRunning = false;

    await this.wsManager.disconnect();
    await this.forkManager.cleanupAll();

    logger.info('MEV Searcher Bot stopped');
  }

  private async initializeRPCConnections(): Promise<void> {
    const rpcConfigs: RPCConfig[] = [
      {
        name: 'alchemy',
        httpUrl: process.env.MAINNET_RPC_URL || '',
        wsUrl: process.env.MAINNET_RPC_WS || '',
        priority: 1,
        maxRetries: 3,
        timeoutMs: 5000,
      },
      {
        name: 'infura',
        httpUrl: process.env.BACKUP_RPC_URL || '',
        wsUrl: process.env.BACKUP_RPC_WS || '',
        priority: 2,
        maxRetries: 3,
        timeoutMs: 5000,
      },
    ];

    await this.wsManager.connectPrimaryRPCs(rpcConfigs.filter(c => c.wsUrl));
    logger.info('RPC connections initialized');
  }

  private async initializeRelayClients(): Promise<void> {
    const flashbotsAuthKey = process.env.FLASHBOTS_AUTH_KEY;
    const edenAuthKey = process.env.FLASHBOTS_AUTH_KEY; // Using same key for demo

    if (flashbotsAuthKey) {
      const flashbotsClient = new FlashbotsRelayClient(flashbotsAuthKey);
      
      // Initialize with provider
      const provider = new ethers.JsonRpcProvider(process.env.MAINNET_RPC_URL);
      await flashbotsClient.initialize(provider);
      
      this.multiRelaySubmitter.addRelay(flashbotsClient);
    }

    if (edenAuthKey) {
      const edenClient = new EdenRelayClient(edenAuthKey);
      this.multiRelaySubmitter.addRelay(edenClient);
    }

    logger.info(
      { relayCount: this.multiRelaySubmitter.getRelays().length },
      'Relay clients initialized'
    );
  }

  private registerStrategies(): void {
    // Import strategies
    const { DexArbitrageStrategy } = require('./strategies/dexArbitrage');
    const { SandwichAttackStrategy } = require('./strategies/sandwichAttack');

    // Register legal strategies
    try {
      const arbitrageStrategy = new DexArbitrageStrategy(
        parseInt(process.env.MIN_PROFIT_THRESHOLD_USD || '10'),
        parseInt(process.env.MAX_GAS_PRICE_GWEI || '300')
      );
      this.strategyRegistry.register(arbitrageStrategy);
      logger.info({ strategy: 'DEX_ARBITRAGE' }, 'Registered legal arbitrage strategy');
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to register arbitrage strategy');
    }

    // Register unethical strategies ONLY in simulation mode for research
    if (process.env.SIMULATION_ONLY === 'true' && process.env.ENABLE_RESEARCH_STRATEGIES === 'true') {
      try {
        const sandwichStrategy = new SandwichAttackStrategy();
        this.strategyRegistry.register(sandwichStrategy);
        logger.warn(
          { strategy: 'SANDWICH_ATTACK' },
          '⚠️  Registered UNETHICAL sandwich strategy for RESEARCH ONLY'
        );
      } catch (error: any) {
        // Expected to fail in production - this is a safety feature
        logger.info('Sandwich attack strategy blocked (production safety)');
      }
    }

    logger.info(
      {
        totalStrategies: this.strategyRegistry.getAllStrategies().length,
        legalStrategies: this.strategyRegistry.getLegalStrategies().length,
      },
      'Strategies registered'
    );
  }

  private async processingLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        // Get next pending transaction
        const tx = this.wsManager.getNextPendingTx();
        
        if (!tx) {
          // No pending transactions, wait a bit
          await this.sleep(100);
          continue;
        }

        // Update queue size metric
        metrics.queueSize.set(this.wsManager.getQueueSize());

        // Classify transaction
        const classified = this.txClassifier.classify(tx);

        // Execute strategies
        const opportunities = await this.strategyRegistry.executeLegalStrategies([classified]);

        // Process opportunities
        for (const opportunity of opportunities) {
          await this.processOpportunity(opportunity);
        }
      } catch (error: any) {
        logger.error({ error: error.message }, 'Error in processing loop');
        await this.sleep(1000); // Back off on error
      }
    }
  }

  private async processOpportunity(opportunity: any): Promise<void> {
    try {
      // Simulate bundle
      const simulationResult = await this.bundleSimulator.simulate(opportunity.bundle);

      if (!simulationResult.success) {
        metrics.simulationFailures.inc({ reason: simulationResult.error || 'unknown' });
        return;
      }

      // Check profitability
      if (!simulationResult.profit || simulationResult.profit.netProfitUSD < parseInt(process.env.MIN_PROFIT_THRESHOLD_USD || '10')) {
        return;
      }

      // Submit bundle (if not in simulation-only mode)
      if (process.env.SIMULATION_ONLY !== 'true') {
        const result = await this.multiRelaySubmitter.submitWithFallback(
          opportunity.bundle,
          opportunity.targetBlock
        );

        if (result.success) {
          metrics.bundlesSubmitted.inc({ relay: result.relay });
          metrics.profitEarned.inc(
            { strategy: opportunity.strategy },
            simulationResult.profit.netProfitUSD
          );
        }
      }

      logger.info(
        {
          strategy: opportunity.strategy,
          profit: simulationResult.profit.netProfitUSD,
          gasUsed: simulationResult.gasUsed?.toString(),
        },
        'Opportunity processed'
      );
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to process opportunity');
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Main execution
async function main(): Promise<void> {
  const searcher = new MEVSearcher();

  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    await searcher.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully...');
    await searcher.stop();
    process.exit(0);
  });

  // Start the searcher
  await searcher.start();
}

// Run if this is the main module
if (require.main === module) {
  main().catch((error) => {
    logger.error({ error: error.message }, 'Fatal error');
    process.exit(1);
  });
}

export { MEVSearcher };
