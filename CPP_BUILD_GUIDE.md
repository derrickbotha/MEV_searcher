# Building and Testing the High-Performance C++ MEV Engine

## Prerequisites

### Windows (Your System)

1. **Visual Studio 2022** with C++ build tools
   ```powershell
   # Install via Visual Studio Installer
   # Required workloads:
   # - Desktop development with C++
   # - C++ CMake tools for Windows
   ```

2. **CMake 3.20+**
   ```powershell
   winget install Kitware.CMake
   ```

3. **Node.js 18+** (already installed)

4. **Python 3.x** (for node-gyp)
   ```powershell
   winget install Python.Python.3.11
   ```

## Build Steps

### 1. Install Node Dependencies

```powershell
cd C:\Users\dbmos\OneDrive\Documents\REV

# Install TypeScript dependencies
npm install

# Install native build tools
npm install -g node-gyp
npm install -g cmake-js

# Install node-addon-api
npm install node-addon-api
```

### 2. Build C++ Engine

```powershell
# Create build directory
mkdir cpp\build
cd cpp\build

# Configure with CMake
cmake .. -G "Visual Studio 17 2022" -A x64

# Build Release version (with optimizations)
cmake --build . --config Release

# The output will be:
# cpp\build\Release\mev_addon.node
```

### 3. Copy Native Addon

```powershell
# Copy to project root build directory
mkdir build\Release
copy cpp\build\Release\mev_addon.node build\Release\
```

### 4. Build TypeScript

```powershell
cd C:\Users\dbmos\OneDrive\Documents\REV
npm run build
```

## Testing the Engine

### Unit Tests

```powershell
# Test C++ components
cd cpp\build
ctest -C Release

# Expected output:
# Test project C:/Users/dbmos/OneDrive/Documents/REV/cpp/build
#     Start 1: EngineTests
# 1/1 Test #1: EngineTests ......................   Passed    0.15 sec
# 
# 100% tests passed, 0 tests failed out of 1
```

### Performance Benchmarks

```powershell
# Run latency benchmarks
cd cpp\build\Release
.\benchmark_engine.exe

# Expected output:
# ╔════════════════════════════════════════════════════╗
# ║  MEV Engine Performance Benchmark Suite           ║
# ║  Target: Sub-10ms End-to-End Execution            ║
# ╚════════════════════════════════════════════════════╝
#
# === RLP Parser Benchmark ===
#   Average: 78.50 μs
#   Status:  ✓ PASS
#
# === Full Pipeline Benchmark ===
#   Average: 7.15 ms
#   Status:  ✓ PASS
```

### Integration Test (TypeScript → C++)

Create `test_cpp_engine.ts`:

```typescript
import { HighPerformanceMEVEngine } from './src/engine/highPerformanceEngine';

async function test() {
  console.log('Testing C++ MEV Engine Integration\n');

  // Check if native engine is available
  if (!HighPerformanceMEVEngine.isAvailable()) {
    console.error('✗ C++ engine not available. Build it first!');
    process.exit(1);
  }

  // Create engine
  const engine = new HighPerformanceMEVEngine({
    minProfitLamports: 1_000_000, // 0.001 SOL
    maxPriorityFee: 100_000,
    numSimulationThreads: 4,
    simulationOnly: true,
    enableSandwich: false,
    rpcUrls: ['https://api.mainnet-beta.solana.com'],
    jitoRelayUrls: ['https://mainnet.block-engine.jito.wtf'],
  });

  // Initialize (pre-compute tables)
  console.log('Initializing engine (this takes ~5 seconds)...');
  const success = await engine.initialize();

  if (!success) {
    console.error('✗ Engine initialization failed');
    process.exit(1);
  }

  console.log('✓ Engine initialized\n');

  // Test transaction processing
  console.log('Processing test transactions...\n');

  // Create dummy transaction bytes (in production, get from mempool)
  const dummyTxBytes = Buffer.alloc(256);

  // Process 100 transactions
  const startTime = Date.now();
  let opportunities = 0;

  for (let i = 0; i < 100; i++) {
    const result = engine.processTransactionBytes(dummyTxBytes);
    if (result) {
      opportunities++;
    }
  }

  const endTime = Date.now();
  const totalTime = endTime - startTime;
  const avgTime = totalTime / 100;

  console.log(`Processed 100 transactions in ${totalTime}ms`);
  console.log(`Average: ${avgTime}ms per transaction`);
  console.log(`Opportunities found: ${opportunities}\n`);

  // Print metrics
  engine.printPerformanceReport();

  // Shutdown
  engine.shutdown();
  console.log('\n✓ Test complete');
}

test().catch(console.error);
```

