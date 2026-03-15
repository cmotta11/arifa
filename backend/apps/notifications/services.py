"""Notification service layer."""

import logging
import string

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.html import strip_tags

from common.exceptions import ApplicationError

from .models import (
    DeliveryLog,
    DeliveryStatus,
    Notification,
    NotificationChannel,
    NotificationPreference,
    NotificationTemplate,
)

logger = logging.getLogger(__name__)


def render_template(*, template, context: dict) -> dict:
    """Safely render a NotificationTemplate's subject, body, and in_app text.

    Uses ``string.Template.safe_substitute`` which only supports ``$variable``
    and ``${variable}`` — no attribute access or arbitrary code execution.

    NOTE: Template strings must use ``$variable`` syntax (not ``{variable}``).
    For backward compatibility, ``{variable}`` placeholders are automatically
    converted to ``$variable`` before rendering.
    """
    # Let Django's template auto-escaping handle XSS prevention.
    # Manual html_escape here caused double-escaping when templates also auto-escape.
    safe_context = {k: str(v) for k, v in context.items()}

    def _safe_render(text: str, ctx: dict) -> str:
        if not text:
            return ""
        # Backward compat: convert {var} to $var (but not ${var} which is already valid)
        import re
        converted = re.sub(r"\{(\w+)\}", r"$\1", text)
        tmpl = string.Template(converted)
        return tmpl.safe_substitute(ctx)

    return {
        "subject": _safe_render(template.subject_template, safe_context),
        "body": _safe_render(template.body_template, safe_context),
        "in_app_text": _safe_render(template.in_app_template, safe_context) if template.in_app_template else "",
    }


def send_notification(
    *,
    recipient,
    template_key: str | None = None,
    title: str = "",
    body: str = "",
    context: dict | None = None,
    category: str = "system",
    priority: str = "normal",
    action_url: str = "",
    ticket_id=None,
    entity_id=None,
    metadata: dict | None = None,
    channel: str | None = None,
) -> Notification:
    """Create and deliver a notification via the appropriate channel.

    If ``template_key`` is provided, the template is rendered with ``context``.
    Otherwise, ``title`` and ``body`` are used directly.
    """
    template = None
    if template_key:
        try:
            template = NotificationTemplate.objects.get(key=template_key, is_active=True)
        except NotificationTemplate.DoesNotExist:
            logger.warning("Notification template '%s' not found, using raw title/body", template_key)

    if template is not None:
        try:
            rendered = template.render(context or {})
            title = title or rendered["subject"]
            body = body or rendered["body"]
        except KeyError as exc:
            logger.warning(
                "Template '%s' render failed (missing key %s), using raw title/body",
                template_key, exc,
            )
        category = template.category

    # Determine channel from user preference or template default
    if channel is None:
        pref = NotificationPreference.objects.filter(user=recipient).first()
        if pref:
            channel = pref.get_channel_for(category)
        elif template:
            channel = template.default_channel
        else:
            channel = NotificationChannel.BOTH

    # Create the notification record inside a transaction
    with transaction.atomic():
        notification = Notification.objects.create(
            recipient=recipient,
            template=template,
            title=title,
            body=body,
            channel=channel,
            priority=priority,
            category=category,
            action_url=action_url,
            ticket_id=ticket_id,
            entity_id=entity_id,
            metadata=metadata or {},
        )

        if channel in (NotificationChannel.IN_APP, NotificationChannel.BOTH):
            _create_delivery_log(notification, NotificationChannel.IN_APP, DeliveryStatus.SENT)

    # Send email OUTSIDE the atomic block to avoid holding DB connections
    if channel in (NotificationChannel.EMAIL, NotificationChannel.BOTH):
        _send_email(notification)

    return notification


def _build_tracking_urls(delivery_log: DeliveryLog) -> dict:
    """Build tracking pixel and click URLs for a delivery log entry."""
    base_url = getattr(settings, "BACKEND_URL", "").rstrip("/")
    if not base_url:
        # Fallback: derive from FRONTEND_URL or use empty (tracking disabled)
        frontend_url = getattr(settings, "FRONTEND_URL", "")
        if frontend_url:
            # Replace frontend port with backend API prefix
            base_url = frontend_url.rstrip("/").replace(":5173", ":8000")
        else:
            return {}

    return {
        "tracking_pixel_url": f"{base_url}/api/v1/notifications/track/open/{delivery_log.id}/",
        "tracking_click_url": f"{base_url}/api/v1/notifications/track/click/{delivery_log.id}/",
    }


