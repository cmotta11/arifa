"""Celery tasks for workflow automation.

Includes periodic checks for delayed processes and batch notifications.
"""

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task
def check_notary_delays_task():
    """Check for tickets stuck in Notary state > 24 business hours."""
    from .automation import check_notary_delays

    count = check_notary_delays()
    logger.info("Notary delay check: %d alerts sent", count)
    return {"alerts_sent": count}


@shared_task
def check_registry_delays_task():
    """Check for tickets stuck in Public Registry > 48 hours."""
    from .automation import check_registry_delays

    count = check_registry_delays()
    logger.info("Registry delay check: %d alerts sent", count)
    return {"alerts_sent": count}


@shared_task
def send_accounting_batch_notifications_task():
    """Send AM/PM batch notifications to accounting for registry expenses.

    Runs twice daily (9am and 5pm) per Celery Beat schedule.
    """
    from datetime import timedelta

    from django.apps import apps
    from django.utils import timezone

    from apps.notifications.tasks import send_notification_async

    UserModel = apps.get_model("authentication", "User")

    # Find expenses recorded in the last 12 hours
    cutoff = timezone.now() - timedelta(hours=12)

    try:
        from apps.services_platform.models import ExpenseRecord

        recent_expenses = ExpenseRecord.objects.filter(
            created_at__gte=cutoff,
            payment_status="pending",
        ).count()
    except (ImportError, Exception):
        recent_expenses = 0

    if recent_expenses == 0:
        return {"sent": 0, "reason": "no_pending_expenses"}

    # Notify directors and coordinators
    accounting_users = UserModel.objects.filter(
        role__in=["director", "coordinator"],
        is_active=True,
    )

    sent = 0
    for user in accounting_users:
        send_notification_async.delay(
            str(user.id),
            "accounting_batch_summary",
            {
                "expense_count": str(recent_expenses),
                "period": "AM" if timezone.now().hour < 12 else "PM",
            },
            category="system",
            action_url="/services/expenses",
        )
        sent += 1

    logger.info("Sent %d accounting batch notifications (%d pending expenses)", sent, recent_expenses)
    return {"sent": sent, "expense_count": recent_expenses}


@shared_task
def check_unfactured_incorporations_task():
    """Alert when completed incorporations haven't been invoiced.

    Checks for tickets in Completed state that don't have a linked
    ACCOUNTING_REIMB sub-ticket or RPA invoice job.
    """
    from datetime import timedelta

    from django.utils import timezone

    from apps.notifications.tasks import send_notification_async
    from apps.workflow.models import Ticket, WorkflowDefinition

    try:
        inc_defs = WorkflowDefinition.objects.filter(
            name__in=["INC_PANAMA", "INC_BVI", "INC_PANAMA_DIGITAL"],
            is_active=True,
        )
    except Exception:
        return {"checked": 0}

    cutoff = timezone.now() - timedelta(days=7)

    # Find completed incorporation tickets older than 7 days
    completed_tickets = Ticket.objects.filter(
        workflow_definition__in=inc_defs,
        current_state__is_final=True,
        updated_at__lt=cutoff,
    ).select_related("client", "entity")

    count = 0
    for ticket in completed_tickets:
        # Check if there's an ACCOUNTING_REIMB sub-ticket
        has_accounting = ticket.sub_tickets.filter(
            workflow_definition__name="ACCOUNTING_REIMB"
        ).exists()

        if not has_accounting:
            # Notify accounting
            from django.apps import apps

            UserModel = apps.get_model("authentication", "User")
            directors = UserModel.objects.filter(role="director", is_active=True)

            for director in directors:
                send_notification_async.delay(
                    str(director.id),
                    "unfactured_incorporation_alert",
                    {
                        "ticket_title": ticket.title,
                        "client_name": ticket.client.name if ticket.client else "",
                        "days_since_completion": str(
                            (timezone.now() - ticket.updated_at).days
                        ),
                    },
                    category="system",
                    priority="high",
                    action_url=f"/tickets/{ticket.id}",
                    ticket_id=str(ticket.id),
                )
                count += 1

    logger.info("Sent %d unfactured incorporation alerts", count)
    return {"alerts_sent": count}
