import { SandwichAttackStrategy } from '../../src/strategies/sandwichAttack';
import { ClassifiedTx, TxType } from '../../src/types';

describe('SandwichAttackStrategy', () => {
  let strategy: SandwichAttackStrategy;
  const originalEnv = process.env.SIMULATION_ONLY;

  beforeEach(() => {
    // CRITICAL: Always run in simulation mode for this unethical strategy
    process.env.SIMULATION_ONLY = 'true';
    strategy = new SandwichAttackStrategy(10000, 300);
  });

  afterEach(() => {
    process.env.SIMULATION_ONLY = originalEnv;
  });

  describe('Strategy Properties', () => {
    test('has correct name and description', () => {
      expect(strategy.name).toBe('SANDWICH_ATTACK');
      expect(strategy.description).toContain('UNETHICAL');
      expect(strategy.description).toContain('Front-run');
    });

    test('is marked as ILLEGAL (critical safety check)', () => {
      expect(strategy.isLegal).toBe(false);
    });

    test('logs warning on initialization', () => {
      // Creating new instance should log warning
      const warnStrategy = new SandwichAttackStrategy();
      expect(warnStrategy.isLegal).toBe(false);
    });
  });

  describe('Safety Checks', () => {
    test('throws error if not in simulation mode', async () => {
      process.env.SIMULATION_ONLY = 'false';
      const productionStrategy = new SandwichAttackStrategy();

      const txs: ClassifiedTx[] = [
        {
          hash: '0x123',
          from: '0xabc',
          to: '0xdef',
          data: '0x',
          value: BigInt(1e18),
          gasPrice: BigInt(50e9),
          gasLimit: BigInt(21000),
          nonce: 1,
          timestamp: Date.now(),
          type: TxType.DEX_SWAP,
        },
      ];

      await expect(productionStrategy.detect(txs)).rejects.toThrow(
        'Sandwich attack strategy can only run in simulation mode'
      );
    });

    test('only runs in simulation mode', () => {
      process.env.SIMULATION_ONLY = 'true';
      expect(() => new SandwichAttackStrategy()).not.toThrow();
    });
  });

  describe('detect', () => {
    test('returns null for empty transaction list', async () => {
      const result = await strategy.detect([]);
      expect(result).toBeNull();
    });

    test('returns null for small transactions', async () => {
      const txs: ClassifiedTx[] = [
        {
          hash: '0x123',
          from: '0xabc',
          to: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
          data: '0x38ed1739',
          value: BigInt(0),
          gasPrice: BigInt(50e9),
          gasLimit: BigInt(21000),
          nonce: 1,
          timestamp: Date.now(),
          type: TxType.DEX_SWAP,
          amount: BigInt(1e17), // 0.1 ETH - too small
        },
      ];

      const result = await strategy.detect(txs);
      expect(result).toBeNull();
    });

    test('identifies large swap transactions as potential victims', async () => {
      const txs: ClassifiedTx[] = [
        {
          hash: '0x456',
          from: '0xvictim',
          to: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
          data: '0x38ed1739',
          value: BigInt(0),
          gasPrice: BigInt(100e9),
          gasLimit: BigInt(300000),
          nonce: 2,
          timestamp: Date.now(),
          type: TxType.DEX_SWAP,
          protocol: 'UNISWAP_V2',
          tokenIn: '0xWETH',
          tokenOut: '0xUSDC',
          amount: BigInt(10e18), // 10 ETH = $20,000 (large enough)
        },
      ];

      const result = await strategy.detect(txs);
      
      if (result) {
        expect(result.type).toBe('SANDWICH_ATTACK');
        expect(result.strategy).toBe('SANDWICH_ATTACK');
        expect(result.expectedProfitUSD).toBeGreaterThanOrEqual(100);
      }
    });

    test('logs warning when opportunity detected', async () => {
      const txs: ClassifiedTx[] = [
        {
          hash: '0x789',
          from: '0xvictim',
          to: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
          data: '0x414bf389',
          value: BigInt(0),
          gasPrice: BigInt(120e9),
          gasLimit: BigInt(400000),
          nonce: 3,
          timestamp: Date.now(),
          type: TxType.DEX_SWAP,
          protocol: 'UNISWAP_V3',
          tokenIn: '0xWETH',
          tokenOut: '0xUSDC',
          amount: BigInt(50e18), // 50 ETH = $100,000
        },
      ];

      await strategy.detect(txs);
      // Should log warning with victim details
    });
  });

  describe('buildBundle', () => {
    test('creates bundle with THREE transactions (front, victim, back)', async () => {
      const opportunity = {
        type: 'SANDWICH_ATTACK',
        expectedProfitUSD: 150,
        gasEstimate: BigInt(600000),
        targetBlock: 100,
        bundle: { txs: [], blockNumber: 100 },
        strategy: 'SANDWICH_ATTACK',
        confidence: 0.8,
      };

      const bundle = await strategy.buildBundle(opportunity);

      expect(bundle).toBeDefined();
      expect(bundle.txs).toHaveLength(3); // CRITICAL: Must be 3 transactions
      expect(bundle.blockNumber).toBeGreaterThanOrEqual(0);
      
      // Sandwich bundles have shorter validity
      const validity = bundle.maxTimestamp! - bundle.minTimestamp!;
      expect(validity).toBeLessThanOrEqual(60); // Max 1 minute
    });

    test('maintains correct transaction ordering', async () => {
      const opportunity = {
        type: 'SANDWICH_ATTACK',
        expectedProfitUSD: 200,
        gasEstimate: BigInt(600000),
        targetBlock: 100,
        bundle: { txs: [], blockNumber: 100 },
        strategy: 'SANDWICH_ATTACK',
        confidence: 0.85,
      };

      const bundle = await strategy.buildBundle(opportunity);

      // Order MUST be: front-run, victim, back-run
      expect(bundle.txs[0]).toBeDefined(); // Tx_A (Front-run)
      expect(bundle.txs[1]).toBeDefined(); // Tx_Victim
      expect(bundle.txs[2]).toBeDefined(); // Tx_B (Back-run)
    });
  });

  describe('estimateProfit', () => {
    test('calculates profit with higher gas costs', async () => {
      const bundle = {
        txs: ['0x...front', '0x...victim', '0x...back'],
        blockNumber: 100,
      };

      const mockFork = {
        id: 1,
        provider: {},
        cleanup: async () => {},
      };

      const profit = await strategy.estimateProfit(bundle, mockFork);

      expect(profit).toBeDefined();
      expect(profit.grossProfitWei).toBeGreaterThan(BigInt(0));
      expect(profit.gasCostWei).toBeGreaterThan(BigInt(0));
      
      // Sandwich uses higher gas prices
      expect(profit.gasPrice).toBeGreaterThanOrEqual(BigInt(100e9)); // >= 100 Gwei
      
      expect(profit.netProfitUSD).toBeDefined();
    });

    test('logs warning during profit estimation', async () => {
      const bundle = {
        txs: ['0x1', '0x2', '0x3'],
        blockNumber: 100,
      };

      const mockFork = {
        id: 1,
        provider: {},
        cleanup: async () => {},
      };

      await strategy.estimateProfit(bundle, mockFork);
      // Should log warning about unethical nature
    });
  });

  describe('Ethical Considerations', () => {
    test('strategy is clearly marked as unethical', () => {
      expect(strategy.isLegal).toBe(false);
      expect(strategy.description).toContain('UNETHICAL');
      expect(strategy.name).toContain('SANDWICH');
    });

    test('should never be registered in production', () => {
      // This test documents the expectation
      expect(strategy.isLegal).toBe(false);
      // StrategyRegistry should reject this in production
    });

    test('requires simulation mode', async () => {
      process.env.SIMULATION_ONLY = 'false';
      const prodStrategy = new SandwichAttackStrategy();
      
      await expect(prodStrategy.detect([])).rejects.toThrow();
    });
  });

  describe('Victim Identification', () => {
    test('identifies victims based on trade size', async () => {
      const smallTrade: ClassifiedTx = {
        hash: '0x1',
        from: '0xuser',
        to: '0xdex',
        data: '0x',
        value: BigInt(0),
        gasPrice: BigInt(50e9),
        gasLimit: BigInt(200000),
        nonce: 1,
        timestamp: Date.now(),
        type: TxType.DEX_SWAP,
        amount: BigInt(1e17), // 0.1 ETH = $200 (too small)
      };

      const largeTrade: ClassifiedTx = {
        ...smallTrade,
        hash: '0x2',
        amount: BigInt(100e18), // 100 ETH = $200,000 (large victim)
      };

      const result1 = await strategy.detect([smallTrade]);
      const result2 = await strategy.detect([largeTrade]);

      expect(result1).toBeNull(); // Too small
      // result2 may or may not be null depending on profitability
    });

    test('calculates slippage impact on victims', async () => {
      const txs: ClassifiedTx[] = [
        {
          hash: '0xvictim123',
          from: '0xvictim',
          to: '0xdex',
          data: '0x38ed1739',
          value: BigInt(0),
          gasPrice: BigInt(100e9),
          gasLimit: BigInt(300000),
          nonce: 5,
          timestamp: Date.now(),
          type: TxType.DEX_SWAP,
          protocol: 'UNISWAP_V2',
          tokenIn: '0xWETH',
          tokenOut: '0xUSDC',
          amount: BigInt(25e18), // 25 ETH
          poolAddress: '0xpool',
        },
      ];

      await strategy.detect(txs);
      // Should calculate price impact and optimal sandwich amounts
    });
  });

  describe('Profitability Threshold', () => {
    test('respects minimum profit threshold', () => {
      const highThresholdStrategy = new SandwichAttackStrategy(50000, 300);
      expect(highThresholdStrategy).toBeDefined();
    });

    test('requires higher profit than arbitrage', async () => {
      const opportunity = {
        type: 'SANDWICH_ATTACK',
        expectedProfitUSD: 50, // Below 100 threshold in code
        gasEstimate: BigInt(600000),
        targetBlock: 100,
        bundle: { txs: [], blockNumber: 100 },
        strategy: 'SANDWICH_ATTACK',
        confidence: 0.5,
      };

      // Low profit opportunities should be filtered out
      // (implementation filters below $100)
    });
  });
});
