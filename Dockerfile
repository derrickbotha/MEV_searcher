# ==========================================
# Multi-Stage Build: C++ + TypeScript
# Target: Sub-10ms MEV Engine
# ==========================================

# Stage 1: C++ Builder (Ultra-Optimized)
FROM node:18-alpine AS cpp-builder

# Install C++ build tools
RUN apk add --no-cache \
    cmake \
    make \
    g++ \
    python3 \
    git

WORKDIR /build

# Copy C++ source and build configuration
COPY cpp/ ./cpp/
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Build C++ engine with maximum optimizations
WORKDIR /build/cpp
RUN cmake -DCMAKE_BUILD_TYPE=Release \
          -DCMAKE_CXX_FLAGS="-O3 -march=x86-64 -mtune=generic -flto -ffast-math" \
          -B build && \
    cmake --build build --config Release --parallel $(nproc)

# Stage 2: TypeScript Builder
FROM node:18-alpine AS ts-builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy C++ compiled artifacts from previous stage
COPY --from=cpp-builder /build/cpp/build ./cpp/build
COPY --from=cpp-builder /build/node_modules ./node_modules

# Copy source code
COPY src/ ./src/
COPY tests/ ./tests/
COPY cpp/include/ ./cpp/include/

# Build TypeScript
RUN npm run build

# Run tests
RUN npm test

# Stage 3: Production Runtime (Minimal)
FROM node:18-alpine

# Install runtime dependencies only
RUN apk add --no-cache \
    libstdc++ \
    libgcc \
    curl \
    ca-certificates

# Create non-root user
RUN addgroup -g 1001 -S mev && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G mev -g mev mev

WORKDIR /app

# Copy production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy compiled artifacts
COPY --from=ts-builder /app/dist ./dist
COPY --from=cpp-builder /build/cpp/build ./cpp/build
COPY --from=ts-builder /app/node_modules ./node_modules

# Copy configuration files
COPY .env.example ./.env.example

# Create directories for logs and data
RUN mkdir -p /app/logs /app/data && \
    chown -R mev:mev /app

# Set ownership
RUN chown -R mev:mev /app

# Switch to non-root user
USER mev

# Expose metrics port
EXPOSE 9090 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Environment variables
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=4096" \
    UV_THREADPOOL_SIZE=16 \
    LOG_LEVEL=info

# Start application
CMD ["node", "dist/index.js"]
