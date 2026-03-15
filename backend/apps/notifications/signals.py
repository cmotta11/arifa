"""Signal handlers for auto-notifications.

Listens to model changes and dispatches notifications to relevant users.
"""

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(post_save, sender="workflow.TicketLog")
def notify_ticket_state_change(sender, instance, created, **kwargs):
    """Notify assigned user and relevant parties when a ticket changes state."""
    if not created:
        return

    ticket = instance.ticket

    # Dispatch workflow automation handlers (regardless of whether it's creation)
    try:
        from apps.workflow.automation import dispatch as dispatch_automation

        dispatch_automation(ticket, instance)
    except Exception:
        logger.exception("Automation dispatch failed for ticket %s", ticket.id)

    # Don't notify on ticket creation (no previous state)
    if instance.previous_state is None:
        return

    from .tasks import send_notification_async

    context = {
        "ticket_title": ticket.title,
        "previous_state": instance.previous_state.name if instance.previous_state else "N/A",
        "new_state": instance.new_state.name if instance.new_state else "N/A",
        "changed_by": instance.changed_by.email if instance.changed_by else "System",
        "comment": instance.comment or "",
    }

    # Notify assigned user (if different from person who made the change)
    if ticket.assigned_to and (
        not instance.changed_by or ticket.assigned_to.id != instance.changed_by.id
    ):
        send_notification_async.delay(
            str(ticket.assigned_to.id),
            "ticket_state_change",
            context,
            action_url=f"/tickets/{ticket.id}",
            ticket_id=str(ticket.id),
            category="ticket",
        )

    # Notify ticket creator (if different from assignee and changer)
    if ticket.created_by and ticket.created_by.id != (ticket.assigned_to_id or None):
        if not instance.changed_by or ticket.created_by.id != instance.changed_by.id:
            send_notification_async.delay(
                str(ticket.created_by.id),
                "ticket_state_change",
                context,
                action_url=f"/tickets/{ticket.id}",
                ticket_id=str(ticket.id),
                category="ticket",
            )


@receiver(post_save, sender="compliance.KYCSubmission")
def notify_kyc_status_change(sender, instance, created, **kwargs):
    """Notify when a KYC submission status changes."""
    if created:
        return  # Only notify on updates

    from .tasks import send_notification_async

    status = instance.status
    if status in ("submitted", "approved", "rejected"):
        template_map = {
            "submitted": "kyc_submitted",
            "approved": "kyc_approved",
            "rejected": "kyc_rejected",
        }

        context = {
            "kyc_id": str(instance.id),
            "status": status,
        }

        # Notify compliance officers on submission
        if status == "submitted":
            from django.apps import apps

            UserModel = apps.get_model("authentication", "User")
            officers = UserModel.objects.filter(
                role__in=["compliance_officer", "director"],
                is_active=True,
            )
            for officer in officers:
                send_notification_async.delay(
                    str(officer.id),
                    template_map[status],
                    context,
                    category="kyc",
                )

        # Notify the assigned coordinator on approval/rejection
        if status in ("approved", "rejected"):
            ticket = getattr(instance, "ticket", None)
            if ticket and ticket.assigned_to:
                send_notification_async.delay(
                    str(ticket.assigned_to.id),
                    template_map[status],
                    context,
                    category="kyc",
                )


@receiver(post_save, sender="compliance.RFI")
def notify_rfi_created(sender, instance, created, **kwargs):
    """Notify when a new RFI is created."""
    if not created:
        return

    from .tasks import send_notification_async

    context = {
        "rfi_id": str(instance.id),
        "notes": instance.notes[:100] if instance.notes else "",
    }

    # Notify the coordinator who handles this KYC
    kyc = instance.kyc_submission
    if hasattr(kyc, "ticket") and kyc.ticket and kyc.ticket.assigned_to:
        send_notification_async.delay(
            str(kyc.ticket.assigned_to.id),
            "rfi_created",
            context,
            category="compliance",
        )


@receiver(post_save, sender="compliance.RiskAssessment")
def notify_high_risk(sender, instance, created, **kwargs):
    """Notify directors when a high-risk assessment is created."""
    if not created:
        return
    if instance.risk_level != "high":
        return

    from django.apps import apps

    from .tasks import send_notification_async

    UserModel = apps.get_model("authentication", "User")
    directors = UserModel.objects.filter(role="director", is_active=True)

    context = {
        "entity_name": instance.entity.name if instance.entity else "Unknown",
        "risk_level": instance.risk_level,
        "total_score": str(instance.total_score),
    }

    for director in directors:
        send_notification_async.delay(
            str(director.id),
            "risk_high_alert",
            context,
            category="compliance",
            priority="high",
        )


@receiver(post_save, sender="rpa.RPAJob")
def notify_rpa_job_complete(sender, instance, created, **kwargs):
    """Notify when an RPA job completes or fails."""
    if created:
        return  # Don't notify on initial creation
    if instance.status not in ("completed", "failed"):
        return
    if not instance.created_by:
        return

    from .tasks import send_notification_async

    template_key = "rpa_job_completed" if instance.status == "completed" else "rpa_job_failed"
    context = {
        "job_name": instance.definition.display_name,
        "status": instance.status,
        "error": instance.error_message[:200] if instance.error_message else "",
    }

    send_notification_async.delay(
        str(instance.created_by.id),
        template_key,
        context,
        category="rpa",
        action_url=f"/admin/rpa-jobs/{instance.id}",
    )
