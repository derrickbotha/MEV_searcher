#pragma once

#include "types.hpp"
#include <bitset>
#include <array>

namespace mev {

/**
 * DAG (Directed Acyclic Graph) Filter using Bloom Filters.
 * Filters out non-target transactions in < 50 microseconds.
 * 
 * Target Transactions:
 * - Uniswap V2/V3 swaps
 * - Sushiswap swaps  
 * - Large value transfers (> $100k)
 */
class DAGFilter {
public:
    explicit DAGFilter(u32 expected_elements = 100000);
    
    /**
     * Add target addresses/function selectors to filter.
     * Call during initialization with known DEX addresses.
     */
    void add_target(const Address& addr) noexcept;
    void add_function_selector(u32 selector) noexcept;
    
    /**
     * Fast check if transaction is potentially interesting.
     * False positive rate: ~0.1%
     * Execution time: < 50 microseconds
     */
    [[nodiscard]] bool might_be_target(const Transaction& tx) const noexcept;
    
    /**
     * Detailed classification (if bloom filter passes).
     * Returns transaction type bitmask.
     */
    enum TxType : u8 {
        UNKNOWN = 0,
        UNISWAP_V2_SWAP = 1 << 0,
        UNISWAP_V3_SWAP = 1 << 1,
        SUSHISWAP_SWAP = 1 << 2,
        LARGE_TRANSFER = 1 << 3,
        HIGH_GAS = 1 << 4
    };
    
    [[nodiscard]] u8 classify_transaction(const Transaction& tx) const noexcept;

private:
    static constexpr size_t BLOOM_SIZE = 1 << 20; // 1M bits
    static constexpr u32 NUM_HASH_FUNCTIONS = 7;
    
    std::bitset<BLOOM_SIZE> bloom_filter_;
    std::array<Address, 256> target_addresses_; // Known DEX routers
    u32 num_targets_ = 0;
    
    [[nodiscard]] std::array<u32, NUM_HASH_FUNCTIONS> 
    hash_address(const Address& addr) const noexcept;
    
    [[nodiscard]] bool is_dex_swap(const Transaction& tx) const noexcept;
};

} // namespace mev
