// Benchmark suite - Validates <10ms execution target
// Comprehensive performance testing for all components

#include "mev_engine.hpp"
#include <iostream>
#include <iomanip>
#include <chrono>
#include <x86intrin.h>

using namespace mev;
using namespace std::chrono;

// High-precision timing using RDTSC
class Timer {
    uint64_t start_;
public:
    Timer() : start_(__rdtsc()) {}
    
    uint64_t elapsed_cycles() const {
        return __rdtsc() - start_;
    }
    
    double elapsed_us() const {
        return elapsed_cycles() / 2400.0; // Assumes 2.4 GHz
    }
    
    double elapsed_ms() const {
        return elapsed_us() / 1000.0;
    }
};

// Create sample transaction
std::vector<uint8_t> create_sample_tx() {
    // Simplified RLP-encoded Uniswap V2 swap
    std::vector<uint8_t> tx = {
        0xf8, 0x6c, // List header
        0x01,       // Nonce
        0x85, 0x0b, 0xa4, 0x3b, 0x74, 0x00, // Gas price (50 gwei)
        0x83, 0x03, 0x0d, 0x40, // Gas limit (200k)
        // To address (Uniswap V2 Router)
        0x94, 0x7a, 0x25, 0x0d, 0x56, 0x30, 0xb4, 0xcf, 0x53, 0x97,
        0x39, 0xdf, 0x2c, 0x5d, 0xac, 0xb4, 0xc6, 0x59, 0xf2, 0x48, 0x8d,
        // Value (1 ETH)
        0x88, 0x0d, 0xe0, 0xb6, 0xb3, 0xa7, 0x64, 0x00, 0x00,
        // Data (swap function call)
        0xa4, 0x38, 0xed, 0x17, 0x39, // swapExactTokensForTokens selector
        // ... additional data ...
    };
    return tx;
}

void benchmark_rlp_parsing() {
    std::cout << "\n=== RLP Parser Benchmark ===\n";
    
    RLPParser parser;
    auto sample_tx = create_sample_tx();
    
    constexpr int iterations = 10000;
    Timer timer;
    
    int successful = 0;
    for (int i = 0; i < iterations; ++i) {
        if (parser.parse_transaction(sample_tx)) {
            ++successful;
        }
    }
    
    double avg_us = timer.elapsed_us() / iterations;
    std::cout << "  Parsed: " << successful << "/" << iterations << "\n";
    std::cout << "  Average: " << std::fixed << std::setprecision(2) 
              << avg_us << " μs\n";
    std::cout << "  Target:  < 100 μs\n";
    std::cout << "  Status:  " << (avg_us < 100 ? "✓ PASS" : "✗ FAIL") << "\n";
}

void benchmark_dag_filter() {
    std::cout << "\n=== DAG Filter Benchmark ===\n";
    
    DAGFilter filter(100000);
    
    // Create test transaction
    Transaction tx{};
    tx.to.data = {0x7a, 0x25, 0x0d, 0x56, 0x30, 0xb4, 0xcf, 0x53, 0x97, 0x39,
                  0xdf, 0x2c, 0x5d, 0xac, 0xb4, 0xc6, 0x59, 0xf2, 0x48, 0x8d};
    tx.data = {0x38, 0xed, 0x17, 0x39}; // swapExactTokensForTokens
    
    constexpr int iterations = 100000;
    Timer timer;
    
    int matches = 0;
    for (int i = 0; i < iterations; ++i) {
        if (filter.might_be_target(tx)) {
            ++matches;
        }
    }
    
    double avg_us = timer.elapsed_us() / iterations;
    std::cout << "  Matches: " << matches << "/" << iterations << "\n";
    std::cout << "  Average: " << std::fixed << std::setprecision(2) 
              << avg_us << " μs\n";
    std::cout << "  Target:  < 50 μs\n";
    std::cout << "  Status:  " << (avg_us < 50 ? "✓ PASS" : "✗ FAIL") << "\n";
}

void benchmark_shadow_fork() {
    std::cout << "\n=== Shadow Fork Benchmark ===\n";
    
    ShadowFork fork;
    
    // Create test bundle
    std::array<Transaction, 3> bundle{};
    for (auto& tx : bundle) {
        tx.value = {0, 0, 0, 1000000000000000000ULL}; // 1 ETH
        tx.gas_limit = 150000;
    }
    
    constexpr int iterations = 1000;
    Timer timer;
    
    int successful = 0;
    for (int i = 0; i < iterations; ++i) {
        auto result = fork.simulate_bundle(bundle);
        if (result.success) {
            ++successful;
        }
    }
    
    double avg_ms = timer.elapsed_ms() / iterations;
    std::cout << "  Successful: " << successful << "/" << iterations << "\n";
    std::cout << "  Average: " << std::fixed << std::setprecision(2) 
              << avg_ms << " ms\n";
    std::cout << "  Target:  < 4 ms\n";
    std::cout << "  Status:  " << (avg_ms < 4 ? "✓ PASS" : "✗ FAIL") << "\n";
}

