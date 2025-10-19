# ==========================================
# MEV Searcher Dashboard - Complete Application
# Multi-Stage Build: Python + Node.js + C++ Components
# Production-Ready: Django + PostgreSQL + Redis + Vector DB
# ==========================================

# ==========================================
# Stage 1: Python Dependencies Builder
# ==========================================
FROM python:3.9-slim AS python-builder

LABEL maintainer="MEV Research Team <mev-research@example.com>" \
      description="Python Dependencies Builder" \
      version="1.0.0"

# Install system dependencies for Python packages
RUN apt-get update && apt-get install -y \
        build-essential \
        libpq-dev \
        libssl-dev \
        libffi-dev \
        libxml2-dev \
        libxslt-dev \
        libjpeg-dev \
        zlib1g-dev \
        && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy requirements and install Python dependencies
WORKDIR /build
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# ==========================================
# Stage 2: Node.js Builder (Frontend Assets)
# ==========================================
FROM node:18-alpine AS node-builder

LABEL maintainer="MEV Research Team <mev-research@example.com>" \
      description="Node.js Frontend Builder" \
      version="1.0.0"

# Install build dependencies
RUN apk add --no-cache git python3 make g++

# Set working directory
WORKDIR /build

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY jest.config.js ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/
COPY public/ ./public/
COPY *.config.js ./

# Build frontend assets
RUN npm run build

# ==========================================
# Stage 3: C++ Builder (Optional Performance Components)
# ==========================================
FROM gcc:11-alpine AS cpp-builder

LABEL maintainer="MEV Research Team <mev-research@example.com>" \
      description="C++ Performance Components Builder" \
      version="1.0.0"

# Install build dependencies
RUN apk add --no-cache \
        cmake \
        make \
        git \
        linux-headers \
        && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /build

# Copy C++ source code
COPY cpp/ ./cpp/

