import os

import dj_database_url
from celery.schedules import crontab

from config.settings.base import *  # noqa: F401, F403

DEBUG = False

# Fail fast if critical secrets are not set in production
SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]

# ---------- Database ----------
# Prefer DATABASE_URL (Render provides this automatically), fall back to individual env vars
_database_url = os.environ.get("DATABASE_URL")
if _database_url:
    DATABASES["default"] = dj_database_url.parse(  # noqa: F405
        _database_url,
        conn_max_age=600,
        conn_health_checks=True,
    )
else:
    DATABASES["default"]["PASSWORD"] = os.environ["POSTGRES_PASSWORD"]  # noqa: F405

# ---------- Security ----------
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True

CORS_ALLOWED_ORIGINS = [o for o in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if o]
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = [o for o in os.environ.get("CSRF_TRUSTED_ORIGINS", "").split(",") if o]

# ---------- WhiteNoise (static files) ----------
MIDDLEWARE.insert(  # noqa: F405
    MIDDLEWARE.index("django.middleware.security.SecurityMiddleware") + 1,  # noqa: F405
    "whitenoise.middleware.WhiteNoiseMiddleware",
)

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

# ---------- Celery Beat ----------
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
