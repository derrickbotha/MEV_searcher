from django.urls import path
from . import views

app_name = 'ml_training'

urlpatterns = [
    path('', views.training_dashboard, name='dashboard'),
    path('models/', views.model_list, name='models'),
    path('training/<int:model_id>/', views.training_detail, name='training_detail'),
]