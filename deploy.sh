#!/bin/bash
# MEV Dashboard Deployment Script
# This script helps deploy the MEV Searcher Dashboard using Docker

set -e

echo "🚀 MEV Searcher Dashboard Deployment"
echo "===================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not available. Please install Docker Compose."
    exit 1
fi

# Function to use docker compose (new or old syntax)
docker_compose_cmd() {
    if docker compose version &> /dev/null; then
        docker compose "$@"
    else
        docker-compose "$@"
    fi
}

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p logs media data

# Check for environment file
if [ ! -f ".env.production" ]; then
    echo "⚠️  .env.production not found. Creating from template..."
    if [ -f ".env.example" ]; then
        cp .env.example .env.production
        echo "✅ Created .env.production from .env.example"
        echo "⚠️  Please edit .env.production with your production settings!"
    else
        echo "⚠️  .env.example not found. Creating basic .env.production..."
        cat > .env.production << EOF
# Django Configuration
SECRET_KEY=django-insecure-change-this-in-production-$(openssl rand -hex 32)
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0

# Database Configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mev_dashboard

# Redis Configuration
REDIS_URL=redis://localhost:6379/0

# Application Settings
LOG_LEVEL=info
EOF
        echo "✅ Created basic .env.production"
    fi
fi

# Build and start services
echo "🏗️  Building and starting services..."
docker_compose_cmd -f docker-compose.prod.yml build --no-cache

echo "🚀 Starting services..."
docker_compose_cmd -f docker-compose.prod.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 30

# Check service health
echo "🔍 Checking service health..."
if docker_compose_cmd -f docker-compose.prod.yml ps | grep -q "Up"; then
    echo "✅ Services are running!"
    echo ""
    echo "🌐 Access your MEV Dashboard at:"
    echo "   Web Interface: http://localhost"
    echo "   Django Admin:  http://localhost/admin (admin/admin123)"
    echo "   API:           http://localhost/api/"
    echo ""
    echo "📊 Service Status:"
    docker_compose_cmd -f docker-compose.prod.yml ps
    echo ""
    echo "📝 Useful commands:"
    echo "   View logs:     docker-compose -f docker-compose.prod.yml logs -f"
    echo "   Stop services: docker-compose -f docker-compose.prod.yml down"
    echo "   Restart:       docker-compose -f docker-compose.prod.yml restart"
else
    echo "❌ Services failed to start properly."
    echo "📝 Check logs with: docker-compose -f docker-compose.prod.yml logs"
    exit 1
fi

echo ""
echo "🎉 Deployment complete! Your MEV Searcher Dashboard is ready."