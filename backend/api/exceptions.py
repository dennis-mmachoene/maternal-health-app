"""Custom exception handler for consistent error responses."""
import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        response.data = {
            'status': 'error',
            'message': str(exc),
            'detail': response.data,
        }
    return response
