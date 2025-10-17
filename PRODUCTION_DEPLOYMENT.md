# ==========================================
# Production Deployment Guide
# MEV Searcher Bot - Enterprise Setup
# ==========================================

## Overview

This guide provides step-by-step instructions for deploying the MEV Searcher Bot in a production environment with enterprise-grade security, monitoring, and scalability.

## Prerequisites

### System Requirements
- **Docker**: 20.10+ with Docker Compose
- **RAM**: 16GB minimum (32GB recommended)
- **CPU**: 8 cores minimum (16 cores recommended)
- **Storage**: 100GB SSD minimum
- **Network**: 1Gbps connection minimum

### Security Requirements
- **SSL/TLS certificates** for HTTPS
- **Firewall** configured for required ports
- **Secrets management** (Vault, AWS Secrets Manager, etc.)
- **Regular security updates**

## Quick Start

### 1. Clone and Setup
```bash
git clone https://github.com/derrickbotha/MEV_searcher.git
cd MEV_searcher
cp .env.production .env
```

### 2. Configure Environment
Edit `.env` with your production values:
```bash
# Critical: Replace with your actual keys
ETH_RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY
FLASHBOTS_SIGNATURE_KEY=0xYOUR_PRIVATE_KEY
POSTGRES_PASSWORD=your_secure_db_password
GRAFANA_PASSWORD=your_secure_grafana_password
```

### 3. Deploy Production Stack
```bash
# Build and deploy all services
npm run prod:deploy

# Or manually:
docker-compose -f docker-compose.prod.yml up -d
```

### 4. Verify Deployment
```bash
# Run comprehensive health check
./scripts/health-check.sh

# Check logs
npm run prod:logs

# Access services
# - API: http://localhost:8080
# - Metrics: http://localhost:9090
# - Grafana: http://localhost:3000 (admin/admin123)
```

## Detailed Deployment

### Environment Configuration

#### Required Secrets
```bash
# Ethereum RPC (get from Infura, Alchemy, or run your own)
ETH_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
ETH_WS_URL=wss://mainnet.infura.io/ws/v3/YOUR_PROJECT_ID

# MEV Relay (get from Flashbots or Eden)
FLASHBOTS_RELAY_URL=https://relay.flashbots.net
FLASHBOTS_SIGNATURE_KEY=0xYOUR_SEARCHER_PRIVATE_KEY

# Database
POSTGRES_PASSWORD=secure_random_password_32_chars

# Monitoring
GRAFANA_PASSWORD=secure_grafana_password
```

#### Performance Tuning
```bash
# Resource allocation
UV_THREADPOOL_SIZE=16
NODE_OPTIONS=--max-old-space-size=4096

# MEV Engine settings
NUM_THREADS=4
MAX_CONNECTIONS=1000
RATE_LIMIT_REQUESTS_PER_MINUTE=1000
```

### Security Hardening

#### 1. Network Security
```bash
# Configure firewall (example for Ubuntu)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw --force enable
```

#### 2. SSL/TLS Setup
```bash
# Generate SSL certificates (replace with your domain)
sudo certbot certonly --standalone -d your-domain.com

# Update nginx configuration
cp config/nginx/ssl/nginx.conf config/nginx/nginx.conf
```

#### 3. Secrets Management
```bash
# Use Docker secrets or external secret manager
echo "your_secure_password" | docker secret create postgres_password -
echo "0xyour_private_key" | docker secret create flashbots_key -
```

### Monitoring & Observability

#### Grafana Dashboards
1. **Access Grafana**: http://localhost:3000
2. **Default credentials**: admin / admin123
3. **Import dashboards**:
   - MEV Performance Dashboard
   - System Resources Dashboard
   - Ethereum Network Dashboard

#### Prometheus Metrics
Available metrics:
- `mev_txs_processed_total`: Total transactions processed
- `mev_opportunities_found_total`: Profitable opportunities detected
- `mev_bundles_submitted_total`: Bundles submitted to relays
- `mev_step1_duration_seconds`: Step 1 execution time
- `mev_step2_duration_seconds`: Step 2 execution time
- `mev_total_profit_wei`: Total profit accumulated

#### Alerting
Configure alerts for:
- Service downtime
- High error rates
- Performance degradation
- Low disk space
- High memory usage

