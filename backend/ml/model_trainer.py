"""
Machine Learning Model Training Pipeline for Maternal Health Risk Prediction.

Implements multiple classifier models, evaluation, comparison,
and automatic best-model selection. Persists models with joblib.
"""

import os
import logging
import numpy as np
import joblib
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
from datetime import datetime

from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report, roc_auc_score
)
from sklearn.model_selection import cross_val_score
try:
    from xgboost import XGBClassifier
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False
    XGBClassifier = None

logger = logging.getLogger(__name__)


class ModelTrainer:
    """
    Trains, evaluates, and persists ML models for maternal health risk classification.

    Models trained:
    1. Random Forest — robust ensemble, handles imbalanced data well
    2. Gradient Boosting — sequential ensemble with high accuracy
    3. Logistic Regression — interpretable linear baseline
    4. XGBoost — optimized gradient boosting, often best in class

    Target classes:
    0 = low risk, 1 = mid risk, 2 = high risk
    """

    MODEL_CONFIGS = {
        'random_forest': {
            'class': RandomForestClassifier,
            'params': {
                'n_estimators': 200,
                'max_depth': 12,
                'min_samples_split': 4,
                'min_samples_leaf': 2,
                'class_weight': 'balanced',  # Handle class imbalance
                'random_state': 42,
                'n_jobs': -1,
            },
            'display_name': 'Random Forest',
            'description': 'Ensemble of decision trees using bagging for robust predictions',
        },
        'gradient_boosting': {
            'class': GradientBoostingClassifier,
            'params': {
                'n_estimators': 200,
                'learning_rate': 0.1,
                'max_depth': 5,
                'min_samples_split': 4,
                'subsample': 0.8,
                'random_state': 42,
            },
            'display_name': 'Gradient Boosting',
            'description': 'Sequential ensemble that minimizes prediction errors iteratively',
        },
        'logistic_regression': {
            'class': LogisticRegression,
            'params': {
                'max_iter': 1000,
                'solver': 'lbfgs',
                'C': 1.0,
                'class_weight': 'balanced',
                'random_state': 42,
            },
            'display_name': 'Logistic Regression',
            'description': 'Interpretable linear model providing probabilistic predictions',
        },
    }

    @classmethod
    def _get_xgboost_config(cls):
        """Return XGBoost config if available."""
        if not XGBOOST_AVAILABLE:
            return {}
        return {
            'xgboost': {
                'class': XGBClassifier,
                'params': {
                    'n_estimators': 200,
                    'learning_rate': 0.1,
                    'max_depth': 6,
                    'subsample': 0.8,
                    'colsample_bytree': 0.8,
                    'eval_metric': 'mlogloss',
                    'random_state': 42,
                    'verbosity': 0,
                },
                'display_name': 'XGBoost',
                'description': 'Extreme Gradient Boosting — optimized for speed and performance',
            }
        }

    CLASS_NAMES = ['low risk', 'mid risk', 'high risk']

    def __init__(self, model_storage_path: str):
        self.model_storage_path = Path(model_storage_path)
        self.model_storage_path.mkdir(parents=True, exist_ok=True)
        self.trained_models: Dict[str, Any] = {}
        self.evaluation_results: Dict[str, Any] = {}
        self.best_model_key: Optional[str] = None
        self.feature_names: Optional[list] = None

    # ─── Training ─────────────────────────────────────────────────────────────

    def train_all(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_test: np.ndarray,
        y_test: np.ndarray,
        feature_names: list,
    ) -> Dict[str, Any]:
        """
        Train all configured models and evaluate them.
        Automatically selects the best model by F1-macro score.
        """
        self.feature_names = feature_names

        # Merge static configs with optional XGBoost
        all_configs = {**self.MODEL_CONFIGS, **self._get_xgboost_config()}
        results = {}

        logger.info(f"Training {len(all_configs)} models on {len(X_train)} samples")

        for model_key, config in all_configs.items():
            logger.info(f"Training {config['display_name']}...")
            try:
                model, metrics = self._train_and_evaluate(
                    model_key, config, X_train, y_train, X_test, y_test
                )
                self.trained_models[model_key] = model
                self.evaluation_results[model_key] = metrics
                results[model_key] = metrics
                logger.info(
                    f"{config['display_name']} — "
                    f"Accuracy: {metrics['accuracy']:.4f}, "
                    f"F1: {metrics['f1_macro']:.4f}"
                )
            except Exception as e:
                logger.error(f"Failed to train {model_key}: {e}", exc_info=True)
                results[model_key] = {'error': str(e)}

        # Auto-select best model by F1 macro (balanced metric for multi-class)
        self.best_model_key = self._select_best_model()
        logger.info(f"Best model selected: {self.best_model_key}")

        # Save all models and metadata
        self._save_all_models()

        return {
            'results': results,
            'best_model': self.best_model_key,
            'best_metrics': self.evaluation_results.get(self.best_model_key, {}),
        }

    def _train_and_evaluate(
        self,
        model_key: str,
        config: Dict,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_test: np.ndarray,
        y_test: np.ndarray,
    ) -> Tuple[Any, Dict]:
        """Train a single model and compute comprehensive evaluation metrics."""
        start_time = datetime.now()

        # Initialize and train the model
        model = config['class'](**config['params'])
        model.fit(X_train, y_train)

        training_time = (datetime.now() - start_time).total_seconds()

        # Predictions
        y_pred = model.predict(X_test)
        y_prob = model.predict_proba(X_test) if hasattr(model, 'predict_proba') else None

        # Core metrics
        accuracy = float(accuracy_score(y_test, y_pred))
        precision_macro = float(precision_score(y_test, y_pred, average='macro', zero_division=0))
        recall_macro = float(recall_score(y_test, y_pred, average='macro', zero_division=0))
        f1_macro = float(f1_score(y_test, y_pred, average='macro', zero_division=0))
        f1_weighted = float(f1_score(y_test, y_pred, average='weighted', zero_division=0))

        # Per-class metrics
        per_class_report = classification_report(
            y_test, y_pred,
            target_names=self.CLASS_NAMES,
            output_dict=True,
            zero_division=0
        )

        # Confusion matrix
        cm = confusion_matrix(y_test, y_pred).tolist()

        # Cross-validation (5-fold) for more robust accuracy estimate
        cv_scores = cross_val_score(
            config['class'](**config['params']),
            np.vstack([X_train, X_test]),
            np.concatenate([y_train, y_test]),
            cv=5,
            scoring='f1_macro',
            n_jobs=-1
        )

        # ROC AUC (one-vs-rest for multi-class)
        roc_auc = None
        if y_prob is not None:
            try:
                roc_auc = float(roc_auc_score(y_test, y_prob, multi_class='ovr', average='macro'))
            except Exception:
                pass

        # Feature importance (model-specific)
        feature_importance = self._extract_feature_importance(model, model_key)

        metrics = {
            'model_key': model_key,
            'display_name': config['display_name'],
            'description': config['description'],
            'accuracy': round(accuracy, 4),
            'precision_macro': round(precision_macro, 4),
            'recall_macro': round(recall_macro, 4),
            'f1_macro': round(f1_macro, 4),
            'f1_weighted': round(f1_weighted, 4),
            'roc_auc': round(roc_auc, 4) if roc_auc else None,
            'confusion_matrix': cm,
            'per_class_report': per_class_report,
            'cv_scores': {
                'mean': round(float(cv_scores.mean()), 4),
                'std': round(float(cv_scores.std()), 4),
                'scores': [round(float(s), 4) for s in cv_scores],
            },
            'feature_importance': feature_importance,
            'training_time_seconds': round(training_time, 2),
            'train_samples': len(X_train),
            'test_samples': len(X_test),
            'trained_at': datetime.utcnow().isoformat(),
        }

        return model, metrics

    def _extract_feature_importance(self, model: Any, model_key: str) -> Optional[list]:
        """Extract feature importance from tree-based models."""
        if self.feature_names is None:
            return None

        importances = None
        if hasattr(model, 'feature_importances_'):
            importances = model.feature_importances_
        elif hasattr(model, 'coef_'):
            # Logistic Regression: use mean absolute coefficient across classes
            importances = np.abs(model.coef_).mean(axis=0)

        if importances is None:
            return None

        # Sort by importance descending
        indices = np.argsort(importances)[::-1]
        return [
            {
                'feature': self.feature_names[i],
                'importance': round(float(importances[i]), 4),
                'rank': int(rank + 1)
            }
            for rank, i in enumerate(indices)
        ]

    # ─── Model Selection ──────────────────────────────────────────────────────

    def _select_best_model(self) -> str:
        """
        Automatically select best model.
        Primary: F1 macro (balanced multi-class metric)
        Tiebreaker: accuracy
        """
        best_key = None
        best_f1 = -1.0

        for key, metrics in self.evaluation_results.items():
            if 'error' in metrics:
                continue
            f1 = metrics.get('f1_macro', 0)
            if f1 > best_f1:
                best_f1 = f1
                best_key = key

        return best_key or list(self.trained_models.keys())[0]

    # ─── Persistence ──────────────────────────────────────────────────────────

    def _save_all_models(self):
        """Persist all trained models and metadata using joblib."""
        for key, model in self.trained_models.items():
            model_path = self.model_storage_path / f'{key}_model.joblib'
            joblib.dump(model, model_path, compress=3)
            logger.info(f"Saved {key} → {model_path}")

        # Save scaler separately (needed for inference)
        metadata = {
            'feature_names': self.feature_names,
            'evaluation_results': self.evaluation_results,
            'best_model_key': self.best_model_key,
            'class_names': self.CLASS_NAMES,
            'saved_at': datetime.utcnow().isoformat(),
        }
        meta_path = self.model_storage_path / 'metadata.joblib'
        joblib.dump(metadata, meta_path)
        logger.info(f"Saved metadata → {meta_path}")

    def load_model(self, model_key: str) -> Any:
        """Load a persisted model from disk."""
        model_path = self.model_storage_path / f'{model_key}_model.joblib'
        if not model_path.exists():
            raise FileNotFoundError(f"Model not found: {model_path}")
        return joblib.load(model_path)

    def load_metadata(self) -> Dict[str, Any]:
        """Load training metadata from disk."""
        meta_path = self.model_storage_path / 'metadata.joblib'
        if not meta_path.exists():
            raise FileNotFoundError("No training metadata found. Train models first.")
        return joblib.load(meta_path)

    def models_exist(self) -> bool:
        """Check if trained models exist on disk."""
        meta_path = self.model_storage_path / 'metadata.joblib'
        return meta_path.exists()

    # ─── Inference ────────────────────────────────────────────────────────────

    def predict(
        self,
        model_key: str,
        X: np.ndarray
    ) -> Dict[str, Any]:
        """
        Run inference with a trained model.
        Returns predicted class, confidence, and per-class probabilities.
        """
        model = self.load_model(model_key)
        y_pred = model.predict(X)
        predicted_class = int(y_pred[0])

        probabilities = {}
        confidence = None
        if hasattr(model, 'predict_proba'):
            proba = model.predict_proba(X)[0]
            confidence = round(float(proba[predicted_class]), 4)
            probabilities = {
                self.CLASS_NAMES[i]: round(float(p), 4)
                for i, p in enumerate(proba)
            }

        return {
            'predicted_class': predicted_class,
            'predicted_label': self.CLASS_NAMES[predicted_class],
            'confidence': confidence,
            'probabilities': probabilities,
        }
