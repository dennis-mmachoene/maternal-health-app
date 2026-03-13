FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# System dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . .

# Create directories
RUN mkdir -p logs ml/models data staticfiles

EXPOSE 8000

CMD python manage.py collectstatic --noinput && \
    python manage.py migrate && \
    gunicorn maternal_health.wsgi:application \
        --bind 0.0.0.0:8000 \
        --workers 2 \
        --timeout 120