# Build C++ components (if CMakeLists.txt exists)
RUN if [ -f "cpp/CMakeLists.txt" ]; then \
        cd cpp && \
        cmake -DCMAKE_BUILD_TYPE=Release \
              -DCMAKE_CXX_FLAGS="-O3 -march=x86-64 -mtune=generic" \
              -B build && \
        cmake --build build --config Release --parallel $(nproc) && \
        strip build/* 2>/dev/null || true; \
    fi

# ==========================================
# Stage 4: PostgreSQL with pgvector
# ==========================================
FROM postgres:15-alpine AS postgres-with-vector

LABEL maintainer="MEV Research Team <mev-research@example.com>" \
      description="PostgreSQL with pgvector" \
      version="1.0.0"

# Install pgvector
RUN apk add --no-cache \
        build-base \
        git \
        postgresql-dev \
        && git clone --depth 1 https://github.com/pgvector/pgvector.git /tmp/pgvector \
        && cd /tmp/pgvector \
        && make OPTFLAGS="-O3" \
        && make install \
        && rm -rf /tmp/pgvector \
        && apk del build-base git

# ==========================================
# Stage 5: Production Runtime
# ==========================================
FROM python:3.9-slim AS production

LABEL maintainer="MEV Research Team <mev-research@example.com>" \
      description="MEV Searcher Dashboard - Production Runtime" \
      version="1.0.0"

# Install runtime system dependencies
RUN apt-get update && apt-get install -y \
        # PostgreSQL client
        postgresql-client \
        # Redis client
        redis-tools \
        # System utilities
        curl \
        ca-certificates \
        dumb-init \
        supervisor \
        nginx \
        # Python runtime dependencies
        libpq5 \
        libssl3 \
        libffi7 \
        libxml2 \
        libxslt1.1 \
        libjpeg62-turbo \
        zlib1g \
        # Additional tools
        git \
        && rm -rf /var/lib/apt/lists/* \
        && apt-get clean

# Create application user and group
RUN groupadd -r mev -g 1000 && \
    useradd -r -g mev -u 1000 -m -d /app -s /bin/bash mev

# Copy Python virtual environment
COPY --from=python-builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy PostgreSQL with pgvector
COPY --from=postgres-with-vector /usr/local/lib/postgresql/ /usr/local/lib/postgresql/
COPY --from=postgres-with-vector /usr/local/share/postgresql/ /usr/local/share/postgresql/

# Copy Node.js built assets
COPY --from=node-builder /build/dist ./static/dist/

# Copy C++ built binaries (if they exist)
COPY --from=cpp-builder /build/cpp/build/* ./bin/

# Set working directory
WORKDIR /app

# Copy Django application code
COPY . /app/

# Copy built frontend assets to Django static directory
RUN mkdir -p /app/static/dist && \
    cp -r ./static/dist/* /app/static/dist/ 2>/dev/null || true

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/media /app/staticfiles /app/tmp \
             /var/lib/postgresql/data /var/log/supervisor \
             /var/run/postgresql /var/log/postgresql \
             /var/log/nginx /var/cache/nginx \
    && chown -R mev:mev /app \
    && chown -R postgres:postgres /var/lib/postgresql /var/run/postgresql /var/log/postgresql \
    && chmod -R 755 /app/bin/* 2>/dev/null || true

# Copy configuration files
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY scripts/init-db.sql /docker-entrypoint-initdb.d/

# Create initialization scripts
RUN echo '#!/bin/bash\n\
echo "=== MEV Dashboard Initialization ===\n\
\n\
# Wait for PostgreSQL to be ready\n\
echo "Waiting for PostgreSQL..."\n\
while ! pg_isready -h localhost -p 5432 -U postgres; do\n\
    sleep 2\n\
done\n\
echo "PostgreSQL is ready!"\n\
\n\
# Run Django migrations\n\
echo "Running Django migrations..."\n\
cd /app\n\
python manage.py migrate --verbosity=1\n\
\n\
# Collect static files\n\
echo "Collecting static files..."\n\
python manage.py collectstatic --noinput --clear\n\
\n\
# Create superuser if it does not exist\n\
echo "Creating superuser..."\n\
echo "from django.contrib.auth import get_user_model; User = get_user_model(); \n\
if not User.objects.filter(username='\''admin'\'').exists(): \n\
    User.objects.create_superuser('\''admin'\'', '\''admin@example.com'\'', '\''admin123'\'')\n\
    print('\''Superuser created: admin/admin123'\'')\n\
else:\n\
    print('\''Superuser already exists'\'')"\n\
' > /app/init_django.sh && chmod +x /app/init_django.sh

# Create health check script
RUN echo '#!/bin/bash\n\
# Health check for MEV Dashboard\n\
\n\
# Check Django application\n\
if curl -f --max-time 5 http://localhost:8000/health/ > /dev/null 2>&1; then\n\
    echo "Django: OK"\n\
else\n\
    echo "Django: FAIL"\n\
    exit 1\n\
fi\n\
\n\
# Check PostgreSQL\n\
if pg_isready -h localhost -p 5432 -U postgres > /dev/null 2>&1; then\n\
    echo "PostgreSQL: OK"\n\
else\n\
    echo "PostgreSQL: FAIL"\n\
    exit 1\n\
fi\n\
\n\
# Check Redis\n\
if redis-cli ping > /dev/null 2>&1; then\n\
    echo "Redis: OK"\n\
else\n\
    echo "Redis: FAIL"\n\
    exit 1\n\
fi\n\
\n\
echo "All services healthy"\n\
' > /app/healthcheck.sh && chmod +x /app/healthcheck.sh

# Make entrypoint script executable
RUN chmod +x /usr/local/bin/entrypoint.sh

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DJANGO_SETTINGS_MODULE=mev_dashboard.settings \
    DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mev_dashboard \
    REDIS_URL=redis://localhost:6379/0 \
    PATH="/opt/venv/bin:/app/bin:$PATH" \
    PYTHONPATH="/app" \
    HOME=/app

# Expose ports
EXPOSE 80 8000 5432 6379

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD /app/healthcheck.sh

# Volumes for persistent data
VOLUME ["/app/logs", "/app/media", "/var/lib/postgresql/data", "/app/data"]

# Switch to application user
USER mev

# Set entrypoint and default command
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]