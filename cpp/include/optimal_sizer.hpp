#pragma once

#include "types.hpp"
#include <array>

namespace mev {

/**
 * Optimal Sizing Engine using Pre-Computed Lookup Tables.
 * Calculates optimal frontrun/backrun amounts in < 1ms.
 * 
 * Uses Dynamic Programming to pre-compute optimal sizes for
 * various victim trade sizes and pool states.
 */
class OptimalSizer {
public:
    OptimalSizer();
    
    /**
     * Calculate optimal frontrun amount to maximize profit.
     * Uses pre-computed DP table + interpolation for speed.
     * 
     * Target: < 500 microseconds
     */
    struct OptimalSize {
        u256 frontrun_amount;
        u256 backrun_amount;
        u256 expected_profit;
        u256 victim_slippage;
        u8 confidence; // 0-100
    };
    
    [[nodiscard]] OptimalSize calculate(
        u256 victim_amount_in,
        u256 pool_reserve0,
        u256 pool_reserve1,
        u32 pool_fee_bps
    ) const noexcept;
    
    /**
     * Game theory model: estimate minimum validator tip to win.
     * Uses stochastic modeling of competitor behavior.
     * 
     * Target: < 100 microseconds
     */
    [[nodiscard]] u64 estimate_validator_tip(
        u256 expected_profit,
        u32 block_base_fee,
        u8 mempool_congestion // 0-100
    ) const noexcept;
    
    /**
     * Pre-compute lookup tables (called at startup).
     * Takes ~5 seconds, saves millions in runtime.
     */
    void precompute_tables() noexcept;

private:
    // Lookup table: [victim_size_bucket][pool_liquidity_bucket] -> optimal_size
    static constexpr size_t VICTIM_BUCKETS = 1000;
    static constexpr size_t LIQUIDITY_BUCKETS = 500;
    
    std::array<std::array<OptimalSize, LIQUIDITY_BUCKETS>, VICTIM_BUCKETS> lookup_table_;
    
    // DP function for optimal sizing (used in pre-computation)
    [[nodiscard]] OptimalSize compute_optimal_dp(
        u256 victim_amount,
        u256 reserve0,
        u256 reserve1,
        u32 fee_bps
    ) const noexcept;
    
    // Fast interpolation between bucket values
    [[nodiscard]] OptimalSize interpolate(
        u256 victim_amount,
        u256 reserve0,
        u256 reserve1,
        u32 fee_bps
    ) const noexcept;
    
    // Stochastic model parameters (pre-trained)
    struct CompetitorModel {
        double mean_tip_percentage;
        double std_dev;
        double congestion_multiplier;
    } competitor_model_;
};

} // namespace mev
