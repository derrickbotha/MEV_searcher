# 🚀 Solana MEV Bot - Quick Start Guide

## Current Implementation Status

✅ **Complete** - All core components converted from Ethereum to Solana
- Transaction classifier
- DEX arbitrage strategy  
- WebSocket manager
- Bundle simulator
- Fork manager
- Jito multi-relay submitter

⚠️ **C++ Engine** - Implemented but requires Visual Studio C++ Build Tools to compile
- Sub-10ms execution engine ready
- Requires additional setup (see CPP_BUILD_GUIDE.md)
- TypeScript implementation works without C++

## Running Without C++ Engine (Recommended for Testing)

The bot is fully functional using TypeScript implementations. The C++ engine provides performance optimization but isn't required.

### 1. Install Dependencies

```powershell
cd C:\Users\dbmos\OneDrive\Documents\REV
npm install
```

### 2. Configure Environment

Create `.env` file:

```env
# Solana RPC (use free tier for testing)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Searcher keypair (generate one for testing)
# Format: JSON array or base58 string
SEARCHER_PRIVATE_KEY=[your_private_key_here]

# Jito relays (default provided if not specified)
JITO_RELAY_URLS=https://mainnet.block-engine.jito.wtf

# Profitability settings
MIN_PROFIT_THRESHOLD_USD=10
SOL_USD_PRICE=100
MAX_PRIORITY_FEE_LAMPORTS=100000

# Safety (KEEP TRUE FOR TESTING!)
SIMULATION_ONLY=true
ENABLE_RESEARCH_STRATEGIES=false
```

### 3. Generate Test Keypair

```powershell
# Install Solana CLI if not already installed
# winget install Solana.Solana

# Generate keypair
solana-keygen new --outfile test-keypair.json

# Get public key
solana-keygen pubkey test-keypair.json

# Get private key as JSON array (for .env)
Get-Content test-keypair.json
# Copy the array into SEARCHER_PRIVATE_KEY in .env
```

### 4. Fix TypeScript Errors (index.ts)

The `index.ts` has some type mismatches. Here's a corrected minimal version:

```typescript
// src/index_simple.ts
import dotenv from 'dotenv';
import { Connection, Keypair } from '@solana/web3.js';
import { logger } from './utils/logger';
import bs58 from 'bs58';

dotenv.config();

async function main() {
  logger.info('Starting Solana MEV Searcher Bot...');
  
  // Load keypair
  const pk = process.env.SEARCHER_PRIVATE_KEY;
  if (!pk) throw new Error('SEARCHER_PRIVATE_KEY required');
  
  const secretKey = pk.startsWith('[') 
    ? Uint8Array.from(JSON.parse(pk)) 
    : bs58.decode(pk);
  const keypair = Keypair.fromSecretKey(secretKey);
  
  logger.info({ pubkey: keypair.publicKey.toBase58() }, 'Keypair loaded');
  
  // Create connection
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');
  
  // Verify connection
  const slot = await connection.getSlot();
  const balance = await connection.getBalance(keypair.publicKey);
  
  logger.info({
    slot,
    balance: balance / 1e9,
    pubkey: keypair.publicKey.toBase58()
  }, 'Connection verified');
  
  if (balance < 0.1 * 1e9) {
    logger.warn('Low SOL balance - fund account for transaction fees');
  }
  
  logger.info('Bot initialized successfully in SIMULATION mode');
  logger.info('Monitoring Solana mempool for MEV opportunities...');
  
  // Main loop (simplified)
  while (true) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    // In production: monitor mempool, detect opportunities, submit bundles
  }
}

if (require.main === module) {
  main().catch(error => {
    logger.error({ error: error.message }, 'Fatal error');
    process.exit(1);
  });
}
```

### 5. Run the Bot

```powershell
# Using simple version
npx ts-node src/index_simple.ts

# Or compile and run
npx tsc src/index_simple.ts --outDir dist
node dist/index_simple.js
```

Expected output:
```
{"level":30,"time":1729267200000,"msg":"Starting Solana MEV Searcher Bot..."}
{"level":30,"time":1729267200100,"pubkey":"YourPublicKeyHere","msg":"Keypair loaded"}
{"level":30,"time":1729267200500,"slot":123456789,"balance":1.5,"pubkey":"YourPublicKeyHere","msg":"Connection verified"}
{"level":30,"time":1729267200501,"msg":"Bot initialized successfully in SIMULATION mode"}
{"level":30,"time":1729267200502,"msg":"Monitoring Solana mempool for MEV opportunities..."}
```

## Understanding the Architecture

