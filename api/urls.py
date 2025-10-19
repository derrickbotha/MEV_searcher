from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = 'api'

router = DefaultRouter()
router.register(r'transactions', views.TransactionViewSet)
router.register(r'mev-opportunities', views.MEVOpportunityViewSet)
router.register(r'ml-training-samples', views.MLTrainingSampleViewSet)
router.register(r'performance-metrics', views.PerformanceMetricViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('data-ingestion/', include([
        path('transaction/', views.DataIngestionView.as_view({'post': 'ingest_transaction'}), name='ingest_transaction'),
        path('opportunity/', views.DataIngestionView.as_view({'post': 'ingest_opportunity'}), name='ingest_opportunity'),
        path('metrics/', views.DataIngestionView.as_view({'post': 'ingest_metrics'}), name='ingest_metrics'),
    ])),
    path('ml-models/', views.MLModelViewSet.as_view({'get': 'list'}), name='ml_models'),
]