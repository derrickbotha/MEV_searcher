# MEV Searcher Live Dashboard & ML Training System

A comprehensive Django-based dashboard for real-time MEV (Maximal Extractable Value) network monitoring, data collection, and machine learning model training.

## 🚀 Features

### Real-time Network Monitoring
- Live transaction stream monitoring
- Mempool activity tracking
- MEV opportunity detection
- Network health metrics
- Performance analytics

### Machine Learning Pipeline
- Automated data collection for ML training
- Feature engineering and preprocessing
- Model training and evaluation
- A/B testing framework
- Strategy optimization

### Dashboard Features
- Real-time metrics visualization
- Transaction analysis and filtering
- Profit/loss tracking
- Strategy performance monitoring
- Custom analytics and reporting

## 🛠️ Technology Stack

- **Backend**: Django 3.2, Django REST Framework
- **Real-time**: Django Channels, WebSockets
- **Database**: PostgreSQL
- **Cache**: Redis
- **Task Queue**: Celery
- **ML**: XGBoost, TensorFlow, scikit-learn
- **Frontend**: HTML, Tailwind CSS, Chart.js, HTMX

## 📋 Prerequisites

- Python 3.8+
- PostgreSQL 12+
- Redis 6+
- Node.js (for frontend assets, optional)

## 🚀 Quick Start

### 1. Environment Setup

```bash
# Clone the repository
cd mev_dashboard

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Database Setup

```bash
# Create PostgreSQL database
createdb mev_dashboard

# Run migrations
python manage.py migrate
```

### 3. Redis Setup

```bash
# Start Redis server
redis-server
```

### 4. Run Development Server

```bash
# Start Django development server
python manage.py runserver

# In another terminal, start Celery worker
celery -A mev_dashboard worker -l info

# In another terminal, start Channels
python manage.py runserver 0.0.0.0:8000
```

### 5. Access Dashboard

Open your browser to `http://localhost:8000`

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
DEBUG=True
SECRET_KEY=your-secret-key-here
DATABASE_URL=postgresql://user:password@localhost:5432/mev_dashboard
REDIS_URL=redis://localhost:6379
CELERY_BROKER_URL=redis://localhost:6379/0
```

### C++ Engine Integration

The dashboard connects to the C++ MEV engine via WebSocket for real-time data streaming. Configure the engine endpoint in settings:

```python
# settings.py
CPP_ENGINE_WS_URL = 'ws://localhost:8080/engine'
```

## 📊 API Endpoints

### REST API
- `GET /api/transactions/` - List transactions
- `GET /api/mev-opportunities/` - List MEV opportunities
- `POST /api/data-ingestion/` - Ingest transaction data
- `GET /api/ml-models/` - List ML models

### WebSocket Endpoints
- `/ws/dashboard/` - Real-time dashboard updates
- `/ws/transactions/` - Transaction stream
- `/ws/ml-training/` - ML training progress

## 🤖 Machine Learning Models

### Opportunity Detection Model
- **Algorithm**: XGBoost Classifier
- **Features**: Gas price, token pairs, liquidity, volatility
- **Target**: MEV opportunity probability

### Profit Estimation Model
- **Algorithm**: Bayesian Neural Network
- **Features**: Opportunity features + market conditions
- **Target**: Expected profit distribution

### Strategy Optimization Model
- **Algorithm**: Reinforcement Learning (PPO)
- **Features**: Historical performance + market data
- **Target**: Optimal strategy parameters

## 📈 Monitoring & Analytics

### System Health
- Database connection status
- Redis cache performance
- Celery task queue status
- WebSocket connection health

### Performance Metrics
- Response times (<500ms target)
- Throughput (10,000+ tx/sec)
- Error rates and uptime
- Resource utilization

## 🔒 Security

- JWT authentication for API access
- Rate limiting on all endpoints
- Input validation and sanitization
- Audit logging for all actions
- CORS configuration for frontend

## 🚀 Deployment

### Production Setup

1. **Web Server**: Gunicorn + Nginx
2. **Database**: PostgreSQL with read replicas
3. **Cache**: Redis cluster
4. **Monitoring**: Prometheus + Grafana
5. **Container**: Docker + Kubernetes

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d
```

## 📚 Documentation

- [API Documentation](./docs/api.md)
- [ML Pipeline Guide](./docs/ml_pipeline.md)
- [Deployment Guide](./docs/deployment.md)
- [Contributing Guidelines](./CONTRIBUTING.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This software is for educational and research purposes only. MEV strategies may be subject to legal and regulatory restrictions in your jurisdiction. Always ensure compliance with applicable laws and regulations.