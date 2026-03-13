# MaternaML — Maternal Health Risk Intelligence

A Machine Learning & Data Science web application for **maternal health risk prediction**, built on a real-world Kaggle dataset.

---

## Architecture Overview

```
maternal-health-app/
├── backend/                     # Django + DRF + Scikit-learn
│   ├── maternal_health/         # Django project (settings, URLs, WSGI)
│   ├── api/                     # REST API layer (views, serializers, models)
│   │   ├── models.py            # PostgreSQL ORM models
│   │   ├── serializers.py       # Input validation & response shaping
│   │   ├── views.py             # All API endpoint handlers
│   │   └── urls.py              # URL routing
│   ├── ml/                      # ML engine (separated from API)
│   │   ├── data_processor.py    # Data ingestion, cleaning, feature engineering
│   │   ├── model_trainer.py     # Training, evaluation, persistence
│   │   └── service.py           # Orchestration layer (API ↔ ML bridge)
│   ├── data/                    # Dataset storage
│   │   └── Maternal_Health_Risk_Data_Set.csv
│   └── ml/models/               # Persisted joblib model files
│
├── frontend/                    # React + Vite + Tailwind
│   └── src/
│       ├── pages/
│       │   ├── Overview.jsx     # Dataset dashboard
│       │   ├── EDA.jsx          # Exploratory data analysis
│       │   ├── Training.jsx     # Model training & comparison
│       │   ├── Performance.jsx  # Metrics, confusion matrix, importance
│       │   └── Predict.jsx      # Live prediction interface
│       ├── components/
│       │   ├── Sidebar.jsx      # Navigation
│       │   └── UI.jsx           # Design system components
│       ├── services/api.js      # Axios API client
│       └── hooks/useApi.js      # Data-fetching hooks
│
├── docker-compose.yml           # Full stack Docker orchestration
└── setup.sh                     # One-command local setup
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend framework | Django 4.2 + Django REST Framework |
| Database | PostgreSQL 15 |
| ML pipeline | Scikit-learn, XGBoost, Pandas, NumPy |
| Model persistence | joblib |
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Charts | Recharts |
| HTTP client | Axios |
| Containerisation | Docker + Docker Compose |

---

## Dataset

**Maternal Health Risk Data Set** — sourced from [Kaggle](https://www.kaggle.com/datasets/csafrit2/maternal-health-risk-data).

| Feature | Description | Unit |
|---|---|---|
| Age | Patient age | years |
| SystolicBP | Systolic blood pressure | mmHg |
| DiastolicBP | Diastolic blood pressure | mmHg |
| BS | Blood sugar (fasting) | mmol/L |
| BodyTemp | Core body temperature | °F |
| HeartRate | Resting heart rate | bpm |
| **RiskLevel** | **Target: low / mid / high risk** | — |

- **1,014 records**, 7 columns, 3 target classes
- No missing values in the original dataset

---

## ML Pipeline

### 1. Data Ingestion
- CSV loaded via Pandas; BOM-stripped, column names normalised
- Stored in PostgreSQL via Django ORM bulk insert

### 2. Data Cleaning
- Duplicate removal
- Median imputation for any missing numeric values
- Physiologically impossible value removal (e.g. SBP < 60)
- Target label normalisation (lowercase, stripped)

### 3. Feature Engineering (10 derived features)
| Feature | Clinical Meaning |
|---|---|
| `PulsePressure` | SystolicBP − DiastolicBP → arterial stiffness |
| `MAP` | Mean Arterial Pressure → organ perfusion |
| `SystolicBP_Deviation` | Distance from upper-normal (120 mmHg) |
| `DiastolicBP_Deviation` | Distance from upper-normal (80 mmHg) |
| `IsHypertensive` | SBP ≥ 140 or DBP ≥ 90 (binary flag) |
| `IsHyperglycemic` | BS > 7.8 mmol/L (gestational diabetes risk) |
| `TempDeviation` | Deviation from 98.6°F |
| `HasFever` | BodyTemp > 100.4°F |
| `HasTachycardia` | HeartRate > 100 bpm |
| `AgeRiskGroup` | Obstetric age risk category (teen/optimal/advanced) |
| `CompositeRiskScore` | Sum of all binary risk flags |
| `BS_Age_Interaction` | Blood sugar × age interaction term |

### 4. Models Trained

| Model | Key Strength |
|---|---|
| Random Forest (200 trees) | Robust to outliers, handles class imbalance |
| Gradient Boosting (200 stages) | High accuracy on tabular data |
| Logistic Regression (multinomial) | Interpretable, fast inference |
| XGBoost (200 estimators) | State-of-the-art gradient boosting |

### 5. Evaluation Metrics
- Accuracy, Precision (macro), Recall (macro), F1 (macro + weighted)
- ROC-AUC (one-vs-rest, macro)
- 5-fold cross-validation F1
- Confusion matrix
- Per-class precision / recall / F1

### 6. Model Selection
Best model selected automatically by **F1 Macro** (balanced multi-class metric).

---

## API Reference

Base URL: `http://localhost:8000/api/v1/`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/dataset/` | Dataset summary & statistics |
| POST | `/dataset/ingest/` | Ingest CSV into PostgreSQL |
| GET | `/eda/` | Full EDA (distributions + correlations) |
| GET | `/eda/distributions/` | Feature distribution histograms |
| GET | `/eda/correlation/` | Pearson correlation matrix |
| POST | `/training/start/` | Trigger full ML training pipeline |
| GET | `/training/status/` | Latest training run status |
| GET | `/training/history/` | All training runs |
| GET | `/models/` | List all trained models |
| GET | `/performance/` | Full evaluation metrics |
| POST | `/predict/` | Make a risk prediction |
| GET | `/predictions/` | Prediction audit log |
| GET | `/features/` | Feature metadata for dynamic form |

