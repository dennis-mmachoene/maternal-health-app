"""API URL routing."""
from django.urls import path
from . import views

urlpatterns = [
    # Dataset
    path('dataset/', views.dataset_summary, name='dataset-summary'),
    path('dataset/ingest/', views.ingest_dataset, name='dataset-ingest'),

    # EDA
    path('eda/', views.eda_overview, name='eda-overview'),
    path('eda/distributions/', views.eda_distributions, name='eda-distributions'),
    path('eda/correlation/', views.eda_correlation, name='eda-correlation'),

    # Training
    path('training/start/', views.start_training, name='training-start'),
    path('training/status/', views.training_status, name='training-status'),
    path('training/history/', views.training_history, name='training-history'),

    # Models
    path('models/', views.model_list, name='model-list'),
    path('performance/', views.model_performance, name='model-performance'),

    # Prediction
    path('predict/', views.predict, name='predict'),
    path('predictions/', views.prediction_history, name='prediction-history'),
    path('features/', views.feature_metadata, name='feature-metadata'),
]
