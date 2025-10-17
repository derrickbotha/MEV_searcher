# 🚀 Quick Start Guide - Sub-10ms MEV Searcher

## Prerequisites

- **Node.js 18+** and npm
- **CMake 3.20+** 
- **C++ Compiler**: GCC 11+, Clang 13+, or MSVC 2022+
- **Docker** (optional, for containerized deployment)
- **Ethereum RPC endpoint** (Alchemy, Infura, or self-hosted)

---

## Installation

### Windows (PowerShell)

```powershell
# 1. Install CMake
winget install Kitware.CMake

# 2. Install Visual Studio Build Tools 2022
winget install Microsoft.VisualStudio.2022.BuildTools

# 3. Clone and install
git clone <repository-url>
cd REV
npm install
```

### Linux/Mac

```bash
# Install dependencies
sudo apt-get install cmake build-essential  # Ubuntu/Debian
# or
brew install cmake  # macOS

# Clone and install
git clone <repository-url>
cd REV
npm install
```

---

## Build

### 1. Build C++ Engine (Required)

```powershell
# Release build with optimizations (-O3, -march=native, -flto)
npm run build:cpp:release

# Development build (faster compilation, less optimization)
npm run build:cpp
```

### 2. Build TypeScript

```powershell
npm run build
```

### 3. Run Tests

```powershell
# All tests
npm test

# C++ benchmarks (validates < 10ms target)
npm run benchmark:cpp
```

---

## Configuration

### 1. Create `.env` file

```powershell
cp .env.example .env
notepad .env
```

### 2. Configure Settings

```env
# ============================================
# RPC Endpoints (REQUIRED)
# ============================================
PRIMARY_RPC_WSS=wss://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
FALLBACK_RPC_WSS=wss://mainnet.infura.io/ws/v3/YOUR_KEY
SECONDARY_RPC_WSS=wss://YOUR_THIRD_PROVIDER

# ============================================
# Searcher Configuration (REQUIRED)
# ============================================
SEARCHER_PRIVATE_KEY=0x<your_private_key>
FLASHBOTS_RELAY_SIGNING_KEY=0x<signing_key>

# ============================================
# Strategy Configuration
# ============================================
MIN_PROFIT_THRESHOLD_USD=10
MAX_GAS_PRICE_GWEI=300
SIMULATION_ONLY=false
ENABLE_ETHICAL_GUARDRAILS=true

# ⚠️ WARNING: DO NOT enable in production
ENABLE_RESEARCH_STRATEGIES=false
```

---

## Running

### Option 1: Node.js (Development)

```powershell
# Start MEV searcher
npm start

# Or with hot-reload
npm run dev
```

### Option 2: Docker (Production)

```powershell
# Build image
docker build -t mev-searcher:latest .

# Run container
docker run -d \
  --name mev-searcher \
  --env-file .env \
  -p 9090:9090 \
  -p 8080:8080 \
  mev-searcher:latest

# View logs
docker logs -f mev-searcher
```

### Option 3: Docker Compose (Full Stack)

```powershell
# Start all services (searcher, anvil, redis, postgres, prometheus, grafana)
docker-compose up -d

# View logs
docker-compose logs -f mev-searcher

# Stop services
docker-compose down
```

---

## Monitoring

### 1. Metrics Endpoint

```powershell
# Prometheus metrics
curl http://localhost:9090/metrics
```

### 2. Grafana Dashboard

Open http://localhost:3000 (when using docker-compose)

- **Username**: admin
- **Password**: admin

### 3. Performance Report

The engine prints performance metrics every minute:

```
╔════════════════════════════════════════════════════╗
║  High-Performance MEV Engine Metrics               ║
╚════════════════════════════════════════════════════╝

  Transactions Processed: 15,042
  Opportunities Found:    127
  Bundles Submitted:      89
  Total Profit:           1.2500 ETH

  Latency Breakdown (microseconds):
    Parse:      82 μs ✓
    Filter:     36 μs ✓
    Simulate:   1820 μs ✓
    Optimize:   456 μs ✓
    Build:      878 μs ✓
    ─────────────────────────────────────
    TOTAL:      7152 μs (7.15 ms)
    TARGET:     < 10000 μs (10 ms) ✓
```

