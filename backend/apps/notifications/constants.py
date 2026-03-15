from django.db import models


class ReminderStepStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    SENT = "sent", "Sent"
    SKIPPED = "skipped", "Skipped"
