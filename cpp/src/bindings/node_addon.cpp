#include <napi.h>
#include "../include/types.hpp"
#include "../include/mev_engine.hpp"
#include <memory>
#include <string>
#include <vector>

namespace mev {

/**
 * C++-Only Node.js Native Addon for MEV Engine
 * NO TypeScript fallbacks - pure C++ execution with redundancy
 */

class MEVEngineWrapper : public Napi::ObjectWrap<MEVEngineWrapper> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports) {
        Napi::Function func = DefineClass(env, "MEVEngine", {
            InstanceMethod("initialize", &MEVEngineWrapper::Initialize),
            InstanceMethod("processTransaction", &MEVEngineWrapper::ProcessTransaction),
            InstanceMethod("getMetrics", &MEVEngineWrapper::GetMetrics),
            InstanceMethod("shutdown", &MEVEngineWrapper::Shutdown),
            // Removed TypeScript fallback methods
        });

        Napi::FunctionReference* constructor = new Napi::FunctionReference();
        *constructor = Napi::Persistent(func);
        env.SetInstanceData(constructor);

        exports.Set("MEVEngine", func);
        return exports;
    }

    MEVEngineWrapper(const Napi::CallbackInfo& info) : Napi::ObjectWrap<MEVEngineWrapper>(info) {
        Napi::Env env = info.Env();

        if (info.Length() < 1 || !info[0].IsObject()) {
            Napi::TypeError::New(env, "Config object expected").ThrowAsJavaScriptException();
            return;
        }

        Napi::Object config_obj = info[0].As<Napi::Object>();

        // Parse C++-only config from JavaScript object
        MEVEngine::Config config;

        if (config_obj.Has("minProfitWei")) {
            config.min_profit_wei = static_cast<u256>(config_obj.Get("minProfitWei").As<Napi::Number>().Int64Value());
        }

        if (config_obj.Has("maxGasPrice")) {
            config.max_gas_price = config_obj.Get("maxGasPrice").As<Napi::Number>().Uint32Value();
        }

        if (config_obj.Has("maxSlippageBps")) {
            config.max_slippage_bps = config_obj.Get("maxSlippageBps").As<Napi::Number>().Uint32Value();
        }

        // Sandwich attack settings (C++ only)
        if (config_obj.Has("enableSandwich")) {
            config.enable_sandwich = config_obj.Get("enableSandwich").As<Napi::Boolean>().Value();
        }

        if (config_obj.Has("sandwichMinVictimSize")) {
            config.sandwich_min_victim_size = static_cast<u256>(config_obj.Get("sandwichMinVictimSize").As<Napi::Number>().Int64Value());
        }

        if (config_obj.Has("sandwichRedundancyLevel")) {
            config.sandwich_redundancy_level = config_obj.Get("sandwichRedundancyLevel").As<Napi::Number>().Uint32Value();
        }

        // Performance settings
        if (config_obj.Has("enableParallelSim")) {
            config.enable_parallel_sim = config_obj.Get("enableParallelSim").As<Napi::Boolean>().Value();
        }

        if (config_obj.Has("numThreads")) {
            config.num_threads = config_obj.Get("numThreads").As<Napi::Number>().Uint32Value();
        }

        // Safety settings
        if (config_obj.Has("simulationOnly")) {
            config.simulation_only = config_obj.Get("simulationOnly").As<Napi::Boolean>().Value();
        }

        // Hardware optimization
        if (config_obj.Has("enableSIMD")) {
            config.enable_simd = config_obj.Get("enableSIMD").As<Napi::Boolean>().Value();
        }

        if (config_obj.Has("enableRDTSC")) {
            config.enable_rdtsc_timing = config_obj.Get("enableRDTSC").As<Napi::Boolean>().Value();
        }

        // Create C++-only engine instance
        engine_ = std::make_unique<MEVEngine>(config);

        std::cout << "[NodeAddon] C++-only MEV engine wrapper created" << std::endl;
        std::cout << "[NodeAddon] ⚠️  NO TypeScript fallbacks available" << std::endl;
    }

