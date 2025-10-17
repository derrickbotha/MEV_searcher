import { ethers } from 'ethers';
import { PendingTx, ClassifiedTx, TxType } from '../types';
import { wsLogger } from '../utils/logger';

// Known protocol signatures
const PROTOCOL_SIGNATURES = {
  // Uniswap V2
  UNISWAP_V2_SWAP: '0x38ed1739', // swapExactTokensForTokens
  UNISWAP_V2_SWAP_ETH: '0x7ff36ab5', // swapExactETHForTokens
  // Uniswap V3
  UNISWAP_V3_SWAP: '0x414bf389', // exactInputSingle
  UNISWAP_V3_MULTICALL: '0x5ae401dc', // multicall
  // Sushiswap (same as Uniswap V2 for most functions)
  // Curve
  CURVE_EXCHANGE: '0x3df02124', // exchange
  // 1inch
  ONEINCH_SWAP: '0x7c025200', // swap
};

const KNOWN_DEX_ROUTERS = new Set([
  '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'.toLowerCase(), // Uniswap V2
  '0xE592427A0AEce92De3Edee1F18E0157C05861564'.toLowerCase(), // Uniswap V3
  '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F'.toLowerCase(), // Sushiswap
  '0x1111111254EEB25477B68fb85Ed929f73A960582'.toLowerCase(), // 1inch
]);

export class TxClassifier {
  private minValueThresholdWei: bigint;

  constructor(minValueThresholdUSD = 100) {
    // Approximate: $100 / $2000 per ETH = 0.05 ETH
    this.minValueThresholdWei = BigInt(Math.floor((minValueThresholdUSD / 2000) * 1e18));
  }

  classify(tx: PendingTx): ClassifiedTx {
    const type = this.detectTxType(tx);
    const classified: ClassifiedTx = {
      ...tx,
      type,
    };

    if (type === TxType.DEX_SWAP) {
      this.enrichDexSwap(classified);
    }

    return classified;
  }

  private detectTxType(tx: PendingTx): TxType {
    // No data = simple ETH transfer
    if (!tx.data || tx.data === '0x' || tx.data.length <= 10) {
      return TxType.TOKEN_TRANSFER;
    }

    const methodSelector = tx.data.slice(0, 10);

    // Check for DEX swaps
    if (this.isDexSwap(tx.to, methodSelector)) {
      return TxType.DEX_SWAP;
    }

    // Check for liquidity operations
    if (this.isLiquidityOperation(methodSelector)) {
      return tx.data.includes('addLiquidity')
        ? TxType.LIQUIDITY_ADD
        : TxType.LIQUIDITY_REMOVE;
    }

    // Check for contract deployment
    if (!tx.to || tx.to === '0x') {
      return TxType.CONTRACT_DEPLOYMENT;
    }

    // Check for NFT purchases (OpenSea, etc.)
    if (this.isNFTPurchase(tx.to, methodSelector)) {
      return TxType.NFT_PURCHASE;
    }

    return TxType.UNKNOWN;
  }

  private isDexSwap(to: string | undefined, methodSelector: string): boolean {
    if (!to) return false;

    const isKnownRouter = KNOWN_DEX_ROUTERS.has(to.toLowerCase());
    const isSwapMethod = Object.values(PROTOCOL_SIGNATURES).some(
      (sig) => sig === methodSelector
    );

    return isKnownRouter && isSwapMethod;
  }

  private isLiquidityOperation(methodSelector: string): boolean {
    const liquidityMethods = [
      '0xe8e33700', // addLiquidity
      '0xf305d719', // addLiquidityETH
      '0xbaa2abde', // removeLiquidity
      '0x02751cec', // removeLiquidityETH
    ];
    return liquidityMethods.includes(methodSelector);
  }

  private isNFTPurchase(to: string | undefined, methodSelector: string): boolean {
    if (!to) return false;

    const nftMarketplaces = new Set([
      '0x00000000006c3852cbEf3e08E8dF289169EdE581'.toLowerCase(), // OpenSea Seaport
      '0x7f268357A8c2552623316e2562D90e642bB538E5'.toLowerCase(), // OpenSea Wyvern
    ]);

    return nftMarketplaces.has(to.toLowerCase());
  }

  private enrichDexSwap(tx: ClassifiedTx): void {
    try {
      // Decode swap parameters
      const iface = new ethers.Interface([
        'function swapExactTokensForTokens(uint,uint,address[],address,uint)',
        'function exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))',
      ]);

      const decoded = iface.parseTransaction({ data: tx.data });
      if (decoded) {
        tx.protocol = this.detectProtocol(tx.to!);

        if (decoded.name === 'swapExactTokensForTokens') {
          tx.tokenIn = decoded.args[2][0];
          tx.tokenOut = decoded.args[2][decoded.args[2].length - 1];
          tx.amount = decoded.args[0];
        } else if (decoded.name === 'exactInputSingle') {
          tx.tokenIn = decoded.args[0].tokenIn;
          tx.tokenOut = decoded.args[0].tokenOut;
          tx.amount = decoded.args[0].amountIn;
        }
      }
    } catch (error) {
      wsLogger.debug({ hash: tx.hash, error }, 'Failed to enrich DEX swap details');
    }
  }

  private detectProtocol(to: string): string {
    const protocols: Record<string, string> = {
      '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D': 'UNISWAP_V2',
      '0xE592427A0AEce92De3Edee1F18E0157C05861564': 'UNISWAP_V3',
      '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F': 'SUSHISWAP',
      '0x1111111254EEB25477B68fb85Ed929f73A960582': 'ONEINCH',
    };

    return protocols[to] || 'UNKNOWN_DEX';
  }

  isHighValue(tx: PendingTx): boolean {
    return tx.value >= this.minValueThresholdWei;
  }

  filterRelevantTxs(txs: PendingTx[]): ClassifiedTx[] {
    return txs
      .filter((tx) => this.isHighValue(tx) || this.hasSignificantData(tx))
      .map((tx) => this.classify(tx));
  }

  private hasSignificantData(tx: PendingTx): boolean {
    // Consider transactions with meaningful calldata (not just transfers)
    return tx.data && tx.data.length > 10 && tx.data !== '0x';
  }
}
