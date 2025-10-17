#pragma once

#include "types.hpp"
#include <span>
#include <optional>

namespace mev {

/**
 * Ultra-fast RLP parser optimized for sub-millisecond transaction parsing.
 * Uses zero-copy parsing and SIMD optimizations where possible.
 */
class RLPParser {
public:
    RLPParser() = default;
    
    /**
     * Parse raw RLP-encoded transaction in < 100 microseconds.
     * Zero-copy design - returns views into original buffer.
     */
    [[nodiscard]] static std::optional<Transaction> 
    parse_transaction(std::span<const u8> rlp_data) noexcept;
    
    /**
     * Optimized encoding for bundle submission (< 500 microseconds).
     */
    [[nodiscard]] static std::vector<u8> 
    encode_transaction(const Transaction& tx) noexcept;
    
    /**
     * Fast batch parsing for mempool streams (parallel SIMD).
     */
    static void parse_batch(
        std::span<const std::span<const u8>> rlp_batch,
        std::vector<Transaction>& out_txs
    ) noexcept;

private:
    [[nodiscard]] static std::optional<u64> 
    decode_length(std::span<const u8>& data) noexcept;
    
    [[nodiscard]] static std::optional<u256> 
    decode_uint256(std::span<const u8> data) noexcept;
    
    static void encode_length(u64 length, bool is_list, std::vector<u8>& out) noexcept;
};

} // namespace mev
