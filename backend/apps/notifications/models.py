from django.conf import settings
from django.db import models

from common.base_model import TimeStampedModel

from .constants import ReminderStepStatus


class NotificationChannel(models.TextChoices):
    IN_APP = "in_app", "In-App"
    EMAIL = "email", "Email"
    BOTH = "both", "Both"


class NotificationCategory(models.TextChoices):
    TICKET = "ticket", "Ticket"
    KYC = "kyc", "KYC"
    COMPLIANCE = "compliance", "Compliance"
    RPA = "rpa", "RPA"
    DOCUMENT = "document", "Document"
    SYSTEM = "system", "System"
    REMINDER = "reminder", "Reminder"


class NotificationPriority(models.TextChoices):
    LOW = "low", "Low"
    NORMAL = "normal", "Normal"
    HIGH = "high", "High"
    URGENT = "urgent", "Urgent"


class ReminderStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"


class DeliveryStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    SENT = "sent", "Sent"
    FAILED = "failed", "Failed"


# ---------------------------------------------------------------------------
# Template
# ---------------------------------------------------------------------------


class NotificationTemplate(TimeStampedModel):
    """Configurable notification template with subject/body patterns."""

    key = models.CharField(max_length=100, unique=True)
    display_name = models.CharField(max_length=200)
    subject_template = models.CharField(
        max_length=500,
        help_text="Subject line with {variable} placeholders.",
    )
    body_template = models.TextField(
        help_text="HTML/text body with {variable} placeholders.",
    )
    in_app_template = models.CharField(
        max_length=500,
        blank=True,
        help_text="Short text for in-app notification. Uses {variable} placeholders.",
    )
    category = models.CharField(
        max_length=20,
        choices=NotificationCategory.choices,
        default=NotificationCategory.SYSTEM,
    )
    default_channel = models.CharField(
        max_length=10,
        choices=NotificationChannel.choices,
        default=NotificationChannel.BOTH,
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["key"]

    def __str__(self):
        return self.display_name

    def render(self, context: dict) -> dict:
        """Render subject, body, and in_app text with context variables.

        Delegates to the service layer for safe rendering.
        """
        from .services import render_template

        return render_template(template=self, context=context)


# ---------------------------------------------------------------------------
# Notification
# ---------------------------------------------------------------------------


class Notification(TimeStampedModel):
    """A single notification sent to a user."""

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    template = models.ForeignKey(
        NotificationTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=500)
    body = models.TextField(blank=True)
    channel = models.CharField(
        max_length=10,
        choices=NotificationChannel.choices,
        default=NotificationChannel.IN_APP,
    )
    priority = models.CharField(
        max_length=10,
        choices=NotificationPriority.choices,
        default=NotificationPriority.NORMAL,
    )
    category = models.CharField(
        max_length=20,
        choices=NotificationCategory.choices,
        default=NotificationCategory.SYSTEM,
    )
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    action_url = models.CharField(max_length=500, blank=True)

    # Optional links to related objects
    ticket = models.ForeignKey(
        "workflow.Ticket",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notifications",
    )
    entity = models.ForeignKey(
        "core.Entity",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    metadata = models.JSONField(default=dict)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "is_read", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.title} → {self.recipient}"


# ---------------------------------------------------------------------------
# Preferences
# ---------------------------------------------------------------------------


class NotificationPreference(TimeStampedModel):
    """Per-user notification channel preferences."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_preference",
    )
    # Per-category channel overrides (JSON: {"ticket": "email", "kyc": "both", ...})
    category_channels = models.JSONField(
        default=dict,
        help_text="Override channel per category. Key=category, value=channel.",
    )
    daily_digest_enabled = models.BooleanField(default=True)
    digest_hour = models.PositiveIntegerField(
        default=8,
        help_text="Hour (0-23) to send the daily digest.",
    )

    def __str__(self):
        return f"Preferences: {self.user.email}"

    def get_channel_for(self, category: str) -> str:
        """Return the preferred channel for a given category."""
        return self.category_channels.get(category, NotificationChannel.BOTH)


# ---------------------------------------------------------------------------
# Reminder Campaign
# ---------------------------------------------------------------------------


class ReminderCampaign(TimeStampedModel):
    """Multi-step reminder sequence for an entity/ticket."""

    name = models.CharField(max_length=200)
    entity = models.ForeignKey(
        "core.Entity",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="reminder_campaigns",
    )
    ticket = models.ForeignKey(
        "workflow.Ticket",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="reminder_campaigns",
    )
    status = models.CharField(
        max_length=20,
        choices=ReminderStatus.choices,
        default=ReminderStatus.ACTIVE,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class ReminderStep(TimeStampedModel):
    """A single step in a reminder campaign."""

    campaign = models.ForeignKey(
        ReminderCampaign,
        on_delete=models.CASCADE,
        related_name="steps",
    )
    order_index = models.PositiveIntegerField()
    delay_days = models.PositiveIntegerField(
        help_text="Days after campaign start (or previous step) to send.",
    )
    template = models.ForeignKey(
        NotificationTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="+",
    )
    sent_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=ReminderStepStatus.choices,
        default=ReminderStepStatus.PENDING,
    )

    class Meta:
        ordering = ["order_index"]

    def __str__(self):
        return f"Step {self.order_index} (day +{self.delay_days})"


# ---------------------------------------------------------------------------
# Delivery Log
# ---------------------------------------------------------------------------


class DeliveryLog(TimeStampedModel):
    """Audit log for notification delivery attempts."""

    notification = models.ForeignKey(
        Notification,
        on_delete=models.CASCADE,
        related_name="delivery_logs",
    )
    channel = models.CharField(max_length=10, choices=NotificationChannel.choices)
    status = models.CharField(
        max_length=10,
        choices=DeliveryStatus.choices,
        default=DeliveryStatus.PENDING,
    )
    error_message = models.TextField(blank=True)
    external_id = models.CharField(max_length=255, blank=True)
    opened_at = models.DateTimeField(null=True, blank=True)
    clicked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Delivery [{self.channel}] {self.status}"