private:
    std::unique_ptr<MEVEngine> engine_;

    /**
     * Initialize C++-only engine
     */
    Napi::Value Initialize(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        if (!engine_) {
            Napi::Error::New(env, "Engine not initialized").ThrowAsJavaScriptException();
            return env.Null();
        }

        bool success = engine_->initialize();

        if (!success) {
            Napi::Error::New(env, "C++ engine initialization failed").ThrowAsJavaScriptException();
            return env.Null();
        }

        return Napi::Boolean::New(env, true);
    }

    /**
     * Process transaction with C++-only execution
     */
    Napi::Value ProcessTransaction(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        if (!engine_) {
            Napi::Error::New(env, "Engine not initialized").ThrowAsJavaScriptException();
            return env.Null();
        }

        if (info.Length() < 1 || !info[0].IsBuffer()) {
            Napi::TypeError::New(env, "Transaction buffer expected").ThrowAsJavaScriptException();
            return env.Null();
        }

        // Get raw transaction data
        Napi::Buffer<uint8_t> tx_buffer = info[0].As<Napi::Buffer<uint8_t>>();
        std::span<const u8> raw_tx(tx_buffer.Data(), tx_buffer.Length());

        // Process with C++-only engine
        bool success = engine_->process_transaction(raw_tx);

        return Napi::Boolean::New(env, success);
    }

    /**
     * Get comprehensive C++ engine metrics
     */
    Napi::Value GetMetrics(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        if (!engine_) {
            Napi::Error::New(env, "Engine not initialized").ThrowAsJavaScriptException();
            return env.Null();
        }

        const auto& metrics = engine_->get_metrics();

        Napi::Object result = Napi::Object::New(env);

        // Transaction processing metrics
        result.Set("txsProcessed", Napi::Number::New(env, metrics.txs_processed.load()));
        result.Set("opportunitiesFound", Napi::Number::New(env, metrics.opportunities_found.load()));
        result.Set("bundlesSubmitted", Napi::Number::New(env, metrics.bundles_submitted.load()));
        result.Set("totalProfitWei", Napi::String::New(env, std::to_string(metrics.total_profit_wei.load())));

        // Performance metrics
        result.Set("avgParseTimeUs", Napi::Number::New(env, metrics.avg_parse_time_us.load()));
        result.Set("avgDetectionTimeUs", Napi::Number::New(env, metrics.avg_detection_time_us.load()));
        result.Set("avgBuildTimeUs", Napi::Number::New(env, metrics.avg_build_time_us.load()));
        result.Set("avgSubmitTimeUs", Napi::Number::New(env, metrics.avg_submit_time_us.load()));
        result.Set("totalExecutionUs", Napi::Number::New(env, metrics.total_execution_us.load()));

        // Redundancy metrics
        result.Set("redundantCalculations", Napi::Number::New(env, metrics.redundant_calculations.load()));
        result.Set("calculationFailures", Napi::Number::New(env, metrics.calculation_failures.load()));
        result.Set("recoveryEvents", Napi::Number::New(env, metrics.recovery_events.load()));

        return result;
    }

    /**
     * Shutdown C++-only engine
     */
    Napi::Value Shutdown(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        if (engine_) {
            engine_->shutdown();
        }

        return env.Null();
    }
};

// Module initialization
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    return MEVEngineWrapper::Init(env, exports);
}

NODE_API_MODULE(mev_engine, Init)

} // namespace mev
            config.max_priority_fee = config_obj.Get("maxPriorityFee").As<Napi::Number>().Uint32Value();
        }
        
        if (config_obj.Has("numSimulationThreads")) {
            config.num_simulation_threads = config_obj.Get("numSimulationThreads").As<Napi::Number>().Uint32Value();
        }
        
        if (config_obj.Has("simulationOnly")) {
            config.simulation_only = config_obj.Get("simulationOnly").As<Napi::Boolean>().Value();
        }
        
        if (config_obj.Has("enableSandwich")) {
            config.enable_sandwich = config_obj.Get("enableSandwich").As<Napi::Boolean>().Value();
        }
        
        // RPC URLs
        if (config_obj.Has("rpcUrls") && config_obj.Get("rpcUrls").IsArray()) {
            Napi::Array rpc_array = config_obj.Get("rpcUrls").As<Napi::Array>();
            for (uint32_t i = 0; i < rpc_array.Length(); i++) {
                config.rpc_urls.push_back(rpc_array.Get(i).As<Napi::String>().Utf8Value());
            }
        }
        
        // Jito relay URLs
        if (config_obj.Has("jitoRelayUrls") && config_obj.Get("jitoRelayUrls").IsArray()) {
            Napi::Array jito_array = config_obj.Get("jitoRelayUrls").As<Napi::Array>();
            for (uint32_t i = 0; i < jito_array.Length(); i++) {
                config.jito_relay_urls.push_back(jito_array.Get(i).As<Napi::String>().Utf8Value());
            }
        }

        // Create engine instance
        engine_ = std::make_unique<MEVEngine>(config);
    }

