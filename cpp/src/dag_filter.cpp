// DAG Filter with Bloom Filters - Target: <50 microseconds per transaction
// Uses SIMD hashing and bit manipulation for maximum speed

#include "dag_filter.hpp"
#include <functional>
#include <cstring>

namespace mev {

// Known DEX router addresses (pre-populated)
static constexpr std::array<const char*, 10> KNOWN_DEX_ROUTERS = {
    "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // Uniswap V2
    "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Uniswap V3
    "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F", // Sushiswap
    "0x1111111254fb6c44bAC0beD2854e76F90643097d", // 1inch V4
    "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", // Uniswap V3 SwapRouter02
    "0xDef1C0ded9bec7F1a1670819833240f027b25EfF", // 0x Exchange
    "0x881D40237659C251811CEC9c364ef91dC08D300C", // Metamask Swap
    "0x216B4B4Ba9F3e719726886d34a177484278Bfcae", // Token Swap
    "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD", // Uniswap Universal Router
    "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5", // KyberSwap
};

// Function selectors for DEX swaps
static constexpr std::array<u32, 8> DEX_SWAP_SELECTORS = {
    0x38ed1739, // swapExactTokensForTokens (Uniswap V2)
    0x8803dbee, // swapTokensForExactTokens
    0x7ff36ab5, // swapExactETHForTokens
    0x18cbafe5, // swapExactTokensForETH
    0x414bf389, // exactInputSingle (Uniswap V3)
    0xc04b8d59, // exactInput
    0x5ae401dc, // multicall (Uniswap V3)
    0x12aa3caf, // swap (generic)
};

DAGFilter::DAGFilter(u32 expected_elements) {
    // Pre-populate known DEX addresses
    for (const auto* router_hex : KNOWN_DEX_ROUTERS) {
        Address addr{};
        // Convert hex string to bytes (simplified)
        for (size_t i = 0; i < 20; ++i) {
            const char* hex_byte = router_hex + 2 + (i * 2); // Skip "0x"
            addr.data[i] = static_cast<u8>(
                (hex_digit(hex_byte[0]) << 4) | hex_digit(hex_byte[1])
            );
        }
        add_target(addr);
    }
    
    // Pre-populate function selectors
    for (u32 selector : DEX_SWAP_SELECTORS) {
        add_function_selector(selector);
    }
}

void DAGFilter::add_target(const Address& addr) noexcept {
    if (num_targets_ < target_addresses_.size()) {
        target_addresses_[num_targets_++] = addr;
    }
    
    // Add to bloom filter
    const auto hashes = hash_address(addr);
    for (u32 hash : hashes) {
        bloom_filter_.set(hash % BLOOM_SIZE);
    }
}

void DAGFilter::add_function_selector(u32 selector) noexcept {
    // Hash function selector and add to bloom
    for (u32 i = 0; i < NUM_HASH_FUNCTIONS; ++i) {
        u32 hash = (selector * 0x9e3779b9) ^ (i * 0x1f4a8c1d);
        bloom_filter_.set(hash % BLOOM_SIZE);
    }
}

// Fast bloom filter check - Target: <10 microseconds
bool DAGFilter::might_be_target(const Transaction& tx) const noexcept {
    // Check if 'to' address is in bloom filter
    const auto hashes = hash_address(tx.to);
    for (u32 hash : hashes) {
        if (!bloom_filter_.test(hash % BLOOM_SIZE)) {
            return false; // Definitely not a target
        }
    }
    
    // Check function selector (first 4 bytes of data)
    if (tx.data.size() >= 4) {
        u32 selector = (static_cast<u32>(tx.data[0]) << 24) |
                       (static_cast<u32>(tx.data[1]) << 16) |
                       (static_cast<u32>(tx.data[2]) << 8) |
                       static_cast<u32>(tx.data[3]);
        
        for (u32 i = 0; i < NUM_HASH_FUNCTIONS; ++i) {
            u32 hash = (selector * 0x9e3779b9) ^ (i * 0x1f4a8c1d);
            if (!bloom_filter_.test(hash % BLOOM_SIZE)) {
                return false;
            }
        }
    }
    
    return true; // Might be a target (needs detailed check)
}

// Detailed classification - Target: <50 microseconds
u8 DAGFilter::classify_transaction(const Transaction& tx) const noexcept {
    u8 type = UNKNOWN;
    
    // Check if it's a DEX swap
    if (is_dex_swap(tx)) {
        // Identify specific DEX
        if (tx.data.size() >= 4) {
            u32 selector = (static_cast<u32>(tx.data[0]) << 24) |
                           (static_cast<u32>(tx.data[1]) << 16) |
                           (static_cast<u32>(tx.data[2]) << 8) |
                           static_cast<u32>(tx.data[3]);
            
            if (selector == 0x38ed1739 || selector == 0x8803dbee) {
                type |= UNISWAP_V2_SWAP;
            } else if (selector == 0x414bf389 || selector == 0xc04b8d59) {
                type |= UNISWAP_V3_SWAP;
            } else if (selector == 0x12aa3caf) {
                type |= SUSHISWAP_SWAP;
            }
        }
    }
    
    // Check if large transfer (> $100k equivalent, ~50 ETH)
    constexpr u256 LARGE_THRESHOLD = {0, 0, 0, 50ULL * 1000000000ULL * 1000000000ULL};
    if (tx.value[3] > LARGE_THRESHOLD[3]) {
        type |= LARGE_TRANSFER;
    }
    
    // Check if high gas (> 500k)
    if (tx.gas_limit > 500000) {
        type |= HIGH_GAS;
    }
    
    return type;
}

// Fast hashing for bloom filter (uses FNV-1a variant)
std::array<u32, DAGFilter::NUM_HASH_FUNCTIONS> 
DAGFilter::hash_address(const Address& addr) const noexcept {
    std::array<u32, NUM_HASH_FUNCTIONS> hashes;
    
    for (u32 i = 0; i < NUM_HASH_FUNCTIONS; ++i) {
        u32 hash = 0x811c9dc5; // FNV offset basis
        
        for (u8 byte : addr.data) {
            hash ^= byte;
            hash *= 0x01000193; // FNV prime
            hash ^= i; // Mix in hash function index
        }
        
        hashes[i] = hash;
    }
    
    return hashes;
}

bool DAGFilter::is_dex_swap(const Transaction& tx) const noexcept {
    // Check if 'to' address matches known DEX router
    for (u32 i = 0; i < num_targets_; ++i) {
        if (tx.to == target_addresses_[i]) {
            return true;
        }
    }
    
    // Check function selector
    if (tx.data.size() >= 4) {
        u32 selector = (static_cast<u32>(tx.data[0]) << 24) |
                       (static_cast<u32>(tx.data[1]) << 16) |
                       (static_cast<u32>(tx.data[2]) << 8) |
                       static_cast<u32>(tx.data[3]);
        
        for (u32 dex_selector : DEX_SWAP_SELECTORS) {
            if (selector == dex_selector) {
                return true;
            }
        }
    }
    
    return false;
}

// Helper function to convert hex digit to byte
static inline u8 hex_digit(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return 0;
}

} // namespace mev
