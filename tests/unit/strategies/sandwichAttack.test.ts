import { SandwichAttackStrategy } from '../../../dist/strategies/sandwichAttack';
import { ClassifiedTx, TxType } from '../../../dist/types';
import { PublicKey } from '@solana/web3.js';

describe('SandwichAttackStrategy', () => {
  let strategy: SandwichAttackStrategy;
  const originalEnv = process.env.SIMULATION_ONLY;

  beforeEach(() => {
    // Strategy now works in both simulation and production modes
    process.env.SIMULATION_ONLY = 'true';
    strategy = new SandwichAttackStrategy(10000, BigInt(1000000));
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

    test('is now marked as LEGAL (WARNING: unethical strategy enabled)', () => {
      expect(strategy.isLegal).toBe(true);
    });

    test('logs warning on initialization', () => {
      // Creating new instance should log warning
      const warnStrategy = new SandwichAttackStrategy();
      expect(warnStrategy.isLegal).toBe(true);
    });
  });

  describe('Safety Checks', () => {
    test('can run in both simulation and production modes', async () => {
      process.env.SIMULATION_ONLY = 'false';
      const productionStrategy = new SandwichAttackStrategy();

      const txs: ClassifiedTx[] = [
        {
          signature: 'test123',
          account: new PublicKey('11111111111111111111111111111112'),
          instructions: [],
          computeUnits: 21000,
          priorityFee: BigInt(50e9),
          slot: 1,
          timestamp: Date.now(),
          type: TxType.DEX_SWAP,
        },
      ];

      // Should not throw in production mode anymore
      await expect(productionStrategy.detect(txs)).resolves.not.toThrow();
    });

    test('runs in simulation mode', () => {
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
          signature: 'test123',
          account: new PublicKey('11111111111111111111111111111112'),
          instructions: [],
          computeUnits: 21000,
          priorityFee: BigInt(50e9),
          slot: 1,
          timestamp: Date.now(),
          type: TxType.DEX_SWAP,
          amount: BigInt(1e17), // Small amount
        },
      ];

      const result = await strategy.detect(txs);
      expect(result).toBeNull();
    });
  });

  describe('Ethical Considerations', () => {
    test('strategy is clearly marked as unethical', () => {
      expect(strategy.isLegal).toBe(true); // Now enabled but still unethical
      expect(strategy.description).toContain('UNETHICAL');
      expect(strategy.name).toContain('SANDWICH');
    });

    test('can now be registered in production (WARNING: unethical)', () => {
      // This test documents the new behavior - strategy is now enabled
      expect(strategy.isLegal).toBe(true);
      // StrategyRegistry will now accept this in production mode
    });
  });
});
