from django.db import models
from django.utils import timezone
import uuid


class SystemHealth(models.Model):
    """Model for storing system health metrics"""

    COMPONENT_TYPES = [
        ('database', 'Database'),
        ('redis', 'Redis Cache'),
        ('web_server', 'Web Server'),
        ('websocket', 'WebSocket Server'),
        ('celery', 'Celery Worker'),
        ('cpp_engine', 'C++ MEV Engine'),
        ('ml_service', 'ML Service'),
    ]

    STATUS_CHOICES = [
        ('healthy', 'Healthy'),
        ('degraded', 'Degraded'),
        ('unhealthy', 'Unhealthy'),
        ('down', 'Down'),
    ]

    id = models.BigAutoField(primary_key=True)
    timestamp = models.DateTimeField(default=timezone.now)

    # Component information
    component = models.CharField(max_length=50, choices=COMPONENT_TYPES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='healthy')

    # Health metrics
    response_time_ms = models.FloatField(null=True, blank=True, help_text="Response time in milliseconds")
    cpu_usage_percent = models.FloatField(null=True, blank=True, help_text="CPU usage percentage")
    memory_usage_percent = models.FloatField(null=True, blank=True, help_text="Memory usage percentage")
    disk_usage_percent = models.FloatField(null=True, blank=True, help_text="Disk usage percentage")

    # Connection metrics
    active_connections = models.IntegerField(default=0, help_text="Number of active connections")
    queue_size = models.IntegerField(default=0, help_text="Queue size for processing")

    # Error tracking
    error_count = models.IntegerField(default=0, help_text="Number of errors in the last check")
    last_error_message = models.TextField(blank=True, help_text="Last error message")

    # Additional metadata
    metadata = models.JSONField(default=dict, help_text="Additional health check metadata")

    class Meta:
        db_table = 'system_health'
        indexes = [
            models.Index(fields=['component', 'timestamp']),
            models.Index(fields=['status']),
            models.Index(fields=['timestamp']),
        ]
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.component}: {self.status} at {self.timestamp}"


class LogEntry(models.Model):
    """Model for storing application logs"""

    LOG_LEVELS = [
        ('DEBUG', 'Debug'),
        ('INFO', 'Info'),
        ('WARNING', 'Warning'),
        ('ERROR', 'Error'),
        ('CRITICAL', 'Critical'),
    ]

    COMPONENT_TYPES = [
        ('web', 'Web Application'),
        ('websocket', 'WebSocket'),
        ('celery', 'Celery Worker'),
        ('cpp_engine', 'C++ Engine'),
        ('ml_service', 'ML Service'),
        ('database', 'Database'),
        ('redis', 'Redis'),
    ]

    id = models.BigAutoField(primary_key=True)
    timestamp = models.DateTimeField(default=timezone.now)

    # Log details
    level = models.CharField(max_length=10, choices=LOG_LEVELS)
    component = models.CharField(max_length=50, choices=COMPONENT_TYPES)
    message = models.TextField()

    # Context
    logger_name = models.CharField(max_length=100, blank=True)
    function_name = models.CharField(max_length=100, blank=True)
    line_number = models.IntegerField(null=True, blank=True)

    # Additional data
    extra_data = models.JSONField(default=dict, help_text="Additional log context")

    # User context (if applicable)
    user_id = models.IntegerField(null=True, blank=True)
    session_id = models.CharField(max_length=100, blank=True)

    # Request context (for web requests)
    request_id = models.UUIDField(null=True, blank=True)
    request_method = models.CharField(max_length=10, blank=True)
    request_path = models.CharField(max_length=500, blank=True)
    response_status = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'log_entries'
        indexes = [
            models.Index(fields=['level']),
            models.Index(fields=['component']),
            models.Index(fields=['timestamp']),
            models.Index(fields=['request_id']),
        ]
        ordering = ['-timestamp']

    def __str__(self):
        return f"[{self.level}] {self.component}: {self.message[:50]}"


