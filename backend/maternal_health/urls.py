"""
Main URL Configuration for Maternal Health Risk Prediction API
"""
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse


def api_root(request):
    """API root endpoint with documentation links."""
    return JsonResponse({
        'name': 'Maternal Health Risk Prediction API',
        'version': '1.0.0',
        'description': 'ML-powered maternal health risk assessment system',
        'endpoints': {
            'dataset': '/api/v1/dataset/',
            'eda': '/api/v1/eda/',
            'training': '/api/v1/training/',
            'models': '/api/v1/models/',
            'predict': '/api/v1/predict/',
            'performance': '/api/v1/performance/',
        }
    })


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include('api.urls')),
    path('', api_root),
]
