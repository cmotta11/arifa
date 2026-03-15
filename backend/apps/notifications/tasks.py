"""Celery tasks for notification delivery."""

import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_notification_async(self, recipient_id: str, template_key: str, context: dict, **kwargs):
    """Send a notification asynchronously."""
    from django.apps import apps

    from . import services

    UserModel = apps.get_model("authentication", "User")
    try:
        recipient = UserModel.objects.get(id=recipient_id)
    except UserModel.DoesNotExist:
        logger.error("Notification recipient %s not found", recipient_id)
        return

    try:
        services.send_notification(
            recipient=recipient,
            template_key=template_key,
            context=context,
            **kwargs,
        )
    except Exception as exc:
        logger.exception("Failed to send notification: %s", exc)
        raise self.retry(exc=exc)


@shared_task
def process_reminders():
    """Process pending reminder campaign steps.

    Runs every 15 minutes via Celery Beat.
    """
    from .constants import ReminderStepStatus
    from .models import ReminderCampaign, ReminderStatus, ReminderStep

    now = timezone.now()
    active_campaigns = ReminderCampaign.objects.filter(status=ReminderStatus.ACTIVE)

    processed = 0
    failed_ids = []
    for campaign in active_campaigns:
        pending_steps = campaign.steps.filter(status=ReminderStepStatus.PENDING).order_by("order_index")
        for step in pending_steps:
            # Calculate when this step should fire
            target_date = campaign.created_at + timedelta(days=step.delay_days)
            if now >= target_date:
                # Send the reminder
                try:
                    from . import services

                    services.send_notification(
                        recipient=step.recipient,
                        template_key=step.template.key if step.template else None,
                        title=f"Reminder: {campaign.name}",
                        body=f"This is reminder step {step.order_index + 1} for {campaign.name}.",
                        category="reminder",
                        ticket_id=campaign.ticket_id,
                        entity_id=campaign.entity_id,
                    )
                    step.status = ReminderStepStatus.SENT
                    step.sent_at = now
                    step.save(update_fields=["status", "sent_at", "updated_at"])
                    processed += 1
                except Exception as exc:
                    logger.error("Failed to process reminder step %s: %s", step.id, exc)
                    failed_ids.append(str(step.id))
            else:
                break  # Steps are ordered, so no need to check further

        # Check if all steps are done
        if not campaign.steps.filter(status=ReminderStepStatus.PENDING).exists():
            campaign.status = ReminderStatus.COMPLETED
            campaign.save(update_fields=["status", "updated_at"])

    if failed_ids:
        logger.warning(
            "Reminder processing had %d failures: %s", len(failed_ids), failed_ids,
        )
    logger.info("Processed %d reminder steps", processed)
    return {"processed": processed, "failed_ids": failed_ids}


@shared_task
def send_daily_digest():
    """Send daily digest emails to users who have it enabled.

    Runs hourly via Celery Beat; the task checks each user's preferred
    ``digest_hour`` so digests are sent at the right time per user.
    Groups unread notifications by category and renders the branded
    ``digest_email.html`` template.
    """
    from collections import defaultdict

    from django.apps import apps
    from django.conf import settings as django_settings

    from .models import (
        DeliveryLog,
        DeliveryStatus,
        Notification,
        NotificationChannel,
        NotificationPreference,
    )

    UserModel = apps.get_model("authentication", "User")
    current_hour = timezone.now().hour
    today_str = timezone.now().strftime("%B %d, %Y")

    prefs = NotificationPreference.objects.filter(
        daily_digest_enabled=True,
        digest_hour=current_hour,
    ).select_related("user")

    sent = 0
    failed_ids = []
    for pref in prefs:
        # Get unread notifications from the last 24 hours
        cutoff = timezone.now() - timedelta(hours=24)
        unread = Notification.objects.filter(
            recipient=pref.user,
            is_read=False,
            created_at__gte=cutoff,
        ).order_by("-created_at")

        total_count = unread.count()
        if total_count == 0:
            continue

        # Group notifications by category
        category_map = defaultdict(list)
        for notif in unread[:50]:  # Limit query to 50 for performance
            category_map[notif.category].append(notif)

        max_items_per_category = 10
        grouped_notifications = []
        for category, items in sorted(category_map.items()):
            display_items = []
            for item in items[:max_items_per_category]:
                display_items.append({
                    "title": item.title,
                    "created_at": item.created_at.strftime("%I:%M %p"),
                })
            remaining = len(items) - max_items_per_category
            grouped_notifications.append({
                "category": category.replace("_", " ").title(),
                "count": len(items),
                "items": display_items,
                "remaining": max(remaining, 0),
            })

        # Build the digest notification record
        from . import services

        try:
            subject = f"Daily Digest for {today_str}: {total_count} unread notification{'s' if total_count != 1 else ''}"

            # Create a Notification record for audit trail
            notification = Notification.objects.create(
                recipient=pref.user,
                title=subject,
                body=f"You have {total_count} unread notifications from the last 24 hours.",
                channel=NotificationChannel.EMAIL,
                category="system",
                action_url="/notifications",
            )

            # Create pending delivery log for tracking
            delivery_log = DeliveryLog.objects.create(
                notification=notification,
                channel=NotificationChannel.EMAIL,
                status=DeliveryStatus.PENDING,
            )

            frontend_url = getattr(django_settings, "FRONTEND_URL", "http://localhost:5173")
            action_url = f"{frontend_url}/notifications"

            services.send_html_email(
                recipient_email=pref.user.email,
                recipient_name=services._get_recipient_name(pref.user),
                subject=subject,
                template_name="notifications/digest_email.html",
                action_url=action_url,
                delivery_log=delivery_log,
                extra_context={
                    "digest_date": today_str,
                    "total_count": total_count,
                    "grouped_notifications": grouped_notifications,
                },
            )

            delivery_log.status = DeliveryStatus.SENT
            delivery_log.save(update_fields=["status", "updated_at"])
            sent += 1
        except Exception as exc:
            logger.error("Failed to send digest to %s: %s", pref.user.email, exc)
            failed_ids.append(str(pref.user_id))

    if failed_ids:
        logger.warning("Daily digest had %d failures: %s", len(failed_ids), failed_ids)
    logger.info("Sent %d daily digests", sent)
    return {"sent": sent, "failed_ids": failed_ids}