class PerformanceProfile(models.Model):
    """Model for storing performance profiling data"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    timestamp = models.DateTimeField(default=timezone.now)

    # Profiling context
    component = models.CharField(max_length=100, help_text="Component being profiled")
    function_name = models.CharField(max_length=200, help_text="Function being profiled")
    operation = models.CharField(max_length=100, help_text="Operation being performed")

    # Performance metrics
    execution_time_ms = models.FloatField(help_text="Execution time in milliseconds")
    cpu_time_ms = models.FloatField(null=True, blank=True, help_text="CPU time used")
    memory_used_bytes = models.BigIntegerField(null=True, blank=True, help_text="Memory used in bytes")

    # Context
    input_size = models.IntegerField(null=True, blank=True, help_text="Size of input data")
    output_size = models.IntegerField(null=True, blank=True, help_text="Size of output data")

    # Additional metadata
    metadata = models.JSONField(default=dict, help_text="Additional profiling metadata")

    class Meta:
        db_table = 'performance_profiles'
        indexes = [
            models.Index(fields=['component']),
            models.Index(fields=['function_name']),
            models.Index(fields=['operation']),
            models.Index(fields=['timestamp']),
        ]
        ordering = ['-timestamp']

    def __str__(self):
        return f"Profile: {self.function_name} took {self.execution_time_ms}ms"


class Incident(models.Model):
    """Model for storing system incidents and outages"""

    SEVERITY_LEVELS = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]

    STATUS_CHOICES = [
        ('investigating', 'Investigating'),
        ('identified', 'Identified'),
        ('monitoring', 'Monitoring'),
        ('resolved', 'Resolved'),
        ('closed', 'Closed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    description = models.TextField()

    # Incident classification
    severity = models.CharField(max_length=20, choices=SEVERITY_LEVELS, default='medium')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='investigating')

    # Affected components
    affected_components = models.JSONField(default=list, help_text="List of affected components")

    # Impact assessment
    impact_description = models.TextField(blank=True, help_text="Description of impact")
    affected_users = models.IntegerField(default=0, help_text="Number of affected users")

    # Timeline
    detected_at = models.DateTimeField(default=timezone.now)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    # Resolution
    root_cause = models.TextField(blank=True, help_text="Root cause analysis")
    resolution = models.TextField(blank=True, help_text="Resolution steps taken")
    preventive_measures = models.TextField(blank=True, help_text="Preventive measures implemented")

    # Communication
    public_communication = models.TextField(blank=True, help_text="Public communication about incident")
    internal_notes = models.TextField(blank=True, help_text="Internal notes and investigation details")

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'incidents'
        indexes = [
            models.Index(fields=['severity']),
            models.Index(fields=['status']),
            models.Index(fields=['detected_at']),
        ]
        ordering = ['-detected_at']

    @property
    def duration(self):
        """Calculate incident duration"""
        end_time = self.resolved_at or self.closed_at or timezone.now()
        return end_time - self.detected_at

    def __str__(self):
        return f"Incident: {self.title} ({self.severity})"


class Backup(models.Model):
    """Model for storing backup information"""

    BACKUP_TYPES = [
        ('database', 'Database Backup'),
        ('model', 'ML Model Backup'),
        ('config', 'Configuration Backup'),
        ('logs', 'Logs Backup'),
        ('full', 'Full System Backup'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    backup_type = models.CharField(max_length=50, choices=BACKUP_TYPES)
    name = models.CharField(max_length=100)

    # Backup details
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    file_path = models.CharField(max_length=500, blank=True, help_text="Path to backup file")
    file_size_bytes = models.BigIntegerField(default=0, help_text="Size of backup file")

    # Timing
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    duration = models.DurationField(null=True, blank=True)

    # Verification
    checksum = models.CharField(max_length=128, blank=True, help_text="Backup file checksum")
    verified_at = models.DateTimeField(null=True, blank=True, help_text="When backup was last verified")

    # Error handling
    error_message = models.TextField(blank=True, help_text="Error message if backup failed")

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'backups'
        indexes = [
            models.Index(fields=['backup_type']),
            models.Index(fields=['status']),
            models.Index(fields=['created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.backup_type} backup: {self.name} ({self.status})"
