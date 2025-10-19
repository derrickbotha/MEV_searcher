from django.shortcuts import render
from django.contrib.auth.decorators import login_required


@login_required
def training_dashboard(request):
    """ML training dashboard"""
    context = {
        'title': 'ML Training Dashboard',
        'active_page': 'ml_training'
    }
    return render(request, 'ml_training/dashboard.html', context)


@login_required
def model_list(request):
    """List of ML models"""
    context = {
        'title': 'ML Models',
        'active_page': 'ml_training'
    }
    return render(request, 'ml_training/models.html', context)


@login_required
def training_detail(request, model_id):
    """Training details for a specific model"""
    context = {
        'title': f'Model {model_id} Training',
        'active_page': 'ml_training',
        'model_id': model_id
    }
    return render(request, 'ml_training/detail.html', context)
