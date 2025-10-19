from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
import uuid


class DataArchive(models.Model):
    """Model for storing data archive information"""

    ARCHIVE_TYPES = [
        ('transactions', 'Transaction Data'),
        ('opportunities', 'MEV Opportunities'),
        ('metrics', 'Performance Metrics'),
        ('logs', 'System Logs'),
        ('models', 'ML Models'),
        ('backups', 'System Backups'),
    ]

    COMPRESSION_TYPES = [
        ('none', 'No Compression'),
        ('gzip', 'GZIP'),
        ('bz2', 'BZIP2'),
        ('xz', 'XZ'),
        ('zip', 'ZIP'),
    ]

    STORAGE_CLASSES = [
        ('hot', 'Hot Storage'),
        ('warm', 'Warm Storage'),
        ('cold', 'Cold Storage'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    archive_type = models.CharField(max_length=50, choices=ARCHIVE_TYPES)
    name = models.CharField(max_length=200)

    # Archive details
    file_path = models.CharField(max_length=500, help_text="Path to archived file")
    original_size_bytes = models.BigIntegerField(help_text="Original data size in bytes")
    compressed_size_bytes = models.BigIntegerField(help_text="Compressed file size in bytes")
    compression_type = models.CharField(max_length=10, choices=COMPRESSION_TYPES, default='gzip')

    # Storage information
    storage_class = models.CharField(max_length=10, choices=STORAGE_CLASSES, default='hot')
    storage_location = models.CharField(max_length=500, help_text="Storage location/path")

    # Data range
    date_from = models.DateTimeField(help_text="Start date of archived data")
    date_to = models.DateTimeField(help_text="End date of archived data")

    # Metadata
    record_count = models.BigIntegerField(default=0, help_text="Number of records in archive")
    checksum = models.CharField(max_length=128, help_text="File checksum for integrity")
    metadata = models.JSONField(default=dict, help_text="Additional archive metadata")

    # Archival timing
    archived_at = models.DateTimeField(default=timezone.now)
    retention_period_days = models.IntegerField(default=365, help_text="Retention period in days")

    # Status
    is_encrypted = models.BooleanField(default=False, help_text="Whether archive is encrypted")
    is_verified = models.BooleanField(default=False, help_text="Whether archive integrity is verified")

    class Meta:
        db_table = 'data_archives'
        indexes = [
            models.Index(fields=['archive_type']),
            models.Index(fields=['storage_class']),
            models.Index(fields=['date_from', 'date_to']),
            models.Index(fields=['archived_at']),
        ]
        ordering = ['-archived_at']

    @property
    def compression_ratio(self):
        """Calculate compression ratio"""
        if self.original_size_bytes == 0:
            return 0.0
        return self.compressed_size_bytes / self.original_size_bytes

    def __str__(self):
        return f"{self.archive_type} archive: {self.name}"


class FileStorage(models.Model):
    """Model for storing file metadata"""

    FILE_TYPES = [
        ('model', 'ML Model File'),
        ('dataset', 'Dataset File'),
        ('config', 'Configuration File'),
        ('log', 'Log File'),
        ('report', 'Report File'),
        ('backup', 'Backup File'),
        ('other', 'Other File'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, help_text="Original file name")
    file_type = models.CharField(max_length=50, choices=FILE_TYPES)

    # File details
    file_path = models.CharField(max_length=500, help_text="Storage path")
    file_size_bytes = models.BigIntegerField(help_text="File size in bytes")
    mime_type = models.CharField(max_length=100, blank=True, help_text="MIME type")

    # File metadata
    checksum = models.CharField(max_length=128, help_text="File checksum")
    encoding = models.CharField(max_length=50, blank=True, help_text="File encoding")
    metadata = models.JSONField(default=dict, help_text="Additional file metadata")

    # Storage information
    storage_class = models.CharField(max_length=10, choices=DataArchive.STORAGE_CLASSES, default='hot')
    is_encrypted = models.BooleanField(default=False)
    encryption_key_id = models.CharField(max_length=100, blank=True, help_text="Encryption key identifier")

    # Access control
    is_public = models.BooleanField(default=False, help_text="Whether file is publicly accessible")
    allowed_users = models.ManyToManyField(User, related_name='accessible_files', blank=True)

    # Lifecycle
    uploaded_at = models.DateTimeField(default=timezone.now)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True, help_text="Expiration date")
    last_accessed_at = models.DateTimeField(null=True, blank=True)

    # Download tracking
    download_count = models.IntegerField(default=0, help_text="Number of downloads")

    class Meta:
        db_table = 'file_storage'
        indexes = [
            models.Index(fields=['file_type']),
            models.Index(fields=['storage_class']),
            models.Index(fields=['uploaded_at']),
            models.Index(fields=['expires_at']),
        ]
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.file_type}: {self.name}"


class DataRetentionPolicy(models.Model):
    """Model for storing data retention policies"""

    DATA_TYPES = [
        ('transactions', 'Transaction Data'),
        ('opportunities', 'MEV Opportunities'),
        ('metrics', 'Performance Metrics'),
        ('logs', 'System Logs'),
        ('models', 'ML Models'),
        ('backups', 'System Backups'),
        ('files', 'Uploaded Files'),
    ]

    RETENTION_UNITS = [
        ('days', 'Days'),
        ('weeks', 'Weeks'),
        ('months', 'Months'),
        ('years', 'Years'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    data_type = models.CharField(max_length=50, choices=DATA_TYPES)

    # Retention rules
    retention_period = models.IntegerField(help_text="Retention period value")
    retention_unit = models.CharField(max_length=10, choices=RETENTION_UNITS, default='days')

    # Storage tier migration
    hot_storage_days = models.IntegerField(default=30, help_text="Days to keep in hot storage")
    warm_storage_days = models.IntegerField(default=365, help_text="Days to keep in warm storage")
    # Cold storage is indefinite

    # Archival settings
    auto_archive = models.BooleanField(default=True, help_text="Automatically archive old data")
    compression_enabled = models.BooleanField(default=True, help_text="Compress archived data")
    encryption_enabled = models.BooleanField(default=True, help_text="Encrypt archived data")

    # Policy status
    is_active = models.BooleanField(default=True)
    description = models.TextField(blank=True)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'data_retention_policies'
        indexes = [
            models.Index(fields=['data_type']),
            models.Index(fields=['is_active']),
        ]
        ordering = ['data_type', 'name']

    def __str__(self):
        return f"Retention policy: {self.name} ({self.data_type})"


class StorageQuota(models.Model):
    """Model for storing storage quotas and usage"""

    QUOTA_TYPES = [
        ('user', 'Per User'),
        ('project', 'Per Project'),
        ('global', 'Global'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quota_type = models.CharField(max_length=20, choices=QUOTA_TYPES)
    name = models.CharField(max_length=100, help_text="Quota name/description")

    # Quota limits
    max_size_bytes = models.BigIntegerField(help_text="Maximum storage size in bytes")
    max_files = models.IntegerField(default=0, help_text="Maximum number of files (0 = unlimited)")

    # Current usage
    current_size_bytes = models.BigIntegerField(default=0, help_text="Current storage usage")
    current_files = models.IntegerField(default=0, help_text="Current number of files")

    # Associated entity
    user = models.OneToOneField(User, on_delete=models.CASCADE, null=True, blank=True,
                               help_text="Associated user (for user quotas)")

    # Status
    is_active = models.BooleanField(default=True)
    warning_threshold_percent = models.FloatField(default=80.0, help_text="Warning threshold percentage")

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'storage_quotas'
        indexes = [
            models.Index(fields=['quota_type']),
            models.Index(fields=['is_active']),
        ]

    @property
    def usage_percent(self):
        """Calculate current usage percentage"""
        if self.max_size_bytes == 0:
            return 0.0
        return (self.current_size_bytes / self.max_size_bytes) * 100

    @property
    def is_over_limit(self):
        """Check if quota is exceeded"""
        return self.current_size_bytes > self.max_size_bytes

    def __str__(self):
        return f"{self.quota_type} quota: {self.name}"


class DataExport(models.Model):
    """Model for storing data export jobs"""

    EXPORT_TYPES = [
        ('csv', 'CSV Export'),
        ('json', 'JSON Export'),
        ('parquet', 'Parquet Export'),
        ('excel', 'Excel Export'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, help_text="Export job name")
    export_type = models.CharField(max_length=20, choices=EXPORT_TYPES)

    # Export configuration
    config = models.JSONField(default=dict, help_text="Export configuration (filters, columns, etc.)")
    data_source = models.CharField(max_length=100, help_text="Source of data to export")

    # Date range
    date_from = models.DateTimeField(null=True, blank=True)
    date_to = models.DateTimeField(null=True, blank=True)

    # Status and progress
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    progress_percent = models.FloatField(default=0.0, help_text="Export progress (0-100)")

    # Result
    file_path = models.CharField(max_length=500, blank=True, help_text="Path to exported file")
    file_size_bytes = models.BigIntegerField(default=0, help_text="Size of exported file")
    record_count = models.IntegerField(default=0, help_text="Number of records exported")

    # Timing
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    duration = models.DurationField(null=True, blank=True)

    # Error handling
    error_message = models.TextField(blank=True, help_text="Error message if export failed")

    # Relationships
    requested_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'data_exports'
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['export_type']),
            models.Index(fields=['created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"Export: {self.name} ({self.export_type})"
