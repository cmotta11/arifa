import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.prod")

app = Celery("arifa")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

app.conf.beat_schedule.update({
    "check-kyc-renewals-daily": {
        "task": "apps.compliance.tasks.check_kyc_renewals",
        "schedule": crontab(hour=6, minute=0),  # Daily at 6am
    },
    "scheduled-risk-recalculation-weekly": {
        "task": "apps.compliance.tasks.scheduled_risk_recalculation",
        "schedule": crontab(hour=2, minute=0, day_of_week="sunday"),  # Weekly on Sunday at 2am
    },
    "check-notary-delays": {
        "task": "apps.workflow.tasks.check_notary_delays_task",
        "schedule": crontab(hour="8,14", minute=0),  # Twice daily at 8am and 2pm
    },
    "check-registry-delays": {
        "task": "apps.workflow.tasks.check_registry_delays_task",
        "schedule": crontab(hour="8,14", minute=0),  # Twice daily at 8am and 2pm
    },
    "send-accounting-batch-notifications": {
        "task": "apps.workflow.tasks.send_accounting_batch_notifications_task",
        "schedule": crontab(hour="9,17", minute=0),  # AM/PM batch at 9am and 5pm
    },
    "check-unfactured-incorporations": {
        "task": "apps.workflow.tasks.check_unfactured_incorporations_task",
        "schedule": crontab(hour=10, minute=0),  # Daily at 10am
    },
    "send-accounting-batch-summary": {
        "task": "apps.notifications.tasks.send_accounting_batch_summary",
        "schedule": crontab(hour="9,15", minute=0),  # Twice daily at 9am and 3pm
    },
})
