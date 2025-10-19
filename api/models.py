from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
import uuid
import secrets


class APIKey(models.Model):
    """Model for storing API keys"""

    KEY_TYPES = [
        ('read', 'Read Only'),
        ('write', 'Read/Write'),
        ('admin', 'Admin'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='api_keys')
    name = models.CharField(max_length=100, help_text="API key name/description")

    # Key details
    key = models.CharField(max_length=128, unique=True, help_text="API key value")
    key_type = models.CharField(max_length=10, choices=KEY_TYPES, default='read')

    # Permissions
    permissions = models.JSONField(default=list, help_text="List of specific permissions")

    # Rate limiting
    rate_limit_requests = models.IntegerField(default=1000, help_text="Requests per time window")
    rate_limit_window_seconds = models.IntegerField(default=3600, help_text="Time window in seconds")

    # Status
    is_active = models.BooleanField(default=True)
    expires_at = models.DateTimeField(null=True, blank=True, help_text="Expiration date")

    # Usage tracking
    last_used_at = models.DateTimeField(null=True, blank=True)
    request_count = models.BigIntegerField(default=0, help_text="Total requests made")

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'api_keys'
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['key']),
            models.Index(fields=['is_active']),
            models.Index(fields=['expires_at']),
        ]
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        # Generate API key if not provided
        if not self.key:
            self.key = secrets.token_urlsafe(64)
        super().save(*args, **kwargs)

    @property
    def is_expired(self):
        """Check if API key is expired"""
        return self.expires_at and timezone.now() > self.expires_at

    def __str__(self):
        return f"API Key: {self.name} ({self.user.username})"


class APIRequestLog(models.Model):
    """Model for logging API requests"""

    id = models.BigAutoField(primary_key=True)
    timestamp = models.DateTimeField(default=timezone.now)

    # Request details
    api_key = models.ForeignKey(APIKey, on_delete=models.SET_NULL, null=True, blank=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    # HTTP details
    method = models.CharField(max_length=10)
    path = models.CharField(max_length=500)
    query_params = models.TextField(blank=True, help_text="Query parameters")
    user_agent = models.TextField(blank=True)

    # Response details
    status_code = models.IntegerField()
    response_size_bytes = models.IntegerField(default=0)
    response_time_ms = models.FloatField(help_text="Response time in milliseconds")

    # Client information
    ip_address = models.GenericIPAddressField()
    country = models.CharField(max_length=2, blank=True, help_text="Country code")

    # Error tracking
    is_error = models.BooleanField(default=False)
    error_message = models.TextField(blank=True)

    # Rate limiting
    rate_limit_hit = models.BooleanField(default=False, help_text="Whether rate limit was hit")

    class Meta:
        db_table = 'api_request_logs'
        indexes = [
            models.Index(fields=['api_key']),
            models.Index(fields=['user']),
            models.Index(fields=['timestamp']),
            models.Index(fields=['status_code']),
            models.Index(fields=['is_error']),
        ]
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.method} {self.path} - {self.status_code}"


class Webhook(models.Model):
    """Model for storing webhook configurations"""

    EVENT_TYPES = [
        ('transaction.new', 'New Transaction'),
        ('opportunity.detected', 'MEV Opportunity Detected'),
        ('opportunity.executed', 'MEV Opportunity Executed'),
        ('alert.triggered', 'Alert Triggered'),
        ('model.trained', 'ML Model Trained'),
        ('backup.completed', 'Backup Completed'),
    ]

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('failed', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='webhooks')
    name = models.CharField(max_length=100, help_text="Webhook name")

    # Webhook configuration
    url = models.URLField(help_text="Webhook URL")
    secret = models.CharField(max_length=128, help_text="Webhook secret for signature verification")

    # Events
    events = models.JSONField(default=list, help_text="List of events to trigger webhook")

    # Status and retry logic
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active')
    retry_count = models.IntegerField(default=3, help_text="Number of retry attempts")
    retry_delay_seconds = models.IntegerField(default=60, help_text="Delay between retries")

    # Statistics
    success_count = models.IntegerField(default=0, help_text="Successful deliveries")
    failure_count = models.IntegerField(default=0, help_text="Failed deliveries")
    last_success_at = models.DateTimeField(null=True, blank=True)
    last_failure_at = models.DateTimeField(null=True, blank=True)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'webhooks'
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['status']),
            models.Index(fields=['created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"Webhook: {self.name} ({self.user.username})"


class WebhookDelivery(models.Model):
    """Model for storing webhook delivery attempts"""

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('success', 'Success'),
        ('failed', 'Failed'),
        ('retry', 'Retry Scheduled'),
    ]

    id = models.BigAutoField(primary_key=True)
    webhook = models.ForeignKey(Webhook, on_delete=models.CASCADE, related_name='deliveries')

    # Delivery details
    event_type = models.CharField(max_length=50, choices=Webhook.EVENT_TYPES)
    payload = models.JSONField(help_text="Webhook payload data")

    # Delivery status
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    attempt_count = models.IntegerField(default=0, help_text="Number of delivery attempts")

    # HTTP response
    response_status_code = models.IntegerField(null=True, blank=True)
    response_body = models.TextField(blank=True)
    response_headers = models.JSONField(default=dict)

    # Timing
    scheduled_at = models.DateTimeField(default=timezone.now)
    delivered_at = models.DateTimeField(null=True, blank=True)
    next_retry_at = models.DateTimeField(null=True, blank=True)

    # Error information
    error_message = models.TextField(blank=True)
    error_code = models.CharField(max_length=50, blank=True)

    class Meta:
        db_table = 'webhook_deliveries'
        indexes = [
            models.Index(fields=['webhook']),
            models.Index(fields=['status']),
            models.Index(fields=['event_type']),
            models.Index(fields=['scheduled_at']),
        ]
        ordering = ['-scheduled_at']

    def __str__(self):
        return f"Webhook delivery: {self.event_type} to {self.webhook.name}"
