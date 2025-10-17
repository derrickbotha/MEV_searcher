#pragma once

#include "types.hpp"
#include <span>

namespace mev {

/**
 * Ultra-Fast Bundle Builder and RLP Encoder.
 * Constructs and encodes MEV bundles in < 1ms.
 */
class BundleBuilder {
public:
    BundleBuilder() = default;
    
    /**
     * Build complete sandwich bundle [frontrun, victim, backrun].
     * Target: < 500 microseconds
     */
    [[nodiscard]] Bundle build_sandwich(
        const Transaction& victim_tx,
        u256 frontrun_amount,
        u256 backrun_amount,
        u64 validator_tip,
        const Address& searcher_address
    ) noexcept;
    
    /**
     * RLP-encode bundle for MEV relay submission.
     * Optimized encoding: < 300 microseconds
     */
    [[nodiscard]] std::vector<u8> encode_bundle(const Bundle& bundle) noexcept;
    
    /**
     * Sign transactions with private key (uses libsecp256k1).
     * Target: < 200 microseconds per signature
     */
    void sign_transaction(
        Transaction& tx,
        const std::array<u8, 32>& private_key
    ) noexcept;

private:
    // Pre-allocated buffer for encoding (avoid allocations)
    mutable std::vector<u8> encode_buffer_;
    
    // Fast transaction construction from template
    [[nodiscard]] Transaction create_swap_transaction(
        const Address& router,
        const Address& from,
        u256 amount_in,
        u256 amount_out_min,
        const std::array<Address, 2>& path,
        u64 deadline
    ) const noexcept;
};

} // namespace mev
