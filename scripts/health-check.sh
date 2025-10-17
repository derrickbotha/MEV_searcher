#!/bin/bash

# ==========================================
# Production Deployment Health Check
# MEV Searcher Bot - Enterprise Monitoring
# ==========================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_URL="http://localhost:8080"
METRICS_URL="http://localhost:9090"
GRAFANA_URL="http://localhost:3000"
PROMETHEUS_URL="http://localhost:9090"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_service() {
    local url=$1
    local service_name=$2
    local timeout=${3:-10}

    log_info "Checking $service_name at $url..."

    if curl -f --max-time $timeout --silent "$url" > /dev/null 2>&1; then
        log_success "$service_name is healthy"
        return 0
    else
        log_error "$service_name is not responding"
        return 1
    fi
}

check_docker_containers() {
    log_info "Checking Docker containers..."

    local containers=("mev-searcher-prod" "mev-postgres" "mev-redis" "mev-prometheus" "mev-grafana")
    local failed_containers=()

    for container in "${containers[@]}"; do
        if docker ps --format "table {{.Names}}" | grep -q "^${container}$"; then
            local status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "unknown")
            if [ "$status" = "healthy" ]; then
                log_success "Container $container is healthy"
            elif [ "$status" = "starting" ]; then
                log_warning "Container $container is starting..."
            else
                log_error "Container $status is not healthy (status: $status)"
                failed_containers+=("$container")
            fi
        else
            log_error "Container $container is not running"
            failed_containers+=("$container")
        fi
    done

    if [ ${#failed_containers[@]} -eq 0 ]; then
        return 0
    else
        return 1
    fi
}

check_application_health() {
    log_info "Checking application health..."

    # Check main application
    if ! check_service "$APP_URL/health" "MEV Searcher API"; then
        return 1
    fi

    # Check metrics endpoint
    if ! check_service "$METRICS_URL/metrics" "Prometheus Metrics"; then
        return 1
    fi

    return 0
}

check_monitoring_stack() {
    log_info "Checking monitoring stack..."

    # Check Prometheus
    if ! check_service "$PROMETHEUS_URL/-/healthy" "Prometheus"; then
        return 1
    fi

    # Check Grafana
    if ! check_service "$GRAFANA_URL/api/health" "Grafana"; then
        return 1
    fi

    return 0
}

check_performance_metrics() {
    log_info "Checking performance metrics..."

    # Get metrics from the application
    local metrics_response=$(curl -s --max-time 5 "$METRICS_URL/metrics" 2>/dev/null || echo "")

    if [ -z "$metrics_response" ]; then
        log_error "Cannot retrieve metrics"
        return 1
    fi

    # Check for key performance indicators
    local txs_processed=$(echo "$metrics_response" | grep "mev_txs_processed" | awk '{print $2}' || echo "0")
    local opportunities_found=$(echo "$metrics_response" | grep "mev_opportunities_found" | awk '{print $2}' || echo "0")
    local bundles_submitted=$(echo "$metrics_response" | grep "mev_bundles_submitted" | awk '{print $2}' || echo "0")

    log_info "Performance Metrics:"
    log_info "  Transactions processed: $txs_processed"
    log_info "  Opportunities found: $opportunities_found"
    log_info "  Bundles submitted: $bundles_submitted"

    # Check if the application is processing transactions
    if [ "$txs_processed" -gt 0 ] 2>/dev/null; then
        log_success "Application is actively processing transactions"
    else
        log_warning "Application has not processed any transactions yet"
    fi

    return 0
}

check_system_resources() {
    log_info "Checking system resources..."

    # Check Docker container resource usage
    if command -v docker &> /dev/null; then
        log_info "Docker container resource usage:"
        docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" | head -10
    fi

    # Check disk space
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$disk_usage" -gt 90 ]; then
        log_error "Disk usage is high: ${disk_usage}%"
        return 1
    elif [ "$disk_usage" -gt 75 ]; then
        log_warning "Disk usage is moderate: ${disk_usage}%"
    else
        log_success "Disk usage is healthy: ${disk_usage}%"
    fi

    return 0
}

# Main health check
main() {
    echo "========================================="
    echo "MEV Searcher Production Health Check"
    echo "========================================="

    local all_checks_passed=true

    # Check Docker containers
    if ! check_docker_containers; then
        all_checks_passed=false
    fi

    echo

    # Check application health
    if ! check_application_health; then
        all_checks_passed=false
    fi

    echo

    # Check monitoring stack
    if ! check_monitoring_stack; then
        all_checks_passed=false
    fi

    echo

    # Check performance metrics
    if ! check_performance_metrics; then
        all_checks_passed=false
    fi

    echo

    # Check system resources
    if ! check_system_resources; then
        all_checks_passed=false
    fi

    echo
    echo "========================================="

    if [ "$all_checks_passed" = true ]; then
        log_success "All health checks passed! 🎉"
        log_success "MEV Searcher is running optimally"
        exit 0
    else
        log_error "Some health checks failed! 🔴"
        log_error "Please review the errors above and take corrective action"
        exit 1
    fi
}

# Run main function
main "$@"