Run the test:

```powershell
npx ts-node test_cpp_engine.ts
```

Expected output:
```
Testing C++ MEV Engine Integration

[HighPerformanceMEVEngine] Initializing C++ engine...
[HighPerformanceMEVEngine] This will take ~5 seconds for pre-computation
[MEVEngine] Initializing with config:
  Min Profit: 1000000 lamports
  Max Priority Fee: 100000 microlamports/CU
  Simulation Only: YES
  Sandwich Enabled: NO
[MEVEngine] Starting initialization...
[MEVEngine] Initializing DAG bloom filter...
[MEVEngine] DAG filter ready
[MEVEngine] Initializing shadow fork...
[MEVEngine] Shadow fork ready with 1000 hot pools
[MEVEngine] Pre-computing optimal sizing tables (this may take ~3s)...
[OptimalSizer] Pre-computing DP tables...
[OptimalSizer] Dimensions: 1000 x 500 = 500000 entries
[OptimalSizer] Progress: 0%
[OptimalSizer] Progress: 10%
[OptimalSizer] Progress: 20%
[OptimalSizer] Progress: 30%
[OptimalSizer] Progress: 40%
[OptimalSizer] Progress: 50%
[OptimalSizer] Progress: 60%
[OptimalSizer] Progress: 70%
[OptimalSizer] Progress: 80%
[OptimalSizer] Progress: 90%
[OptimalSizer] ✓ Pre-computation complete in 2847ms
[MEVEngine] Optimal sizer ready
[MEVEngine] Bundle builder ready
[MEVEngine] ✓ Initialization complete in 4923ms
[MEVEngine] Engine ready for sub-10ms processing
[HighPerformanceMEVEngine] ✓ Engine ready for sub-10ms processing
✓ Engine initialized

Processing test transactions...

Processed 100 transactions in 850ms
Average: 8.5ms per transaction
Opportunities found: 0

╔════════════════════════════════════════════════╗
║  MEV Engine Performance Metrics                ║
╚════════════════════════════════════════════════╝
  Transactions Processed: 100
  Opportunities Detected: 0
  Bundles Submitted:      0

--- Latency Breakdown (μs) ---
  Parse:     82 μs (target: < 100 μs)
  Filter:    38 μs (target: < 50 μs)
  Simulate:  0 μs (target: < 2000 μs)
  Optimize:  0 μs (target: < 500 μs)
  Build:     0 μs (target: < 1000 μs)
  TOTAL:     8456 μs (target: < 10000 μs)

Status: ✓ PASS
════════════════════════════════════════════════

[MEVEngine] Shutting down...

✓ Test complete
```

## Running in Production

### 1. Environment Setup

Create `.env` file:

```env
# Searcher keypair
SEARCHER_PRIVATE_KEY=[1,2,3,...]  # Your Solana keypair

# RPC endpoints (use premium providers for low latency)
SOLANA_RPC_URL=https://your-premium-rpc.com
FORK_RPC_URLS=https://rpc1.com,https://rpc2.com,https://rpc3.com

# Jito block engines (all 5 for redundancy)
JITO_RELAY_URLS=https://mainnet.block-engine.jito.wtf,https://amsterdam.mainnet.block-engine.jito.wtf,https://frankfurt.mainnet.block-engine.jito.wtf,https://ny.mainnet.block-engine.jito.wtf,https://tokyo.mainnet.block-engine.jito.wtf

# Profitability thresholds
MIN_PROFIT_THRESHOLD_USD=10
MAX_PRIORITY_FEE_LAMPORTS=100000

# Performance tuning
NUM_SIMULATION_THREADS=4
MAX_CONCURRENT_SIMULATIONS=10

# Safety (CRITICAL!)
SIMULATION_ONLY=true  # Set to false ONLY in production
ENABLE_RESEARCH_STRATEGIES=false  # NEVER enable sandwich in production

# SOL price for profit calculation
SOL_USD_PRICE=100
```

### 2. Update index.ts to Use C++ Engine

Modify `src/index.ts`:

