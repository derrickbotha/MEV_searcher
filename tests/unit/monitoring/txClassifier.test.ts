import { TxClassifier } from '../../../dist/monitoring/txClassifier';
import { PendingTx, TxType } from '../../../dist/types';

describe('TxClassifier', () => {
  let classifier: TxClassifier;

  beforeEach(() => {
    classifier = new TxClassifier(100); // $100 min threshold
  });

  describe('classify', () => {
    test('classifies simple ETH transfer', () => {
      const tx: PendingTx = {
        hash: '0x123',
        from: '0xabc',
        to: '0xdef',
        data: '0x',
        value: BigInt(1e18), // 1 ETH
        gasPrice: BigInt(50e9), // 50 Gwei
        gasLimit: BigInt(21000),
        nonce: 1,
        timestamp: Date.now(),
      };

      const classified = classifier.classify(tx);
      expect(classified.type).toBe(TxType.TOKEN_TRANSFER);
    });

    test('classifies Uniswap V2 swap', () => {
      const tx: PendingTx = {
        hash: '0x456',
        from: '0xabc',
        to: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2 Router
        data: '0x38ed1739000000000000000000000000', // swapExactTokensForTokens signature + data
        value: BigInt(0),
        gasPrice: BigInt(100e9),
        gasLimit: BigInt(200000),
        nonce: 2,
        timestamp: Date.now(),
      };

      const classified = classifier.classify(tx);
      expect(classified.type).toBe(TxType.DEX_SWAP);
      expect(classified.protocol).toBe('UNISWAP_V2');
    });

    test('classifies contract deployment', () => {
      const tx: PendingTx = {
        hash: '0x789',
        from: '0xabc',
        to: undefined,
        data: '0x608060405234801561001057600080fd5b50', // Contract bytecode
        value: BigInt(0),
        gasPrice: BigInt(50e9),
        gasLimit: BigInt(1000000),
        nonce: 3,
        timestamp: Date.now(),
      };

      const classified = classifier.classify(tx);
      expect(classified.type).toBe(TxType.CONTRACT_DEPLOYMENT);
    });

    test('classifies unknown transaction', () => {
      const tx: PendingTx = {
        hash: '0xabc',
        from: '0xabc',
        to: '0xunknown',
        data: '0x12345678',
        value: BigInt(0),
        gasPrice: BigInt(50e9),
        gasLimit: BigInt(100000),
        nonce: 4,
        timestamp: Date.now(),
      };

      const classified = classifier.classify(tx);
      expect(classified.type).toBe(TxType.UNKNOWN);
    });
  });

  describe('isHighValue', () => {
    test('returns true for high-value transaction', () => {
      const tx: PendingTx = {
        hash: '0x123',
        from: '0xabc',
        to: '0xdef',
        data: '0x',
        value: BigInt(1e18), // 1 ETH (worth ~$2000)
        gasPrice: BigInt(50e9),
        gasLimit: BigInt(21000),
        nonce: 1,
        timestamp: Date.now(),
      };

      expect(classifier.isHighValue(tx)).toBe(true);
    });

    test('returns false for low-value transaction', () => {
      const tx: PendingTx = {
        hash: '0x123',
        from: '0xabc',
        to: '0xdef',
        data: '0x',
        value: BigInt(1e15), // 0.001 ETH (worth ~$2)
        gasPrice: BigInt(50e9),
        gasLimit: BigInt(21000),
        nonce: 1,
        timestamp: Date.now(),
      };

      expect(classifier.isHighValue(tx)).toBe(false);
    });
  });

  describe('filterRelevantTxs', () => {
    test('filters out low-value simple transfers', () => {
      const txs: PendingTx[] = [
        {
          hash: '0x1',
          from: '0xabc',
          to: '0xdef',
          data: '0x',
          value: BigInt(1e15), // Low value
          gasPrice: BigInt(50e9),
          gasLimit: BigInt(21000),
          nonce: 1,
          timestamp: Date.now(),
        },
        {
          hash: '0x2',
          from: '0xabc',
          to: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
          data: '0x38ed1739000000000000000000000000', // DEX swap
          value: BigInt(0),
          gasPrice: BigInt(100e9),
          gasLimit: BigInt(200000),
          nonce: 2,
          timestamp: Date.now(),
        },
      ];

      const filtered = classifier.filterRelevantTxs(txs);
      expect(filtered.length).toBe(1);
      expect(filtered[0].type).toBe(TxType.DEX_SWAP);
    });

    test('returns empty array for no relevant transactions', () => {
      const txs: PendingTx[] = [
        {
          hash: '0x1',
          from: '0xabc',
          to: '0xdef',
          data: '0x',
          value: BigInt(1e15),
          gasPrice: BigInt(50e9),
          gasLimit: BigInt(21000),
          nonce: 1,
          timestamp: Date.now(),
        },
      ];

      const filtered = classifier.filterRelevantTxs(txs);
      expect(filtered.length).toBe(0);
    });
  });
});