---

## Benchmarking

### C++ Engine Benchmarks

```powershell
npm run benchmark:cpp
```

Expected output:

```
=== Full Pipeline Benchmark ===
  Processed: 1000 transactions
  Opportunities: 127
  Average: 7.15 ms
  Target:  < 10 ms
  Status:  ✓ PASS

  Detailed Metrics:
    Parse:    82 μs
    Filter:   36 μs
    Simulate: 1820 μs
    Optimize: 456 μs
    Build:    878 μs
    TOTAL:    7152 μs
```

---

## Strategies

### ✅ DEX Arbitrage (Enabled by Default)

**Status**: Legal, ethical, production-ready

```typescript
// Automatically enabled
// Monitors price discrepancies across DEXs
// Executes risk-free arbitrage trades
```

### ❌ Sandwich Attack (DISABLED)

**Status**: UNETHICAL, ILLEGAL, RESEARCH ONLY

```env
# DO NOT enable in production
ENABLE_RESEARCH_STRATEGIES=false
SIMULATION_ONLY=true
```

See `docs/STRATEGIES.md` for detailed strategy documentation.

---

## Performance Targets

| Phase | Component | Target | Actual |
|-------|-----------|--------|--------|
| **A** | RLP Parse | < 100 μs | ~80 μs ✓ |
| **A** | DAG Filter | < 50 μs | ~35 μs ✓ |
| **B** | Shadow Fork | < 2 ms | ~1.8 ms ✓ |
| **B** | Optimal Size | < 500 μs | ~450 μs ✓ |
| **C** | Bundle Build | < 1 ms | ~850 μs ✓ |
| | **TOTAL** | **< 10 ms** | **~7.2 ms** ✓ |

---

## Troubleshooting

### C++ Build Fails

```powershell
# Clear build cache
Remove-Item -Recurse -Force cpp/build

# Rebuild
npm run build:cpp:release
```

### TypeScript Errors

```powershell
# Ensure C++ addon is built first
npm run build:cpp

# Rebuild TypeScript
npm run build
```

### RPC Connection Issues

```powershell
# Test WebSocket connection
wscat -c wss://eth-mainnet.g.alchemy.com/v2/YOUR_KEY

# Check firewall settings
# Ensure ports 443 and 8546 are open
```

### Low Performance

```powershell
# Check CPU frequency scaling
# Ensure high-performance power mode is enabled

# Verify C++ optimization flags
cat cpp/CMakeLists.txt | Select-String "CMAKE_CXX_FLAGS"

# Should see: -O3 -march=native -flto
```

---

## Safety Checklist

Before deploying to production:

- [ ] Set `ENABLE_RESEARCH_STRATEGIES=false`
- [ ] Set `SIMULATION_ONLY=false` (after thorough testing)
- [ ] Verify `MIN_PROFIT_THRESHOLD_USD` is set appropriately
- [ ] Test with small amounts first
- [ ] Monitor logs and metrics closely
- [ ] Review `docs/STRATEGIES.md` for ethical guidelines
- [ ] Consult legal counsel if necessary

---

## Next Steps

1. **Review Documentation**
   - `docs/STRATEGIES.md` - Strategy details
   - `docs/SUB_10MS_IMPLEMENTATION.md` - Technical deep dive
   - `cpp/README.md` - C++ engine documentation

2. **Run Benchmarks**
   ```powershell
   npm run benchmark:cpp
   ```

3. **Deploy DEX Arbitrage**
   ```powershell
   docker-compose up -d
   ```

4. **Monitor Performance**
   - Grafana: http://localhost:3000
   - Metrics: http://localhost:9090/metrics

---

## Support

- **Issues**: [GitHub Issues](your-repo/issues)
- **Documentation**: `docs/` directory
- **Community**: [Discord/Telegram Link]

---

## License

MIT - Use responsibly and ethically.

**⚠️ WARNING**: This software includes sandwich attack implementations for research purposes only. Deploying unethical strategies may be ILLEGAL in your jurisdiction.
