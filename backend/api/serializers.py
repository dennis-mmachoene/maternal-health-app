"""
DRF Serializers for input validation and response serialization.
"""
from rest_framework import serializers
from .models import DatasetRecord, TrainingRun, HealthRecord, PredictionLog


class DatasetRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = DatasetRecord
        fields = '__all__'


class TrainingRunSerializer(serializers.ModelSerializer):
    duration_seconds = serializers.SerializerMethodField()

    class Meta:
        model = TrainingRun
        fields = '__all__'

    def get_duration_seconds(self, obj):
        if obj.completed_at and obj.started_at:
            return (obj.completed_at - obj.started_at).total_seconds()
        return None


class PredictionInputSerializer(serializers.Serializer):
    """Validates prediction input with clinical range checks."""
    Age = serializers.FloatField(
        min_value=10, max_value=70,
        help_text="Patient age in years (10–70)"
    )
    SystolicBP = serializers.FloatField(
        min_value=60, max_value=200,
        help_text="Systolic blood pressure in mmHg (60–200)"
    )
    DiastolicBP = serializers.FloatField(
        min_value=40, max_value=140,
        help_text="Diastolic blood pressure in mmHg (40–140)"
    )
    BS = serializers.FloatField(
        min_value=1.0, max_value=25.0,
        help_text="Blood sugar level in mmol/L (1.0–25.0)"
    )
    BodyTemp = serializers.FloatField(
        min_value=95.0, max_value=104.0,
        help_text="Body temperature in °F (95–104)"
    )
    HeartRate = serializers.FloatField(
        min_value=40, max_value=160,
        help_text="Resting heart rate in bpm (40–160)"
    )
    model_key = serializers.ChoiceField(
        choices=['random_forest', 'gradient_boosting', 'logistic_regression', 'xgboost', 'best'],
        default='best',
        required=False,
        help_text="Which model to use for prediction"
    )

    def validate(self, data):
        """Cross-field validation: DiastolicBP must be < SystolicBP."""
        if data['DiastolicBP'] >= data['SystolicBP']:
            raise serializers.ValidationError(
                "DiastolicBP must be less than SystolicBP."
            )
        return data


class PredictionLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = PredictionLog
        fields = '__all__'
