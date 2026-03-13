"""
REST API Views for Maternal Health Risk Prediction System.

Endpoints:
- /api/v1/dataset/          GET  — Dataset summary
- /api/v1/dataset/ingest/   POST — Ingest CSV into PostgreSQL
- /api/v1/eda/              GET  — EDA data (distributions, correlations)
- /api/v1/training/start/   POST — Trigger model training
- /api/v1/training/status/  GET  — Latest training run status
- /api/v1/models/           GET  — All model metrics
- /api/v1/predict/          POST — Make a prediction
- /api/v1/predictions/      GET  — Prediction history
"""

import os
import logging
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import DatasetRecord, TrainingRun, HealthRecord, PredictionLog
from .serializers import (
    DatasetRecordSerializer,
    TrainingRunSerializer,
    PredictionInputSerializer,
    PredictionLogSerializer,
)
from ml import service as ml_service
from ml.model_trainer import ModelTrainer

logger = logging.getLogger(__name__)

DATASET_PATH = os.path.join(settings.DATA_PATH, 'Maternal_Health_Risk_Data_Set.csv')


def _get_dataset_path() -> str:
    """Resolve dataset path, checking data directory first."""
    paths = [
        DATASET_PATH,
        '/mnt/user-data/uploads/Maternal_Health_Risk_Data_Set.csv',
    ]
    for p in paths:
        if os.path.exists(p):
            return p
    raise FileNotFoundError(
        f"Dataset not found. Expected at: {DATASET_PATH}. "
        "Please ensure the CSV is in the data/ directory."
    )


# ─── Dataset Endpoints ────────────────────────────────────────────────────────

@api_view(['GET'])
def dataset_summary(request):
    """
    Returns dataset statistics: row count, column info, class distribution, statistics.
    """
    try:
        dataset_path = _get_dataset_path()
        info = ml_service.get_dataset_info(dataset_path)

        # Get the latest dataset record from DB if exists
        db_record = DatasetRecord.objects.filter(is_active=True).first()
        if db_record:
            info['db_record'] = DatasetRecordSerializer(db_record).data

        return Response({'status': 'success', 'data': info})
    except FileNotFoundError as e:
        logger.error(f"Dataset not found: {e}")
        return Response({'status': 'error', 'message': str(e)}, status=404)
    except Exception as e:
        logger.exception("Error loading dataset summary")
        return Response({'status': 'error', 'message': str(e)}, status=500)


@api_view(['POST'])
def ingest_dataset(request):
    """
    Ingest CSV dataset into PostgreSQL.
    Reads the CSV, creates HealthRecord rows, and logs a DatasetRecord.
    """
    try:
        import pandas as pd

        dataset_path = _get_dataset_path()
        df = pd.read_csv(dataset_path)
        df.columns = [c.strip('\ufeff').strip() for c in df.columns]
        df[['RiskLevel']] = df[['RiskLevel']].apply(lambda x: x.str.lower().str.strip())

        # Remove duplicates before ingestion
        df = df.drop_duplicates()

        # Create or update DatasetRecord
        DatasetRecord.objects.filter(is_active=True).update(is_active=False)
        record = DatasetRecord.objects.create(
            name='Maternal Health Risk Dataset',
            filepath=dataset_path,
            total_rows=len(df),
            total_columns=len(df.columns),
            is_active=True,
            metadata={'columns': list(df.columns), 'source': 'Kaggle'}
        )

        # Bulk insert health records (clear existing first)
        HealthRecord.objects.filter(dataset__is_active=False).delete()

        health_records = []
        for _, row in df.iterrows():
            health_records.append(HealthRecord(
                age=row['Age'],
                systolic_bp=row['SystolicBP'],
                diastolic_bp=row['DiastolicBP'],
                blood_sugar=row['BS'],
                body_temp=row['BodyTemp'],
                heart_rate=row['HeartRate'],
                risk_level=row['RiskLevel'],
                dataset=record,
            ))

        HealthRecord.objects.bulk_create(health_records, batch_size=500)
        logger.info(f"Ingested {len(health_records)} records into PostgreSQL")

        return Response({
            'status': 'success',
            'message': f'Ingested {len(health_records)} records',
            'dataset_id': record.id,
            'rows': len(health_records),
        })
    except Exception as e:
        logger.exception("Error during dataset ingestion")
        return Response({'status': 'error', 'message': str(e)}, status=500)


