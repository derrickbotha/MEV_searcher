from django.contrib import admin
from .models import Transaction, MEVOpportunity, Strategy, DashboardMetric


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ['signature', 'slot', 'block_time', 'processed_at']
    list_filter = ['block_time', 'processed_at']
    search_fields = ['signature']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['-block_time']


@admin.register(MEVOpportunity)
class MEVOpportunityAdmin(admin.ModelAdmin):
    list_display = ['opportunity_type', 'strategy_used', 'profit_lamports', 'success', 'detected_at']
    list_filter = ['opportunity_type', 'strategy_used', 'success', 'detected_at']
    search_fields = ['strategy_used']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['-detected_at']


@admin.register(Strategy)
class StrategyAdmin(admin.ModelAdmin):
    list_display = ['name', 'strategy_type', 'is_active', 'total_opportunities', 'successful_opportunities']
    list_filter = ['strategy_type', 'is_active']
    search_fields = ['name', 'description']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['-created_at']


@admin.register(DashboardMetric)
class DashboardMetricAdmin(admin.ModelAdmin):
    list_display = ['metric_name', 'metric_type', 'value', 'unit', 'timestamp']
    list_filter = ['metric_type', 'timestamp']
    search_fields = ['metric_name']
    readonly_fields = ['id']
    ordering = ['-timestamp']
