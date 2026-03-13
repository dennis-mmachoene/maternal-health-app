"""
ML Service Layer — Orchestrates the full machine learning pipeline.
Acts as the bridge between the API layer and the ML engine.
Maintains a singleton-like state for loaded models.
"""

import logging
import numpy as np
from typing import Dict, Any, Optional
from django.conf import settings

from .data_processor import MaternalHealthDataProcessor
from .model_trainer import ModelTrainer

logger = logging.getLogger(__name__)

# ─── Singleton State ──────────────────────────────────────────────────────────
# These are module-level singletons for the lifetime of the Django process.
_processor: Optional[MaternalHealthDataProcessor] = None
_trainer: Optional[ModelTrainer] = None


def get_processor() -> MaternalHealthDataProcessor:
    """Get or create the data processor singleton."""
    global _processor
    if _processor is None:
        _processor = MaternalHealthDataProcessor()
    return _processor


def get_trainer() -> ModelTrainer:
    """Get or create the model trainer singleton."""
    global _trainer
    if _trainer is None:
        _trainer = ModelTrainer(model_storage_path=settings.MODEL_STORAGE_PATH)
    return _trainer


def reset_singletons():
    """Reset singletons (useful after training to reload fresh state)."""
    global _processor, _trainer
    _processor = None
    _trainer = None


# ─── Core Service Functions ───────────────────────────────────────────────────

def run_full_pipeline(dataset_path: str) -> Dict[str, Any]:
    """
    Execute the complete ML pipeline:
    1. Load and clean data
    2. Engineer features
    3. Train all models
    4. Evaluate and select best
    5. Persist models
    """
    logger.info(f"Starting full ML pipeline with dataset: {dataset_path}")

    processor = MaternalHealthDataProcessor()
    trainer = ModelTrainer(model_storage_path=settings.MODEL_STORAGE_PATH)

    # Run preprocessing pipeline
    pipeline_output = processor.run_pipeline(dataset_path)

    # Train all models
    training_results = trainer.train_all(
        X_train=pipeline_output['X_train'],
        y_train=pipeline_output['y_train'],
        X_test=pipeline_output['X_test'],
        y_test=pipeline_output['y_test'],
        feature_names=pipeline_output['feature_names'],
    )

    # Save the fitted scaler to the trainer's model storage
    import joblib
    from pathlib import Path
    scaler_path = Path(settings.MODEL_STORAGE_PATH) / 'scaler.joblib'
    joblib.dump(processor.scaler, scaler_path)
    logger.info(f"Scaler saved to {scaler_path}")

    # Update singletons
    global _processor, _trainer
    _processor = processor
    _trainer = trainer

    return {
        'pipeline': pipeline_output,
        'training': training_results,
        'dataset_summary': processor.get_dataset_summary(),
    }


def get_dataset_info(dataset_path: str) -> Dict[str, Any]:
    """Load dataset and return summary statistics for the dashboard."""
    processor = get_processor()
    if processor.raw_df is None:
        processor.load_from_file(dataset_path)
    return processor.get_dataset_summary()


def get_eda_data(dataset_path: str) -> Dict[str, Any]:
    """Get all EDA data: distributions, correlations, summaries."""
    processor = get_processor()
    if processor.raw_df is None:
        processor.load_from_file(dataset_path)

    return {
        'summary': processor.get_dataset_summary(),
        'distributions': processor.get_distributions(),
        'correlation_matrix': processor.get_correlation_matrix(),
    }


def get_model_performance() -> Dict[str, Any]:
    """
    Get evaluation metrics for all trained models.
    Loads from disk if not in memory.
    """
    trainer = get_trainer()

    if not trainer.models_exist():
        return {'error': 'No trained models found. Please train models first.'}

    try:
        metadata = trainer.load_metadata()
        return {
            'models': metadata['evaluation_results'],
            'best_model': metadata['best_model_key'],
            'feature_names': metadata['feature_names'],
            'class_names': metadata['class_names'],
            'saved_at': metadata.get('saved_at'),
        }
    except Exception as e:
        logger.error(f"Error loading model performance: {e}")
        return {'error': str(e)}


def make_prediction(input_data: Dict[str, float], model_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Make a prediction for a single patient input.

    Args:
        input_data: Feature values keyed by feature name
        model_key: Which model to use (defaults to best model)
    """
    trainer = get_trainer()

    if not trainer.models_exist():
        raise ValueError("No trained models available. Please train models first.")

    metadata = trainer.load_metadata()
    feature_names = metadata['feature_names']

    # Use best model if not specified
    if model_key is None:
        model_key = metadata['best_model_key']

    # Build the full feature vector including engineered features
    processor = MaternalHealthDataProcessor()

    # Create a DataFrame with raw features to run through feature engineering
    import pandas as pd
    raw_features = {
        'Age': input_data.get('Age', 25),
        'SystolicBP': input_data.get('SystolicBP', 120),
        'DiastolicBP': input_data.get('DiastolicBP', 80),
        'BS': input_data.get('BS', 6.0),
        'BodyTemp': input_data.get('BodyTemp', 98.6),
        'HeartRate': input_data.get('HeartRate', 70),
        'RiskLevel': 'low risk',  # Placeholder, will be dropped
    }

    df_input = pd.DataFrame([raw_features])
    df_engineered = processor.engineer_features(df_input)
    df_features = df_engineered[feature_names].values

    # Load the fitted scaler and transform
    import joblib
    from pathlib import Path
    scaler_path = Path(settings.MODEL_STORAGE_PATH) / 'scaler.joblib'

    if scaler_path.exists():
        scaler = joblib.load(scaler_path)
        df_features_scaled = scaler.transform(df_features)
    else:
        # Fallback without scaling
        logger.warning("Scaler not found, predicting without scaling")
        df_features_scaled = df_features

    # Run prediction
    result = trainer.predict(model_key, df_features_scaled)
    result['model_used'] = model_key
    result['model_display_name'] = ModelTrainer.MODEL_CONFIGS.get(
        model_key, {}
    ).get('display_name', model_key)
    result['input_features'] = input_data

    return result
