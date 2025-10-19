import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { PendingTx, ClassifiedTx, TxType, DEXProtocol } from '../types';
import { wsLogger } from '../utils/logger';

// Known Solana DEX program IDs
const DEX_PROGRAMS = new Map<string, DEXProtocol>([
  ['675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', DEXProtocol.RAYDIUM], // Raydium AMM
  ['JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', DEXProtocol.JUPITER], // Jupiter Aggregator
  ['9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP', DEXProtocol.ORCA], // Orca Whirlpool
  ['9tKE7Mbmj4mxDjWatGzP5uGhZzu4qH2zeTJ0LfK7lyfX', DEXProtocol.SABER], // Saber
  ['H8W3ctz92svYg6mkn1UtGfu2aQr2PdvxKKWUuEC4HG1J', DEXProtocol.METEORA], // Meteora
]);

// Known token mint addresses for major tokens
const TOKEN_MINTS = {
  SOL: new PublicKey('So11111111111111111111111111111111111111112'),
  USDC: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
  USDT: new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'),
  RAY: new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'),
  ORCA: new PublicKey('orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE'),
};

export class TxClassifier {
  private minValueThresholdLamports: bigint;

  constructor(minValueThresholdUSD = 100) {
    // Approximate: $100 / $200 per SOL = 0.5 SOL
    this.minValueThresholdLamports = BigInt(Math.floor((minValueThresholdUSD / 200) * 1e9));
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
    // Check if transaction has instructions (all Solana txs do)
    if (!tx.instructions || tx.instructions.length === 0) {
      return TxType.UNKNOWN;
    }

    // Check for DEX swap patterns
    if (this.isDexSwap(tx.programId)) {
      return TxType.DEX_SWAP;
    }

    // Check for liquidity operations
    if (this.isLiquidityOperation(tx.programId, tx.instructions)) {
      return TxType.LIQUIDITY_ADD;
    }

    // Check for token transfers
    if (this.isTokenTransfer(tx.programId)) {
      return TxType.TOKEN_TRANSFER;
    }

    // Check for NFT purchases (would need more sophisticated logic)
    if (this.isNFTPurchase(tx.programId, tx.instructions)) {
      return TxType.NFT_PURCHASE;
    }

    return TxType.PROGRAM_INTERACTION;
  }

  private isDexSwap(programId?: PublicKey): boolean {
    if (!programId) return false;
    return DEX_PROGRAMS.has(programId.toString());
  }

  private isLiquidityOperation(programId?: PublicKey, instructions?: any[]): boolean {
    if (!programId || !instructions) return false;

    const programIdStr = programId.toString();

    // Raydium liquidity operations
    if (programIdStr === '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8') {
      // Check for Raydium instruction discriminators
      // This would need actual instruction parsing
      return instructions.some(inst => this.isRaydiumLiquidityInstruction(inst));
    }

    // Orca liquidity operations
    if (programIdStr === '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP') {
      return instructions.some(inst => this.isOrcaLiquidityInstruction(inst));
    }

    return false;
  }

  private isTokenTransfer(programId?: PublicKey): boolean {
    if (!programId) return false;
    // SPL Token program
    return programId.toString() === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
  }

  private isNFTPurchase(programId?: PublicKey, instructions?: any[]): boolean {
    if (!programId || !instructions) return false;

    // Magic Eden, Tensor, etc. would have specific program IDs
    // This is a simplified check
    const nftMarketplaces = [
      'M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K', // Magic Eden v2
      'TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hAsbdwmHbN', // Tensor
    ];

    return nftMarketplaces.includes(programId.toString());
  }

  private isRaydiumLiquidityInstruction(instruction: any): boolean {
    // Raydium instruction discriminators for liquidity operations
    // This would need proper instruction parsing
    // For now, return false - would need actual implementation
    return false;
  }

  private isOrcaLiquidityInstruction(instruction: any): boolean {
    // Orca Whirlpool instruction discriminators
    // This would need proper instruction parsing
    // For now, return false - would need actual implementation
    return false;
  }

  private enrichDexSwap(tx: ClassifiedTx): void {
    try {
      if (!tx.programId) return;

      const protocol = DEX_PROGRAMS.get(tx.programId.toString());
      if (protocol) {
        tx.protocol = protocol;
      }

      // Extract token information from instructions
      // This is a simplified version - real implementation would parse instructions
      this.extractTokenInfo(tx);

    } catch (error) {
      wsLogger.debug({ signature: tx.signature, error }, 'Failed to enrich DEX swap details');
    }
  }

  private extractTokenInfo(tx: ClassifiedTx): void {
    // This is a placeholder - real implementation would:
    // 1. Parse the transaction instructions
    // 2. Extract token mint addresses from instruction data
    // 3. Determine input/output amounts

    // For now, we'll set some defaults for testing
    tx.tokenIn = TOKEN_MINTS.SOL;
    tx.tokenOut = TOKEN_MINTS.USDC;
    tx.amount = BigInt(1e9); // 1 SOL
    tx.slippage = 0.5; // 0.5%
  }

  shouldProcess(tx: PendingTx): boolean {
    // Check minimum value threshold
    return tx.priorityFee >= this.minValueThresholdLamports;
  }

  hasSignificantData(tx: PendingTx): boolean {
    // All Solana transactions have instructions, so check if it's a complex transaction
    return Boolean(tx.instructions && tx.instructions.length > 1);
  }
}