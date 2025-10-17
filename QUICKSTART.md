# Quick Start Guide - MEV Searcher Bot

## 🚀 5-Minute Quick Start

### Step 1: Prerequisites Check

```powershell
# Check Node.js version (should be v18+)
node --version

# Check npm version (should be v9+)
npm --version

# Check Docker (optional, for containerized deployment)
docker --version

# Install Foundry (for Anvil simulation)
# Visit: https://book.getfoundry.sh/getting-started/installation
```

### Step 2: Clone and Install

```powershell
# Clone the repository
git clone https://github.com/yourorg/mev-searcher.git
cd mev-searcher

# Install dependencies
npm install
```

### Step 3: Configure Environment

```powershell
# Copy the example environment file
cp .env.example .env

# Open and edit .env with your configuration
notepad .env
```

**CRITICAL Configuration Items:**

```env
# Get free RPC URLs from:
# - Alchemy: https://www.alchemy.com/
# - Infura: https://infura.io/

MAINNET_RPC_URL=https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY
MAINNET_RPC_WS=wss://eth-mainnet.alchemyapi.io/v2/YOUR_KEY

# For testing, use SIMULATION_ONLY mode
SIMULATION_ONLY=true

# Set minimum profit threshold
MIN_PROFIT_THRESHOLD_USD=10

# IMPORTANT: Never use real private keys during testing!
SEARCHER_PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000000
```

### Step 4: Run Tests (TDD Approach)

```powershell
# Run unit tests
npm test

# Run with coverage report
npm test -- --coverage

# Watch mode for development
npm run test:watch
```

### Step 5: Start Development

```powershell
# Build the project
npm run build

# Start in development mode
npm run dev
```

## 🐳 Docker Quick Start (Recommended)

### Option 1: Docker Compose (All-in-One)

```powershell
# Copy environment file
cp .env.example .env

# Edit .env with your RPC URLs
notepad .env

# Start all services (Searcher + Anvil + Redis + Postgres + Prometheus + Grafana)
docker-compose up -d

# View logs
docker-compose logs -f mev-searcher

# Check service status
docker-compose ps

# Access services:
# - Application: http://localhost:8080/health
# - Metrics: http://localhost:9090/metrics
# - Prometheus: http://localhost:9091
# - Grafana: http://localhost:3000 (admin/admin)

# Stop services
docker-compose down
```

### Option 2: Docker Only

```powershell
# Build image
docker build -t mev-searcher:latest .

# Run container
docker run -d \
  --name mev-searcher \
  -p 9090:9090 \
  -p 8080:8080 \
  --env-file .env \
  mev-searcher:latest

# View logs
docker logs -f mev-searcher

# Stop container
docker stop mev-searcher
docker rm mev-searcher
```

## ☸️ Kubernetes Quick Start

### Step 1: Prepare Secrets

```powershell
# Edit the Kubernetes deployment with your values
notepad k8s\deployment.yaml

# Update the Secret section with base64-encoded values
# PowerShell command to encode:
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("your-secret-value"))
```

### Step 2: Deploy

```powershell
# Apply Kubernetes manifests
kubectl apply -f k8s\deployment.yaml

# Check deployment status
kubectl get pods -n mev-searcher

# View logs
kubectl logs -f deployment/mev-searcher -n mev-searcher

# Port forward to access locally
kubectl port-forward -n mev-searcher svc/mev-searcher 9090:9090 8080:8080
```

## 📊 Verify Installation

### Health Check

```powershell
# Check application health
curl http://localhost:8080/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2025-10-17T12:00:00.000Z",
#   "uptime": 123.45
# }
```

### Metrics Check

```powershell
# Check Prometheus metrics
curl http://localhost:9090/metrics

# Should return metrics like:
# bundle_submission_latency_ms_bucket{le="50",relay="flashbots"} 42
# simulation_success_rate 0.87
# bundles_submitted_total{relay="flashbots"} 150
```

### View Logs

```powershell
# Docker Compose
docker-compose logs -f mev-searcher

# Docker
docker logs -f mev-searcher

# Kubernetes
kubectl logs -f deployment/mev-searcher -n mev-searcher

# Local
npm run dev
```

## 🧪 Testing Your Setup

### Run Integration Tests

```powershell
# Start Anvil fork locally
anvil --fork-url YOUR_RPC_URL

# In another terminal, run integration tests
npm run test:integration
```

### Run Performance Tests

```powershell
npm run test:perf
```

## 🎯 First Bundle Submission (Simulation Mode)

1. **Ensure SIMULATION_ONLY=true** in your `.env` file
2. **Start the application** (Docker or local)
3. **Monitor logs** for opportunity detection
4. **Check metrics** at http://localhost:9090/metrics

Expected log output:
```
INFO: MEV Searcher Bot started successfully
INFO: RPC connections initialized
INFO: Relay clients initialized
INFO: Strategies registered
INFO: Opportunity detected strategy=example profit=15.5
INFO: Simulation successful netProfitUSD=15.5
```

## 🔧 Troubleshooting

### Issue: "Cannot connect to RPC"
**Solution**: Verify your RPC URLs in `.env` are correct and active

```powershell
# Test RPC connection
curl YOUR_RPC_URL -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### Issue: "Anvil not found"
**Solution**: Install Foundry

```powershell
# Windows (use WSL or Git Bash)
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Issue: "Tests failing"
**Solution**: Ensure all dependencies are installed

```powershell
# Clean install
rm -rf node_modules package-lock.json
npm install
npm test
```

### Issue: "Docker build fails"
**Solution**: Check Docker is running and you have enough disk space

```powershell
docker system df
docker system prune
```

## 📈 Next Steps

1. **Configure Strategies**: Edit `src/strategies/` to add custom MEV strategies
2. **Tune Parameters**: Adjust `MIN_PROFIT_THRESHOLD_USD`, `MAX_GAS_PRICE_GWEI`
3. **Set Up Monitoring**: Configure Grafana dashboards at http://localhost:3000
4. **Production Deployment**: Switch to Kubernetes for production scale
5. **Enable Real Transactions**: Set `SIMULATION_ONLY=false` (after thorough testing!)

## ⚠️ Production Checklist

Before running in production with real funds:

- [ ] Test in SIMULATION_ONLY mode for at least 7 days
- [ ] Verify all tests pass (npm test)
- [ ] Review strategy profitability metrics
- [ ] Configure proper alerting (Prometheus + Grafana)
- [ ] Set up secure key management (AWS KMS / HashiCorp Vault)
- [ ] Use dedicated RPC endpoints (not free tier)
- [ ] Enable ethical guardrails (ENABLE_ETHICAL_GUARDRAILS=true)
- [ ] Set conservative profit thresholds initially
- [ ] Start with small amounts
- [ ] Monitor 24/7 for the first week

## 📞 Support

- **Issues**: https://github.com/yourorg/mev-searcher/issues
- **Discussions**: https://github.com/yourorg/mev-searcher/discussions
- **Documentation**: See README.md

## 🎓 Learning Resources

- [Flashbots Documentation](https://docs.flashbots.net/)
- [MEV Wiki](https://www.mev.wiki/)
- [Foundry Book](https://book.getfoundry.sh/)
- [Ethers.js Docs](https://docs.ethers.org/v6/)

---

**Ready to start? Run: `docker-compose up -d` 🚀**
