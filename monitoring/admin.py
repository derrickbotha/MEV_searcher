from django.contrib import admin
from .models import SystemHealth, LogEntry, PerformanceProfile, Incident, Backup


@admin.register(SystemHealth)
class SystemHealthAdmin(admin.ModelAdmin):
    list_display = ['component', 'status', 'response_time_ms', 'timestamp']
    list_filter = ['component', 'status', 'timestamp']
    readonly_fields = ['id']
    ordering = ['-timestamp']


@admin.register(LogEntry)
class LogEntryAdmin(admin.ModelAdmin):
    list_display = ['level', 'component', 'message', 'timestamp']
    list_filter = ['level', 'component', 'timestamp']
    search_fields = ['message', 'logger_name']
    readonly_fields = ['id']
    ordering = ['-timestamp']


@admin.register(PerformanceProfile)
class PerformanceProfileAdmin(admin.ModelAdmin):
    list_display = ['component', 'function_name', 'execution_time_ms', 'timestamp']
    list_filter = ['component', 'timestamp']
    search_fields = ['function_name', 'operation']
    readonly_fields = ['id']
    ordering = ['-timestamp']


@admin.register(Incident)
class IncidentAdmin(admin.ModelAdmin):
    list_display = ['title', 'severity', 'status', 'detected_at', 'duration']
    list_filter = ['severity', 'status', 'detected_at']
    search_fields = ['title', 'description']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['-detected_at']


@admin.register(Backup)
class BackupAdmin(admin.ModelAdmin):
    list_display = ['backup_type', 'name', 'status', 'started_at', 'completed_at']
    list_filter = ['backup_type', 'status', 'started_at']
    search_fields = ['name']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['-started_at']
