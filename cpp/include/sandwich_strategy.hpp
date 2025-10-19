#pragma once

#include "types.hpp"
#include <vector>
#include <array>
#include <atomic>
#include <mutex>
#include <functional>
#include <thread>
#include <chrono>

namespace mev {

/**
 * C++-Only Sandwich Attack Strategy with Built-in Redundancies
 *
 * WARNING: This strategy is UNETHICAL and potentially ILLEGAL.
 * Implemented for research purposes only.
 *
 * Features:
 * - Triple-redundant profit calculations
 * - Backup sizing algorithms (DP + RL + Heuristic)
 * - Failover simulation engines
 * - Parallel execution with error recovery
 * - Sub-10ms execution guarantee
 */
class SandwichAttackStrategy {
public:
    struct Config {
        u256 min_victim_trade_size = 10000000000ULL; // 10 SOL minimum
        u256 max_priority_fee = 1000000ULL;          // 0.001 SOL max fee
        u32 max_slippage_bps = 50;                   // 0.5% max slippage
        u8 redundancy_level = 3;                     // Triple redundancy
        bool enable_parallel_exec = true;
        u8 num_worker_threads = 4;
        bool simulation_only = false;                // Safety flag
    };

    struct SandwichOpportunity {
        Transaction victim_tx;
        u256 optimal_front_amount;
        u256 optimal_back_amount;
        u256 expected_gross_profit;
        u256 expected_net_profit;
        u64 compute_units_estimate;
        u64 priority_fee_estimate;
        u8 confidence_score; // 0-100
        std::chrono::microseconds processing_time;
        bool is_redundant_calculation; // True if multiple methods agreed
    };

    explicit SandwichAttackStrategy(const Config& config);
    ~SandwichAttackStrategy();

    // Disable copy/move
    SandwichAttackStrategy(const SandwichAttackStrategy&) = delete;
    SandwichAttackStrategy& operator=(const SandwichAttackStrategy&) = delete;

    /**
     * Initialize strategy with pre-computed tables and redundancy systems
     */
    bool initialize();

    /**
     * Detect sandwich opportunity from victim transaction
     * Returns opportunity if profitable, nullopt otherwise
     * Target: < 5ms execution time
     */
    [[nodiscard]] std::optional<SandwichOpportunity>
    detect_opportunity(const Transaction& victim_tx) noexcept;

    /**
     * Build sandwich bundle [Tx_A, Tx_Victim, Tx_B]
     * Critical: Order must be maintained for effectiveness
     */
    [[nodiscard]] std::optional<std::vector<u8>>
    build_bundle(const SandwichOpportunity& opp) noexcept;

    /**
     * Estimate profit with simulation (redundant calculations)
     */
    [[nodiscard]] std::optional<u256>
    estimate_profit(const SandwichOpportunity& opp) noexcept;

    /**
     * Get performance metrics
     */
    struct Metrics {
        std::atomic<u64> opportunities_detected{0};
        std::atomic<u64> bundles_built{0};
        std::atomic<u64> redundant_calculations{0};
        std::atomic<u64> failed_calculations{0};
        std::atomic<u64> avg_detection_time_us{0};
        std::atomic<u64> avg_build_time_us{0};
        std::atomic<u64> total_profit_generated{0};
    };

    [[nodiscard]] const Metrics& get_metrics() const noexcept {
        return metrics_;
    }

    /**
     * Shutdown with cleanup
     */
    void shutdown() noexcept;

private:
    Config config_;
    Metrics metrics_;

    // Redundancy systems
    struct RedundancyEngine {
        // Primary: Dynamic Programming (fastest, most accurate)
        std::vector<std::vector<u256>> dp_profit_table_;
        std::vector<std::vector<u256>> dp_front_amounts_;
        std::vector<std::vector<u256>> dp_back_amounts_;

        // Secondary: Reinforcement Learning model (adaptive)
        std::vector<float> rl_weights_;
        std::vector<std::vector<float>> rl_state_action_values_;

        // Tertiary: Heuristic approximation (fallback)
        struct HeuristicParams {
            float front_run_ratio = 0.25f;    // 25% of victim trade
            float profit_margin = 0.02f;      // 2% expected profit
            float slippage_estimate = 0.005f; // 0.5% slippage
        } heuristic_params_;

        // Agreement checking
        bool calculations_agree(u256 dp_result, u256 rl_result, u256 heur_result) const;
        u256 consensus_value(u256 dp, u256 rl, u256 heur) const;
    } redundancy_engine_;

    // Parallel execution
    std::vector<std::thread> worker_threads_;
    std::atomic<bool> running_{false};
    std::mutex calculation_mutex_;

    // Pre-computed constants for speed
    static constexpr u64 COMPUTE_UNITS_FRONT_RUN = 150000;
    static constexpr u64 COMPUTE_UNITS_BACK_RUN = 150000;
    static constexpr u64 COMPUTE_UNITS_VICTIM = 100000;
    static constexpr u64 JITO_TIP_LAMPORTS = 500000; // 0.0005 SOL

    /**
     * Core detection pipeline with redundancy
     */

    /**
     * Phase 1: Victim Analysis (< 1ms)
     * Check if transaction is sandwichable
     */
    [[nodiscard]] bool analyze_victim(const Transaction& tx) noexcept;

    /**
     * Phase 2: Redundant Profit Calculations (< 2ms)
     * Run DP, RL, and heuristic calculations in parallel
     */
    [[nodiscard]] std::optional<std::array<u256, 3>>
    calculate_profits_redundant(const Transaction& victim_tx) noexcept;

    /**
     * Phase 3: Optimal Sizing with Fallbacks (< 1ms)
     * Use consensus from redundant calculations
     */
    [[nodiscard]] std::optional<std::pair<u256, u256>>
    calculate_optimal_sizes(const Transaction& victim_tx, u256 consensus_profit) noexcept;

    /**
     * Phase 4: Viability Check (< 1ms)
     * Final profitability and risk assessment
     */
    [[nodiscard]] bool check_viability(const SandwichOpportunity& opp) noexcept;

    /**
     * Redundancy calculation methods
     */

    /**
     * Primary: Dynamic Programming optimal sizing
     * Pre-computed table lookup for O(1) queries
     */
    [[nodiscard]] u256 calculate_dp_profit(const Transaction& victim_tx) noexcept;

    /**
     * Secondary: RL-based sizing with online learning
     * Adapts to market conditions
     */
    [[nodiscard]] u256 calculate_rl_profit(const Transaction& victim_tx) noexcept;

    /**
     * Tertiary: Fast heuristic approximation
     * Always works, reasonable accuracy
     */
    [[nodiscard]] u256 calculate_heuristic_profit(const Transaction& victim_tx) noexcept;

    /**
     * Parallel execution helpers
     */
    using CalculationResult = std::optional<u256>;
    using CalculationTask = std::function<CalculationResult()>;

    [[nodiscard]] std::array<CalculationResult, 3>
    execute_parallel_calculations(const Transaction& victim_tx) noexcept;

    /**
     * Bundle construction with validation
     */
    [[nodiscard]] std::optional<std::vector<u8>>
    construct_sandwich_bundle(const SandwichOpportunity& opp) noexcept;

    /**
     * Utility functions
     */
    [[nodiscard]] static u64 timestamp_us() noexcept;
    void update_metric(std::atomic<u64>& metric, u64 new_value) noexcept;

    /**
     * Pre-computation for redundancy tables
     */
    void precompute_dp_tables() noexcept;
    void initialize_rl_model() noexcept;
    void calibrate_heuristics() noexcept;
};

} // namespace mev