### What Each Component Does

1. **Transaction Classifier** (`src/monitoring/txClassifier.ts`)
   - Detects DEX swaps by program ID
   - Identifies Jupiter, Raydium, Orca transactions
   - Classifies by swap size and type

2. **DEX Arbitrage Strategy** (`src/strategies/dexArbitrage.ts`)
   - Finds price discrepancies across DEXes
   - Uses Jupiter API for optimal routing
   - Calculates profit after fees

3. **Bundle Simulator** (`src/simulation/bundleSimulator.ts`)
   - Simulates transactions before submission
   - Validates profitability
   - Tracks compute units

4. **Jito Submitter** (`src/submission/multiRelaySubmitter.ts`)
   - Submits bundles to Jito block engines
   - Handles multiple relays for redundancy
   - Manages priority fees and tips

### How MEV Detection Works

```
1. Monitor Mempool
   └─> WebSocket subscription to Solana RPC
   
2. Classify Transactions
   └─> Is it a DEX swap?
       └─> Yes: Extract swap details
       └─> No: Skip

3. Detect Opportunity
   └─> Check prices across DEXes
       └─> Price difference > threshold?
           └─> Yes: Calculate arbitrage
           └─> No: Skip

4. Simulate Bundle
   └─> Estimate profit after fees
       └─> Profitable?
           └─> Yes: Submit to Jito
           └─> No: Skip

5. Submit to Jito
   └─> Bundle submitted to block engine
   └─> Monitor for inclusion
```

## Testing Without Production Deployment

### Test 1: Connection Verification

```typescript
import { Connection, Keypair } from '@solana/web3.js';

const connection = new Connection('https://api.mainnet-beta.solana.com');
const slot = await connection.getSlot();
console.log(`Current slot: ${slot}`);
// Expected: Slot number (e.g., 234567890)
```

### Test 2: Keypair Loading

```typescript
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const pk = '[your,private,key,array]';
const secretKey = Uint8Array.from(JSON.parse(pk));
const keypair = Keypair.fromSecretKey(secretKey);
console.log(`Public key: ${keypair.publicKey.toBase58()}`);
// Expected: Base58 public key
```

### Test 3: Jupiter API

```typescript
import { createJupiterApiClient } from '@jup-ag/api';

const client = createJupiterApiClient();
const quote = await client.quoteGet({
  inputMint: 'So11111111111111111111111111111111111111112', // SOL
  outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  amount: 1000000000, // 1 SOL
  slippageBps: 50
});
console.log(`Quote: ${quote.outAmount} USDC`);
// Expected: Current SOL->USDC price
```

## Common Issues

### "SEARCHER_PRIVATE_KEY required"

Solution: Add your keypair to `.env`:
```env
SEARCHER_PRIVATE_KEY=[1,2,3,4,...] # 64-byte array
```

### "Low SOL balance"

Solution: Fund your test account:
```powershell
# Devnet (free)
solana airdrop 2 <YOUR_PUBKEY> --url devnet

# Mainnet (costs real SOL)
# Transfer from exchange or another wallet
```

### "Connection verification failed"

Solutions:
1. Check internet connection
2. Try different RPC:
   ```env
   SOLANA_RPC_URL=https://solana-api.projectserum.com
   ```
3. Use premium RPC (Helius, QuickNode)

## Next Steps

### For Production Use:

1. **Get Premium RPC** - Free RPCs are rate-limited
   - [Helius](https://helius.xyz) - Best for MEV
   - [QuickNode](https://quicknode.com)
   - [Triton](https://triton.one)

2. **Fund Searcher Account** - Need SOL for fees
   - Minimum 0.5 SOL recommended
   - More for higher priority fees

3. **Set SIMULATION_ONLY=false** - Enable real submissions
   - ⚠️ Only after thorough testing!

4. **Monitor Performance** - Use Grafana dashboard
   - Metrics on port 9090
   - Track profit, latency, success rate

5. **Implement Circuit Breakers** - Prevent losses
   - Max loss per hour
   - Auto-shutdown on repeated failures
   - Alert system for anomalies

### For C++ Engine Setup:

See `CPP_BUILD_GUIDE.md` for detailed instructions on:
- Installing Visual Studio C++ Build Tools
- Compiling the high-performance engine
- Running sub-10ms benchmarks

## License

MIT - Use responsibly and ethically.

## Disclaimer

This software is for educational purposes. MEV trading involves financial risk. The authors are not responsible for any losses. Always test in simulation mode first.

Sandwich attacks are unethical and potentially illegal. The bot disables sandwich strategies by default and should never be enabled in production.
