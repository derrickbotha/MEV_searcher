from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.conf import settings
import uuid


# Conditional field for JSON support
def JSONField(**kwargs):
    """Return JSONField for PostgreSQL, TextField for SQLite"""
    if 'postgresql' in settings.DATABASES['default']['ENGINE']:
        return models.JSONField(**kwargs)
    else:
        return models.TextField(**kwargs)


class Transaction(models.Model):
    """Model for storing Solana transaction data"""

    # Transaction identification
    id = models.BigAutoField(primary_key=True)
    signature = models.CharField(max_length=88, unique=True, help_text="Solana transaction signature")
    slot = models.BigIntegerField(help_text="Solana slot number")
    block_time = models.DateTimeField(null=True, blank=True, help_text="Block timestamp")

    # Transaction data
    raw_data = JSONField(help_text="Raw transaction data as JSON")
    processed_at = models.DateTimeField(default=timezone.now, help_text="When transaction was processed")

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'transactions'
        indexes = [
            models.Index(fields=['slot']),
            models.Index(fields=['block_time']),
            models.Index(fields=['processed_at']),
        ]
        ordering = ['-block_time']

    def __str__(self):
        return f"Transaction {self.signature[:8]}... at slot {self.slot}"


class MEVOpportunity(models.Model):
    """Model for storing detected MEV opportunities"""

    OPPORTUNITY_TYPES = [
        ('arbitrage', 'Arbitrage'),
        ('sandwich', 'Sandwich Attack'),
        ('liquidation', 'Liquidation'),
        ('frontrun', 'Front-running'),
        ('backrun', 'Back-running'),
    ]

    id = models.BigAutoField(primary_key=True)
    transaction = models.ForeignKey(Transaction, on_delete=models.CASCADE, related_name='mev_opportunities')

    # Opportunity details
    opportunity_type = models.CharField(max_length=50, choices=OPPORTUNITY_TYPES)
    strategy_used = models.CharField(max_length=100, help_text="Strategy that detected this opportunity")

    # Financial metrics
    profit_lamports = models.BigIntegerField(help_text="Profit in lamports")
    gas_used = models.BigIntegerField(help_text="Gas used for the transaction")

    # Timing
    detected_at = models.DateTimeField(help_text="When opportunity was detected")
    executed_at = models.DateTimeField(null=True, blank=True, help_text="When opportunity was executed")
    success = models.BooleanField(default=False, help_text="Whether execution was successful")

    # Additional data
    metadata = JSONField(default=dict, help_text="Additional opportunity metadata")

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'mev_opportunities'
        indexes = [
            models.Index(fields=['opportunity_type', 'detected_at']),
            models.Index(fields=['strategy_used']),
            models.Index(fields=['success']),
            models.Index(fields=['detected_at']),
        ]
        ordering = ['-detected_at']

    def __str__(self):
        return f"{self.opportunity_type} opportunity: {self.profit_lamports} lamports"


class Strategy(models.Model):
    """Model for storing MEV strategies"""

    STRATEGY_TYPES = [
        ('sandwich', 'Sandwich Attack'),
        ('arbitrage', 'Arbitrage'),
        ('liquidation', 'Liquidation'),
        ('custom', 'Custom Strategy'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    strategy_type = models.CharField(max_length=50, choices=STRATEGY_TYPES)
    description = models.TextField(blank=True)

    # Configuration
    config = JSONField(default=dict, help_text="Strategy configuration parameters")
    is_active = models.BooleanField(default=True)

    # Performance tracking
    total_opportunities = models.IntegerField(default=0)
    successful_opportunities = models.IntegerField(default=0)
    total_profit_lamports = models.BigIntegerField(default=0)
    total_gas_used = models.BigIntegerField(default=0)

    # Metadata
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'strategies'
        ordering = ['-created_at']

    @property
    def success_rate(self):
        """Calculate success rate as percentage"""
        if self.total_opportunities == 0:
            return 0.0
        return (self.successful_opportunities / self.total_opportunities) * 100

    def __str__(self):
        return f"{self.name} ({self.strategy_type})"


class DashboardMetric(models.Model):
    """Model for storing dashboard metrics"""

    METRIC_TYPES = [
        ('tps', 'Transactions Per Second'),
        ('mempool_size', 'Mempool Size'),
        ('gas_price', 'Average Gas Price'),
        ('profit', 'Total Profit'),
        ('opportunities', 'MEV Opportunities'),
        ('success_rate', 'Success Rate'),
    ]

    id = models.BigAutoField(primary_key=True)
    metric_name = models.CharField(max_length=100)
    metric_type = models.CharField(max_length=50, choices=METRIC_TYPES)
    value = models.DecimalField(max_digits=20, decimal_places=10)
    unit = models.CharField(max_length=20, blank=True, help_text="Unit of measurement")

    # Time tracking
    timestamp = models.DateTimeField(default=timezone.now)

    # Additional context
    tags = JSONField(default=dict, help_text="Additional metric tags")

    class Meta:
        db_table = 'dashboard_metrics'
        indexes = [
            models.Index(fields=['metric_name', 'timestamp']),
            models.Index(fields=['metric_type']),
            models.Index(fields=['timestamp']),
        ]
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.metric_name}: {self.value} {self.unit}"
