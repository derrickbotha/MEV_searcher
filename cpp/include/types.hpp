#pragma once

#include <array>
#include <cstdint>
#include <string_view>
#include <vector>

namespace mev {

// Ultra-compact types for minimal memory footprint
using u8 = uint8_t;
using u16 = uint16_t;
using u32 = uint32_t;
using u64 = uint64_t;
using u128 = __uint128_t;
using u256 = std::array<u64, 4>;

// Ethereum address (20 bytes)
struct Address {
    std::array<u8, 20> data;
    
    constexpr bool operator==(const Address& other) const noexcept {
        return data == other.data;
    }
};

// Ethereum hash (32 bytes)
struct Hash {
    std::array<u8, 32> data;
};

// Transaction (minimal fields for speed)
struct Transaction {
    Address from;
    Address to;
    u256 value;
    u64 gas_limit;
    u256 gas_price;
    u64 nonce;
    std::vector<u8> data;
    u64 timestamp_us; // Microsecond precision
};

// MEV Opportunity (compact representation)
struct Opportunity {
    Transaction victim_tx;
    u256 frontrun_amount;
    u256 backrun_amount;
    u256 expected_profit;
    u64 validator_tip;
    u32 target_block;
    u8 confidence; // 0-100
};

// MEV Bundle
struct Bundle {
    std::array<Transaction, 3> txs; // [frontrun, victim, backrun]
    u256 total_profit;
    u64 total_gas;
    u64 validator_tip;
};

} // namespace mev
