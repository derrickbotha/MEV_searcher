# MEV Searcher Live Dashboard & ML Training System

A comprehensive Django-based platform for real-time MEV (Maximal Extractable Value) opportunity detection, analysis, and machine learning-driven strategy optimization.

## 🚀 Features

- **Real-time MEV Detection**: Live monitoring of blockchain transactions for arbitrage opportunities
- **Machine Learning Pipeline**: Automated model training and strategy optimization
- **Interactive Dashboard**: Real-time charts and analytics with WebSocket updates
- **Risk Management**: Comprehensive risk metrics and alerting system
- **Data Management**: Multi-tier storage with archival and export capabilities
- **API Integration**: RESTful APIs with webhook support for external integrations
- **System Monitoring**: Health checks, performance profiling, and incident management

## 🏗️ Architecture

### Django Apps
- `dashboard`: Core MEV data models and real-time monitoring
- `ml_training`: Machine learning models and training pipeline
- `analytics`: Performance metrics and risk analysis
- `monitoring`: System health and incident tracking
- `storage`: Data archival and file management
- `api`: REST API and webhook management

### Technology Stack
- **Backend**: Django 3.2.25, Django REST Framework, Channels
- **Database**: PostgreSQL + pgvector (production) / SQLite (development)
- **Vector Search**: pgvector for ML embeddings and similarity search
- **Cache**: Redis
- **Async Tasks**: Celery
- **ML**: XGBoost, TensorFlow, scikit-learn, pgvector
- **Frontend**: HTML, Tailwind CSS, Chart.js, HTMX
- **WebSockets**: Django Channels for real-time updates
- **Containerization**: Docker + Docker Compose

## 🐳 Complete Docker Deployment (Recommended)

The application includes a comprehensive Dockerfile that packages the entire MEV Searcher Dashboard with all dependencies, databases, and services in a single deployable container.

### Quick Start with Complete Docker Setup

1. **Prerequisites**
   - Docker and Docker Compose installed
   - At least 8GB RAM available
   - 20GB free disk space

2. **One-Command Deployment**
   ```bash
   # Make deployment script executable and run
   chmod +x deploy.sh
   ./deploy.sh
   ```

   Or manually:
   ```bash
   # Build and start all services
   docker-compose -f docker-compose.prod.yml up -d --build
   ```

3. **Access the Application**
   - **Dashboard**: http://localhost
   - **Admin Panel**: http://localhost/admin (admin/admin123)
   - **API**: http://localhost/api/
   - **Django Dev Server**: http://localhost:8000

### What's Included in the Complete Docker Setup

The comprehensive Dockerfile includes:

- **🐍 Django Application**: Complete MEV dashboard with all apps
- **🐘 PostgreSQL + pgvector**: Vector database for ML embeddings
- **🔴 Redis**: Caching and session storage
- **🌐 Nginx**: Web server and reverse proxy
- **📊 Supervisor**: Process management for all services
- **🔧 Auto-Setup**: Database initialization, migrations, superuser creation

### Architecture Overview

```
┌─────────────────────────────────────┐
│         MEV Dashboard Container      │
├─────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│  │  Nginx  │ │ Django  │ │  Redis  │ │
│  │ (Port 80)│ │ (Port  │ │ (Port   │ │
│  └─────────┘ │ 8000)   │ │ 6379)   │ │
│              └─────────┘ └─────────┘ │
│                                     │
│  ┌─────────────────────────────────┐ │
│  │        PostgreSQL + pgvector    │ │
│  │        (Port 5432)              │ │
│  └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Production Features

- **Multi-stage build** for optimized image size
- **Security hardening** with non-root user
- **Health checks** for all services
- **Automatic database setup** and migrations
- **Persistent volumes** for data storage
- **Comprehensive logging** with log rotation
- **Resource limits** and monitoring

### Manual Docker Commands

```bash
# Build the image
docker build -t mev-dashboard .

# Run the complete application
docker run -d \
  --name mev-dashboard \
  -p 80:80 -p 8000:8000 -p 5432:5432 -p 6379:6379 \
  -v mev_data:/app/data \
  mev-dashboard

# View logs
docker logs -f mev-dashboard

# Stop and remove
docker stop mev-dashboard
docker rm mev-dashboard
```

### Environment Configuration

Create a `.env.production` file:

```bash
# Django Configuration
SECRET_KEY=your-production-secret-key
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,localhost

# Database (internal to container)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mev_dashboard
REDIS_URL=redis://localhost:6379/0

# Application Settings
LOG_LEVEL=info
```

### Troubleshooting

```bash
# Check container status
docker-compose -f docker-compose.prod.yml ps

