from django.contrib import admin
from .models import DataArchive, FileStorage, DataRetentionPolicy, StorageQuota, DataExport


@admin.register(DataArchive)
class DataArchiveAdmin(admin.ModelAdmin):
    list_display = ['archive_type', 'name', 'storage_class', 'archived_at', 'compression_ratio']
    list_filter = ['archive_type', 'storage_class', 'archived_at']
    search_fields = ['name']
    readonly_fields = ['id']
    ordering = ['-archived_at']


@admin.register(FileStorage)
class FileStorageAdmin(admin.ModelAdmin):
    list_display = ['name', 'file_type', 'file_size_bytes', 'storage_class', 'uploaded_at']
    list_filter = ['file_type', 'storage_class', 'uploaded_at', 'is_public']
    search_fields = ['name']
    readonly_fields = ['id', 'download_count']
    ordering = ['-uploaded_at']


@admin.register(DataRetentionPolicy)
class DataRetentionPolicyAdmin(admin.ModelAdmin):
    list_display = ['name', 'data_type', 'retention_period', 'retention_unit', 'is_active']
    list_filter = ['data_type', 'is_active']
    search_fields = ['name', 'description']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['data_type', 'name']


@admin.register(StorageQuota)
class StorageQuotaAdmin(admin.ModelAdmin):
    list_display = ['quota_type', 'name', 'usage_percent', 'is_over_limit', 'is_active']
    list_filter = ['quota_type', 'is_active']
    search_fields = ['name']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(DataExport)
class DataExportAdmin(admin.ModelAdmin):
    list_display = ['name', 'export_type', 'status', 'progress_percent', 'started_at']
    list_filter = ['export_type', 'status', 'started_at']
    search_fields = ['name', 'data_source']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['-started_at']