def _send_email(notification: Notification):
    """Send HTML email for a notification using branded templates."""
    # Create a pending delivery log first so we have an ID for tracking URLs
    delivery_log = DeliveryLog.objects.create(
        notification=notification,
        channel=NotificationChannel.EMAIL,
        status=DeliveryStatus.PENDING,
    )

    try:
        send_html_email(
            recipient_email=notification.recipient.email,
            recipient_name=_get_recipient_name(notification.recipient),
            subject=notification.title,
            title=notification.title,
            body=notification.body,
            action_url=notification.action_url,
            action_text="View Details" if notification.action_url else "",
            template_name="notifications/notification_email.html",
            delivery_log=delivery_log,
        )
        delivery_log.status = DeliveryStatus.SENT
        delivery_log.save(update_fields=["status", "updated_at"])
        logger.info("Email sent to %s: %s", notification.recipient.email, notification.title)
    except Exception as exc:
        delivery_log.status = DeliveryStatus.FAILED
        delivery_log.error_message = str(exc)
        delivery_log.save(update_fields=["status", "error_message", "updated_at"])
        logger.error("Failed to send email to %s: %s", notification.recipient.email, exc)


def _get_recipient_name(user) -> str:
    """Return the recipient's display name."""
    if user.first_name:
        return user.first_name
    return user.email.split("@")[0]


def send_html_email(
    *,
    recipient_email: str,
    recipient_name: str = "",
    subject: str,
    title: str = "",
    body: str = "",
    action_url: str = "",
    action_text: str = "",
    template_name: str = "notifications/notification_email.html",
    extra_context: dict | None = None,
    delivery_log: DeliveryLog | None = None,
):
    """Send an HTML email using Django templates with plain-text fallback.

    If a ``delivery_log`` is provided, tracking URLs are injected into the
    template context for open/click tracking.
    """
    context = {
        "title": title,
        "body": body,
        "action_url": action_url,
        "action_text": action_text,
        "recipient_name": recipient_name,
    }

    # Add tracking URLs if we have a delivery log
    if delivery_log is not None:
        tracking = _build_tracking_urls(delivery_log)
        context.update(tracking)

    if extra_context:
        context.update(extra_context)

    html_message = render_to_string(template_name, context)
    plain_message = strip_tags(html_message)

    send_mail(
        subject=subject,
        message=plain_message,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@arifa.law"),
        recipient_list=[recipient_email],
        html_message=html_message,
        fail_silently=False,
    )


def _create_delivery_log(
    notification: Notification,
    channel: str,
    status: str,
    error_message: str = "",
):
    DeliveryLog.objects.create(
        notification=notification,
        channel=channel,
        status=status,
        error_message=error_message,
    )


def mark_as_read(*, notification_id, user) -> Notification:
    """Mark a single notification as read.

    Uses an idempotent UPDATE to avoid race conditions when the same
    notification is marked as read concurrently.
    """
    updated = Notification.objects.filter(
        id=notification_id, recipient=user
    ).update(is_read=True, read_at=timezone.now())

    if not updated:
        raise ApplicationError("Notification not found.")

    return Notification.objects.get(id=notification_id, recipient=user)


@transaction.atomic
def mark_all_as_read(*, user) -> int:
    """Mark all unread notifications as read for a user."""
    now = timezone.now()
    count = Notification.objects.filter(
        recipient=user, is_read=False
    ).update(is_read=True, read_at=now, updated_at=now)
    return count


def get_unread_count(*, user) -> int:
    """Get the count of unread notifications for a user."""
    return Notification.objects.filter(recipient=user, is_read=False).count()


@transaction.atomic
def update_preferences(*, user, **data) -> NotificationPreference:
    """Create or update notification preferences for a user."""
    ALLOWED_FIELDS = {"category_channels", "daily_digest_enabled", "digest_hour"}
    pref, _ = NotificationPreference.objects.get_or_create(user=user)
    updated_fields = []
    for attr, value in data.items():
        if attr in ALLOWED_FIELDS:
            setattr(pref, attr, value)
            updated_fields.append(attr)
    if updated_fields:
        pref.save(update_fields=[*updated_fields, "updated_at"])
    return pref
