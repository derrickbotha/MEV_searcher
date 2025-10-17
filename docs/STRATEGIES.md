# MEV Strategies - Comprehensive Guide

## Overview

This document describes the MEV strategies implemented in the searcher bot, including their algorithms, ethical considerations, and implementation details.

## ⚠️ CRITICAL: Ethical Framework

### Legal Strategies (Production-Safe)
- ✅ DEX Arbitrage
- ✅ Liquidation bots (future)
- ✅ Gas optimization (future)

### Unethical Strategies (Research/Education ONLY)
- ❌ Sandwich attacks
- ❌ Frontrunning user transactions
- ❌ Oracle manipulation

**The codebase enforces `isLegal` flag. Unethical strategies CANNOT run in production.**

---

## 1. DEX Arbitrage Strategy

### Algorithm 2: Basic MEV - Price Difference Arbitrage

**Status**: ✅ LEGAL & ETHICAL

**Description**: Profit from price differences between two Decentralized Exchanges (DEXs). This strategy actually HELPS the market by balancing prices.

### Implementation

```typescript
class DexArbitrageStrategy implements Strategy {
  name = 'DEX_ARBITRAGE';
  isLegal = true; // Ethical arbitrage
}
```

### Algorithm Steps

#### Step 1: TRIGGER - Transaction Spotted
```
Monitor mempool for new Tx_Pending involving token swaps
↓
Identify transactions that might create price imbalances
```

#### Step 2: COMPARE PRICES - Check DEXs
```
Query current prices across multiple DEXs:
- Uniswap V2
- Uniswap V3
- Sushiswap
- Curve
- 1inch

For each Asset_X, get:
  Price_Uniswap = getPrice(UNISWAP, Asset_X)
  Price_Sushiswap = getPrice(SUSHISWAP, Asset_X)
```

#### Step 3: IDENTIFY OPPORTUNITY - Find Discrepancy
```
IF (Price_DEX_A ≠ Price_DEX_B) THEN
  Potential arbitrage exists
  
Calculate price difference:
  ΔPrice = |Price_DEX_A - Price_DEX_B|
  
IF (ΔPrice / Price_DEX_A > 0.5%) THEN
  Significant arbitrage opportunity
```

#### Step 4: CALCULATE PROFIT - Model Trade
```
Buy on Cheaper DEX:
  Cost = Amount × Price_Cheap
  
Sell on Expensive DEX:
  Revenue = Amount × Price_Expensive
  
Gross Profit:
  P_Gross = Revenue - Cost
  P_Gross = Amount × (Price_Expensive - Price_Cheap)
```

#### Step 5: DETERMINE VIABILITY - Check Gas & Fees
```
Calculate net profit:
  P_Net = P_Gross - Gas_Fee - Validator_Tip
  
Where:
  Gas_Fee = Gas_Used × Gas_Price
  Gas_Used ≈ 400,000 (two DEX swaps)
  Validator_Tip ≈ 0.01 ETH
  
IF (P_Net > MIN_PROFIT_THRESHOLD) THEN
  Opportunity is viable
```

#### Step 6: EXECUTE - Submit Bundle
```
IF (P_Net > 0) THEN
  Construct bundle:
    Bundle = [
      Tx_Buy  (on cheaper DEX),
      Tx_Sell (on expensive DEX)
    ]
  
  Submit to:
    - Flashbots Relay
    - Eden Network
    - bloXroute
```

### Example

```
Scenario:
- Uniswap V3: 1 ETH = 2000 USDC
- Sushiswap:  1 ETH = 2010 USDC
- Price difference: $10 (0.5%)

Trade Amount: 10 ETH

Calculations:
1. Buy 10 ETH on Uniswap: Cost = $20,000
2. Sell 10 ETH on Sushiswap: Revenue = $20,100
3. Gross Profit: $100

Gas Costs:
- Gas: 400,000 × 50 Gwei = 0.02 ETH = $40
- Tip: 0.01 ETH = $20

Net Profit: $100 - $40 - $20 = $40 ✅ Profitable
```

### Configuration

```env
MIN_PROFIT_THRESHOLD_USD=10    # Minimum profit to execute
MAX_GAS_PRICE_GWEI=300        # Maximum gas price limit
```

### Why This is Ethical

1. **Helps Market Efficiency**: Balances prices across DEXs
2. **No Victims**: Doesn't exploit individual users
3. **Provides Liquidity**: Improves overall market liquidity
4. **Legal**: Fully compliant with regulations

