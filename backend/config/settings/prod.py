import os

from celery.schedules import crontab

from config.settings.base import *  # noqa: F401, F403

DEBUG = False

# Fail fast if critical secrets are not set in production
SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]
DATABASES["default"]["PASSWORD"] = os.environ["POSTGRES_PASSWORD"]  # noqa: F405

SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True

CORS_ALLOWED_ORIGINS = [o for o in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if o]

CELERY_BEAT_SCHEDULE = {  # noqa: F405
    "recalculate-risks-weekly": {
        "task": "apps.compliance.tasks.recalculate_all_risks",
        "schedule": crontab(hour=2, minute=0, day_of_week="sunday"),
    },
    "recalculate-high-risk-biweekly": {
        "task": "apps.compliance.tasks.recalculate_high_risk_entities",
        "schedule": crontab(hour=3, minute=0, day_of_week="sunday,wednesday"),
    },
}
