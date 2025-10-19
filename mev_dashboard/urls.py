"""mev_dashboard URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/3.2/topics/http/urls/
"""
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('dashboard.urls')),
    path('api/', include('api.urls')),
    path('analytics/', include('analytics.urls')),
    path('ml-training/', include('ml_training.urls')),
    path('monitoring/', include('monitoring.urls')),
]
