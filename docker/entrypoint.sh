#!/bin/bash
set -e

echo "=== MEV Dashboard Docker Entrypoint ==="

# Create necessary directories
mkdir -p /app/logs /app/media /app/staticfiles /app/tmp
mkdir -p /var/lib/postgresql/data /var/run/postgresql /var/log/postgresql
mkdir -p /var/log/supervisor /var/log/nginx /var/cache/nginx

# Set proper ownership
chown -R mev:mev /app
chown -R postgres:postgres /var/lib/postgresql /var/run/postgresql /var/log/postgresql

# Initialize PostgreSQL if not already done
if [ ! -d "/var/lib/postgresql/data/base" ]; then
    echo "Initializing PostgreSQL database..."
    su - postgres -c "/usr/lib/postgresql/15/bin/initdb -D /var/lib/postgresql/data"

    # Configure PostgreSQL for better performance
    cat >> /var/lib/postgresql/data/postgresql.conf << EOF
# MEV Dashboard PostgreSQL Configuration
listen_addresses = 'localhost'
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 4GB
EOF

    # Configure pg_hba.conf for local connections
    cat > /var/lib/postgresql/data/pg_hba.conf << EOF
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             postgres                                trust
local   all             all                                     trust
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust
EOF
fi

# Start PostgreSQL in background for initialization
echo "Starting PostgreSQL for initialization..."
su - postgres -c "/usr/lib/postgresql/15/bin/pg_ctl -D /var/lib/postgresql/data -l /var/log/postgresql/postgresql.log start"

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if su - postgres -c "psql -c 'SELECT 1'" >/dev/null 2>&1; then
        break
    fi
    echo "Waiting... ($i/30)"
    sleep 2
done

# Create databases
echo "Creating databases..."
su - postgres -c "psql -c 'CREATE DATABASE IF NOT EXISTS mev_dashboard;'"
su - postgres -c "psql -c 'CREATE DATABASE IF NOT EXISTS vectors;'"

# Enable extensions
echo "Enabling PostgreSQL extensions..."
su - postgres -c "psql -d mev_dashboard -c 'CREATE EXTENSION IF NOT EXISTS vector;'"
su - postgres -c "psql -d mev_dashboard -c 'CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";'"
su - postgres -c "psql -d mev_dashboard -c 'CREATE EXTENSION IF NOT EXISTS \"pg_stat_statements\";'"
su - postgres -c "psql -d vectors -c 'CREATE EXTENSION IF NOT EXISTS vector;'"

# Stop PostgreSQL (will be restarted by supervisord)
echo "Stopping PostgreSQL (will be restarted by supervisord)..."
su - postgres -c "/usr/lib/postgresql/15/bin/pg_ctl -D /var/lib/postgresql/data stop" || true

echo "=== Initialization Complete ==="
echo "Starting services with supervisord..."

# Execute the main command (supervisord)
exec "$@"