from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from dashboard.models import Transaction, MEVOpportunity, Strategy
import uuid


class PerformanceMetric(models.Model):
    """Model for storing detailed performance metrics"""

    METRIC_TYPES = [
        ('latency', 'Latency'),
        ('throughput', 'Throughput'),
        ('profitability', 'Profitability'),
        ('success_rate', 'Success Rate'),
        ('gas_efficiency', 'Gas Efficiency'),
        ('cpu_usage', 'CPU Usage'),
        ('memory_usage', 'Memory Usage'),
        ('network_io', 'Network I/O'),
    ]

    id = models.BigAutoField(primary_key=True)
    timestamp = models.DateTimeField(default=timezone.now)

    # Metric details
    metric_name = models.CharField(max_length=100)
    metric_type = models.CharField(max_length=50, choices=METRIC_TYPES)
    value = models.DecimalField(max_digits=20, decimal_places=10)
    unit = models.CharField(max_length=20, blank=True)

    # Context
    tags = models.JSONField(default=dict, help_text="Additional metric context/tags")

    # Relationships
    strategy = models.ForeignKey(Strategy, on_delete=models.SET_NULL, null=True, blank=True)
    transaction = models.ForeignKey(Transaction, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'performance_metrics'
        indexes = [
            models.Index(fields=['metric_name', 'timestamp']),
            models.Index(fields=['metric_type']),
            models.Index(fields=['timestamp']),
            models.Index(fields=['strategy']),
        ]
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.metric_name}: {self.value} {self.unit} at {self.timestamp}"