# ─── EDA Endpoints ────────────────────────────────────────────────────────────

@api_view(['GET'])
def eda_overview(request):
    """
    Returns comprehensive EDA data:
    - Feature distributions (with per-risk-level breakdowns)
    - Pearson correlation matrix
    - Dataset summary statistics
    """
    try:
        dataset_path = _get_dataset_path()
        eda_data = ml_service.get_eda_data(dataset_path)
        return Response({'status': 'success', 'data': eda_data})
    except Exception as e:
        logger.exception("Error computing EDA")
        return Response({'status': 'error', 'message': str(e)}, status=500)


@api_view(['GET'])
def eda_distributions(request):
    """Feature distribution data for histogram charts."""
    try:
        dataset_path = _get_dataset_path()
        processor = ml_service.get_processor()
        if processor.raw_df is None:
            processor.load_from_file(dataset_path)
        distributions = processor.get_distributions()
        return Response({'status': 'success', 'data': distributions})
    except Exception as e:
        return Response({'status': 'error', 'message': str(e)}, status=500)


@api_view(['GET'])
def eda_correlation(request):
    """Correlation matrix for the heatmap visualization."""
    try:
        dataset_path = _get_dataset_path()
        processor = ml_service.get_processor()
        if processor.raw_df is None:
            processor.load_from_file(dataset_path)
        corr = processor.get_correlation_matrix()
        return Response({'status': 'success', 'data': corr})
    except Exception as e:
        return Response({'status': 'error', 'message': str(e)}, status=500)


# ─── Training Endpoints ───────────────────────────────────────────────────────

@api_view(['POST'])
def start_training(request):
    """
    Trigger the full ML training pipeline.
    Creates a TrainingRun record, runs training, updates with results.
    """
    # Create pending run record
    run = TrainingRun.objects.create(status='running')

    try:
        dataset_path = _get_dataset_path()

        # Get or create dataset record
        dataset_record = DatasetRecord.objects.filter(is_active=True).first()

        # Reset singletons to allow fresh training
        ml_service.reset_singletons()

        # Run the full pipeline
        results = ml_service.run_full_pipeline(dataset_path)
        training_results = results['training']

        best_model_key = training_results['best_model']
        best_metrics = training_results.get('best_metrics', {})

        # Update run record
        run.status = 'completed'
        run.completed_at = timezone.now()
        run.best_model = best_model_key
        run.best_f1_score = best_metrics.get('f1_macro')
        run.best_accuracy = best_metrics.get('accuracy')
        run.results = training_results['results']
        run.dataset = dataset_record
        run.save()

        logger.info(f"Training completed. Best model: {best_model_key}")

        return Response({
            'status': 'success',
            'run_id': run.id,
            'best_model': best_model_key,
            'results': training_results['results'],
            'best_metrics': best_metrics,
        })

    except Exception as e:
        logger.exception("Training failed")
        run.status = 'failed'
        run.error_message = str(e)
        run.completed_at = timezone.now()
        run.save()
        return Response({
            'status': 'error',
            'run_id': run.id,
            'message': str(e)
        }, status=500)


@api_view(['GET'])
def training_status(request):
    """Get the latest training run status."""
    run = TrainingRun.objects.first()
    if not run:
        return Response({
            'status': 'success',
            'data': None,
            'message': 'No training runs found'
        })
    return Response({
        'status': 'success',
        'data': TrainingRunSerializer(run).data
    })


@api_view(['GET'])
def training_history(request):
    """Get all training run history."""
    runs = TrainingRun.objects.all()[:20]
    return Response({
        'status': 'success',
        'data': TrainingRunSerializer(runs, many=True).data
    })


# ─── Model Performance Endpoints ─────────────────────────────────────────────

@api_view(['GET'])
def model_performance(request):
    """
    Returns performance metrics for all trained models:
    - accuracy, precision, recall, F1
    - confusion matrices
    - feature importance
    - cross-validation scores
    """
    try:
        perf = ml_service.get_model_performance()
        if 'error' in perf:
            return Response({'status': 'error', 'message': perf['error']}, status=404)
        return Response({'status': 'success', 'data': perf})
    except Exception as e:
        logger.exception("Error fetching model performance")
        return Response({'status': 'error', 'message': str(e)}, status=500)


