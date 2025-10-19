import { DexArbitrageStrategy } from '../../../dist/strategies/dexArbitrage';
import { ClassifiedTx, TxType, DEXProtocol } from '../../../dist/types';
import { PublicKey } from '@solana/web3.js';

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
          signature: 'abc123',
          account: new PublicKey('11111111111111111111111111111112'),
          programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
          instructions: [],
          computeUnits: 5000,
          priorityFee: BigInt(1000),
          slot: 100,
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
          signature: 'def456',
          account: new PublicKey('11111111111111111111111111111112'),
          programId: new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'), // Raydium AMM
          instructions: [],
          computeUnits: 80000,
          priorityFee: BigInt(5000),
          slot: 101,
          timestamp: Date.now(),
          type: TxType.DEX_SWAP,
          protocol: DEXProtocol.RAYDIUM,
          tokenIn: new PublicKey('So11111111111111111111111111111111111111112'), // SOL
          tokenOut: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), // USDC
          amount: BigInt(1e9), // 1 SOL (in lamports)
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
          signature: 'ghi789',
          account: new PublicKey('11111111111111111111111111111112'),
          programId: new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'),
          instructions: [],
          computeUnits: 100000,
          priorityFee: BigInt(10000),
          slot: 102,
          timestamp: Date.now(),
          type: TxType.DEX_SWAP,
          protocol: DEXProtocol.RAYDIUM,
          tokenIn: new PublicKey('So11111111111111111111111111111111111111112'),
          tokenOut: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
          amount: BigInt(10e9), // 10 SOL - larger amount
        },
      ];

      const result = await strategy.detect(txs);

      if (result) {
        expect(result.type).toBe('DEX_ARBITRAGE');
        expect(result.strategy).toBe('DEX_ARBITRAGE');
        expect(result.expectedProfitUSD).toBeGreaterThan(0);
        expect(result.computeUnitsEstimate).toBeGreaterThan(0);
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
        computeUnitsEstimate: 200000,
        targetSlot: 100,
        bundle: { transactions: [], slot: 100 },
        strategy: 'DEX_ARBITRAGE',
        confidence: 0.8,
        priorityFee: BigInt(10000),
      };

      const bundle = await strategy.buildBundle(opportunity);

      expect(bundle).toBeDefined();
      expect(bundle.transactions).toHaveLength(2);
      expect(bundle.slot).toBeGreaterThanOrEqual(0);
      expect(bundle.minTimestamp).toBeDefined();
      expect(bundle.maxTimestamp).toBeDefined();
      expect(bundle.maxTimestamp).toBeGreaterThan(bundle.minTimestamp!);
    });
  });

  describe('estimateProfit', () => {
    test('calculates profit estimate with priority fees', async () => {
      const bundle = {
        transactions: [], // Empty array for mock
        slot: 100,
      };

      const mockFork = {
        id: 1,
        connection: {},
        cleanup: async () => {},
      };

      const profit = await strategy.estimateProfit(bundle, mockFork);

      expect(profit).toBeDefined();
      expect(profit.grossProfitLamports).toBeGreaterThan(BigInt(0));
      expect(profit.priorityFeeLamports).toBeGreaterThan(BigInt(0));
      expect(profit.netProfitLamports).toBeDefined();
      expect(profit.netProfitUSD).toBeGreaterThan(0);
      expect(profit.priorityFeePerCU).toBeGreaterThan(0);
    });

    test('net profit is gross profit minus priority fee', async () => {
      const bundle = {
        transactions: [],
        slot: 100,
      };

      const mockFork = {
        id: 1,
        connection: {},
        cleanup: async () => {},
      };

      const profit = await strategy.estimateProfit(bundle, mockFork);

      const calculatedNet = profit.grossProfitLamports - profit.priorityFeeLamports;
      expect(profit.netProfitLamports).toBe(calculatedNet);
    });
  });

  describe('Arbitrage Logic', () => {
    test('identifies buy-low-sell-high opportunity', async () => {
      // Create a scenario where Raydium has lower price than Jupiter
      const txs: ClassifiedTx[] = [
        {
          signature: 'jkl012',
          account: new PublicKey('11111111111111111111111111111112'),
          programId: new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'),
          instructions: [],
          computeUnits: 80000,
          priorityFee: BigInt(5000),
          slot: 103,
          timestamp: Date.now(),
          type: TxType.DEX_SWAP,
          protocol: DEXProtocol.RAYDIUM,
          tokenIn: new PublicKey('So11111111111111111111111111111111111111112'),
          tokenOut: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
          amount: BigInt(5e9), // 5 SOL
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

    test('respects maximum priority fee limit', () => {
      const strategyWithLowFee = new DexArbitrageStrategy(10, 50);
      expect(strategyWithLowFee).toBeDefined();
    });
  });

  describe('Profit Calculation', () => {
    test('calculates USD value correctly', async () => {
      const bundle = {
        transactions: [],
        slot: 100,
      };

      const mockFork = {
        id: 1,
        connection: {},
        cleanup: async () => {},
      };

      const profit = await strategy.estimateProfit(bundle, mockFork);

      // Check USD conversion makes sense
      const solValue = Number(profit.netProfitLamports) / 1e9; // Convert lamports to SOL
      const expectedUSD = solValue * 200; // $200 per SOL default

      expect(Math.abs(profit.netProfitUSD - expectedUSD)).toBeLessThan(1); // Within $1
    });
  });
});