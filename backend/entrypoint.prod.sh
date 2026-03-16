#!/bin/bash
set -e

echo "==> Running migrations..."
python manage.py migrate --noinput

echo "==> Seeding workflows..."
python manage.py seed_workflows

echo "==> Seeding risk matrix..."
python manage.py seed_risk_matrix

echo "==> Seeding jurisdiction configs..."
python manage.py seed_jurisdiction_configs

echo "==> Seeding RPA definitions..."
python manage.py seed_rpa_definitions

echo "==> Seeding notification templates..."
python manage.py seed_notification_templates

echo "==> Seeding service catalog..."
python manage.py seed_service_catalog

echo "==> Creating superuser (if not exists)..."
python manage.py shell -c "
from apps.authentication.models import User
if not User.objects.filter(email='admin@arifa.com').exists():
    u = User.objects.create_superuser(
        email='admin@arifa.com',
        password='Panama123',
        first_name='Admin',
        last_name='ARIFA',
        role='director',
    )
    print(f'Superuser created: {u.email}')
else:
    print('Superuser already exists, skipping.')
"

echo "==> Starting gunicorn..."
exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers ${WEB_CONCURRENCY:-4} \
    --preload
