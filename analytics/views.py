from django.shortcuts import render
from django.contrib.auth.decorators import login_required


@login_required
def analytics_home(request):
    """Analytics dashboard home"""
    context = {
        'title': 'Analytics Dashboard',
        'active_page': 'analytics'
    }
    return render(request, 'analytics/home.html', context)


@login_required
def performance_analytics(request):
    """Performance analytics view"""
    context = {
        'title': 'Performance Analytics',
        'active_page': 'analytics'
    }
    return render(request, 'analytics/performance.html', context)


@login_required
def strategy_analysis(request):
    """Strategy analysis view"""
    context = {
        'title': 'Strategy Analysis',
        'active_page': 'analytics'
    }
    return render(request, 'analytics/strategy.html', context)


@login_required
def custom_reports(request):
    """Custom reports view"""
    context = {
        'title': 'Custom Reports',
        'active_page': 'analytics'
    }
    return render(request, 'analytics/reports.html', context)
