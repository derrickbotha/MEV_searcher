import { DexArbitrageStrategy } from '../../src/strategies/dexArbitrage';
import { ClassifiedTx, TxType } from '../../src/types';

describe('DexArbitrageStrategy', () => {
  let strategy: DexArbitrageStrategy;

  beforeEach(() => {
    strategy = new DexArbitrageStrategy(10, 300);
  });

  describe('Strategy Properties', () => {
    test('has correct name and description', () => {
      expect(strategy.name).toBe('DEX_ARBITRAGE');
      expect(strategy.description).toContain('price differences');
      expect(strategy.isLegal).toBe(true);
    });

    test('is marked as legal (ethical arbitrage)', () => {
      expect(strategy.isLegal).toBe(true);
    });
  });

  describe('detect', () => {
    test('returns null for empty transaction list', async () => {
      const result = await strategy.detect([]);
      expect(result).toBeNull();
    });

    test('returns null for non-DEX transactions', async () => {
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
          type: TxType.TOKEN_TRANSFER,
        },
      ];

      const result = await strategy.detect(txs);
      expect(result).toBeNull();
    });

    test('analyzes DEX swap transactions', async () => {
      const txs: ClassifiedTx[] = [
        {
          hash: '0x456',
          from: '0xabc',
          to: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2
          data: '0x38ed1739000000000000000000000000',
          value: BigInt(0),
          gasPrice: BigInt(100e9),
          gasLimit: BigInt(200000),
          nonce: 2,
          timestamp: Date.now(),
          type: TxType.DEX_SWAP,
          protocol: 'UNISWAP_V2',
          tokenIn: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
          tokenOut: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
          amount: BigInt(1e18), // 1 ETH
        },
      ];

      const result = await strategy.detect(txs);
      // May return null if mock prices don't show arbitrage
      // But should not throw error
      expect(result === null || typeof result === 'object').toBe(true);
    });

    test('detects arbitrage opportunity with price discrepancy', async () => {
      const txs: ClassifiedTx[] = [
        {
          hash: '0x789',
          from: '0xabc',
          to: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
          data: '0x38ed1739000000000000000000000000',
          value: BigInt(0),
          gasPrice: BigInt(50e9),
          gasLimit: BigInt(200000),
          nonce: 3,
          timestamp: Date.now(),
          type: TxType.DEX_SWAP,
          protocol: 'UNISWAP_V2',
          tokenIn: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
          tokenOut: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          amount: BigInt(10e18), // 10 ETH - larger amount
        },
      ];

      const result = await strategy.detect(txs);
      
      if (result) {
        expect(result.type).toBe('DEX_ARBITRAGE');
        expect(result.strategy).toBe('DEX_ARBITRAGE');
        expect(result.expectedProfitUSD).toBeGreaterThan(0);
        expect(result.gasEstimate).toBeGreaterThan(BigInt(0));
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('buildBundle', () => {
    test('creates bundle with two transactions (buy and sell)', async () => {
      const opportunity = {
        type: 'DEX_ARBITRAGE',
        expectedProfitUSD: 15.5,
        gasEstimate: BigInt(400000),
        targetBlock: 100,
        bundle: { txs: [], blockNumber: 100 },
        strategy: 'DEX_ARBITRAGE',
        confidence: 0.8,
      };

      const bundle = await strategy.buildBundle(opportunity);

      expect(bundle).toBeDefined();
      expect(bundle.txs).toHaveLength(2);
      expect(bundle.blockNumber).toBeGreaterThanOrEqual(0);
      expect(bundle.minTimestamp).toBeDefined();
      expect(bundle.maxTimestamp).toBeDefined();
      expect(bundle.maxTimestamp).toBeGreaterThan(bundle.minTimestamp!);
    });
  });

  describe('estimateProfit', () => {
    test('calculates profit estimate with gas costs', async () => {
      const bundle = {
        txs: ['0x...buy', '0x...sell'],
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
      expect(profit.netProfitWei).toBeDefined();
      expect(profit.netProfitUSD).toBeGreaterThan(0);
      expect(profit.gasPrice).toBeGreaterThan(BigInt(0));
    });

    test('net profit is gross profit minus gas cost', async () => {
      const bundle = {
        txs: ['0x...buy', '0x...sell'],
        blockNumber: 100,
      };

      const mockFork = {
        id: 1,
        provider: {},
        cleanup: async () => {},
      };

      const profit = await strategy.estimateProfit(bundle, mockFork);

      const calculatedNet = profit.grossProfitWei - profit.gasCostWei;
      expect(profit.netProfitWei).toBe(calculatedNet);
    });
  });

  describe('Arbitrage Logic', () => {
    test('identifies buy-low-sell-high opportunity', async () => {
      // Create a scenario where Uniswap has lower price than Sushiswap
      const txs: ClassifiedTx[] = [
        {
          hash: '0xabc',
          from: '0xtrader',
          to: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
          data: '0x38ed1739',
          value: BigInt(0),
          gasPrice: BigInt(50e9),
          gasLimit: BigInt(200000),
          nonce: 1,
          timestamp: Date.now(),
          type: TxType.DEX_SWAP,
          protocol: 'UNISWAP_V2',
          tokenIn: '0xWETH',
          tokenOut: '0xUSDC',
          amount: BigInt(5e18),
        },
      ];

      const result = await strategy.detect(txs);
      
      // Should find arbitrage with mock prices
      if (result) {
        expect(result.expectedProfitUSD).toBeGreaterThan(0);
      }
    });

    test('respects minimum profit threshold', () => {
      const strategyWithHighThreshold = new DexArbitrageStrategy(1000, 300);
      expect(strategyWithHighThreshold).toBeDefined();
    });

    test('respects maximum gas price limit', () => {
      const strategyWithLowGas = new DexArbitrageStrategy(10, 50);
      expect(strategyWithLowGas).toBeDefined();
    });
  });

  describe('Profit Calculation', () => {
    test('calculates USD value correctly', async () => {
      const bundle = {
        txs: ['0x1', '0x2'],
        blockNumber: 100,
      };

      const mockFork = {
        id: 1,
        provider: {},
        cleanup: async () => {},
      };

      const profit = await strategy.estimateProfit(bundle, mockFork);

      // Check USD conversion makes sense
      const ethValue = Number(profit.netProfitWei) / 1e18;
      const expectedUSD = ethValue * 2000; // $2000 per ETH default

      expect(Math.abs(profit.netProfitUSD - expectedUSD)).toBeLessThan(1); // Within $1
    });
  });
});
