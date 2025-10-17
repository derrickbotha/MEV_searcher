#pragma once

#include "types.hpp"
#include <unordered_map>
#include <memory>

namespace mev {

/**
 * Shadow Fork - In-Memory EVM State for Ultra-Fast Simulation.
 * Executes transactions in < 2ms with parallel execution support.
 * 
 * Design: Maintains hot cache of frequently accessed contract state.
 */
class ShadowFork {
public:
    ShadowFork();
    
    /**
     * Simulate transaction execution and return state changes.
     * Target: < 2ms including state lookups
     */
    struct SimulationResult {
        bool success;
        u256 gas_used;
        u256 state_delta; // Price impact
        std::vector<u8> return_data;
    };
    
    [[nodiscard]] SimulationResult 
    simulate(const Transaction& tx) noexcept;
    
    /**
     * Parallel simulation of [frontrun, victim, backrun] bundle.
     * Returns combined result in 2-4ms.
     */
    struct BundleSimResult {
        bool success;
        u256 frontrun_profit;
        u256 backrun_profit;
        u256 total_gas;
        u256 victim_slippage;
    };
    
    [[nodiscard]] BundleSimResult 
    simulate_bundle(const std::array<Transaction, 3>& bundle) noexcept;
    
    /**
     * Update state from latest block (called every 12s).
     */
    void sync_state(u32 block_number) noexcept;
    
    /**
     * Pre-warm cache with top DEX pool states.
     */
    void prewarm_pools(std::span<const Address> pool_addresses) noexcept;

private:
    struct PoolState {
        u256 reserve0;
        u256 reserve1;
        u32 fee_bps; // Basis points
        u64 last_update;
    };
    
    // Hot cache: 1000 most active pools
    std::unordered_map<Address, PoolState> pool_cache_;
    
    // Simulate AMM swap using x*y=k formula (optimized)
    [[nodiscard]] u256 simulate_amm_swap(
        const PoolState& pool,
        u256 amount_in,
        bool zero_for_one
    ) const noexcept;
    
    // Fast state lookup with fallback to RPC
    [[nodiscard]] std::optional<PoolState> 
    get_pool_state(const Address& pool) noexcept;
};

} // namespace mev
