from django.urls import path
from . import views

app_name = 'dashboard'

urlpatterns = [
    path('', views.dashboard_home, name='home'),
    path('transactions/', views.transaction_monitor, name='transactions'),
    path('ml-training/', views.ml_training_dashboard, name='ml_training'),
    path('analytics/', views.analytics_dashboard, name='analytics'),
]