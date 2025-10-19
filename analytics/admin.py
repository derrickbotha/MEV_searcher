from django.contrib import admin
from .models import PerformanceMetric, AnalyticsReport, RiskMetric, PortfolioSnapshot, CustomDashboard, Alert


@admin.register(PerformanceMetric)
class PerformanceMetricAdmin(admin.ModelAdmin):
    list_display = ['metric_name', 'metric_type', 'value', 'unit', 'timestamp', 'strategy']
    list_filter = ['metric_type', 'timestamp', 'strategy']
    search_fields = ['metric_name']
    readonly_fields = ['id']
    ordering = ['-timestamp']


@admin.register(AnalyticsReport)
class AnalyticsReportAdmin(admin.ModelAdmin):
    list_display = ['title', 'report_type', 'status', 'generated_at', 'created_by']
    list_filter = ['report_type', 'status', 'generated_at']
    search_fields = ['title', 'summary']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['-generated_at']


@admin.register(RiskMetric)
class RiskMetricAdmin(admin.ModelAdmin):
    list_display = ['risk_type', 'strategy', 'value', 'time_horizon', 'timestamp']
    list_filter = ['risk_type', 'time_horizon', 'timestamp']
    search_fields = ['strategy__name']
    readonly_fields = ['id']
    ordering = ['-timestamp']


@admin.register(PortfolioSnapshot)
class PortfolioSnapshotAdmin(admin.ModelAdmin):
    list_display = ['timestamp', 'total_value_lamports', 'total_profit_lamports', 'win_rate']
    list_filter = ['timestamp']
    readonly_fields = ['id']
    ordering = ['-timestamp']


@admin.register(CustomDashboard)
class CustomDashboardAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_by', 'is_public', 'is_template', 'last_viewed_at']
    list_filter = ['is_public', 'is_template', 'last_viewed_at']
    search_fields = ['name', 'description']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['-last_viewed_at']


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ['title', 'alert_type', 'severity', 'status', 'triggered_at']
    list_filter = ['alert_type', 'severity', 'status', 'triggered_at']
    search_fields = ['title', 'message']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['-triggered_at']
