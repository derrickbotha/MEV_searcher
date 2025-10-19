#pragma once

#include "types.hpp"
#include "sandwich_strategy.hpp"
#include <functional>
#include <atomic>
#include <thread>

namespace mev {

/**
 * C++-Only MEV Engine - No TypeScript Dependencies
 * Ultra-high performance with sub-10ms execution guarantee
 *
 * Features:
 * - Pure C++ implementation with SIMD optimizations
 * - Built-in redundancy for critical operations
 * - Parallel processing with error recovery
 * - Direct hardware optimization (RDTSC timing, cache alignment)
 */
class MEVEngine {
public:
    struct Config {
        // Core settings
        u256 min_profit_wei = 0;
        u64 max_gas_price = 0;
        u32 max_slippage_bps = 50;

        // Sandwich attack settings (C++ only)
        bool enable_sandwich = false;
        u256 sandwich_min_victim_size = 10000000000ULL; // 10 SOL
        u8 sandwich_redundancy_level = 3;

        // Performance settings
        bool enable_parallel_sim = true;
        u8 num_threads = 4;
        bool simulation_only = true; // Safety first

        // Hardware optimization
        bool enable_simd = true;
        bool enable_rdtsc_timing = true;
    };

    explicit MEVEngine(const Config& config);
    ~MEVEngine();

    // Disable copy/move (singleton pattern)
    MEVEngine(const MEVEngine&) = delete;
    MEVEngine& operator=(const MEVEngine&) = delete;

    /**
     * Initialize C++-only engine with all redundancies
     * Pre-computes tables, initializes strategies, starts worker threads
     */
    bool initialize() noexcept;

    /**
     * Process raw transaction - C++ only, no TypeScript fallback
     * Main entry point for ultra-fast processing
     *
     * Returns: true if opportunity found and processed
     * Execution time: Guaranteed < 10ms
     */
    [[nodiscard]] bool process_transaction(std::span<const u8> raw_tx) noexcept;

    /**
     * Get comprehensive performance metrics
     */
    struct Metrics {
        // Transaction processing
        std::atomic<u64> txs_processed{0};
        std::atomic<u64> opportunities_found{0};
        std::atomic<u64> bundles_submitted{0};
        std::atomic<u64> total_profit_wei{0};

        // Timing (microseconds)
        std::atomic<u64> avg_parse_time_us{0};
        std::atomic<u64> avg_detection_time_us{0};
        std::atomic<u64> avg_build_time_us{0};
        std::atomic<u64> avg_submit_time_us{0};
        std::atomic<u64> total_execution_us{0};

        // Redundancy metrics
        std::atomic<u64> redundant_calculations{0};
        std::atomic<u64> calculation_failures{0};
        std::atomic<u64> recovery_events{0};

        // Performance targets
        static constexpr u64 TARGET_TOTAL_TIME_US = 10000; // 10ms
        static constexpr u64 TARGET_PARSE_TIME_US = 100;   // 0.1ms
        static constexpr u64 TARGET_DETECT_TIME_US = 5000; // 5ms
    };

    [[nodiscard]] const Metrics& get_metrics() const noexcept {
        return metrics_;
    }

    /**
     * Emergency shutdown with cleanup
     */
    void shutdown() noexcept;

private:
    Config config_;
    Metrics metrics_;

    // C++-only components (no TypeScript fallbacks)
    std::unique_ptr<SandwichAttackStrategy> sandwich_strategy_;

    // Worker threads for parallel processing
    std::vector<std::thread> worker_threads_;
    std::atomic<bool> running_{false};

    // Redundancy and error recovery
    struct RedundancyManager {
        std::atomic<u64> active_failovers{0};
        std::atomic<u64> successful_recoveries{0};

        bool initiate_failover() noexcept;
        void log_recovery_event() noexcept;
    } redundancy_mgr_;

    /**
     * Core processing pipeline - C++ only
     */

    /**
     * Phase 1: Ultra-fast transaction parsing (< 100μs)
     * Direct binary parsing with SIMD acceleration
     */
    [[nodiscard]] bool parse_transaction(std::span<const u8> raw_tx,
                                       Transaction& parsed) noexcept;

    /**
     * Phase 2: Strategy detection with redundancy (< 5ms)
     * Parallel execution of all enabled strategies
     */
    [[nodiscard]] bool detect_opportunities(const Transaction& tx) noexcept;

    /**
     * Phase 3: Bundle construction (< 2ms)
     * Direct binary serialization with validation
     */
    [[nodiscard]] bool build_bundle(const SandwichAttackStrategy::SandwichOpportunity& opp,
                                   std::vector<u8>& bundle_data) noexcept;

    /**
     * Phase 4: Submission with failover (< 3ms)
     * Multi-relay submission with automatic failover
     */
    [[nodiscard]] bool submit_bundle(const std::vector<u8>& bundle_data) noexcept;

    /**
     * Redundancy and error recovery functions
     */
    [[nodiscard]] bool execute_with_redundancy(std::function<bool()> operation) noexcept;
    void handle_processing_error(const std::string& error_msg) noexcept;
    void trigger_emergency_shutdown() noexcept;

    /**
     * Performance monitoring and optimization
     */
    [[nodiscard]] static u64 rdtsc_timestamp() noexcept;
    void update_performance_metrics(u64 start_time, u64 end_time) noexcept;
    void check_performance_targets() noexcept;

    /**
     * Hardware-optimized utilities
     */
    void prefetch_data(const void* addr) noexcept;
    void align_execution_caches() noexcept;
};

} // namespace mev

} // namespace mev