---

## 2. Sandwich Attack Strategy

### Algorithm 3: Sandwich Attack (UNETHICAL)

**Status**: ❌ ILLEGAL & UNETHICAL - RESEARCH ONLY

**Warning**: This strategy exploits individual users and causes direct financial harm. It is implemented ONLY for educational purposes and security research.

### Implementation

```typescript
class SandwichAttackStrategy implements Strategy {
  name = 'SANDWICH_ATTACK';
  isLegal = false; // CRITICAL: Marked as unethical
}
```

### Algorithm Steps

#### Step 1: MEMPOOL LISTEN - Identify Target
```
Monitor mempool for large swap transactions:
  
FOR each Tx_Pending DO
  IF (Tx_Value > $10,000 AND Type = DEX_SWAP) THEN
    Identify as Tx_Victim
    Calculate price impact of victim's trade
```

#### Step 2: PRICE SIMULATION - Simulate Slippage
```
Simulate victim's transaction:
  
Initial State:
  P_Initial = getCurrentPrice(Asset_Y)
  Liquidity_Initial = getCurrentLiquidity(Pool)
  
Execute Victim Trade (simulation):
  applyTrade(Tx_Victim, Pool)
  
Final State:
  P_Final = getCurrentPrice(Asset_Y)
  
Price Impact:
  ΔP = P_Final - P_Initial
```

#### Step 3: FRONT-RUN TX (Tx_A) - Buy Order
```
Create Tx_A (Front-run):
  Action: BUY Asset_Y
  Amount: Optimal_Amount (typically 10-20% of victim's size)
  Gas_Price: Victim_Gas + 1 Gwei (to execute first)
  
Effect:
  Slightly moves price UP before victim's trade
```

#### Step 4: BACK-RUN TX (Tx_B) - Sell Order
```
Create Tx_B (Back-run):
  Action: SELL Asset_Y
  Amount: Same as Tx_A
  Gas_Price: Victim_Gas - 1 Gwei (to execute after)
  
Effect:
  Sells at P_Final (higher price) due to victim's slippage
```

#### Step 5: VIABILITY CHECK - Calculate Profit
```
Revenue from Tx_B:
  Revenue = Amount × P_Final
  
Cost of Tx_A:
  Cost = Amount × P_Initial
  
Gas Costs:
  Gas_Total = Gas_Tx_A + Gas_Tx_B + Gas_Victim_Incentive
  Gas_Total ≈ 600,000 × Gas_Price
  
Validator Tip:
  Tip = 0.02 ETH (higher for sandwich)
  
Net Profit:
  Profit_Net = Revenue - Cost - Gas_Total - Tip
```

#### Step 6: BUILD BUNDLE - Ensure Order
```
IF (Profit_Net > $100) THEN  // Higher threshold
  Construct MEV_Bundle with GUARANTEED ordering:
  
  MEV_Bundle = [
    Tx_A        (Front-run: Buy before victim),
    Tx_Victim   (Original trade),
    Tx_B        (Back-run: Sell after victim)
  ]
  
  CRITICAL: Order MUST be maintained
```

#### Step 7: EXECUTE - Submit Bundle
```
Submit MEV_Bundle to MEV Block Builder:
  - Guaranteed atomic execution
  - All 3 transactions in EXACT order
  - Same block inclusion
  
Result:
  IF included THEN
    Attacker profits
    Victim receives WORSE price than expected
```

### Example Attack Scenario

```
Victim Transaction:
- Swap 100 ETH → USDC
- Expected: ~$200,000 USDC
- Slippage tolerance: 1%

Attacker's Sandwich:

1. Tx_A (Front-run):
   - Buy 10 ETH → USDC
   - Price moves from $2000 → $2002
   
2. Tx_Victim (Executes):
   - Victim buys at inflated price
   - Gets $199,500 instead of $200,000
   - Victim LOSES $500
   
3. Tx_B (Back-run):
   - Sell 10 ETH at $2005
   - Attacker GAINS from victim's slippage

Attacker's Profit:
- Revenue: $20,050 (sell at inflated price)
- Cost: $20,000 (buy at initial price)
- Gross: $50
- Gas: $120 (3 transactions @ high gas)
- Net: -$70 (unprofitable in this case)
```

### Why This is Unethical

