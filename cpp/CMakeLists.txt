cmake_minimum_required(VERSION 3.20)
project(mev_engine VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Aggressive optimization flags for sub-10ms performance
if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    set(CMAKE_CXX_FLAGS_RELEASE "-O3 -march=native -mtune=native -flto -ffast-math -DNDEBUG")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wall -Wextra -Wpedantic")
endif()

# Enable LTO (Link Time Optimization)
set(CMAKE_INTERPROCEDURAL_OPTIMIZATION TRUE)

# Find dependencies
find_package(Threads REQUIRED)

# Include directories
include_directories(${CMAKE_CURRENT_SOURCE_DIR}/include)

# Core engine library (ultra-lean, minimal dependencies)
add_library(mev_core STATIC
    src/rlp_parser.cpp
    src/dag_filter.cpp
    src/shadow_fork.cpp
    src/optimal_sizer.cpp
    src/bundle_builder.cpp
    src/mev_engine.cpp
)

target_link_libraries(mev_core PRIVATE Threads::Threads)

# Node.js N-API addon
find_package(PkgConfig)
execute_process(
    COMMAND node -p "require('node-addon-api').include"
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    OUTPUT_VARIABLE NODE_ADDON_API_DIR
    OUTPUT_STRIP_TRAILING_WHITESPACE
)

add_library(mev_addon SHARED
    src/node_bindings.cpp
)

target_include_directories(mev_addon PRIVATE 
    ${CMAKE_JS_INC}
    ${NODE_ADDON_API_DIR}
)

target_link_libraries(mev_addon PRIVATE mev_core)

set_target_properties(mev_addon PROPERTIES 
    PREFIX ""
    SUFFIX ".node"
    CXX_STANDARD 20
)

# Benchmark executable
add_executable(mev_benchmark
    src/benchmark.cpp
)

target_link_libraries(mev_benchmark PRIVATE mev_core)

# Installation
install(TARGETS mev_core DESTINATION lib)
install(TARGETS mev_addon DESTINATION ../build)
install(DIRECTORY include/ DESTINATION include)
