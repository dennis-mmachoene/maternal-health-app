# Generated migration for api app
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='DatasetRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('filepath', models.CharField(max_length=500)),
                ('total_rows', models.IntegerField(default=0)),
                ('total_columns', models.IntegerField(default=0)),
                ('ingested_at', models.DateTimeField(auto_now_add=True)),
                ('is_active', models.BooleanField(default=True)),
                ('metadata', models.JSONField(blank=True, default=dict)),
            ],
            options={
                'ordering': ['-ingested_at'],
            },
        ),
        migrations.CreateModel(
            name='TrainingRun',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(
                    choices=[('pending', 'Pending'), ('running', 'Running'),
                             ('completed', 'Completed'), ('failed', 'Failed')],
                    default='pending', max_length=20
                )),
                ('started_at', models.DateTimeField(auto_now_add=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('best_model', models.CharField(blank=True, max_length=100)),
                ('best_f1_score', models.FloatField(blank=True, null=True)),
                ('best_accuracy', models.FloatField(blank=True, null=True)),
                ('results', models.JSONField(blank=True, default=dict)),
                ('error_message', models.TextField(blank=True)),
                ('dataset', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    to='api.datasetrecord'
                )),
            ],
            options={
                'ordering': ['-started_at'],
            },
        ),
        migrations.CreateModel(
            name='HealthRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('age', models.FloatField()),
                ('systolic_bp', models.FloatField()),
                ('diastolic_bp', models.FloatField()),
                ('blood_sugar', models.FloatField()),
                ('body_temp', models.FloatField()),
                ('heart_rate', models.FloatField()),
                ('risk_level', models.CharField(
                    choices=[('low risk', 'Low Risk'), ('mid risk', 'Mid Risk'), ('high risk', 'High Risk')],
                    max_length=20
                )),
                ('ingested_at', models.DateTimeField(auto_now_add=True)),
                ('dataset', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    to='api.datasetrecord'
                )),
            ],
            options={
                'ordering': ['id'],
            },
        ),
        migrations.CreateModel(
            name='PredictionLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('input_data', models.JSONField()),
                ('predicted_label', models.CharField(max_length=50)),
                ('confidence', models.FloatField(blank=True, null=True)),
                ('probabilities', models.JSONField(default=dict)),
                ('model_used', models.CharField(max_length=100)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
