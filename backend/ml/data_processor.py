"""
Data Processing Pipeline for Maternal Health Risk Dataset.

Handles data ingestion, cleaning, and feature engineering.
Separates data science logic cleanly from API concerns.
"""

import logging
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Tuple, Dict, Any, Optional
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split

logger = logging.getLogger(__name__)


class MaternalHealthDataProcessor:
    """
    Full data processing pipeline for the Maternal Health Risk dataset.

    Features:
    - Age: Patient age in years
    - SystolicBP: Systolic blood pressure (mmHg)
    - DiastolicBP: Diastolic blood pressure (mmHg)
    - BS: Blood sugar level (mmol/L)
    - BodyTemp: Body temperature (°F)
    - HeartRate: Resting heart rate (bpm)
    - RiskLevel: Target — 'low risk', 'mid risk', 'high risk'
    """

    FEATURE_COLUMNS = ['Age', 'SystolicBP', 'DiastolicBP', 'BS', 'BodyTemp', 'HeartRate']
    TARGET_COLUMN = 'RiskLevel'
    RISK_LEVELS = {'low risk': 0, 'mid risk': 1, 'high risk': 2}
    RISK_LABELS = {0: 'low risk', 1: 'mid risk', 2: 'high risk'}

    # Clinical reference ranges for derived features
    NORMAL_SYSTOLIC = (90, 120)
    NORMAL_DIASTOLIC = (60, 80)
    NORMAL_BS = (3.9, 7.8)       # mmol/L fasting
    NORMAL_TEMP = (97.0, 99.0)   # °F
    NORMAL_HR = (60, 100)

    def __init__(self):
        self.scaler = StandardScaler()
        self.label_encoder = LabelEncoder()
        self.feature_names_after_engineering = None
        self.raw_df: Optional[pd.DataFrame] = None
        self.processed_df: Optional[pd.DataFrame] = None

    # ─── Data Ingestion ───────────────────────────────────────────────────────

    def load_from_file(self, filepath: str) -> pd.DataFrame:
        """Load raw CSV data from disk."""
        logger.info(f"Loading dataset from {filepath}")
        df = pd.read_csv(filepath)
        # Strip BOM character if present from UTF-8-BOM files
        df.columns = [c.strip('\ufeff').strip() for c in df.columns]
        self.raw_df = df.copy()
        logger.info(f"Loaded {len(df)} rows × {len(df.columns)} columns")
        return df

    def load_from_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """Load from an existing DataFrame (e.g. from DB)."""
        self.raw_df = df.copy()
        return df

    # ─── Data Cleaning ────────────────────────────────────────────────────────

    def clean(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Comprehensive data cleaning:
        1. Remove duplicates
        2. Handle missing values
        3. Fix data types
        4. Remove clinical outliers
        """
        logger.info("Starting data cleaning pipeline")
        initial_rows = len(df)

        # Standardize column names
        df.columns = [c.strip() for c in df.columns]

        # Drop exact duplicates
        df = df.drop_duplicates()
        logger.info(f"Removed {initial_rows - len(df)} duplicate rows")

        # Normalize RiskLevel casing
        df[self.TARGET_COLUMN] = df[self.TARGET_COLUMN].str.lower().str.strip()

        # Handle missing values — fill numerics with median (robust to outliers)
        for col in self.FEATURE_COLUMNS:
            if col in df.columns:
                missing = df[col].isnull().sum()
                if missing > 0:
                    median_val = df[col].median()
                    df[col] = df[col].fillna(median_val)
                    logger.info(f"Filled {missing} missing values in '{col}' with median={median_val:.2f}")

        # Drop rows where target is missing or invalid
        valid_targets = list(self.RISK_LEVELS.keys())
        df = df[df[self.TARGET_COLUMN].isin(valid_targets)]

        # Remove physiologically impossible values (basic sanity checks)
        df = df[df['Age'].between(10, 70)]
        df = df[df['SystolicBP'].between(60, 200)]
        df = df[df['DiastolicBP'].between(40, 140)]
        df = df[df['BS'].between(1.0, 25.0)]
        df = df[df['BodyTemp'].between(95.0, 104.0)]
        df = df[df['HeartRate'].between(40, 160)]

        logger.info(f"Cleaned dataset: {initial_rows} → {len(df)} rows")
        return df.reset_index(drop=True)

    # ─── Feature Engineering ──────────────────────────────────────────────────

    def engineer_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Create clinically meaningful derived features:
        - Pulse pressure (SystolicBP - DiastolicBP) → arterial stiffness indicator
        - Mean arterial pressure (MAP) → perfusion pressure
        - BP abnormality flags
        - Blood sugar risk categories
        - Temperature deviation from normal
        - Age risk groups (maternal age categories)
        """
        logger.info("Engineering features")
        df = df.copy()

        # Pulse pressure: clinically significant for cardiovascular risk
        df['PulsePressure'] = df['SystolicBP'] - df['DiastolicBP']

        # Mean Arterial Pressure: key perfusion indicator
        df['MAP'] = (df['SystolicBP'] + 2 * df['DiastolicBP']) / 3

        # BP deviation from normal (hypertension indicator)
        df['SystolicBP_Deviation'] = df['SystolicBP'] - self.NORMAL_SYSTOLIC[1]
        df['DiastolicBP_Deviation'] = df['DiastolicBP'] - self.NORMAL_DIASTOLIC[1]

        # Hypertension flag (SBP >= 140 or DBP >= 90 → gestational hypertension threshold)
        df['IsHypertensive'] = (
            (df['SystolicBP'] >= 140) | (df['DiastolicBP'] >= 90)
        ).astype(int)

        # Hyperglycemia flag (BS > 7.8 → gestational diabetes risk)
        df['IsHyperglycemic'] = (df['BS'] > 7.8).astype(int)

        # Temperature deviation from normal (fever flag)
        df['TempDeviation'] = df['BodyTemp'] - 98.6
        df['HasFever'] = (df['BodyTemp'] > 100.4).astype(int)

        # Tachycardia flag (HR > 100)
        df['HasTachycardia'] = (df['HeartRate'] > 100).astype(int)

        # Age risk group (obstetric risk classification)
        # 0=teen(<18), 1=optimal(18-25), 2=advanced(25-35), 3=geriatric(35+)
        df['AgeRiskGroup'] = pd.cut(
            df['Age'],
            bins=[0, 18, 25, 35, 100],
            labels=[3, 1, 2, 3],
            ordered=False
        ).astype(int)

        # Composite risk score (count of abnormal indicators)
        df['CompositeRiskScore'] = (
            df['IsHypertensive'] +
            df['IsHyperglycemic'] +
            df['HasFever'] +
            df['HasTachycardia']
        )

        # BS × Age interaction (older mothers with high BS carry elevated risk)
        df['BS_Age_Interaction'] = df['BS'] * df['Age'] / 100

        logger.info(f"Engineered features: {df.shape[1]} total columns")
        return df

    # ─── Encoding & Scaling ───────────────────────────────────────────────────

    def encode_target(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, np.ndarray]:
        """Encode RiskLevel string labels to integers: low=0, mid=1, high=2."""
        y = df[self.TARGET_COLUMN].map(self.RISK_LEVELS).values
        return df, y

    def get_feature_matrix(self, df: pd.DataFrame) -> pd.DataFrame:
        """Return only the feature columns (drop target)."""
        cols_to_drop = [self.TARGET_COLUMN]
        return df.drop(columns=[c for c in cols_to_drop if c in df.columns])

    def scale_features(self, X_train: np.ndarray, X_test: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Fit StandardScaler on training data and transform both sets.
        Critical: fit ONLY on training data to prevent data leakage.
        """
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        return X_train_scaled, X_test_scaled

    def scale_single(self, X: np.ndarray) -> np.ndarray:
        """Scale a single prediction input using the fitted scaler."""
        return self.scaler.transform(X)

    # ─── Full Pipeline ────────────────────────────────────────────────────────

    def run_pipeline(
        self,
        filepath: str,
        test_size: float = 0.2,
        random_state: int = 42
    ) -> Dict[str, Any]:
        """
        Execute the complete preprocessing pipeline.
        Returns train/test splits ready for model training.
        """
        # 1. Load
        df = self.load_from_file(filepath)

        # 2. Clean
        df = self.clean(df)

        # 3. Engineer features
        df = self.engineer_features(df)
        self.processed_df = df.copy()

        # 4. Encode target
        df, y = self.encode_target(df)

        # 5. Get feature matrix
        X_df = self.get_feature_matrix(df)
        self.feature_names_after_engineering = list(X_df.columns)
        X = X_df.values

        # 6. Train/test split (stratified to preserve class distribution)
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state, stratify=y
        )

        # 7. Scale (fit on train only)
        X_train_scaled, X_test_scaled = self.scale_features(X_train, X_test)

        logger.info(
            f"Pipeline complete: train={len(X_train)}, test={len(X_test)}, "
            f"features={X_train.shape[1]}"
        )

        return {
            'X_train': X_train_scaled,
            'X_test': X_test_scaled,
            'y_train': y_train,
            'y_test': y_test,
            'feature_names': self.feature_names_after_engineering,
            'n_classes': len(self.RISK_LEVELS),
            'class_names': list(self.RISK_LABELS.values()),
        }

    # ─── EDA Statistics ───────────────────────────────────────────────────────

    def get_dataset_summary(self) -> Dict[str, Any]:
        """Generate comprehensive dataset statistics for the EDA dashboard."""
        if self.raw_df is None:
            raise ValueError("No data loaded. Run load_from_file() first.")

        df = self.raw_df.copy()
        df.columns = [c.strip('\ufeff').strip() for c in df.columns]

        summary = {
            'total_rows': len(df),
            'total_columns': len(df.columns),
            'columns': list(df.columns),
            'feature_types': {col: str(df[col].dtype) for col in df.columns},
            'missing_values': df.isnull().sum().to_dict(),
            'duplicates': int(df.duplicated().sum()),
            'class_distribution': df[self.TARGET_COLUMN].value_counts().to_dict(),
            'class_percentages': (df[self.TARGET_COLUMN].value_counts(normalize=True) * 100).round(2).to_dict(),
        }

        # Statistical summary for numeric columns
        numeric_stats = {}
        for col in self.FEATURE_COLUMNS:
            if col in df.columns:
                numeric_stats[col] = {
                    'mean': round(float(df[col].mean()), 3),
                    'median': round(float(df[col].median()), 3),
                    'std': round(float(df[col].std()), 3),
                    'min': round(float(df[col].min()), 3),
                    'max': round(float(df[col].max()), 3),
                    'q25': round(float(df[col].quantile(0.25)), 3),
                    'q75': round(float(df[col].quantile(0.75)), 3),
                    'skewness': round(float(df[col].skew()), 3),
                    'kurtosis': round(float(df[col].kurtosis()), 3),
                }
        summary['statistics'] = numeric_stats

        return summary

    def get_distributions(self) -> Dict[str, Any]:
        """Get feature distributions for histogram charts."""
        if self.raw_df is None:
            raise ValueError("No data loaded.")

        df = self.raw_df.copy()
        df.columns = [c.strip('\ufeff').strip() for c in df.columns]
        distributions = {}

        for col in self.FEATURE_COLUMNS:
            if col in df.columns:
                counts, bin_edges = np.histogram(df[col].dropna(), bins=20)
                distributions[col] = {
                    'counts': counts.tolist(),
                    'bin_edges': [round(float(e), 2) for e in bin_edges.tolist()],
                    'by_risk': {}
                }
                # Distribution per risk level
                for risk in self.RISK_LEVELS.keys():
                    subset = df[df[self.TARGET_COLUMN] == risk][col].dropna()
                    distributions[col]['by_risk'][risk] = {
                        'mean': round(float(subset.mean()), 3) if len(subset) > 0 else 0,
                        'values': subset.tolist()[:200],  # Limit for performance
                    }

        return distributions

    def get_correlation_matrix(self) -> Dict[str, Any]:
        """Compute Pearson correlation matrix for numeric features."""
        if self.raw_df is None:
            raise ValueError("No data loaded.")

        df = self.raw_df.copy()
        df.columns = [c.strip('\ufeff').strip() for c in df.columns]

        # Add encoded risk level for correlation
        df['RiskEncoded'] = df[self.TARGET_COLUMN].map(self.RISK_LEVELS)
        numeric_cols = self.FEATURE_COLUMNS + ['RiskEncoded']
        corr = df[numeric_cols].corr().round(3)

        return {
            'labels': numeric_cols,
            'matrix': corr.values.tolist(),
            'dataframe': {col: corr[col].to_dict() for col in numeric_cols}
        }
