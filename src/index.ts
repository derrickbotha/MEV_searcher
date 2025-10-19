import dotenv from 'dotenv';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { WebSocketManager } from './monitoring/websocketManager';
import { TxClassifier } from './monitoring/txClassifier';
import { LocalForkManager } from './simulation/localForkManager';
import { BundleSimulator } from './simulation/bundleSimulator';
import { StrategyRegistry } from './strategies/registry';
import { MultiRelaySubmitter } from './submission/multiRelaySubmitter';
import { createMetricsServer, metrics } from './monitoring/metrics';
import { logger } from './utils/logger';
import bs58 from 'bs58';

dotenv.config();

class MEVSearcher {
  private wsManager: WebSocketManager;
  private txClassifier: TxClassifier;
  private forkManager: LocalForkManager;
  private bundleSimulator: BundleSimulator;
  private strategyRegistry: StrategyRegistry;
  private multiRelaySubmitter: MultiRelaySubmitter;
  private connection: Connection;
  private searcherKeypair: Keypair;
  private isRunning = false;

  constructor() {
    logger.info('Initializing Solana MEV Searcher Bot...');
    this.searcherKeypair = this.loadSearcherKeypair();
    logger.info({ pubkey: this.searcherKeypair.publicKey.toBase58() }, 'Keypair loaded');
    
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    this.connection = new Connection(rpcUrl, { commitment: 'confirmed' });
    
    this.wsManager = new WebSocketManager([rpcUrl], parseInt(process.env.MAX_PENDING_TX_QUEUE_SIZE || '10000'));
    this.txClassifier = new TxClassifier(parseInt(process.env.MIN_PROFIT_THRESHOLD_USD || '10'));
    this.forkManager = new LocalForkManager(this.getForkRpcUrls());
    this.bundleSimulator = new BundleSimulator(this.forkManager, 10, 5000);
    this.strategyRegistry = new StrategyRegistry(process.env.SIMULATION_ONLY === 'true');
    this.multiRelaySubmitter = new MultiRelaySubmitter(this.getJitoRelayUrls(), this.searcherKeypair);
    
    logger.info('MEV Searcher Bot initialized');
  }

  async start(): Promise<void> {
    logger.info('Starting...');
    const metricsPort = parseInt(process.env.METRICS_PORT || '9090');
    createMetricsServer(metricsPort);
    await this.verifyConnection();
    await this.initializeAccountSubscriptions();
    this.registerStrategies();
    await this.verifyJitoTipAccount();
    this.isRunning = true;
    this.processingLoop();
    logger.info('Started successfully');
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    await this.wsManager.disconnect();
    await this.forkManager.cleanupAll();
  }

  private loadSearcherKeypair(): Keypair {
    const pk = process.env.SEARCHER_PRIVATE_KEY;
    if (!pk) throw new Error('SEARCHER_PRIVATE_KEY required');
    const secretKey = pk.startsWith('[') ? Uint8Array.from(JSON.parse(pk)) : bs58.decode(pk);
    return Keypair.fromSecretKey(secretKey);
  }

  private getForkRpcUrls(): string[] {
    return process.env.FORK_RPC_URLS?.split(',').map(u => u.trim()) || [
      process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    ];
  }

  private getJitoRelayUrls(): string[] {
    return process.env.JITO_RELAY_URLS?.split(',').map(u => u.trim()) || [
      'https://mainnet.block-engine.jito.wtf',
    ];
  }

  private async verifyConnection(): Promise<void> {
    const slot = await this.connection.getSlot();
    const balance = await this.connection.getBalance(this.searcherKeypair.publicKey);
    logger.info({ slot, balance: balance / 1e9 }, 'Connection verified');
  }

  private async initializeAccountSubscriptions(): Promise<void> {
    const accounts = [
      { name: 'jupiter', address: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4' },
      { name: 'raydium', address: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8' },
    ];
    for (const acc of accounts) {
      this.wsManager.subscribeToAccount(new PublicKey(acc.address), acc.name);
    }
  }

  private async verifyJitoTipAccount(): Promise<void> {
    try {
      const tipAccount = await this.multiRelaySubmitter.getRandomTipAccount();
      if (tipAccount) {
        const info = await this.connection.getAccountInfo(tipAccount);
        logger.info({ tipAccount: tipAccount.toBase58(), exists: !!info }, 'Jito tip verified');
      }
    } catch (error) {
      logger.warn('Failed to verify Jito tip account');
    }
  }

  private registerStrategies(): void {
    const { DexArbitrageStrategy } = require('./strategies/dexArbitrage');
    try {
      const strategy = new DexArbitrageStrategy(this.connection, this.searcherKeypair, 10, 100000);
      this.strategyRegistry.register(strategy);
      logger.info('Registered DEX arbitrage strategy');
    } catch (error) {
      logger.error('Failed to register strategy');
    }
  }

  private async processingLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        const tx = this.wsManager.getNextPendingTx();
        if (!tx) {
          await this.sleep(100);
          continue;
        }
        const classified = this.txClassifier.classify(tx);
        const opportunities = await this.strategyRegistry.executeLegalStrategies([classified]);
        for (const opp of opportunities) {
          await this.processOpportunity(opp);
        }
      } catch (error) {
        await this.sleep(1000);
      }
    }
  }

  private async processOpportunity(opportunity: any): Promise<void> {
    const result = await this.bundleSimulator.simulate(opportunity.bundle);
    if (!result.success) return;
    const minProfit = (parseInt(process.env.MIN_PROFIT_THRESHOLD_USD || '10') / 100) * 1e9;
    if (!result.profit || result.profit.netProfitLamports < minProfit) return;
    
    if (process.env.SIMULATION_ONLY !== 'true') {
      await this.multiRelaySubmitter.submitWithFallback(opportunity.bundle, opportunity.targetSlot);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}

async function main(): Promise<void> {
  const searcher = new MEVSearcher();
  process.on('SIGTERM', async () => { await searcher.stop(); process.exit(0); });
  process.on('SIGINT', async () => { await searcher.stop(); process.exit(0); });
  await searcher.start();
}

if (require.main === module) {
  main().catch(error => { logger.error({ error: error.message }, 'Fatal'); process.exit(1); });
}

export { MEVSearcher };