### Scaling & High Availability

#### Horizontal Scaling
```yaml
# docker-compose.prod.yml
services:
  mev-searcher:
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '4.0'
          memory: 8G
    # Load balancer configuration
```

#### Database Clustering
```yaml
# PostgreSQL with replication
services:
  postgres-primary:
    # Primary database
  postgres-replica:
    # Read replica
```

#### Redis Clustering
```yaml
# Redis Cluster for high availability
services:
  redis-1:
  redis-2:
  redis-3:
```

### Backup & Recovery

#### Database Backups
```bash
# Automated daily backups
0 2 * * * docker exec mev-postgres pg_dump -U mev_user mev_searcher > backup_$(date +\%Y\%m\%d).sql
```

#### Configuration Backups
```bash
# Backup environment and configs
tar -czf backup_$(date +\%Y\%m\%d).tar.gz .env config/ scripts/
```

#### Disaster Recovery
1. **Stop services**: `npm run prod:stop`
2. **Restore database**: `docker exec -i mev-postgres psql -U mev_user mev_searcher < backup.sql`
3. **Restore configs**: `tar -xzf backup.tar.gz`
4. **Restart services**: `npm run prod:deploy`

### Performance Optimization

#### C++ Engine Tuning
```bash
# Benchmark your specific hardware
npm run benchmark:cpp

# Adjust thread count based on CPU cores
NUM_THREADS=8  # For 16-core CPU
```

#### Memory Optimization
```bash
# Node.js memory settings
NODE_OPTIONS="--max-old-space-size=8192 --optimize-for-size"

# Redis memory limits
redis:
  command: redis-server --maxmemory 1gb --maxmemory-policy allkeys-lru
```

#### Network Optimization
```bash
# Use multiple RPC endpoints for redundancy
FALLBACK_RPC_URLS=https://rpc1,https://rpc2,https://rpc3

# Connection pooling
MAX_CONNECTIONS=2000
```

### Troubleshooting

#### Common Issues

**1. C++ Engine Not Building**
```bash
# Check Docker build logs
docker build --progress=plain -t mev-searcher:debug --target cpp-builder .

# Alternative: Use pre-built binaries
docker pull mev-searcher:latest
```

**2. Database Connection Issues**
```bash
# Check database logs
docker-compose -f docker-compose.prod.yml logs postgres

# Test connection
docker exec -it mev-postgres psql -U mev_user -d mev_searcher
```

**3. High Memory Usage**
```bash
# Monitor memory usage
docker stats

# Adjust resource limits in docker-compose.prod.yml
deploy:
  resources:
    limits:
      memory: 12G
```

**4. Performance Degradation**
```bash
# Run performance diagnostics
npm run benchmark:full

# Check system resources
./scripts/health-check.sh
```

### Maintenance

#### Regular Tasks
```bash
# Daily: Check health
./scripts/health-check.sh

# Weekly: Security scan
npm run security:scan

# Monthly: Update dependencies
npm audit fix
npm update

# Quarterly: Full backup test
# Restore from backup and verify functionality
```

#### Updates
```bash
# Update application
git pull origin master
npm run prod:build
docker-compose -f docker-compose.prod.yml up -d --no-deps mev-searcher

# Update monitoring stack
docker-compose -f docker-compose.prod.yml pull prometheus grafana
docker-compose -f docker-compose.prod.yml up -d prometheus grafana
```

### Support & Monitoring

#### Health Endpoints
- **Application**: `GET /health` - Overall health status
- **Metrics**: `GET /metrics` - Prometheus metrics
- **Readiness**: `GET /ready` - Readiness for traffic
- **Liveness**: `GET /live` - Container liveness

#### Log Analysis
```bash
# View application logs
npm run prod:logs mev-searcher

# Search for errors
docker-compose -f docker-compose.prod.yml logs | grep ERROR

# Monitor performance
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

---

## 🚀 Production Checklist

- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Firewall configured
- [ ] Secrets management implemented
- [ ] Monitoring dashboards configured
- [ ] Alerting rules set up
- [ ] Backup strategy implemented
- [ ] Health checks passing
- [ ] Performance benchmarks completed
- [ ] Security scan passed
- [ ] Documentation updated

**Ready for production deployment!** 🎯