class AnalyticsReport(models.Model):
    """Model for storing generated analytics reports"""

    REPORT_TYPES = [
        ('daily', 'Daily Report'),
        ('weekly', 'Weekly Report'),
        ('monthly', 'Monthly Report'),
        ('custom', 'Custom Report'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('generating', 'Generating'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    report_type = models.CharField(max_length=20, choices=REPORT_TYPES)

    # Report configuration
    config = models.JSONField(default=dict, help_text="Report configuration parameters")
    date_range_start = models.DateTimeField()
    date_range_end = models.DateTimeField()

    # Report content
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    content = models.JSONField(default=dict, help_text="Generated report content")
    summary = models.TextField(blank=True, help_text="Report summary")

    # File storage
    file_path = models.CharField(max_length=500, blank=True, help_text="Path to generated report file")
    file_size_bytes = models.BigIntegerField(default=0)

    # Timing
    generated_at = models.DateTimeField(null=True, blank=True)
    generation_duration = models.DurationField(null=True, blank=True)

    # Relationships
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'analytics_reports'
        indexes = [
            models.Index(fields=['report_type']),
            models.Index(fields=['status']),
            models.Index(fields=['created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.report_type})"


class RiskMetric(models.Model):
    """Model for storing risk analysis metrics"""

    RISK_TYPES = [
        ('volatility', 'Volatility'),
        ('drawdown', 'Drawdown'),
        ('sharpe_ratio', 'Sharpe Ratio'),
        ('sortino_ratio', 'Sortino Ratio'),
        ('value_at_risk', 'Value at Risk'),
        ('expected_shortfall', 'Expected Shortfall'),
    ]

    id = models.BigAutoField(primary_key=True)
    timestamp = models.DateTimeField(default=timezone.now)

    # Risk metric details
    risk_type = models.CharField(max_length=50, choices=RISK_TYPES)
    value = models.DecimalField(max_digits=20, decimal_places=10)
    confidence_level = models.FloatField(default=0.95, help_text="Confidence level for VaR/ES calculations")

    # Context
    strategy = models.ForeignKey(Strategy, on_delete=models.CASCADE, related_name='risk_metrics')
    time_horizon = models.CharField(max_length=20, help_text="Time horizon (e.g., 1d, 1w, 1m)")

    # Additional data
    metadata = models.JSONField(default=dict, help_text="Additional risk calculation metadata")

    class Meta:
        db_table = 'risk_metrics'
        indexes = [
            models.Index(fields=['risk_type', 'timestamp']),
            models.Index(fields=['strategy']),
            models.Index(fields=['time_horizon']),
        ]
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.risk_type} for {self.strategy.name}: {self.value}"


class PortfolioSnapshot(models.Model):
    """Model for storing portfolio snapshots over time"""

    id = models.BigAutoField(primary_key=True)
    timestamp = models.DateTimeField(default=timezone.now)

    # Portfolio metrics
    total_value_lamports = models.BigIntegerField(help_text="Total portfolio value in lamports")
    total_profit_lamports = models.BigIntegerField(help_text="Total profit in lamports")
    total_gas_used = models.BigIntegerField(help_text="Total gas used")

    # Performance metrics
    win_rate = models.FloatField(help_text="Win rate percentage")
    profit_factor = models.FloatField(help_text="Profit factor (gross profit / gross loss)")
    sharpe_ratio = models.FloatField(null=True, blank=True)

    # Risk metrics
    max_drawdown = models.FloatField(help_text="Maximum drawdown percentage")
    volatility = models.FloatField(help_text="Portfolio volatility")

    # Strategy breakdown
    strategy_performance = models.JSONField(default=dict, help_text="Performance breakdown by strategy")

    class Meta:
        db_table = 'portfolio_snapshots'
        indexes = [
            models.Index(fields=['timestamp']),
        ]
        ordering = ['-timestamp']

    def __str__(self):
        return f"Portfolio snapshot at {self.timestamp}: {self.total_value_lamports} lamports"


class CustomDashboard(models.Model):
    """Model for storing user-defined custom dashboards"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    # Dashboard configuration
    layout = models.JSONField(default=dict, help_text="Dashboard layout configuration")
    widgets = models.JSONField(default=list, help_text="List of dashboard widgets")

    # Visibility
    is_public = models.BooleanField(default=False)
    is_template = models.BooleanField(default=False, help_text="Whether this is a template dashboard")

    # Relationships
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='custom_dashboards')
    forked_from = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True,
                                  related_name='forks', help_text="Dashboard this was forked from")

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_viewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'custom_dashboards'
        indexes = [
            models.Index(fields=['created_by']),
            models.Index(fields=['is_public']),
            models.Index(fields=['is_template']),
        ]
        ordering = ['-last_viewed_at', '-updated_at']

    def __str__(self):
        return f"Custom Dashboard: {self.name} by {self.created_by.username}"


class Alert(models.Model):
    """Model for storing system alerts and notifications"""

    ALERT_TYPES = [
        ('performance', 'Performance Alert'),
        ('risk', 'Risk Alert'),
        ('system', 'System Alert'),
        ('opportunity', 'Opportunity Alert'),
    ]

    SEVERITY_LEVELS = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('acknowledged', 'Acknowledged'),
        ('resolved', 'Resolved'),
        ('dismissed', 'Dismissed'),
    ]

    id = models.BigAutoField(primary_key=True)
    title = models.CharField(max_length=200)
    message = models.TextField()

    # Alert classification
    alert_type = models.CharField(max_length=50, choices=ALERT_TYPES)
    severity = models.CharField(max_length=20, choices=SEVERITY_LEVELS, default='medium')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')

    # Context
    related_strategy = models.ForeignKey(Strategy, on_delete=models.SET_NULL, null=True, blank=True)
    related_transaction = models.ForeignKey(Transaction, on_delete=models.SET_NULL, null=True, blank=True)
    metadata = models.JSONField(default=dict, help_text="Additional alert context")

    # Timing
    triggered_at = models.DateTimeField(default=timezone.now)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    # Recipients
    notified_users = models.ManyToManyField(User, related_name='alerts', blank=True)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'alerts'
        indexes = [
            models.Index(fields=['alert_type']),
            models.Index(fields=['severity']),
            models.Index(fields=['status']),
            models.Index(fields=['triggered_at']),
        ]
        ordering = ['-triggered_at']

    def __str__(self):
        return f"{self.severity.upper()} {self.alert_type}: {self.title}"
