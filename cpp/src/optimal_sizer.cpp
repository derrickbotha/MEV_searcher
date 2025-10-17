// Optimal Sizer - Pre-computed lookup tables - Target: <1ms
// Uses Dynamic Programming and Game Theory for optimal sizing

#include "optimal_sizer.hpp"
#include <cmath>
#include <algorithm>

namespace mev {

OptimalSizer::OptimalSizer() {
    // Initialize competitor model with pre-trained parameters
    competitor_model_.mean_tip_percentage = 0.15; // 15% of profit
    competitor_model_.std_dev = 0.05;
    competitor_model_.congestion_multiplier = 1.5;
}

// Calculate optimal sizing using DP lookup table - Target: <500 microseconds
OptimalSizer::OptimalSize OptimalSizer::calculate(
    u256 victim_amount_in,
    u256 pool_reserve0,
    u256 pool_reserve1,
    u32 pool_fee_bps
) const noexcept {
    // Bucket victim amount (log scale for better distribution)
    const u64 victim_val = victim_amount_in[0];
    const u32 victim_bucket = std::min(
        static_cast<u32>(std::log2(victim_val + 1) * 50),
        VICTIM_BUCKETS - 1
    );
    
    // Bucket pool liquidity
    const u64 liquidity = pool_reserve0[0] + pool_reserve1[0];
    const u32 liquidity_bucket = std::min(
        static_cast<u32>(std::log2(liquidity + 1) * 25),
        LIQUIDITY_BUCKETS - 1
    );
    
    // Lookup or interpolate
    if (lookup_table_[victim_bucket][liquidity_bucket].confidence > 0) {
        return lookup_table_[victim_bucket][liquidity_bucket];
    }
    
    // Fallback: compute on-the-fly using DP
    return compute_optimal_dp(victim_amount_in, pool_reserve0, pool_reserve1, pool_fee_bps);
}

// Dynamic Programming for optimal sizing - Used in pre-computation
OptimalSizer::OptimalSize OptimalSizer::compute_optimal_dp(
    u256 victim_amount,
    u256 reserve0,
    u256 reserve1,
    u32 fee_bps
) const noexcept {
    OptimalSize result{};
    
    // Simplified 64-bit math
    const u64 victim_in = victim_amount[0];
    const u64 r0 = reserve0[0];
    const u64 r1 = reserve1[0];
    
    // Calculate victim's expected output (no frontrun)
    const u64 victim_out_fair = (r1 * victim_in * (10000 - fee_bps)) / 
                                 ((r0 + victim_in) * 10000);
    
    // Try different frontrun sizes (0.1% to 50% of victim size)
    u64 best_frontrun = 0;
    u64 best_profit = 0;
    u64 best_slippage = 0;
    
    for (u32 pct = 1; pct <= 500; pct += 5) { // 0.1% to 50%
        const u64 frontrun_in = (victim_in * pct) / 1000;
        
        // Simulate: frontrun -> victim -> backrun
        
        // After frontrun
        const u64 frontrun_out = (r1 * frontrun_in * (10000 - fee_bps)) / 
                                  ((r0 + frontrun_in) * 10000);
        const u64 new_r0 = r0 + frontrun_in;
        const u64 new_r1 = r1 - frontrun_out;
        
        // After victim
        const u64 victim_out_sandwich = (new_r1 * victim_in * (10000 - fee_bps)) / 
                                         ((new_r0 + victim_in) * 10000);
        const u64 final_r0 = new_r0 + victim_in;
        const u64 final_r1 = new_r1 - victim_out_sandwich;
        
        // Backrun (sell frontrun_out)
        const u64 backrun_out = (final_r0 * frontrun_out * (10000 - fee_bps)) / 
                                 ((final_r1 + frontrun_out) * 10000);
        
        // Calculate profit
        const u64 gross_profit = backrun_out > frontrun_in ? 
                                  (backrun_out - frontrun_in) : 0;
        
        // Calculate victim slippage
        const u64 slippage = victim_out_fair > victim_out_sandwich ? 
                              (victim_out_fair - victim_out_sandwich) : 0;
        
        // Update best
        if (gross_profit > best_profit && slippage > 0) {
            best_frontrun = frontrun_in;
            best_profit = gross_profit;
            best_slippage = slippage;
        }
    }
    
    result.frontrun_amount = {0, 0, 0, best_frontrun};
    result.backrun_amount = result.frontrun_amount; // Sell same amount
    result.expected_profit = {0, 0, 0, best_profit};
    result.victim_slippage = {0, 0, 0, best_slippage};
    result.confidence = best_profit > 0 ? 90 : 0;
    
    return result;
}

// Estimate validator tip using game theory - Target: <100 microseconds
u64 OptimalSizer::estimate_validator_tip(
    u256 expected_profit,
    u32 block_base_fee,
    u8 mempool_congestion
) const noexcept {
    const u64 profit_wei = expected_profit[0];
    
    // Base tip: mean percentage of profit
    double tip_pct = competitor_model_.mean_tip_percentage;
    
    // Adjust for congestion
    if (mempool_congestion > 50) {
        tip_pct *= competitor_model_.congestion_multiplier;
    }
    
    // Calculate tip
    const u64 tip = static_cast<u64>(profit_wei * tip_pct);
    
    // Ensure minimum tip for inclusion
    const u64 min_tip = block_base_fee * 110 / 100; // 10% above base fee
    
    return std::max(tip, min_tip);
}

// Pre-compute lookup tables - Called at startup (~5 seconds)
void OptimalSizer::precompute_tables() noexcept {
    // Generate representative samples
    for (u32 v_bucket = 0; v_bucket < VICTIM_BUCKETS; ++v_bucket) {
        const u64 victim_amount = 1ULL << (v_bucket / 50); // Exponential scale
        
        for (u32 l_bucket = 0; l_bucket < LIQUIDITY_BUCKETS; ++l_bucket) {
            const u64 liquidity = 1ULL << (l_bucket / 25);
            
            // Assume 50/50 pool
            const u256 reserve0 = {0, 0, 0, liquidity / 2};
            const u256 reserve1 = {0, 0, 0, liquidity / 2};
            const u256 victim = {0, 0, 0, victim_amount};
            
            // Compute optimal size
            lookup_table_[v_bucket][l_bucket] = compute_optimal_dp(
                victim, reserve0, reserve1, 30 // 0.3% fee
            );
        }
    }
}

// Fast interpolation (if exact bucket not found)
OptimalSizer::OptimalSize OptimalSizer::interpolate(
    u256 victim_amount,
    u256 reserve0,
    u256 reserve1,
    u32 fee_bps
) const noexcept {
    // Simplified: use nearest neighbor
    return calculate(victim_amount, reserve0, reserve1, fee_bps);
}

} // namespace mev