private:
    std::unique_ptr<MEVEngine> engine_;
    
    /**
     * Initialize engine (pre-compute tables)
     */
    Napi::Value Initialize(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        
        bool success = engine_->initialize();
        
        return Napi::Boolean::New(env, success);
    }
    
    /**
     * Process transaction (7-10ms execution)
     * 
     * @param txData - Buffer containing raw transaction data
     * @returns Object with opportunity details or null
     */
    Napi::Value ProcessTransaction(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        
        if (info.Length() < 1 || !info[0].IsBuffer()) {
            Napi::TypeError::New(env, "Buffer expected").ThrowAsJavaScriptException();
            return env.Null();
        }
        
        Napi::Buffer<uint8_t> buffer = info[0].As<Napi::Buffer<uint8_t>>();
        std::vector<uint8_t> tx_data(buffer.Data(), buffer.Data() + buffer.Length());
        
        // Process transaction (C++ high-performance code)
        auto opportunity = engine_->process_transaction(tx_data);
        
        if (!opportunity) {
            return env.Null();
        }
        
        // Convert C++ opportunity to JavaScript object
        Napi::Object result = Napi::Object::New(env);
        
        result.Set("type", Napi::Number::New(env, static_cast<uint8_t>(opportunity->type)));
        result.Set("grossProfit", Napi::Number::New(env, opportunity->gross_profit));
        result.Set("netProfit", Napi::Number::New(env, opportunity->net_profit));
        result.Set("computeUnits", Napi::Number::New(env, opportunity->compute_units));
        result.Set("priorityFeeCost", Napi::Number::New(env, opportunity->priority_fee_cost));
        result.Set("processingTimeUs", Napi::Number::New(env, opportunity->processing_time.count()));
        
        // Swap info
        Napi::Object swap_info = Napi::Object::New(env);
        swap_info.Set("amountIn", Napi::Number::New(env, opportunity->swap_info.amount_in));
        swap_info.Set("minAmountOut", Napi::Number::New(env, opportunity->swap_info.min_amount_out));
        swap_info.Set("slippageBps", Napi::Number::New(env, opportunity->swap_info.slippage_bps));
        result.Set("swapInfo", swap_info);
        
        // Optimal sizing (for sandwich)
        if (opportunity->type == Opportunity::Type::SANDWICH) {
            result.Set("optimalFrontAmount", Napi::Number::New(env, opportunity->optimal_front_amount));
            result.Set("optimalBackAmount", Napi::Number::New(env, opportunity->optimal_back_amount));
        }
        
        return result;
    }
    
    /**
     * Submit opportunity as Jito bundle
     */
    Napi::Value SubmitOpportunity(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        
        if (info.Length() < 1 || !info[0].IsObject()) {
            Napi::TypeError::New(env, "Opportunity object expected").ThrowAsJavaScriptException();
            return Napi::Boolean::New(env, false);
        }
        
        // TODO: Parse opportunity from JS object and submit
        
        return Napi::Boolean::New(env, true);
    }
    
    /**
     * Get performance metrics
     */
    Napi::Value GetMetrics(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        
        const auto& metrics = engine_->get_metrics();
        
        Napi::Object result = Napi::Object::New(env);
        
        result.Set("transactionsProcessed", Napi::Number::New(env, metrics.transactions_processed));
        result.Set("opportunitiesDetected", Napi::Number::New(env, metrics.opportunities_detected));
        result.Set("bundlesSubmitted", Napi::Number::New(env, metrics.bundles_submitted));
        result.Set("bundlesLanded", Napi::Number::New(env, metrics.bundles_landed));
        
        result.Set("avgParseTimeUs", Napi::Number::New(env, metrics.avg_parse_time_us));
        result.Set("avgFilterTimeUs", Napi::Number::New(env, metrics.avg_filter_time_us));
        result.Set("avgSimulateTimeUs", Napi::Number::New(env, metrics.avg_simulate_time_us));
        result.Set("avgOptimizeTimeUs", Napi::Number::New(env, metrics.avg_optimize_time_us));
        result.Set("avgBuildTimeUs", Napi::Number::New(env, metrics.avg_build_time_us));
        result.Set("avgTotalTimeUs", Napi::Number::New(env, metrics.avg_total_time_us));
        
        result.Set("totalGrossProfit", Napi::Number::New(env, metrics.total_gross_profit));
        result.Set("totalNetProfit", Napi::Number::New(env, metrics.total_net_profit));
        result.Set("totalFeesPaid", Napi::Number::New(env, metrics.total_fees_paid));
        
        return result;
    }
    
    /**
     * Print metrics to console
     */
    Napi::Value PrintMetrics(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        
        engine_->print_metrics();
        
        return env.Undefined();
    }
    
    /**
     * Shutdown engine
     */
    Napi::Value Shutdown(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        
        engine_->shutdown();
        
        return env.Undefined();
    }
};

// Module initialization
Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    return MEVEngineWrapper::Init(env, exports);
}

NODE_API_MODULE(mev_addon, InitAll)

} // namespace solana_mev