@shared_task
def send_accounting_batch_summary():
    """Send AM/PM batch summary of pending expenses to accounting team.

    Runs twice daily (9 AM and 3 PM) via Celery Beat.  Queries pending
    expenses from the services_platform app and sends a summary email to
    users with accounting-related roles (gestora, director).
    """
    from decimal import Decimal

    from django.apps import apps
    from django.conf import settings as django_settings
    from django.db.models import Count, Sum

    from .models import (
        DeliveryLog,
        DeliveryStatus,
        Notification,
        NotificationChannel,
    )

    ExpenseRecord = apps.get_model("services_platform", "ExpenseRecord")
    UserModel = apps.get_model("authentication", "User")

    pending_expenses = ExpenseRecord.objects.filter(payment_status="pending")
    total_count = pending_expenses.count()

    if total_count == 0:
        logger.info("No pending expenses for accounting batch summary")
        return {"sent": 0, "pending_count": 0}

    total_amount = pending_expenses.aggregate(
        total=Sum("amount"),
    )["total"] or Decimal("0.00")

    # Group by category for the summary
    category_summary = (
        pending_expenses
        .values("category")
        .annotate(count=Count("id"), amount=Sum("amount"))
        .order_by("category")
    )

    now = timezone.now()
    batch_period = "AM" if now.hour < 12 else "PM"
    today_str = now.strftime("%B %d, %Y")
    subject = f"Accounting Batch ({batch_period}) - {today_str}: {total_count} Pending Expenses"

    # Build summary body
    summary_lines = [
        f"Pending Expenses Summary ({batch_period} Batch - {today_str})",
        f"Total: {total_count} expenses, ${total_amount:,.2f} USD",
        "",
        "Breakdown by category:",
    ]
    for entry in category_summary:
        cat_display = entry["category"].replace("_", " ").title()
        summary_lines.append(
            f"  - {cat_display}: {entry['count']} expense(s), ${entry['amount']:,.2f}"
        )

    body_text = "\n".join(summary_lines)

    # Send to gestora and director roles (accounting-adjacent)
    accounting_users = UserModel.objects.filter(
        role__in=["gestora", "director"],
        is_active=True,
    )

    sent = 0
    failed_ids = []

    from . import services

    for user in accounting_users:
        try:
            notification = Notification.objects.create(
                recipient=user,
                title=subject,
                body=body_text,
                channel=NotificationChannel.BOTH,
                category="system",
                action_url="/admin/expenses",
            )

            # In-app delivery
            DeliveryLog.objects.create(
                notification=notification,
                channel=NotificationChannel.IN_APP,
                status=DeliveryStatus.SENT,
            )

            # Email delivery with tracking
            delivery_log = DeliveryLog.objects.create(
                notification=notification,
                channel=NotificationChannel.EMAIL,
                status=DeliveryStatus.PENDING,
            )

            frontend_url = getattr(django_settings, "FRONTEND_URL", "http://localhost:5173")

            services.send_html_email(
                recipient_email=user.email,
                recipient_name=services._get_recipient_name(user),
                subject=subject,
                title=subject,
                body=body_text,
                action_url=f"{frontend_url}/admin/expenses",
                action_text="View Pending Expenses",
                delivery_log=delivery_log,
            )

            delivery_log.status = DeliveryStatus.SENT
            delivery_log.save(update_fields=["status", "updated_at"])
            sent += 1
        except Exception as exc:
            logger.error(
                "Failed to send accounting batch summary to %s: %s",
                user.email, exc,
            )
            failed_ids.append(str(user.id))

    if failed_ids:
        logger.warning(
            "Accounting batch summary had %d failures: %s",
            len(failed_ids), failed_ids,
        )
    logger.info(
        "Sent %d accounting batch summaries (%s batch, %d pending expenses)",
        sent, batch_period, total_count,
    )
    return {"sent": sent, "pending_count": total_count, "failed_ids": failed_ids}
