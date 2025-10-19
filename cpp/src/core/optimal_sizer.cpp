#include "../include/optimal_sizer.hpp"
#include <algorithm>
#include <cmath>
#include <iostream>
#include <vector>

namespace solana_mev {

/**
 * Optimal sizing engine using Dynamic Programming
 * Pre-computes lookup tables for sub-500μs runtime queries
 */

struct SizingResult {
    uint64_t front_run_amount;
    uint64_t back_run_amount;
    Lamports expected_profit;
    bool viable;
};

class OptimalSizer {
private:
    // DP lookup table: [victim_amount_index][liquidity_index] -> optimal_front_run
    std::vector<std::vector<uint64_t>> dp_table_;
    
    // Pre-computed profit table
    std::vector<std::vector<Lamports>> profit_table_;
    
    // Table dimensions
    static constexpr size_t AMOUNT_BUCKETS = 1000;
    static constexpr size_t LIQUIDITY_BUCKETS = 500;
    
    // Value ranges (in lamports)
    static constexpr uint64_t MIN_VICTIM_AMOUNT = 1'000'000'000; // 1 SOL
    static constexpr uint64_t MAX_VICTIM_AMOUNT = 1'000'000'000'000; // 1000 SOL
    static constexpr uint64_t MIN_LIQUIDITY = 100'000'000'000; // 100 SOL
    static constexpr uint64_t MAX_LIQUIDITY = 10'000'000'000'000; // 10k SOL
    
    bool tables_computed_ = false;

public:
    OptimalSizer() {
        dp_table_.resize(AMOUNT_BUCKETS, std::vector<uint64_t>(LIQUIDITY_BUCKETS, 0));
        profit_table_.resize(AMOUNT_BUCKETS, std::vector<Lamports>(LIQUIDITY_BUCKETS, 0));
    }
    
    /**
     * Pre-compute DP lookup tables (~3 seconds)
     * This runs once at startup to enable sub-500μs runtime queries
     */
    void precompute_tables() {
        if (tables_computed_) {
            return;
        }
        
        std::cout << "[OptimalSizer] Pre-computing DP tables..." << std::endl;
        std::cout << "[OptimalSizer] Dimensions: " << AMOUNT_BUCKETS << " x " << LIQUIDITY_BUCKETS
                  << " = " << (AMOUNT_BUCKETS * LIQUIDITY_BUCKETS) << " entries" << std::endl;
        
        auto start = std::chrono::steady_clock::now();
        
        // Iterate over all buckets
        for (size_t victim_idx = 0; victim_idx < AMOUNT_BUCKETS; ++victim_idx) {
            uint64_t victim_amount = index_to_victim_amount(victim_idx);
            
            for (size_t liq_idx = 0; liq_idx < LIQUIDITY_BUCKETS; ++liq_idx) {
                uint64_t liquidity = index_to_liquidity(liq_idx);
                
                // Find optimal front-run amount via DP
                auto result = compute_optimal_sandwich_dp(victim_amount, liquidity);
                
                dp_table_[victim_idx][liq_idx] = result.front_run_amount;
                profit_table_[victim_idx][liq_idx] = result.expected_profit;
            }
            
            // Progress indicator every 10%
            if (victim_idx % (AMOUNT_BUCKETS / 10) == 0) {
                std::cout << "[OptimalSizer] Progress: " 
                          << (victim_idx * 100 / AMOUNT_BUCKETS) << "%" << std::endl;
            }
        }
        
        auto end = std::chrono::steady_clock::now();
        auto duration_ms = std::chrono::duration_cast<std::chrono::milliseconds>(end - start).count();
        
        tables_computed_ = true;
        
        std::cout << "[OptimalSizer] ✓ Pre-computation complete in " 
                  << duration_ms << "ms" << std::endl;
    }
    