# View detailed logs
docker-compose -f docker-compose.prod.yml logs -f mev-dashboard

# Enter container for debugging
docker-compose -f docker-compose.prod.yml exec mev-dashboard bash

# Reset everything (WARNING: destroys data)
docker-compose -f docker-compose.prod.yml down -v
docker system prune -f
```

### Performance Tuning

The container is configured for production use with:
- **CPU Limit**: 4 cores
- **Memory Limit**: 8GB
- **PostgreSQL**: Optimized for concurrent connections
- **Redis**: 256MB memory with LRU eviction
- **Nginx**: Gzip compression and caching enabled

## � Manual Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd mev-dashboard
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up database**
   ```bash
   python setup.py
   ```
   This will:
   - Install/configure PostgreSQL (if available)
   - Set up Redis
   - Run database migrations
   - Create a superuser (admin/admin123)

5. **Alternative manual setup**
   ```bash
   # Create database (PostgreSQL)
   createdb mev_dashboard
   psql -d mev_dashboard -c "CREATE USER mev_user WITH PASSWORD 'mev_password';"
   psql -d mev_dashboard -c "GRANT ALL PRIVILEGES ON DATABASE mev_dashboard TO mev_user;"

   # Run migrations
   python manage.py migrate

   # Create superuser
   python manage.py createsuperuser
   ```

## 🚀 Running the Application

1. **Start Redis** (in a separate terminal)
   ```bash
   redis-server
   ```

2. **Start Celery worker** (in a separate terminal)
   ```bash
   celery -A mev_dashboard worker -l info
   ```

3. **Start Django development server**
   ```bash
   python manage.py runserver
   ```

4. **Access the application**
   - Dashboard: http://localhost:8000
   - Admin: http://localhost:8000/admin
   - API: http://localhost:8000/api/

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL=postgresql://mev_user:mev_password@localhost:5432/mev_dashboard

# Redis
REDIS_URL=redis://localhost:6379/0

# Django
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Blockchain
WEB3_PROVIDER_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID

# ML Configuration
ML_MODEL_PATH=models/
TRAINING_DATA_PATH=data/training/
```

### Django Settings

Key settings in `mev_dashboard/settings.py`:
- Database configuration (PostgreSQL/SQLite)
- Channels configuration for WebSockets
- Redis caching setup
- REST Framework configuration
- CORS settings

## 📊 API Endpoints

### Dashboard APIs
- `GET /api/transactions/` - List transactions
- `GET /api/opportunities/` - MEV opportunities
- `GET /api/metrics/` - Dashboard metrics

### ML APIs
- `POST /api/ml/train/` - Start model training
- `GET /api/ml/models/` - List trained models
- `POST /api/ml/predict/` - Get predictions

### Analytics APIs
- `GET /api/analytics/performance/` - Performance metrics
- `GET /api/analytics/risk/` - Risk metrics
- `GET /api/analytics/alerts/` - Active alerts

## 🔄 WebSocket Channels

Real-time updates via WebSocket:
- `transactions` - Live transaction feed
- `opportunities` - MEV opportunity alerts
- `metrics` - Dashboard metric updates
- `training` - ML training progress

## 🧪 Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=.

# Run specific app tests
pytest dashboard/
pytest ml_training/
```

## 📈 Machine Learning Pipeline

### Training Process
1. **Data Collection**: Gather historical transaction data
2. **Feature Engineering**: Extract relevant features for MEV detection
3. **Model Training**: Train XGBoost/TensorFlow models
4. **Evaluation**: Cross-validation and performance metrics
5. **Deployment**: Deploy best-performing models

### Models
- **Opportunity Detection**: Binary classification for MEV opportunities
- **Profit Estimation**: Regression model for expected profits
- **Risk Assessment**: Risk scoring for opportunities

## 🔒 Security

- API key authentication for external access
- Rate limiting on all endpoints
- Input validation and sanitization
- Secure WebSocket connections
- Database query optimization

## 📁 Project Structure

```
mev_dashboard/
├── dashboard/          # Core MEV monitoring
├── ml_training/        # ML models and training
├── analytics/          # Performance and risk analytics
├── monitoring/         # System health monitoring
├── storage/           # Data archival and storage
├── api/               # REST API and webhooks
├── mev_dashboard/     # Django settings
├── static/            # Static assets
├── templates/         # HTML templates
├── manage.py
├── requirements.txt
├── setup.py
└── README.md
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer

This software is for educational and research purposes. MEV trading involves significant financial risk. Always test thoroughly in development environments before deploying to production.