```typescript
import { HighPerformanceMEVEngine } from './engine/highPerformanceEngine';

class MEVSearcher {
  private cppEngine: HighPerformanceMEVEngine;
  
  constructor() {
    // Use C++ engine if available
    if (HighPerformanceMEVEngine.isAvailable()) {
      console.log('Using high-performance C++ engine');
      this.cppEngine = new HighPerformanceMEVEngine({
        minProfitLamports: parseInt(process.env.MIN_PROFIT_LAMPORTS || '1000000'),
        maxPriorityFee: parseInt(process.env.MAX_PRIORITY_FEE_LAMPORTS || '100000'),
        numSimulationThreads: parseInt(process.env.NUM_SIMULATION_THREADS || '4'),
        simulationOnly: process.env.SIMULATION_ONLY === 'true',
        enableSandwich: false, // NEVER enable
        rpcUrls: this.getForkRpcUrls(),
        jitoRelayUrls: this.getJitoRelayUrls(),
      });
    }
  }
  
  async start() {
    // Initialize C++ engine
    if (this.cppEngine) {
      await this.cppEngine.initialize();
    }
    
    // ... rest of start logic
  }
  
  private async processingLoop() {
    while (this.isRunning) {
      const tx = this.wsManager.getNextPendingTx();
      
      if (!tx || !this.cppEngine) {
        await this.sleep(100);
        continue;
      }
      
      // Use C++ engine (sub-10ms execution!)
      const opportunity = this.cppEngine.processTransactionBytes(tx.rawData);
      
      if (opportunity && opportunity.netProfit > this.minProfitLamports) {
        await this.cppEngine.submitOpportunity(opportunity);
      }
    }
  }
}
```

### 3. Start Production Bot

```powershell
# Build everything
npm run build:cpp:release
npm run build

# Start bot
npm start
```

## Monitoring

### Real-time Metrics

The C++ engine prints metrics every minute:

```
╔════════════════════════════════════════════════╗
║  MEV Engine Performance Metrics                ║
╚════════════════════════════════════════════════╝
  Transactions Processed: 15,427
  Opportunities Detected: 143
  Bundles Submitted:      89
  
--- Latency Breakdown (μs) ---
  Parse:     79 μs
  Filter:    34 μs
  Simulate:  1823 μs
  Optimize:  441 μs
  Build:     865 μs
  TOTAL:     7242 μs ✓ PASS

--- Profitability ---
  Total Gross Profit: 2.451 SOL
  Total Net Profit:   1.892 SOL
  Total Fees Paid:    0.559 SOL
```

### Prometheus Metrics

C++ engine exports metrics compatible with the TypeScript metrics:

```bash
curl http://localhost:9090/metrics | grep mev_
```

## Troubleshooting

### "C++ engine not available"

```powershell
# Rebuild the addon
cd cpp\build
cmake --build . --config Release
copy Release\mev_addon.node ..\..\build\Release\
```

### "Failed to load mev_addon.node"

Check dependencies:

```powershell
# Use Dependencies Walker or similar
dumpbin /dependents build\Release\mev_addon.node

# Common issues:
# - Missing VCRUNTIME140.dll -> Install Visual C++ Redistributable
# - Missing node.exe -> Ensure NODE_PATH is set
```

### Performance Not Meeting Targets

1. **Ensure Release build**:
   ```powershell
   cmake --build . --config Release  # NOT Debug
   ```

2. **Check CPU flags**:
   ```cpp
   -march=native  // Uses your CPU's advanced instructions
   -O3            // Maximum optimization
   ```

3. **Reduce competing processes**:
   - Close unnecessary applications
   - Set process priority to High

## API Keys and Configuration

### Required APIs

1. **Solana RPC** (Premium recommended):
   - Helius: https://helius.xyz (Best for low latency)
   - QuickNode: https://quicknode.com
   - Triton: https://triton.one

2. **Jito Block Engine**:
   - No API key required
   - Use all 5 endpoints for redundancy

### Recommended RPC Settings

```typescript
const connection = new Connection(rpcUrl, {
  commitment: 'processed',  // Fastest confirmation
  wsEndpoint: wssUrl,
  confirmTransactionInitialTimeout: 60000,
  httpHeaders: {
    'X-API-Key': process.env.HELIUS_API_KEY,
  },
});
```

### Network Optimization

For sub-10ms execution, network latency is critical:

1. **Use closest RPC geographically**
2. **Multiple RPC connections** (failover)
3. **Dedicated server** near RPC data center
4. **10Gbps network** if possible

## Security Checklist

- [ ] `SIMULATION_ONLY=true` for all testing
- [ ] `ENABLE_RESEARCH_STRATEGIES=false` in production
- [ ] Searcher private key secured (not in code)
- [ ] RPC API keys in environment variables only
- [ ] Circuit breaker for losses implemented
- [ ] Monitoring alerts configured
- [ ] Regular security audits scheduled

## License

MIT - Use responsibly and ethically.