@api_view(['GET'])
def model_list(request):
    """List all available trained models with their metrics."""
    try:
        trainer = ml_service.get_trainer()
        if not trainer.models_exist():
            return Response({
                'status': 'success',
                'data': [],
                'message': 'No models trained yet'
            })
        metadata = trainer.load_metadata()
        models = []
        for key, metrics in metadata['evaluation_results'].items():
            models.append({
                'key': key,
                'display_name': metrics.get('display_name', key),
                'description': metrics.get('description', ''),
                'accuracy': metrics.get('accuracy'),
                'f1_macro': metrics.get('f1_macro'),
                'is_best': key == metadata['best_model_key'],
            })
        # Sort by F1 descending
        models.sort(key=lambda x: x.get('f1_macro') or 0, reverse=True)
        return Response({'status': 'success', 'data': models})
    except Exception as e:
        return Response({'status': 'error', 'message': str(e)}, status=500)


# ─── Prediction Endpoints ─────────────────────────────────────────────────────

@api_view(['POST'])
def predict(request):
    """
    Make a risk level prediction for a patient.

    Input: { Age, SystolicBP, DiastolicBP, BS, BodyTemp, HeartRate, model_key? }
    Output: { predicted_label, confidence, probabilities, model_used }
    """
    serializer = PredictionInputSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({
            'status': 'error',
            'message': 'Validation failed',
            'errors': serializer.errors
        }, status=400)

    validated = serializer.validated_data
    model_key = validated.pop('model_key', 'best')
    if model_key == 'best':
        model_key = None  # Service will use best model

    try:
        result = ml_service.make_prediction(validated, model_key=model_key)

        # Log prediction to DB
        PredictionLog.objects.create(
            input_data=validated,
            predicted_label=result['predicted_label'],
            confidence=result.get('confidence'),
            probabilities=result.get('probabilities', {}),
            model_used=result.get('model_used', ''),
        )

        return Response({'status': 'success', 'data': result})

    except ValueError as e:
        return Response({'status': 'error', 'message': str(e)}, status=400)
    except Exception as e:
        logger.exception("Prediction error")
        return Response({'status': 'error', 'message': str(e)}, status=500)


@api_view(['GET'])
def prediction_history(request):
    """Get recent prediction history."""
    logs = PredictionLog.objects.all()[:50]
    return Response({
        'status': 'success',
        'data': PredictionLogSerializer(logs, many=True).data
    })


# ─── Feature Metadata ─────────────────────────────────────────────────────────

@api_view(['GET'])
def feature_metadata(request):
    """
    Returns metadata for each input feature:
    - Display name, unit, min/max, description
    Used by the frontend to dynamically generate the prediction form.
    """
    features = [
        {
            'key': 'Age',
            'label': 'Age',
            'unit': 'years',
            'min': 10,
            'max': 70,
            'step': 1,
            'default': 25,
            'description': 'Patient age in years',
            'type': 'number',
        },
        {
            'key': 'SystolicBP',
            'label': 'Systolic BP',
            'unit': 'mmHg',
            'min': 60,
            'max': 200,
            'step': 1,
            'default': 120,
            'description': 'Upper number of blood pressure reading',
            'type': 'number',
        },
        {
            'key': 'DiastolicBP',
            'label': 'Diastolic BP',
            'unit': 'mmHg',
            'min': 40,
            'max': 140,
            'step': 1,
            'default': 80,
            'description': 'Lower number of blood pressure reading',
            'type': 'number',
        },
        {
            'key': 'BS',
            'label': 'Blood Sugar',
            'unit': 'mmol/L',
            'min': 1.0,
            'max': 25.0,
            'step': 0.1,
            'default': 6.0,
            'description': 'Fasting blood glucose level',
            'type': 'number',
        },
        {
            'key': 'BodyTemp',
            'label': 'Body Temperature',
            'unit': '°F',
            'min': 95.0,
            'max': 104.0,
            'step': 0.1,
            'default': 98.6,
            'description': 'Core body temperature',
            'type': 'number',
        },
        {
            'key': 'HeartRate',
            'label': 'Heart Rate',
            'unit': 'bpm',
            'min': 40,
            'max': 160,
            'step': 1,
            'default': 72,
            'description': 'Resting heart rate per minute',
            'type': 'number',
        },
    ]
    return Response({'status': 'success', 'data': features})