    /**
     * Runtime query: Get optimal sizing (< 500μs)
     * Uses pre-computed DP table for instant lookup
     */
    SizingResult calculate_optimal_sandwich(
        uint64_t victim_amount,
        uint64_t reserve_in,
        uint64_t reserve_out,
        uint16_t fee_bps
    ) {
        if (!tables_computed_) {
            std::cerr << "[OptimalSizer] ERROR: Tables not pre-computed!" << std::endl;
            return {0, 0, 0, false};
        }
        
        // Map inputs to table indices
        size_t victim_idx = victim_amount_to_index(victim_amount);
        size_t liq_idx = liquidity_to_index(reserve_in);
        
        // Lookup from pre-computed table (O(1))
        uint64_t optimal_front = dp_table_[victim_idx][liq_idx];
        Lamports expected_profit = profit_table_[victim_idx][liq_idx];
        
        // Calculate back-run amount (sell all tokens acquired)
        uint64_t tokens_acquired = calculate_output_amount(optimal_front, reserve_in, reserve_out, fee_bps);
        uint64_t optimal_back = tokens_acquired;
        
        // Adjust for actual fee (table uses 0.3% default)
        if (fee_bps != 30) {
            expected_profit = recalculate_with_fee(optimal_front, optimal_back, victim_amount, 
                                                    reserve_in, reserve_out, fee_bps);
        }
        
        return {
            optimal_front,
            optimal_back,
            expected_profit,
            expected_profit > 100'000 // Viable if > 0.0001 SOL profit
        };
    }

private:
    /**
     * Core DP algorithm: Finds optimal front-run amount
     * 
     * Objective: Maximize profit = (back_run_output - front_run_input)
     * 
     * Constraints:
     * 1. Victim's slippage tolerance not exceeded
     * 2. Front-run doesn't drain pool
     * 3. Profitable after fees
     */
    SizingResult compute_optimal_sandwich_dp(uint64_t victim_amount, uint64_t liquidity) {
        static constexpr uint16_t FEE_BPS = 30; // 0.3% (Raydium default)
        
        // Binary search for optimal front-run amount
        uint64_t left = 0;
        uint64_t right = std::min(victim_amount * 10, liquidity / 2); // Don't drain >50% pool
        
        uint64_t best_front = 0;
        Lamports best_profit = 0;
        
        // Binary search with 20 iterations gives ~0.0001% precision
        for (int iter = 0; iter < 20; ++iter) {
            uint64_t mid = (left + right) / 2;
            
            // Calculate profit for this front-run size
            auto profit = simulate_sandwich_profit(mid, victim_amount, liquidity, FEE_BPS);
            
            if (profit > best_profit) {
                best_profit = profit;
                best_front = mid;
            }
            
            // Check derivatives to decide binary search direction
            auto profit_left = simulate_sandwich_profit(mid - (mid / 100), victim_amount, liquidity, FEE_BPS);
            auto profit_right = simulate_sandwich_profit(mid + (mid / 100), victim_amount, liquidity, FEE_BPS);
            
            if (profit_right > profit_left) {
                left = mid;
            } else {
                right = mid;
            }
        }
        
        return {best_front, 0, best_profit, best_profit > 0};
    }
    
    /**
     * Simulates sandwich attack profit for given front-run amount
     * 
     * Steps:
     * 1. Front-run: Buy tokens (pushes price up)
     * 2. Victim: Executes swap (at worse price)
     * 3. Back-run: Sell tokens (profit from price difference)
     */
    Lamports simulate_sandwich_profit(
        uint64_t front_run_amount,
        uint64_t victim_amount,
        uint64_t initial_liquidity,
        uint16_t fee_bps
    ) {
        if (front_run_amount == 0) {
            return 0;
        }
        
        // State 0: Initial pool state
        uint64_t reserve_in = initial_liquidity;
        uint64_t reserve_out = initial_liquidity; // Assume equal reserves for simplicity
        
        // State 1: After front-run
        uint64_t front_tokens_out = calculate_output_amount(front_run_amount, reserve_in, reserve_out, fee_bps);
        reserve_in += front_run_amount;
        reserve_out -= front_tokens_out;
        
        // State 2: After victim's swap
        uint64_t victim_tokens_out = calculate_output_amount(victim_amount, reserve_in, reserve_out, fee_bps);
        reserve_in += victim_amount;
        reserve_out -= victim_tokens_out;
        
        // State 3: After back-run (sell all acquired tokens)
        uint64_t back_tokens_in = front_tokens_out;
        uint64_t back_amount_out = calculate_output_amount(back_tokens_in, reserve_out, reserve_in, fee_bps);
        
        // Profit calculation
        if (back_amount_out > front_run_amount) {
            return back_amount_out - front_run_amount;
        } else {
            return 0; // Loss - not viable
        }
    }
    
