// Core types used throughout the application

export interface PendingTx {
  hash: string;
  from: string;
  to?: string;
  data: string;
  value: bigint;
  gasPrice: bigint;
  gasLimit: bigint;
  nonce: number;
  timestamp: number;
  priority?: number;
}

export interface RPCConfig {
  name: string;
  httpUrl: string;
  wsUrl: string;
  priority: number;
  maxRetries: number;
  timeoutMs: number;
}

export interface ClassifiedTx extends PendingTx {
  type: TxType;
  protocol?: string;
  poolAddress?: string;
  tokenIn?: string;
  tokenOut?: string;
  amount?: bigint;
}

export enum TxType {
  DEX_SWAP = 'DEX_SWAP',
  LIQUIDITY_ADD = 'LIQUIDITY_ADD',
  LIQUIDITY_REMOVE = 'LIQUIDITY_REMOVE',
  NFT_PURCHASE = 'NFT_PURCHASE',
  TOKEN_TRANSFER = 'TOKEN_TRANSFER',
  CONTRACT_DEPLOYMENT = 'CONTRACT_DEPLOYMENT',
  UNKNOWN = 'UNKNOWN',
}

export interface Opportunity {
  type: string;
  expectedProfitUSD: number;
  gasEstimate: bigint;
  targetBlock: number;
  bundle: Bundle;
  strategy: string;
  confidence: number;
}

export interface Bundle {
  txs: string[];
  blockNumber: number;
  minTimestamp?: number;
  maxTimestamp?: number;
  revertingTxHashes?: string[];
}

export interface SignedBundle extends Bundle {
  signature: string;
}

export interface SubmissionResult {
  success: boolean;
  bundleHash?: string;
  error?: string;
  relay: string;
  inclusionProbability?: number;
}

export interface ProfitEstimate {
  grossProfitWei: bigint;
  gasCostWei: bigint;
  netProfitWei: bigint;
  netProfitUSD: number;
  gasPrice: bigint;
}

export interface ForkHandle {
  id: number;
  provider: any;
  cleanup: () => Promise<void>;
}

export interface ForkState {
  blockNumber: number;
  timestamp: number;
  stateRoot: string;
}

export interface HealthStatus {
  healthy: boolean;
  latencyMs?: number;
  lastChecked: number;
  errorCount: number;
}

export interface Strategy {
  name: string;
  description: string;
  isLegal: boolean;
  detect: (txs: ClassifiedTx[]) => Promise<Opportunity | null>;
  buildBundle: (opportunity: Opportunity) => Promise<Bundle>;
  estimateProfit: (bundle: Bundle, fork: ForkHandle) => Promise<ProfitEstimate>;
}
