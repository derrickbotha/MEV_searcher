from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from dashboard.models import Transaction
from pgvector.django import VectorField
import uuid


class MLModel(models.Model):
    """Model for storing ML models"""

    MODEL_TYPES = [
        ('opportunity_detection', 'Opportunity Detection'),
        ('profit_estimation', 'Profit Estimation'),
        ('strategy_optimization', 'Strategy Optimization'),
        ('risk_assessment', 'Risk Assessment'),
    ]

    ALGORITHMS = [
        ('xgboost', 'XGBoost'),
        ('lightgbm', 'LightGBM'),
        ('tensorflow', 'TensorFlow'),
        ('pytorch', 'PyTorch'),
        ('sklearn', 'Scikit-learn'),
    ]

    STATUS_CHOICES = [
        ('training', 'Training'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('deployed', 'Deployed'),
        ('retired', 'Retired'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    model_type = models.CharField(max_length=50, choices=MODEL_TYPES)
    algorithm = models.CharField(max_length=50, choices=ALGORITHMS)

    # Model metadata
    version = models.CharField(max_length=20, help_text="Model version (e.g., v1.0.0)")
    description = models.TextField(blank=True)

    # Model configuration
    config = models.JSONField(default=dict, help_text="Model hyperparameters and configuration")
    feature_names = models.JSONField(default=list, help_text="List of feature names used by the model")

    # Performance metrics
    accuracy = models.FloatField(null=True, blank=True)
    precision = models.FloatField(null=True, blank=True)
    recall = models.FloatField(null=True, blank=True)
    f1_score = models.FloatField(null=True, blank=True)
    auc_roc = models.FloatField(null=True, blank=True)

    # Training metadata
    training_started_at = models.DateTimeField(null=True, blank=True)
    training_completed_at = models.DateTimeField(null=True, blank=True)
    training_duration = models.DurationField(null=True, blank=True)

    # Model artifacts
    model_path = models.CharField(max_length=500, blank=True, help_text="Path to saved model file")
    model_size_bytes = models.BigIntegerField(default=0, help_text="Size of model file in bytes")

    # Status and deployment
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='training')
    is_active = models.BooleanField(default=False, help_text="Whether this model is currently active")
    deployed_at = models.DateTimeField(null=True, blank=True)

    # Relationships
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    parent_model = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name='child_models', help_text="Parent model for versioning")

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ml_models'
        indexes = [
            models.Index(fields=['model_type', 'status']),
            models.Index(fields=['algorithm']),
            models.Index(fields=['is_active']),
            models.Index(fields=['created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} v{self.version} ({self.model_type})"


class VectorEmbedding(models.Model):
    """Model for storing vector embeddings in PostgreSQL with pgvector"""

    EMBEDDING_TYPES = [
        ('transaction_features', 'Transaction Features'),
        ('market_state', 'Market State'),
        ('strategy_pattern', 'Strategy Pattern'),
        ('opportunity_signature', 'Opportunity Signature'),
        ('risk_profile', 'Risk Profile'),
    ]

    id = models.BigAutoField(primary_key=True)

    # Embedding metadata
    embedding_type = models.CharField(max_length=50, choices=EMBEDDING_TYPES)
    name = models.CharField(max_length=200, help_text="Descriptive name for the embedding")

    # Vector data (using pgvector)
    vector = VectorField(dimensions=768, help_text="Vector embedding (768 dimensions for BERT-like models)")

    # Associated data
    metadata = models.JSONField(default=dict, help_text="Additional metadata for the embedding")
    tags = models.JSONField(default=list, help_text="Tags for categorization and search")

    # Relationships
    transaction = models.ForeignKey(Transaction, on_delete=models.CASCADE, null=True, blank=True,
                                  related_name='embeddings')
    model = models.ForeignKey('MLModel', on_delete=models.CASCADE, null=True, blank=True,
                             related_name='embeddings')

    # Quality metrics
    confidence_score = models.FloatField(default=0.0, help_text="Confidence score of the embedding")
    quality_score = models.FloatField(default=0.0, help_text="Quality score of the embedding")

    # Usage tracking
    usage_count = models.IntegerField(default=0, help_text="Number of times this embedding has been used")
    last_used_at = models.DateTimeField(null=True, blank=True)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'vector_embeddings'
        indexes = [
            # Vector similarity search index (created via migration)
            models.Index(fields=['embedding_type']),
            models.Index(fields=['created_at']),
            models.Index(fields=['usage_count']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.embedding_type}: {self.name}"

    @classmethod
    def find_similar(cls, query_vector, embedding_type=None, limit=10):
        """
        Find similar embeddings using vector similarity search
        """
        queryset = cls.objects.all()
        if embedding_type:
            queryset = queryset.filter(embedding_type=embedding_type)

        # Use pgvector's cosine similarity search
        return queryset.annotate(
            similarity=VectorField.cosine_similarity('vector', query_vector)
        ).order_by('-similarity')[:limit]


class MLTrainingSample(models.Model):
    """Model for storing ML training samples"""

    id = models.BigAutoField(primary_key=True)
    transaction = models.ForeignKey(Transaction, on_delete=models.CASCADE, related_name='ml_samples')

    # Features and labels
    features = models.JSONField(help_text="Extracted features for ML model")
    labels = models.JSONField(default=dict, help_text="Target variables/labels")

    # Model association
    model_version = models.CharField(max_length=50, help_text="Version of model this sample is for")

    # Sample metadata
    sample_weight = models.FloatField(default=1.0, help_text="Sample weight for training")
    is_validation = models.BooleanField(default=False, help_text="Whether this is a validation sample")
    is_test = models.BooleanField(default=False, help_text="Whether this is a test sample")

    # Processing metadata
    processed_at = models.DateTimeField(default=timezone.now)
    feature_extraction_version = models.CharField(max_length=20, help_text="Version of feature extraction logic")

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ml_training_samples'
        indexes = [
            models.Index(fields=['model_version']),
            models.Index(fields=['is_validation']),
            models.Index(fields=['is_test']),
            models.Index(fields=['processed_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"ML Sample for {self.transaction.signature[:8]}... (model: {self.model_version})"


class TrainingRun(models.Model):
    """Model for storing ML training runs"""

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    model = models.ForeignKey(MLModel, on_delete=models.CASCADE, related_name='training_runs')

    # Training configuration
    config = models.JSONField(default=dict, help_text="Training configuration and hyperparameters")

    # Training progress
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    progress_percentage = models.FloatField(default=0.0, help_text="Training progress (0-100)")

    # Training metrics
    train_loss = models.JSONField(default=list, help_text="Training loss over epochs")
    val_loss = models.JSONField(default=list, help_text="Validation loss over epochs")
    train_metrics = models.JSONField(default=dict, help_text="Training metrics")
    val_metrics = models.JSONField(default=dict, help_text="Validation metrics")

    # Timing
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    duration = models.DurationField(null=True, blank=True)

    # Results
    final_model_path = models.CharField(max_length=500, blank=True, help_text="Path to final trained model")
    best_checkpoint_path = models.CharField(max_length=500, blank=True, help_text="Path to best checkpoint")

    # Error handling
    error_message = models.TextField(blank=True, help_text="Error message if training failed")

    # Relationships
    initiated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'training_runs'
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['started_at']),
            models.Index(fields=['completed_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"Training run for {self.model.name} ({self.status})"


class ModelEvaluation(models.Model):
    """Model for storing model evaluation results"""

    id = models.BigAutoField(primary_key=True)
    model = models.ForeignKey(MLModel, on_delete=models.CASCADE, related_name='evaluations')

    # Evaluation metadata
    evaluation_type = models.CharField(max_length=50, help_text="Type of evaluation (e.g., cross_validation, holdout)")
    dataset_info = models.JSONField(default=dict, help_text="Information about evaluation dataset")

    # Performance metrics
    accuracy = models.FloatField(null=True, blank=True)
    precision = models.FloatField(null=True, blank=True)
    recall = models.FloatField(null=True, blank=True)
    f1_score = models.FloatField(null=True, blank=True)
    auc_roc = models.FloatField(null=True, blank=True)
    auc_pr = models.FloatField(null=True, blank=True)

    # Additional metrics
    confusion_matrix = models.JSONField(default=dict, help_text="Confusion matrix")
    classification_report = models.JSONField(default=dict, help_text="Detailed classification report")
    feature_importance = models.JSONField(default=dict, help_text="Feature importance scores")

    # Evaluation timing
    evaluated_at = models.DateTimeField(default=timezone.now)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'model_evaluations'
        indexes = [
            models.Index(fields=['model', 'evaluated_at']),
            models.Index(fields=['evaluation_type']),
        ]
        ordering = ['-evaluated_at']

    def __str__(self):
        return f"Evaluation for {self.model.name} ({self.evaluation_type})"


class ABLTest(models.Model):
    """Model for storing A/B testing results"""

    STATUS_CHOICES = [
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    # Models being tested
    model_a = models.ForeignKey(MLModel, on_delete=models.CASCADE, related_name='ab_tests_as_a')
    model_b = models.ForeignKey(MLModel, on_delete=models.CASCADE, related_name='ab_tests_as_b')

    # Test configuration
    traffic_split = models.FloatField(default=0.5, help_text="Traffic split (0.0-1.0) for model A")
    test_duration_days = models.IntegerField(default=7, help_text="Duration of test in days")
    min_sample_size = models.IntegerField(default=1000, help_text="Minimum sample size required")

    # Test status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='running')
    started_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Results
    model_a_performance = models.JSONField(default=dict, help_text="Performance metrics for model A")
    model_b_performance = models.JSONField(default=dict, help_text="Performance metrics for model B")
    winner = models.CharField(max_length=10, choices=[('A', 'Model A'), ('B', 'Model B'), ('tie', 'Tie')], blank=True)

    # Statistical significance
    confidence_level = models.FloatField(null=True, blank=True, help_text="Statistical confidence level")
    p_value = models.FloatField(null=True, blank=True, help_text="P-value for statistical test")

    # Metadata
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ab_tests'
        ordering = ['-created_at']

    def __str__(self):
        return f"A/B Test: {self.name} ({self.model_a.name} vs {self.model_b.name})"


class MLModel(models.Model):
    """Model for storing ML models"""

    MODEL_TYPES = [
        ('opportunity_detection', 'Opportunity Detection'),
        ('profit_estimation', 'Profit Estimation'),
        ('strategy_optimization', 'Strategy Optimization'),
        ('risk_assessment', 'Risk Assessment'),
    ]

    ALGORITHMS = [
        ('xgboost', 'XGBoost'),
        ('lightgbm', 'LightGBM'),
        ('tensorflow', 'TensorFlow'),
        ('pytorch', 'PyTorch'),
        ('sklearn', 'Scikit-learn'),
    ]

    STATUS_CHOICES = [
        ('training', 'Training'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('deployed', 'Deployed'),
        ('retired', 'Retired'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    model_type = models.CharField(max_length=50, choices=MODEL_TYPES)
    algorithm = models.CharField(max_length=50, choices=ALGORITHMS)

    # Model metadata
    version = models.CharField(max_length=20, help_text="Model version (e.g., v1.0.0)")
    description = models.TextField(blank=True)

    # Model configuration
    config = models.JSONField(default=dict, help_text="Model hyperparameters and configuration")
    feature_names = models.JSONField(default=list, help_text="List of feature names used by the model")

    # Performance metrics
    accuracy = models.FloatField(null=True, blank=True)
    precision = models.FloatField(null=True, blank=True)
    recall = models.FloatField(null=True, blank=True)
    f1_score = models.FloatField(null=True, blank=True)
    auc_roc = models.FloatField(null=True, blank=True)

    # Training metadata
    training_started_at = models.DateTimeField(null=True, blank=True)
    training_completed_at = models.DateTimeField(null=True, blank=True)
    training_duration = models.DurationField(null=True, blank=True)

    # Model artifacts
    model_path = models.CharField(max_length=500, blank=True, help_text="Path to saved model file")
    model_size_bytes = models.BigIntegerField(default=0, help_text="Size of model file in bytes")

    # Status and deployment
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='training')
    is_active = models.BooleanField(default=False, help_text="Whether this model is currently active")
    deployed_at = models.DateTimeField(null=True, blank=True)

    # Relationships
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    parent_model = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name='child_models', help_text="Parent model for versioning")

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ml_models'
        indexes = [
            models.Index(fields=['model_type', 'status']),
            models.Index(fields=['algorithm']),
            models.Index(fields=['is_active']),
            models.Index(fields=['created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} v{self.version} ({self.model_type})"


class MLTrainingSample(models.Model):
    """Model for storing ML training samples"""

    id = models.BigAutoField(primary_key=True)
    transaction = models.ForeignKey(Transaction, on_delete=models.CASCADE, related_name='ml_samples')

    # Features and labels
    features = models.JSONField(help_text="Extracted features for ML model")
    labels = models.JSONField(default=dict, help_text="Target variables/labels")

    # Model association
    model_version = models.CharField(max_length=50, help_text="Version of model this sample is for")

    # Sample metadata
    sample_weight = models.FloatField(default=1.0, help_text="Sample weight for training")
    is_validation = models.BooleanField(default=False, help_text="Whether this is a validation sample")
    is_test = models.BooleanField(default=False, help_text="Whether this is a test sample")

    # Processing metadata
    processed_at = models.DateTimeField(default=timezone.now)
    feature_extraction_version = models.CharField(max_length=20, help_text="Version of feature extraction logic")

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ml_training_samples'
        indexes = [
            models.Index(fields=['model_version']),
            models.Index(fields=['is_validation']),
            models.Index(fields=['is_test']),
            models.Index(fields=['processed_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"ML Sample for {self.transaction.signature[:8]}... (model: {self.model_version})"


class TrainingRun(models.Model):
    """Model for storing ML training runs"""

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    model = models.ForeignKey(MLModel, on_delete=models.CASCADE, related_name='training_runs')

    # Training configuration
    config = models.JSONField(default=dict, help_text="Training configuration and hyperparameters")

    # Training progress
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    progress_percentage = models.FloatField(default=0.0, help_text="Training progress (0-100)")

    # Training metrics
    train_loss = models.JSONField(default=list, help_text="Training loss over epochs")
    val_loss = models.JSONField(default=list, help_text="Validation loss over epochs")
    train_metrics = models.JSONField(default=dict, help_text="Training metrics")
    val_metrics = models.JSONField(default=dict, help_text="Validation metrics")

    # Timing
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    duration = models.DurationField(null=True, blank=True)

    # Results
    final_model_path = models.CharField(max_length=500, blank=True, help_text="Path to final trained model")
    best_checkpoint_path = models.CharField(max_length=500, blank=True, help_text="Path to best checkpoint")

    # Error handling
    error_message = models.TextField(blank=True, help_text="Error message if training failed")

    # Relationships
    initiated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'training_runs'
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['started_at']),
            models.Index(fields=['completed_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"Training run for {self.model.name} ({self.status})"


class ModelEvaluation(models.Model):
    """Model for storing model evaluation results"""

    id = models.BigAutoField(primary_key=True)
    model = models.ForeignKey(MLModel, on_delete=models.CASCADE, related_name='evaluations')

    # Evaluation metadata
    evaluation_type = models.CharField(max_length=50, help_text="Type of evaluation (e.g., cross_validation, holdout)")
    dataset_info = models.JSONField(default=dict, help_text="Information about evaluation dataset")

    # Performance metrics
    accuracy = models.FloatField(null=True, blank=True)
    precision = models.FloatField(null=True, blank=True)
    recall = models.FloatField(null=True, blank=True)
    f1_score = models.FloatField(null=True, blank=True)
    auc_roc = models.FloatField(null=True, blank=True)
    auc_pr = models.FloatField(null=True, blank=True)

    # Additional metrics
    confusion_matrix = models.JSONField(default=dict, help_text="Confusion matrix")
    classification_report = models.JSONField(default=dict, help_text="Detailed classification report")
    feature_importance = models.JSONField(default=dict, help_text="Feature importance scores")

    # Evaluation timing
    evaluated_at = models.DateTimeField(default=timezone.now)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'model_evaluations'
        indexes = [
            models.Index(fields=['model', 'evaluated_at']),
            models.Index(fields=['evaluation_type']),
        ]
        ordering = ['-evaluated_at']

    def __str__(self):
        return f"Evaluation for {self.model.name} ({self.evaluation_type})"


class ABLTest(models.Model):
    """Model for storing A/B testing results"""

    STATUS_CHOICES = [
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    # Models being tested
    model_a = models.ForeignKey(MLModel, on_delete=models.CASCADE, related_name='ab_tests_as_a')
    model_b = models.ForeignKey(MLModel, on_delete=models.CASCADE, related_name='ab_tests_as_b')

    # Test configuration
    traffic_split = models.FloatField(default=0.5, help_text="Traffic split (0.0-1.0) for model A")
    test_duration_days = models.IntegerField(default=7, help_text="Duration of test in days")
    min_sample_size = models.IntegerField(default=1000, help_text="Minimum sample size required")

    # Test status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='running')
    started_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Results
    model_a_performance = models.JSONField(default=dict, help_text="Performance metrics for model A")
    model_b_performance = models.JSONField(default=dict, help_text="Performance metrics for model B")
    winner = models.CharField(max_length=10, choices=[('A', 'Model A'), ('B', 'Model B'), ('tie', 'Tie')], blank=True)

    # Statistical significance
    confidence_level = models.FloatField(null=True, blank=True, help_text="Statistical confidence level")
    p_value = models.FloatField(null=True, blank=True, help_text="P-value for statistical test")

    # Metadata
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ab_tests'
        ordering = ['-created_at']

    def __str__(self):
        return f"A/B Test: {self.name} ({self.model_a.name} vs {self.model_b.name})"
