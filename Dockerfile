# ==========================================
# Production-Ready MEV Searcher Bot
# Multi-Stage Build: C++ Core + TypeScript Orchestration
# Target: Sub-10ms Execution with Enterprise Security
# ==========================================

# ==========================================
# Stage 1: C++ Builder (Ultra-Optimized Core Engine)
# ==========================================
FROM node:18-alpine AS cpp-builder

# Metadata
LABEL maintainer="MEV Research Team <mev-research@example.com>" \
      description="Ultra-fast C++ MEV Engine Core" \
      version="1.0.0"

# Install C++ build dependencies with security updates
RUN apk update && apk upgrade && \
    apk add --no-cache \
        cmake \
        make \
        g++ \
        python3 \
        git \
        linux-headers \
        build-base \
        binutils && \
    rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /build

# Copy build configuration first for better caching
COPY package*.json ./
COPY tsconfig.json ./
COPY cpp/CMakeLists.txt ./cpp/

# Install Node.js dependencies (for cmake-js)
RUN npm ci --only=production && npm cache clean --force

# Copy C++ source code
COPY cpp/include/ ./cpp/include/
COPY cpp/src/ ./cpp/src/

# Build C++ engine with maximum optimizations
WORKDIR /build/cpp

# Configure and build with aggressive optimizations
RUN cmake -DCMAKE_BUILD_TYPE=Release \
          -DCMAKE_CXX_FLAGS="-O3 -march=x86-64-v3 -mtune=generic -flto=auto -ffast-math -funroll-loops -DNDEBUG -fomit-frame-pointer" \
          -DCMAKE_EXE_LINKER_FLAGS="-flto=auto -Wl,--strip-all" \
          -B build && \
    cmake --build build --config Release --parallel $(nproc) && \
    strip build/mev_benchmark && \
    strip build/libmev_core.a

# ==========================================
# Stage 2: TypeScript Builder & Tester
# ==========================================
FROM node:18-alpine AS ts-builder

# Metadata
LABEL maintainer="MEV Research Team <mev-research@example.com>" \
      description="TypeScript Builder & Test Runner" \
      version="1.0.0"

# Install build dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache \
        git \
        python3 \
        make \
        g++ && \
    rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY tsconfig.json ./
COPY jest.config.js ./

# Install ALL dependencies (including dev dependencies for building/testing)
RUN npm ci && npm cache clean --force

# Copy C++ compiled artifacts from previous stage
COPY --from=cpp-builder /build/cpp/build ./cpp/build
COPY --from=cpp-builder /build/node_modules ./node_modules

# Copy source code
COPY src/ ./src/
COPY tests/ ./tests/
COPY cpp/include/ ./cpp/include/
COPY scripts/ ./scripts/

# Build TypeScript with optimizations
RUN npm run build

# Run comprehensive test suite
RUN npm run test:integration || (echo "Integration tests failed" && exit 1)

# Run performance benchmarks (optional, can be skipped in CI)
# RUN npm run benchmark:cpp || echo "Benchmarking skipped"

# ==========================================
# Stage 3: Security Scanner (Optional)
# ==========================================
FROM aquasec/trivy:latest AS security-scanner

# Metadata
LABEL maintainer="MEV Research Team <mev-research@example.com>" \
      description="Security Vulnerability Scanner" \
      version="1.0.0"

# Copy application files for scanning
COPY --from=ts-builder /app/package*.json /scan/
COPY --from=ts-builder /app/dist /scan/dist

# Run security scan (this will be cached if no vulnerabilities found)
RUN trivy filesystem --no-progress --exit-code 1 --severity HIGH,CRITICAL /scan || \
    (echo "Security vulnerabilities found! Review and fix before deployment." && exit 1)

# ==========================================
# Stage 4: Production Runtime (Minimal & Secure)
# ==========================================
FROM node:18-alpine AS production

# Metadata
LABEL maintainer="MEV Research Team <mev-research@example.com>" \
      description="Production MEV Searcher Bot" \
      version="1.0.0" \
      security.scan="trivy"

# Install minimal runtime dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache \
        libstdc++ \
        libgcc \
        curl \
        ca-certificates \
        dumb-init \
        su-exec \
        tzdata && \
    rm -rf /var/cache/apk/* && \
    addgroup -g 1001 -S mev && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G mev -g mev mev

# Set working directory
WORKDIR /app

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/data /app/tmp && \
    chown -R mev:mev /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production --no-audit --no-fund && \
    npm cache clean --force

# Copy compiled artifacts from build stages
COPY --from=cpp-builder /build/cpp/build ./cpp/build
COPY --from=ts-builder /app/dist ./dist
COPY --from=ts-builder /app/node_modules ./node_modules

# Copy configuration and scripts
COPY .env.example ./.env.example
COPY scripts/init-db.sql ./scripts/

# Copy security scan results for audit trail (optional)
# Note: Security scanning results are available in build logs

# Set proper ownership
RUN chown -R mev:mev /app

# Switch to non-root user
USER mev

# Environment variables for production
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=4096 --max-old-space-size=4096" \
    UV_THREADPOOL_SIZE=16 \
    LOG_LEVEL=info \
    PORT=8080 \
    METRICS_PORT=9090 \
    HEALTH_CHECK_PORT=8080 \
    TMPDIR=/app/tmp \
    HOME=/app

# Expose ports
EXPOSE 8080 9090

# Health check with proper timeout and retries
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f --max-time 5 http://localhost:${HEALTH_CHECK_PORT:-8080}/health || exit 1

# Volume for persistent data
VOLUME ["/app/logs", "/app/data"]

# Default command with proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "--trace-warnings", "--trace-uncaught", "dist/index.js"]

# ==========================================
# Stage 5: Debug Image (Optional)
# ==========================================
FROM production AS debug

# Metadata
LABEL maintainer="MEV Research Team <mev-research@example.com>" \
      description="Debug Build with Development Tools" \
      version="1.0.0-debug"

# Switch back to root for installing debug tools
USER root

# Install debugging tools
RUN apk add --no-cache \
        bash \
        curl \
        vim \
        htop \
        strace \
        tcpdump \
        netcat-openbsd \
        bind-tools && \
    rm -rf /var/cache/apk/*

# Install development dependencies for debugging
COPY package*.json ./
RUN npm install --only=dev && npm cache clean --force

# Copy source maps and source code for debugging
COPY --from=ts-builder /app/src ./src-debug
COPY --from=ts-builder /app/tests ./tests-debug

# Switch back to non-root user
USER mev

# Debug command
CMD ["node", "--inspect=0.0.0.0:9229", "dist/index.js"]