void benchmark_optimal_sizer() {
    std::cout << "\n=== Optimal Sizer Benchmark ===\n";
    
    OptimalSizer sizer;
    
    // Pre-compute tables
    std::cout << "  Pre-computing lookup tables...\n";
    Timer precompute_timer;
    sizer.precompute_tables();
    std::cout << "  Pre-computation: " << std::fixed << std::setprecision(2)
              << precompute_timer.elapsed_ms() << " ms\n";
    
    // Benchmark calculations
    u256 victim_amount = {0, 0, 0, 10000000000000000000ULL}; // 10 ETH
    u256 reserve0 = {0, 0, 0, 1000000ULL * 1000000000000000000ULL};
    u256 reserve1 = {0, 0, 0, 2000000000ULL * 1000000ULL};
    
    constexpr int iterations = 10000;
    Timer timer;
    
    for (int i = 0; i < iterations; ++i) {
        [[maybe_unused]] auto result = sizer.calculate(victim_amount, reserve0, reserve1, 30);
    }
    
    double avg_us = timer.elapsed_us() / iterations;
    std::cout << "  Average: " << std::fixed << std::setprecision(2) 
              << avg_us << " μs\n";
    std::cout << "  Target:  < 500 μs\n";
    std::cout << "  Status:  " << (avg_us < 500 ? "✓ PASS" : "✗ FAIL") << "\n";
}

void benchmark_bundle_builder() {
    std::cout << "\n=== Bundle Builder Benchmark ===\n";
    
    BundleBuilder builder;
    
    Transaction victim_tx{};
    victim_tx.value = {0, 0, 0, 10000000000000000000ULL};
    
    u256 frontrun = {0, 0, 0, 1000000000000000000ULL};
    u256 backrun = {0, 0, 0, 1000000000000000000ULL};
    Address searcher{};
    
    constexpr int iterations = 10000;
    Timer timer;
    
    for (int i = 0; i < iterations; ++i) {
        auto bundle = builder.build_sandwich(victim_tx, frontrun, backrun, 1000000, searcher);
        [[maybe_unused]] auto encoded = builder.encode_bundle(bundle);
    }
    
    double avg_us = timer.elapsed_us() / iterations;
    std::cout << "  Average: " << std::fixed << std::setprecision(2) 
              << avg_us << " μs\n";
    std::cout << "  Target:  < 1000 μs\n";
    std::cout << "  Status:  " << (avg_us < 1000 ? "✓ PASS" : "✗ FAIL") << "\n";
}

void benchmark_full_pipeline() {
    std::cout << "\n=== Full Pipeline Benchmark (7-Step Algorithm) ===\n";
    std::cout << "  Target: 7-10 ms end-to-end\n\n";
    
    // Initialize engine
    MEVEngine::Config config{};
    config.min_profit_wei = {0, 0, 0, 10000000000000000ULL}; // 0.01 ETH
    config.max_gas_price = 300000000000; // 300 gwei
    config.num_threads = 4;
    
    MEVEngine engine(config);
    engine.initialize();
    
    std::cout << "  Engine initialized (pre-computation complete)\n\n";
    
    // Create sample transactions
    auto sample_tx = create_sample_tx();
    
    constexpr int iterations = 1000;
    Timer timer;
    
    int opportunities = 0;
    for (int i = 0; i < iterations; ++i) {
        if (engine.process_transaction(sample_tx)) {
            ++opportunities;
        }
    }
    
    double avg_ms = timer.elapsed_ms() / iterations;
    
    std::cout << "  Processed: " << iterations << " transactions\n";
    std::cout << "  Opportunities: " << opportunities << "\n";
    std::cout << "  Average: " << std::fixed << std::setprecision(2) 
              << avg_ms << " ms\n";
    std::cout << "  Target:  < 10 ms\n";
    std::cout << "  Status:  " << (avg_ms < 10 ? "✓ PASS" : "✗ FAIL") << "\n";
    
    // Print detailed 7-step metrics
    const auto& metrics = engine.get_metrics();
    std::cout << "\n  7-Step Algorithm Timing Breakdown:\n";
    std::cout << "    Step 1 (INGEST & FILTER):    " << std::fixed << std::setprecision(2)
              << metrics.step1_ingest_filter_us.load() / 1000.0 << " ms (< 1ms target)\n";
    std::cout << "    Step 2 (PARALLEL SIMULATION): " << std::fixed << std::setprecision(2)
              << metrics.step2_parallel_sim_us.load() / 1000.0 << " ms (2-4ms target)\n";
    std::cout << "    Step 3 (OPTIMAL SIZING):      " << std::fixed << std::setprecision(2)
              << metrics.step3_optimal_sizing_us.load() / 1000.0 << " ms (< 1ms target)\n";
    std::cout << "    Step 4 (VIABILITY CHECK):     " << std::fixed << std::setprecision(2)
              << metrics.step4_viability_check_us.load() / 1000.0 << " ms (< 1ms target)\n";
    std::cout << "    Step 5 (BUILD BUNDLE):        " << std::fixed << std::setprecision(2)
              << metrics.step5_build_bundle_us.load() / 1000.0 << " ms (< 1ms target)\n";
    std::cout << "    Step 6 (SUBMIT):              " << std::fixed << std::setprecision(2)
              << metrics.step6_submit_us.load() / 1000.0 << " ms (< 2ms target)\n";
    std::cout << "    TOTAL EXECUTION:              " << std::fixed << std::setprecision(2)
              << metrics.total_execution_us.load() / 1000.0 << " ms (7-10ms target)\n";
    
    engine.shutdown();
}

int main() {
    std::cout << "╔════════════════════════════════════════════════════╗\n";
    std::cout << "║  MEV Engine Performance Benchmark Suite           ║\n";
    std::cout << "║  Target: Sub-10ms End-to-End Execution            ║\n";
    std::cout << "╚════════════════════════════════════════════════════╝\n";
    
    benchmark_rlp_parsing();
    benchmark_dag_filter();
    benchmark_shadow_fork();
    benchmark_optimal_sizer();
    benchmark_bundle_builder();
    benchmark_full_pipeline();
    
    std::cout << "\n╔════════════════════════════════════════════════════╗\n";
    std::cout << "║  Benchmark Complete                                ║\n";
    std::cout << "╚════════════════════════════════════════════════════╝\n";
    
    return 0;
}
