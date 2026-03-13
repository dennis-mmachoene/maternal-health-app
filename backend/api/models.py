"""
Database models for tracking dataset ingestion and model training runs.
"""
from django.db import models


class DatasetRecord(models.Model):
    """Stores information about ingested datasets."""
    name = models.CharField(max_length=200)
    filepath = models.CharField(max_length=500)
    total_rows = models.IntegerField(default=0)
    total_columns = models.IntegerField(default=0)
    ingested_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-ingested_at']

    def __str__(self):
        return f"{self.name} ({self.total_rows} rows)"


class TrainingRun(models.Model):
    """Records each model training run with results."""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    best_model = models.CharField(max_length=100, blank=True)
    best_f1_score = models.FloatField(null=True, blank=True)
    best_accuracy = models.FloatField(null=True, blank=True)
    results = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    dataset = models.ForeignKey(
        DatasetRecord, on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        ordering = ['-started_at']

    def __str__(self):
        return f"Training Run #{self.pk} — {self.status} ({self.best_model})"


class HealthRecord(models.Model):
    """Stores ingested patient records from the CSV dataset."""
    RISK_CHOICES = [
        ('low risk', 'Low Risk'),
        ('mid risk', 'Mid Risk'),
        ('high risk', 'High Risk'),
    ]

    age = models.FloatField()
    systolic_bp = models.FloatField()
    diastolic_bp = models.FloatField()
    blood_sugar = models.FloatField()
    body_temp = models.FloatField()
    heart_rate = models.FloatField()
    risk_level = models.CharField(max_length=20, choices=RISK_CHOICES)
    ingested_at = models.DateTimeField(auto_now_add=True)
    dataset = models.ForeignKey(
        DatasetRecord, on_delete=models.CASCADE, null=True, blank=True
    )

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f"Patient #{self.pk} — {self.risk_level} (Age: {self.age})"


class PredictionLog(models.Model):
    """Audit log of all predictions made through the API."""
    input_data = models.JSONField()
    predicted_label = models.CharField(max_length=50)
    confidence = models.FloatField(null=True, blank=True)
    probabilities = models.JSONField(default=dict)
    model_used = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Prediction #{self.pk} → {self.predicted_label} ({self.model_used})"
