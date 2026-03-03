from celery.schedules import crontab

from config.settings.base import *  # noqa: F401, F403

DEBUG = False

SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True

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
