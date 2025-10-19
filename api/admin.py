from django.contrib import admin
from .models import APIKey, APIRequestLog, Webhook, WebhookDelivery


@admin.register(APIKey)
class APIKeyAdmin(admin.ModelAdmin):
    list_display = ['name', 'user', 'key_type', 'is_active', 'last_used_at', 'request_count']
    list_filter = ['key_type', 'is_active', 'last_used_at']
    search_fields = ['name', 'user__username']
    readonly_fields = ['id', 'key', 'created_at', 'updated_at', 'request_count']
    ordering = ['-created_at']


@admin.register(APIRequestLog)
class APIRequestLogAdmin(admin.ModelAdmin):
    list_display = ['method', 'path', 'status_code', 'ip_address', 'timestamp']
    list_filter = ['method', 'status_code', 'timestamp', 'is_error']
    search_fields = ['path', 'ip_address']
    readonly_fields = ['id']
    ordering = ['-timestamp']


@admin.register(Webhook)
class WebhookAdmin(admin.ModelAdmin):
    list_display = ['name', 'user', 'status', 'success_count', 'failure_count', 'last_success_at']
    list_filter = ['status', 'last_success_at']
    search_fields = ['name', 'user__username']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['-created_at']


@admin.register(WebhookDelivery)
class WebhookDeliveryAdmin(admin.ModelAdmin):
    list_display = ['webhook', 'event_type', 'status', 'attempt_count', 'scheduled_at']
    list_filter = ['event_type', 'status', 'scheduled_at']
    search_fields = ['webhook__name']
    readonly_fields = ['id']
    ordering = ['-scheduled_at']
