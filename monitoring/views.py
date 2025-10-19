from django.shortcuts import render
from django.contrib.auth.decorators import login_required


@login_required
def monitoring_dashboard(request):
    """System monitoring dashboard"""
    context = {
        'title': 'System Monitoring',
        'active_page': 'monitoring'
    }
    return render(request, 'monitoring/dashboard.html', context)


@login_required
def system_health(request):
    """System health status"""
    context = {
        'title': 'System Health',
        'active_page': 'monitoring'
    }
    return render(request, 'monitoring/health.html', context)


@login_required
def alerts(request):
    """System alerts"""
    context = {
        'title': 'System Alerts',
        'active_page': 'monitoring'
    }
    return render(request, 'monitoring/alerts.html', context)


@login_required
def system_logs(request):
    """System logs"""
    context = {
        'title': 'System Logs',
        'active_page': 'monitoring'
    }
    return render(request, 'monitoring/logs.html', context)
