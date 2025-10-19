from django.urls import path
from . import views

app_name = 'analytics'

urlpatterns = [
    path('', views.analytics_home, name='home'),
    path('performance/', views.performance_analytics, name='performance'),
    path('strategy/', views.strategy_analysis, name='strategy'),
    path('reports/', views.custom_reports, name='reports'),
]