### Prediction Request Example
```json
POST /api/v1/predict/
{
  "Age": 30,
  "SystolicBP": 140,
  "DiastolicBP": 90,
  "BS": 9.5,
  "BodyTemp": 99.0,
  "HeartRate": 88,
  "model_key": "best"
}
```

### Prediction Response Example
```json
{
  "status": "success",
  "data": {
    "predicted_class": 2,
    "predicted_label": "high risk",
    "confidence": 0.9312,
    "probabilities": {
      "low risk": 0.0221,
      "mid risk": 0.0467,
      "high risk": 0.9312
    },
    "model_used": "xgboost",
    "model_display_name": "XGBoost"
  }
}
```

---

## Quick Start

### Option A: Local Development

```bash
# 1. Clone and enter project
cd maternal-health-app

# 2. Place the dataset
cp Maternal_Health_Risk_Data_Set.csv backend/data/

# 3. Run setup script
./setup.sh

# 4. Start backend (terminal 1)
cd backend && source venv/bin/activate
python manage.py runserver

# 5. Start frontend (terminal 2)
cd frontend && npm run dev

# 6. Open http://localhost:5173
```

### Option B: Docker Compose

```bash
# Place dataset
cp Maternal_Health_Risk_Data_Set.csv backend/data/

# Launch all services
docker-compose up --build

# Open http://localhost:3000
```

---

## First-Run Workflow

1. **Overview** → Click **"Ingest to DB"** to load the CSV into PostgreSQL
2. **Model Training** → Click **"Start Training"** (≈30–60 seconds)
3. **Exploration** → Inspect distributions and correlation heatmap
4. **Performance** → Review accuracy, confusion matrices, feature importance
5. **Predict Risk** → Enter patient vitals and get an instant prediction

---

## Environment Variables

### Backend (`backend/.env`)
```env
DEBUG=True
SECRET_KEY=your-secret-key
DB_NAME=maternal_health_db
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173
MODEL_STORAGE_PATH=./ml/models/
DATA_PATH=./data/
LOG_LEVEL=INFO
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:8000/api/v1
```

---

## Disclaimer

This application is for **educational and research purposes only**. It is not a certified medical device and must not be used as a substitute for professional clinical judgment.
