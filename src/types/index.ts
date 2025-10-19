// Core types used throughout the Solana MEV searcher application

import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

export interface PendingTx {
  signature: string;
  account: PublicKey;
  programId?: PublicKey;
  instructions: any[];
  computeUnits: number;
  priorityFee: bigint; // in lamports
  slot: number;
  timestamp: number;
  priority?: number;
}

export interface RPCConfig {
  name: string;
  httpUrl: string;
  wsUrl?: string;
  priority: number;
  maxRetries: number;
  timeoutMs: number;
  commitment?: 'processed' | 'confirmed' | 'finalized';
}

export interface ClassifiedTx extends PendingTx {
  type: TxType;
  protocol?: string;
  poolAddress?: PublicKey;
  tokenIn?: PublicKey;
  tokenOut?: PublicKey;
  amount?: bigint;
  slippage?: number;
}

export enum TxType {
  DEX_SWAP = 'DEX_SWAP',
  LIQUIDITY_ADD = 'LIQUIDITY_ADD',
  LIQUIDITY_REMOVE = 'LIQUIDITY_REMOVE',
  NFT_PURCHASE = 'NFT_PURCHASE',
  TOKEN_TRANSFER = 'TOKEN_TRANSFER',
  PROGRAM_INTERACTION = 'PROGRAM_INTERACTION',
  UNKNOWN = 'UNKNOWN',
}

export enum DEXProtocol {
  RAYDIUM = 'RAYDIUM',
  JUPITER = 'JUPITER',
  ORCA = 'ORCA',
  SABER = 'SABER',
  METEORA = 'METEORA',
}

export interface Opportunity {
  type: string;
  expectedProfitUSD: number;
  computeUnitsEstimate: number;
  targetSlot: number;
  bundle: Bundle;
  strategy: string;
  confidence: number;
  priorityFee: bigint;
}

export interface Bundle {
  transactions: (Transaction | VersionedTransaction)[];
  slot: number;
  minTimestamp?: number;
  maxTimestamp?: number;
  failedTxs?: string[];
}

export interface SignedBundle extends Bundle {
  signatures: string[];
}

export interface SubmissionResult {
  success: boolean;
  bundleId?: string;
  error?: string;
  relay: string;
  landedSlot?: number;
  inclusionProbability?: number;
}

export interface ProfitEstimate {
  grossProfitLamports: bigint;
  priorityFeeLamports: bigint;
  netProfitLamports: bigint;
  netProfitUSD: number;
  priorityFeePerCU: number;
}

export interface ForkHandle {
  id: number;
  connection: any;
  cleanup: () => Promise<void>;
}

export interface ForkState {
  slot: number;
  timestamp: number;
  blockhash: string;
}

export interface HealthStatus {
  healthy: boolean;
  latencyMs?: number;
  lastChecked: number;
  errorCount: number;
  slotHeight?: number;
}

export interface Strategy {
  name: string;
  description: string;
  isLegal: boolean;
  detect: (txs: ClassifiedTx[]) => Promise<Opportunity | null>;
  buildBundle: (opportunity: Opportunity) => Promise<Bundle>;
  estimateProfit: (bundle: Bundle, fork: ForkHandle) => Promise<ProfitEstimate>;
}

export interface PoolInfo {
  address: PublicKey;
  protocol: DEXProtocol;
  tokenA: PublicKey;
  tokenB: PublicKey;
  tokenAAccount: PublicKey;
  tokenBAccount: PublicKey;
  authority?: PublicKey;
  feeAccount?: PublicKey;
  fee: number;
}

export interface TokenInfo {
  address: PublicKey;
  symbol: string;
  decimals: number;
  coingeckoId?: string;
}

export interface MEVConfig {
  minProfitLamports: bigint;
  maxPriorityFee: bigint;
  maxSlippageBps: number;
  numThreads: number;
  jitoTipAccount?: PublicKey;
}
