from django.contrib import admin
from .models import MLModel, MLTrainingSample, TrainingRun, ModelEvaluation, ABLTest


@admin.register(MLModel)
class MLModelAdmin(admin.ModelAdmin):
    list_display = ['name', 'model_type', 'algorithm', 'version', 'status', 'accuracy', 'created_at']
    list_filter = ['model_type', 'algorithm', 'status', 'is_active']
    search_fields = ['name', 'description']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['-created_at']


@admin.register(MLTrainingSample)
class MLTrainingSampleAdmin(admin.ModelAdmin):
    list_display = ['transaction', 'model_version', 'is_validation', 'is_test', 'processed_at']
    list_filter = ['model_version', 'is_validation', 'is_test', 'processed_at']
    search_fields = ['transaction__signature']
    readonly_fields = ['id', 'created_at']
    ordering = ['-processed_at']


@admin.register(TrainingRun)
class TrainingRunAdmin(admin.ModelAdmin):
    list_display = ['model', 'status', 'progress_percentage', 'started_at', 'completed_at']
    list_filter = ['status', 'started_at', 'completed_at']
    search_fields = ['model__name']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['-started_at']


@admin.register(ModelEvaluation)
class ModelEvaluationAdmin(admin.ModelAdmin):
    list_display = ['model', 'evaluation_type', 'accuracy', 'precision', 'recall', 'evaluated_at']
    list_filter = ['evaluation_type', 'evaluated_at']
    search_fields = ['model__name']
    readonly_fields = ['id', 'created_at']
    ordering = ['-evaluated_at']


@admin.register(ABLTest)
class ABLTestAdmin(admin.ModelAdmin):
    list_display = ['name', 'model_a', 'model_b', 'status', 'winner', 'started_at']
    list_filter = ['status', 'started_at', 'completed_at']
    search_fields = ['name']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['-started_at']
