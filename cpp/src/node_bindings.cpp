// Node.js N-API bindings for C++ MEV Engine
// Exposes high-performance C++ core to TypeScript

#include <napi.h>
#include "mev_engine.hpp"
#include <memory>
#include <vector>

namespace {

// Global engine instance
std::unique_ptr<mev::MEVEngine> g_engine;

// Convert Napi::Value to u256
mev::u256 ToU256(const Napi::Value& value) {
    if (value.IsString()) {
        // Parse hex string
        std::string str = value.As<Napi::String>();
        // TODO: Proper hex parsing
        return {0, 0, 0, 0};
    } else if (value.IsNumber()) {
        return {0, 0, 0, value.As<Napi::Number>().Uint32Value()};
    }
    return {0, 0, 0, 0};
}

// Convert u256 to Napi::String
Napi::String FromU256(Napi::Env env, const mev::u256& value) {
    // Convert to hex string
    char buffer[66];
    snprintf(buffer, sizeof(buffer), "0x%016llx%016llx%016llx%016llx",
             value[3], value[2], value[1], value[0]);
    return Napi::String::New(env, buffer);
}

// Initialize engine
Napi::Value Initialize(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsObject()) {
        Napi::TypeError::New(env, "Expected config object").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    auto config_obj = info[0].As<Napi::Object>();
    
    // Parse config
    mev::MEVEngine::Config config{};
    
    if (config_obj.Has("minProfitWei")) {
        config.min_profit_wei = ToU256(config_obj.Get("minProfitWei"));
    }
    
    if (config_obj.Has("maxGasPrice")) {
        config.max_gas_price = config_obj.Get("maxGasPrice").As<Napi::Number>().Uint32Value();
    }
    
    if (config_obj.Has("maxSlippageBps")) {
        config.max_slippage_bps = config_obj.Get("maxSlippageBps").As<Napi::Number>().Uint32Value();
    }
    
    if (config_obj.Has("numThreads")) {
        config.num_threads = config_obj.Get("numThreads").As<Napi::Number>().Uint32Value();
    }
    
    // Create engine
    g_engine = std::make_unique<mev::MEVEngine>(config);
    g_engine->initialize();
    
    return Napi::Boolean::New(env, true);
}

// Process transaction (main entry point)
Napi::Value ProcessTransaction(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (!g_engine) {
        Napi::Error::New(env, "Engine not initialized").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    if (info.Length() < 1 || !info[0].IsBuffer()) {
        Napi::TypeError::New(env, "Expected Buffer").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    auto buffer = info[0].As<Napi::Buffer<uint8_t>>();
    std::span<const uint8_t> raw_tx(buffer.Data(), buffer.Length());
    
    // Process transaction (7-10ms)
    const bool result = g_engine->process_transaction(raw_tx);
    
    return Napi::Boolean::New(env, result);
}

// Set opportunity callback
Napi::Value SetOpportunityCallback(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (!g_engine) {
        Napi::Error::New(env, "Engine not initialized").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    if (info.Length() < 1 || !info[0].IsFunction()) {
        Napi::TypeError::New(env, "Expected function").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    // Store callback as persistent reference
    auto callback = Napi::ThreadSafeFunction::New(
        env,
        info[0].As<Napi::Function>(),
        "OpportunityCallback",
        0,
        1
    );
    
    g_engine->set_opportunity_callback([callback](const mev::Opportunity& opp) {
        // Call JS callback with opportunity data
        callback.BlockingCall([opp](Napi::Env env, Napi::Function jsCallback) {
            auto obj = Napi::Object::New(env);
            
            obj.Set("frontrunAmount", FromU256(env, opp.frontrun_amount));
            obj.Set("backrunAmount", FromU256(env, opp.backrun_amount));
            obj.Set("expectedProfit", FromU256(env, opp.expected_profit));
            obj.Set("validatorTip", Napi::Number::New(env, opp.validator_tip));
            obj.Set("confidence", Napi::Number::New(env, opp.confidence));
            
            jsCallback.Call({obj});
        });
    });
    
    return env.Undefined();
}

// Set submission callback
Napi::Value SetSubmissionCallback(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (!g_engine) {
        Napi::Error::New(env, "Engine not initialized").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    if (info.Length() < 1 || !info[0].IsFunction()) {
        Napi::TypeError::New(env, "Expected function").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    auto callback = Napi::ThreadSafeFunction::New(
        env,
        info[0].As<Napi::Function>(),
        "SubmissionCallback",
        0,
        1
    );
    
    g_engine->set_submission_callback([callback](const std::vector<uint8_t>& bundle) {
        // Call JS callback with encoded bundle
        bool success = false;
        
        callback.BlockingCall([&bundle, &success](Napi::Env env, Napi::Function jsCallback) {
            auto buffer = Napi::Buffer<uint8_t>::Copy(env, bundle.data(), bundle.size());
            auto result = jsCallback.Call({buffer});
            
            if (result.IsBoolean()) {
                success = result.As<Napi::Boolean>().Value();
            }
        });
        
        return success;
    });
    
    return env.Undefined();
}

// Get metrics
Napi::Value GetMetrics(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (!g_engine) {
        Napi::Error::New(env, "Engine not initialized").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    const auto& metrics = g_engine->get_metrics();
    
    auto obj = Napi::Object::New(env);
    obj.Set("txsProcessed", Napi::Number::New(env, metrics.txs_processed.load()));
    obj.Set("opportunitiesFound", Napi::Number::New(env, metrics.opportunities_found.load()));
    obj.Set("bundlesSubmitted", Napi::Number::New(env, metrics.bundles_submitted.load()));
    obj.Set("totalProfitWei", Napi::Number::New(env, metrics.total_profit_wei.load()));
    obj.Set("avgParseTimeUs", Napi::Number::New(env, metrics.avg_parse_time_us.load()));
    obj.Set("avgFilterTimeUs", Napi::Number::New(env, metrics.avg_filter_time_us.load()));
    obj.Set("avgSimulateTimeUs", Napi::Number::New(env, metrics.avg_simulate_time_us.load()));
    obj.Set("avgOptimizeTimeUs", Napi::Number::New(env, metrics.avg_optimize_time_us.load()));
    obj.Set("avgBuildTimeUs", Napi::Number::New(env, metrics.avg_build_time_us.load()));
    obj.Set("avgTotalTimeUs", Napi::Number::New(env, metrics.avg_total_time_us.load()));
    
    return obj;
}

// Shutdown engine
Napi::Value Shutdown(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (g_engine) {
        g_engine->shutdown();
        g_engine.reset();
    }
    
    return env.Undefined();
}

// Module initialization
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("initialize", Napi::Function::New(env, Initialize));
    exports.Set("processTransaction", Napi::Function::New(env, ProcessTransaction));
    exports.Set("setOpportunityCallback", Napi::Function::New(env, SetOpportunityCallback));
    exports.Set("setSubmissionCallback", Napi::Function::New(env, SetSubmissionCallback));
    exports.Set("getMetrics", Napi::Function::New(env, GetMetrics));
    exports.Set("shutdown", Napi::Function::New(env, Shutdown));
    
    return exports;
}

} // anonymous namespace

NODE_API_MODULE(mev_addon, Init)
