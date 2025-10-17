#pragma once

#include "types.hpp"
#include "rlp_parser.hpp"
#include "dag_filter.hpp"
#include "shadow_fork.hpp"
#include "optimal_sizer.hpp"
#include "bundle_builder.hpp"

#include <functional>
#include <atomic>
#include <thread>

namespace mev {

/**
 * Main MEV Engine - Orchestrates sub-10ms opportunity detection and execution.
 * 
 * Implements the Updated Sandwich Attack Algorithm for Sub-10ms Execution:
 * 
 * Step 1: INGEST & FILTER (< 1ms)
 *         - DAG Filtering + Custom RLP Parser on Direct Node Peer Stream
 * 
 * Step 2: PARALLEL SIMULATION (2-4ms) 
 *         - Shadow Fork/In-Memory EVM Sandbox (Parallel execution of Tx_A, Tx_Victim, Tx_B)
 * 
 * Step 3: OPTIMAL SIZING (< 1ms)
 *         - Pre-Trained RL/NN Inference Model determines Tx_A size for maximum profit
 * 
 * Step 4: VIABILITY CHECK (< 1ms)
 *         - Calculate Final Net Profit (P_Net = P_Gross - Gas - (Tip via Stochastic Model))
 * 
 * Step 5: BUILD BUNDLE (< 1ms)
 *         - RLP-Encode Transactions (Optimized Rust/C++ RLP-Encoding of MEV_Bundle)
 * 
 * Step 6: SUBMIT (< 2ms)
 *         - Direct gRPC Submission to the fastest MEV Relay API endpoint
 * 
 * Step 7: CONFIRM
 *         - Monitor Block Inclusion and log final profit
 * 
 * Total: 7-10ms from mempool detection to bundle submission
 */
class MEVEngine {
public:
    struct Config {
        u256 min_profit_wei = 0; // Minimum profit threshold
        u64 max_gas_price = 0;
        u32 max_slippage_bps = 50; // Max victim slippage (0.5%)
        bool enable_parallel_sim = true;
        u8 num_threads = 4;
    };
    
    explicit MEVEngine(const Config& config);
    ~MEVEngine();
    
    // Disable copy/move (singleton pattern)
    MEVEngine(const MEVEngine&) = delete;
    MEVEngine& operator=(const MEVEngine&) = delete;
    
    /**
     * Initialize engine and pre-warm caches.
     * Must be called before processing transactions.
     */
    void initialize() noexcept;
    
    /**
     * Process raw mempool transaction (main entry point).
     * Called by Node.js layer on every new pending transaction.
     * 
     * Returns: true if opportunity found and bundle submitted
     * Execution time: 7-10ms (target)
     */
    [[nodiscard]] bool process_transaction(std::span<const u8> raw_tx) noexcept;
    
    /**
     * Callback for opportunity detection.
     * Called when profitable opportunity is found.
     */
    using OpportunityCallback = std::function<void(const Opportunity&)>;
    void set_opportunity_callback(OpportunityCallback callback) noexcept;
    
    /**
     * Callback for bundle submission (submits via gRPC).
     */
    using SubmissionCallback = std::function<bool(const std::vector<u8>&)>;
    void set_submission_callback(SubmissionCallback callback) noexcept;
    
    /**
     * Performance metrics with detailed step timing.
     */
    struct Metrics {
        std::atomic<u64> txs_processed{0};
        std::atomic<u64> opportunities_found{0};
        std::atomic<u64> bundles_submitted{0};
        std::atomic<u64> total_profit_wei{0};
        
        // Step-by-step latency tracking (microseconds)
        std::atomic<u64> step1_ingest_filter_us{0};    // Step 1: < 1ms
        std::atomic<u64> step2_parallel_sim_us{0};     // Step 2: 2-4ms
        std::atomic<u64> step3_optimal_sizing_us{0};   // Step 3: < 1ms
        std::atomic<u64> step4_viability_check_us{0};  // Step 4: < 1ms
        std::atomic<u64> step5_build_bundle_us{0};     // Step 5: < 1ms
        std::atomic<u64> step6_submit_us{0};           // Step 6: < 2ms
        std::atomic<u64> total_execution_us{0};        // Total: 7-10ms
        
        // Rolling averages
        std::atomic<u64> avg_step1_us{0};
        std::atomic<u64> avg_step2_us{0};
        std::atomic<u64> avg_step3_us{0};
        std::atomic<u64> avg_step4_us{0};
        std::atomic<u64> avg_step5_us{0};
        std::atomic<u64> avg_step6_us{0};
        std::atomic<u64> avg_total_us{0};
    };
    
    [[nodiscard]] const Metrics& get_metrics() const noexcept {
        return metrics_;
    }
    
    /**
     * Graceful shutdown.
     */
    void shutdown() noexcept;

private:
    Config config_;
    
    // Core components (ultra-lean, minimal overhead)
    RLPParser parser_;
    DAGFilter filter_;
    ShadowFork shadow_fork_;
    OptimalSizer sizer_;
    BundleBuilder builder_;
    
    // Callbacks
    OpportunityCallback opportunity_callback_;
    SubmissionCallback submission_callback_;
    
    // Metrics
    Metrics metrics_;
    
    // Thread pool for parallel simulation
    std::vector<std::thread> worker_threads_;
    std::atomic<bool> running_{false};
    
    /**
     * Core pipeline stages (inlined for speed).
     */
    
    /**
     * Step 1: INGEST & FILTER - Ultra-fast RLP parsing and bloom filtering.
     * Target: <1ms execution time.
     */
    [[nodiscard]] inline bool 
    step1_ingest_filter(std::span<const u8> raw_tx, Transaction& parsed) noexcept;
    
    /**
     * Step 2: PARALLEL SIMULATION - Shadow fork EVM execution.
     * Target: 2-4ms execution time.
     */
    [[nodiscard]] inline bool 
    step2_parallel_simulation(const Transaction& victim_tx, 
                              SimulationResult& result) noexcept;
    
    /**
     * Step 3: OPTIMAL SIZING - Pre-computed DP tables with RL/NN inference.
     * Target: <1ms execution time.
     */
    [[nodiscard]] inline bool 
    step3_optimal_sizing(const SimulationResult& sim_result,
                         OptimalSize& optimal) noexcept;
    
    /**
     * Step 4: VIABILITY CHECK - Profitability and risk assessment.
     * Target: <1ms execution time.
     */
    [[nodiscard]] inline bool 
    step4_viability_check(const OptimalSize& optimal,
                          const SimulationResult& sim_result) noexcept;
    
    /**
     * Step 5: BUILD BUNDLE - Optimized RLP encoding and bundle construction.
     * Target: <1ms execution time.
     */
    [[nodiscard]] inline bool 
    step5_build_bundle(const Transaction& victim_tx,
                       const OptimalSize& optimal,
                       std::vector<u8>& bundle_data) noexcept;
    
    /**
     * Step 6: SUBMIT - Relay submission with Flashbots/Eden.
     * Target: <2ms execution time.
     */
    [[nodiscard]] inline bool 
    step6_submit(const std::vector<u8>& bundle_data) noexcept;
    
    /**
     * Step 7: CONFIRM - Bundle inclusion confirmation.
     */
    inline void step7_confirm(const std::vector<u8>& bundle_data) noexcept;
    
    // Timing utilities (use RDTSC for nanosecond precision)
    [[nodiscard]] static inline u64 timestamp_us() noexcept;
};

} // namespace mev
