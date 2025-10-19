from django.shortcuts import render
from django.contrib.auth.decorators import login_required


@login_required
def dashboard_home(request):
    """Main dashboard view with real-time metrics"""
    context = {
        'title': 'MEV Searcher Dashboard',
        'active_page': 'dashboard'
    }
    return render(request, 'dashboard/home.html', context)


@login_required
def transaction_monitor(request):
    """Transaction monitoring view"""
    context = {
        'title': 'Transaction Monitor',
        'active_page': 'transactions'
    }
    return render(request, 'dashboard/transactions.html', context)


@login_required
def ml_training_dashboard(request):
    """ML training dashboard view"""
    context = {
        'title': 'ML Training Dashboard',
        'active_page': 'ml_training'
    }
    return render(request, 'dashboard/ml_training.html', context)


@login_required
def analytics_dashboard(request):
    """Analytics dashboard view"""
    context = {
        'title': 'Analytics Dashboard',
        'active_page': 'analytics'
    }
    return render(request, 'dashboard/analytics.html', context)