1. **Direct Victim**: Exploits specific user transactions
2. **Financial Harm**: Causes measurable loss to victims
3. **Manipulative**: Artificially moves prices
4. **Potentially Illegal**: May violate securities laws in many jurisdictions
5. **Undermines Trust**: Damages ecosystem reputation

### Safety Mechanisms

```typescript
// Code enforces multiple safety checks:

1. isLegal = false (cannot run in production)
2. Requires SIMULATION_ONLY = true
3. Requires ENABLE_RESEARCH_STRATEGIES = true
4. Logs warnings on every operation
5. StrategyRegistry rejects in production
```

### Legal Considerations

**United States**: May violate:
- Wire Fraud (18 U.S.C. § 1343)
- Commodities fraud
- Market manipulation laws

**European Union**: May violate:
- Market Abuse Regulation (MAR)
- MiFID II provisions

**Consult legal counsel before ANY implementation.**

---

## Strategy Comparison

| Feature | DEX Arbitrage | Sandwich Attack |
|---------|---------------|-----------------|
| **Legality** | ✅ Legal | ❌ Potentially Illegal |
| **Ethics** | ✅ Ethical | ❌ Unethical |
| **Victim** | None | Direct user harm |
| **Market Impact** | Positive (efficiency) | Negative (manipulation) |
| **Production Use** | ✅ Allowed | ❌ Blocked |
| **Bundle Size** | 2 transactions | 3 transactions |
| **Gas Cost** | ~400k | ~600k |
| **Profit Target** | $10+ | $100+ |
| **Implementation** | Fully implemented | Research only |

---

## Adding New Strategies

### Template

```typescript
import { Strategy, ClassifiedTx, Opportunity, Bundle, ProfitEstimate, ForkHandle } from '../types';

export class MyStrategy implements Strategy {
  name = 'MY_STRATEGY';
  description = 'Description of strategy';
  isLegal = true; // CRITICAL: Set correctly
  
  async detect(txs: ClassifiedTx[]): Promise<Opportunity | null> {
    // Step 1: Identify opportunities
    // Step 2: Calculate profitability
    // Step 3: Return opportunity or null
  }
  
  async buildBundle(opportunity: Opportunity): Promise<Bundle> {
    // Construct transaction bundle
  }
  
  async estimateProfit(bundle: Bundle, fork: ForkHandle): Promise<ProfitEstimate> {
    // Simulate on fork and calculate profit
  }
}
```

### Registration

```typescript
// In src/index.ts
const myStrategy = new MyStrategy();
this.strategyRegistry.register(myStrategy);
```

---

## Testing Strategies

### Unit Tests

```typescript
describe('MyStrategy', () => {
  test('has correct legal status', () => {
    expect(strategy.isLegal).toBe(true);
  });
  
  test('detects opportunities', async () => {
    const result = await strategy.detect(mockTxs);
    expect(result).toBeDefined();
  });
  
  test('calculates profit correctly', async () => {
    const profit = await strategy.estimateProfit(bundle, fork);
    expect(profit.netProfitUSD).toBeGreaterThan(0);
  });
});
```

### Integration Tests

```bash
# Start Anvil fork
anvil --fork-url $MAINNET_RPC_URL

# Run integration tests
npm run test:integration
```

---

## Monitoring Strategy Performance

### Metrics

```
# Opportunities detected
opportunities_detected_total{strategy="DEX_ARBITRAGE"} 42

# Profit earned
profit_earned_usd{strategy="DEX_ARBITRAGE"} 1250.50

# Success rate
bundle_inclusion_rate 0.42
```

### Grafana Queries

```promql
# Strategy profitability
sum(rate(profit_earned_usd[1h])) by (strategy)

# Opportunity detection rate
rate(opportunities_detected_total[5m])
```

---

## Future Strategies

### Planned (Ethical)

1. **Liquidation Bot**: Liquidate undercollateralized positions on lending protocols
2. **Gas Optimization**: Submit transactions with optimal gas prices
3. **NFT Arbitrage**: Profit from NFT price differences across marketplaces

### Research Only (Unethical)

1. **Oracle Manipulation**: (Educational analysis only)
2. **Time-Bandit Attacks**: (Research documentation only)

---

## References

- [Flashbots Ethics](https://github.com/flashbots/mev-research)
- [MEV Wiki](https://www.mev.wiki/)
- [Ethereum Foundation: MEV](https://ethereum.org/en/developers/docs/mev/)

---

**Remember**: Always prioritize ethics and legality over profit. Build systems that improve the ecosystem, not exploit its users.
