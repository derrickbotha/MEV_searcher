# Solana MEV Searcher Bot 🚀

A high-performance MEV (Maximal Extractable Value) searcher bot for Solana, specialized in DEX arbitrage using Jito block engines.

## ✅ Status

**Conversion Complete** - All core components converted from Ethereum to Solana. Production-ready with simulation mode testing recommended.

## Features

- 🔍 **Multi-DEX Arbitrage**: Monitors Raydium, Jupiter, and Orca for price discrepancies
- ⚡ **Jito Integration**: Submits bundles to multiple Jito block engines for optimal execution
- 🎯 **Smart Simulation**: Validates profitability before submitting transactions
- 📊 **Real-time Monitoring**: Account subscriptions for instant opportunity detection
- 🛡️ **Risk Management**: Compute unit tracking, priority fee optimization
- 📈 **Metrics**: Prometheus-compatible metrics on port 9090

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Build
npm run build

# Run in simulation mode (safe)
npm start
```

## Configuration

Create `.env` file:

```env
SEARCHER_PRIVATE_KEY=[1,2,3,...]  # Your Solana keypair
SOLANA_RPC_URL=https://your-rpc.com
JITO_RELAY_URLS=https://mainnet.block-engine.jito.wtf
MIN_PROFIT_THRESHOLD_USD=10
SIMULATION_ONLY=true  # Set false for production
```

## Documentation

See [SOLANA_CONVERSION_STATUS.md](./SOLANA_CONVERSION_STATUS.md) for complete conversion details and architecture.

## License

MIT