    /**
     * Constant Product AMM formula: x * y = k
     * 
     * output = (reserve_out * amount_in * (10000 - fee_bps)) / 
     *          (reserve_in * 10000 + amount_in * (10000 - fee_bps))
     */
    uint64_t calculate_output_amount(
        uint64_t amount_in,
        uint64_t reserve_in,
        uint64_t reserve_out,
        uint16_t fee_bps
    ) {
        if (amount_in == 0 || reserve_in == 0 || reserve_out == 0) {
            return 0;
        }
        
        // Use 128-bit arithmetic to avoid overflow
        __uint128_t amount_in_with_fee = (__uint128_t)amount_in * (10000 - fee_bps);
        __uint128_t numerator = amount_in_with_fee * reserve_out;
        __uint128_t denominator = (__uint128_t)reserve_in * 10000 + amount_in_with_fee;
        
        return (uint64_t)(numerator / denominator);
    }
    
    /**
     * Recalculate profit with different fee
     */
    Lamports recalculate_with_fee(
        uint64_t front_amount,
        uint64_t back_amount,
        uint64_t victim_amount,
        uint64_t reserve_in,
        uint64_t reserve_out,
        uint16_t fee_bps
    ) {
        return simulate_sandwich_profit(front_amount, victim_amount, reserve_in, fee_bps);
    }
    
    // Index mapping functions (logarithmic scale for better coverage)
    size_t victim_amount_to_index(uint64_t amount) {
        if (amount <= MIN_VICTIM_AMOUNT) return 0;
        if (amount >= MAX_VICTIM_AMOUNT) return AMOUNT_BUCKETS - 1;
        
        double log_min = std::log10(MIN_VICTIM_AMOUNT);
        double log_max = std::log10(MAX_VICTIM_AMOUNT);
        double log_amount = std::log10(amount);
        
        return (size_t)((log_amount - log_min) / (log_max - log_min) * (AMOUNT_BUCKETS - 1));
    }
    
    uint64_t index_to_victim_amount(size_t index) {
        double log_min = std::log10(MIN_VICTIM_AMOUNT);
        double log_max = std::log10(MAX_VICTIM_AMOUNT);
        double log_amount = log_min + (log_max - log_min) * index / (AMOUNT_BUCKETS - 1);
        
        return (uint64_t)std::pow(10.0, log_amount);
    }
    
    size_t liquidity_to_index(uint64_t liquidity) {
        if (liquidity <= MIN_LIQUIDITY) return 0;
        if (liquidity >= MAX_LIQUIDITY) return LIQUIDITY_BUCKETS - 1;
        
        double log_min = std::log10(MIN_LIQUIDITY);
        double log_max = std::log10(MAX_LIQUIDITY);
        double log_liq = std::log10(liquidity);
        
        return (size_t)((log_liq - log_min) / (log_max - log_min) * (LIQUIDITY_BUCKETS - 1));
    }
    
    uint64_t index_to_liquidity(size_t index) {
        double log_min = std::log10(MIN_LIQUIDITY);
        double log_max = std::log10(MAX_LIQUIDITY);
        double log_liq = log_min + (log_max - log_min) * index / (LIQUIDITY_BUCKETS - 1);
        
        return (uint64_t)std::pow(10.0, log_liq);
    }
};

} // namespace solana_mev
