from django.urls import path
from . import views

app_name = 'monitoring'

urlpatterns = [
    path('', views.monitoring_dashboard, name='dashboard'),
    path('health/', views.system_health, name='health'),
    path('alerts/', views.alerts, name='alerts'),
    path('logs/', views.system_logs, name='logs'),
]