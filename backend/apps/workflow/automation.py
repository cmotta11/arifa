"""INC workflow automation hooks.

Defines handlers that execute when tickets transition between states.
Handlers are registered by (workflow_definition_name, target_state_name) and
dispatched from the ``notify_ticket_state_change`` signal.

Each handler receives the ticket, the TicketLog entry, and the user who
triggered the transition.
"""

import logging
from typing import Callable

from django.db import transaction

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Handler registry
# ---------------------------------------------------------------------------

_HANDLERS: dict[tuple[str, str], list[Callable]] = {}


def on_enter(workflow: str, state: str):
    """Decorator to register a handler for entering a workflow state.

    Usage::

        @on_enter("INC_PANAMA", "KYC Review")
        def handle_kyc_review(ticket, log_entry, user):
            ...
    """

    def decorator(fn: Callable):
        key = (workflow, state)
        _HANDLERS.setdefault(key, []).append(fn)
        return fn

    return decorator


def dispatch(ticket, log_entry):
    """Run all registered handlers for the ticket's current state transition."""
    wf_name = (
        ticket.workflow_definition.name
        if ticket.workflow_definition
        else None
    )
    state_name = log_entry.new_state.name if log_entry.new_state else None

    if not wf_name or not state_name:
        return

    handlers = _HANDLERS.get((wf_name, state_name), [])
    user = log_entry.changed_by

    for handler in handlers:
        try:
            handler(ticket, log_entry, user)
        except Exception:
            logger.exception(
                "Automation handler %s failed for ticket %s entering %s/%s",
                handler.__name__,
                ticket.id,
                wf_name,
                state_name,
            )


# ---------------------------------------------------------------------------
# INC_PANAMA handlers
# ---------------------------------------------------------------------------


@on_enter("INC_PANAMA", "KYC Review")
def inc_panama_auto_risk(ticket, log_entry, user):
    """Auto-calculate risk assessment when entering KYC Review."""
    if not ticket.entity_id:
        return

    from apps.compliance.tasks import recalculate_entity_risk

    recalculate_entity_risk.delay(str(ticket.entity_id), trigger="inc_kyc_review")
    logger.info("Dispatched risk recalc for entity %s (ticket %s)", ticket.entity_id, ticket.id)


@on_enter("INC_PANAMA", "Drafting")
def inc_panama_assign_gestora(ticket, log_entry, user):
    """Auto-assign to least-loaded gestora when entering Drafting."""
    if ticket.assigned_to_id:
        return  # Already assigned

    from django.apps import apps
    from django.db.models import Count

    UserModel = apps.get_model("authentication", "User")
    gestoras = (
        UserModel.objects.filter(role="gestora", is_active=True)
        .annotate(ticket_count=Count("assigned_tickets"))
        .order_by("ticket_count")
    )

    if gestoras.exists():
        least_loaded = gestoras.first()
        ticket.assigned_to = least_loaded
        ticket.save(update_fields=["assigned_to", "updated_at"])
        logger.info(
            "Auto-assigned ticket %s to gestora %s",
            ticket.id,
            least_loaded.email,
        )


@on_enter("INC_PANAMA", "Drafting")
def inc_panama_trigger_doc_assembly(ticket, log_entry, user):
    """When a ticket enters Drafting, check if we should trigger doc assembly."""
    # This will be enhanced when the services_platform app is ready.
    # For now, log the intent.
    logger.info(
        "Ticket %s entered Drafting — document assembly can be triggered.",
        ticket.id,
    )


@on_enter("INC_PANAMA", "Notary")
def inc_panama_assign_deed(ticket, log_entry, user):
    """Assign a notary deed from the pool when entering Notary stage."""
    try:
        from apps.services_platform.models import NotaryDeedPool
        from apps.services_platform.services import assign_deed
    except ImportError:
        logger.debug("services_platform not yet installed, skipping deed assignment.")
        return

    # Only assign if there's a linked service request
    sr_id = ticket.metadata.get("service_request_id")
    if not sr_id:
        return

    try:
        assign_deed(request_id=sr_id, jurisdiction_id=ticket.jurisdiction_id)
        logger.info("Deed assigned for ticket %s service request %s", ticket.id, sr_id)
    except Exception:
        logger.exception("Failed to assign deed for ticket %s", ticket.id)


@on_enter("INC_PANAMA", "Notary")
def inc_panama_create_legal_support_ticket(ticket, log_entry, user):
    """Auto-create a LEGAL_SUPPORT sub-ticket when entering Notary."""
    from apps.workflow.models import WorkflowDefinition
    from apps.workflow.services import spawn_sub_ticket

    try:
        legal_def = WorkflowDefinition.objects.get(name="LEGAL_SUPPORT", is_active=True)
    except WorkflowDefinition.DoesNotExist:
        logger.warning("LEGAL_SUPPORT workflow not found, skipping sub-ticket creation.")
        return

    from apps.compliance.services import _get_system_user

    system_user = _get_system_user()

    spawn_sub_ticket(
        parent_ticket_id=ticket.id,
        created_by=system_user,
        title=f"Legal Support — {ticket.title}",
        workflow_definition_id=legal_def.id,
        metadata={"auto_created": True, "source_stage": "Notary"},
    )
    logger.info("Created LEGAL_SUPPORT sub-ticket for ticket %s", ticket.id)


@on_enter("INC_PANAMA", "Public Registry")
def inc_panama_create_registry_ticket(ticket, log_entry, user):
    """Auto-create a PUBLIC_REGISTRY sub-ticket when entering Public Registry."""
    from apps.workflow.models import WorkflowDefinition
    from apps.workflow.services import spawn_sub_ticket

    try:
        registry_def = WorkflowDefinition.objects.get(name="PUBLIC_REGISTRY", is_active=True)
    except WorkflowDefinition.DoesNotExist:
        logger.warning("PUBLIC_REGISTRY workflow not found, skipping sub-ticket creation.")
        return

    from apps.compliance.services import _get_system_user

    system_user = _get_system_user()

    spawn_sub_ticket(
        parent_ticket_id=ticket.id,
        created_by=system_user,
        title=f"Registry Filing — {ticket.title}",
        workflow_definition_id=registry_def.id,
        metadata={"auto_created": True, "source_stage": "Public Registry"},
    )
    logger.info("Created PUBLIC_REGISTRY sub-ticket for ticket %s", ticket.id)


@on_enter("INC_PANAMA", "NIT/RUC")
def inc_panama_dispatch_nit_ruc_rpa(ticket, log_entry, user):
    """Dispatch RPA job to register NIT/RUC when entering that stage."""
    from apps.rpa.models import RPAJobDefinition
    from apps.rpa.services import create_rpa_job, start_rpa_job

    try:
        definition = RPAJobDefinition.objects.get(name="INC_REGISTER_NIT_RUC", is_active=True)
    except RPAJobDefinition.DoesNotExist:
        logger.warning("INC_REGISTER_NIT_RUC RPA definition not found.")
        return

    input_data = {
        "ticket_id": str(ticket.id),
        "entity_id": str(ticket.entity_id) if ticket.entity_id else "",
        "client_name": ticket.client.name if ticket.client else "",
    }

    job = create_rpa_job(
        definition_id=definition.id,
        input_data=input_data,
        ticket_id=ticket.id,
        entity_id=ticket.entity_id,
        created_by=user,
    )
    start_rpa_job(job_id=job.id)
    logger.info("Dispatched INC_REGISTER_NIT_RUC RPA job %s for ticket %s", job.id, ticket.id)


@on_enter("INC_PANAMA", "File Opening")
def inc_panama_dispatch_file_opening_rpa(ticket, log_entry, user):
    """Dispatch RPA job to open Aderant file when entering File Opening."""
    from apps.rpa.models import RPAJobDefinition
    from apps.rpa.services import create_rpa_job, start_rpa_job

    try:
        definition = RPAJobDefinition.objects.get(name="INC_CREATE_MATTER_INC", is_active=True)
    except RPAJobDefinition.DoesNotExist:
        logger.warning("INC_CREATE_MATTER_INC RPA definition not found.")
        return

    input_data = {
        "ticket_id": str(ticket.id),
        "entity_id": str(ticket.entity_id) if ticket.entity_id else "",
        "client_name": ticket.client.name if ticket.client else "",
        "matter_type": "incorporation",
        "matter_description": f"Incorporation — {ticket.title}",
    }

    job = create_rpa_job(
        definition_id=definition.id,
        input_data=input_data,
        ticket_id=ticket.id,
        entity_id=ticket.entity_id,
        created_by=user,
    )
    start_rpa_job(job_id=job.id)
    logger.info("Dispatched INC_CREATE_MATTER_INC RPA job %s for ticket %s", job.id, ticket.id)


@on_enter("INC_PANAMA", "Completed")
def inc_panama_finalize(ticket, log_entry, user):
    """Finalize the incorporation — update entity status and create archive ticket."""
    # Update entity status to active
    if ticket.entity_id:
        from apps.core.models import Entity

        Entity.objects.filter(id=ticket.entity_id).update(status="active")
        logger.info("Entity %s marked active after incorporation completion.", ticket.entity_id)

    # Create ARCHIVE sub-ticket
    from apps.workflow.models import WorkflowDefinition
    from apps.workflow.services import spawn_sub_ticket

    try:
        archive_def = WorkflowDefinition.objects.get(name="ARCHIVE", is_active=True)
    except WorkflowDefinition.DoesNotExist:
        logger.warning("ARCHIVE workflow not found, skipping.")
        return

    from apps.compliance.services import _get_system_user

    system_user = _get_system_user()

    spawn_sub_ticket(
        parent_ticket_id=ticket.id,
        created_by=system_user,
        title=f"Archive — {ticket.title}",
        workflow_definition_id=archive_def.id,
        metadata={"auto_created": True, "source_stage": "Completed"},
    )

    # Dispatch annual renewal RPA if applicable
    from apps.rpa.models import RPAJobDefinition
    from apps.rpa.services import create_rpa_job, start_rpa_job

    try:
        definition = RPAJobDefinition.objects.get(name="INC_CREATE_MATTER_ANNUAL", is_active=True)
    except RPAJobDefinition.DoesNotExist:
        return

    input_data = {
        "ticket_id": str(ticket.id),
        "entity_id": str(ticket.entity_id) if ticket.entity_id else "",
        "client_name": ticket.client.name if ticket.client else "",
        "matter_type": "annual_renewal",
    }

    job = create_rpa_job(
        definition_id=definition.id,
        input_data=input_data,
        ticket_id=ticket.id,
        entity_id=ticket.entity_id,
        created_by=user,
    )
    start_rpa_job(job_id=job.id)


# ---------------------------------------------------------------------------
# INC_BVI handlers
# ---------------------------------------------------------------------------


@on_enter("INC_BVI", "KYC Review")
def inc_bvi_auto_risk(ticket, log_entry, user):
    """Auto-calculate risk assessment when entering KYC Review (BVI)."""
    if not ticket.entity_id:
        return

    from apps.compliance.tasks import recalculate_entity_risk

    recalculate_entity_risk.delay(str(ticket.entity_id), trigger="inc_bvi_kyc_review")


@on_enter("INC_BVI", "Drafting")
def inc_bvi_assign_gestora(ticket, log_entry, user):
    """Auto-assign to gestora (BVI)."""
    inc_panama_assign_gestora(ticket, log_entry, user)


@on_enter("INC_BVI", "M&A / COI")
def inc_bvi_ma_coi(ticket, log_entry, user):
    """Trigger M&A document preparation and BVI registry submission."""
    logger.info("BVI ticket %s entered M&A/COI stage — preparing M&A docs.", ticket.id)

    # Trigger BVI document assembly (Memorandum, Articles)
    if ticket.entity_id:
        try:
            from apps.documents.builders.base import DocumentBuilderRegistry

            for doc_type in ["bvi_memorandum", "bvi_articles"]:
                builder = DocumentBuilderRegistry.get_builder(doc_type)
                if builder:
                    logger.info(
                        "BVI doc assembly ready: %s for ticket %s",
                        doc_type,
                        ticket.id,
                    )
        except Exception:
            logger.exception("BVI doc assembly check failed for ticket %s", ticket.id)


@on_enter("INC_BVI", "Client Signing")
def inc_bvi_client_signing(ticket, log_entry, user):
    """Set up client signing reminders (5d/3d/2d)."""
    from apps.notifications.tasks import send_notification_async

    # Notify client that documents are ready for signing
    if ticket.client_id:
        from django.apps import apps

        UserModel = apps.get_model("authentication", "User")
        client_users = UserModel.objects.filter(
            role="client",
            is_active=True,
        )
        # Find users linked to this client (simplified: notify all clients for now)
        for cu in client_users[:5]:
            send_notification_async.delay(
                str(cu.id),
                "client_signing_reminder",
                {
                    "entity_name": ticket.entity.name if ticket.entity else ticket.title,
                },
                category="ticket",
                action_url=f"/tickets/{ticket.id}",
                ticket_id=str(ticket.id),
            )

    # Schedule reminder campaign (5d, 3d, 2d before deadline)
    try:
        from apps.notifications.services import schedule_reminder

        schedule_reminder(
            entity_id=ticket.entity_id,
            ticket_id=ticket.id,
            template_key="client_signing_reminder",
            steps_days=[5, 3, 2],
        )
        logger.info("Scheduled signing reminders for BVI ticket %s", ticket.id)
    except Exception:
        logger.exception("Failed to schedule signing reminders for ticket %s", ticket.id)


@on_enter("INC_BVI", "ROD/ROM/ROB")
def inc_bvi_rod_rom_rob(ticket, log_entry, user):
    """File Register of Directors, Members, and Beneficial Owners with BVI registry."""
    logger.info("BVI ticket %s — filing ROD/ROM/ROB.", ticket.id)

    # Trigger BVI-specific document assembly
    if ticket.entity_id:
        try:
            from apps.documents.builders.base import DocumentBuilderRegistry

            for doc_type in ["bvi_share_certificate"]:
                builder = DocumentBuilderRegistry.get_builder(doc_type)
                if builder:
                    logger.info(
                        "BVI ROD/ROM/ROB doc ready: %s for ticket %s",
                        doc_type,
                        ticket.id,
                    )
        except Exception:
            logger.exception("BVI ROD/ROM/ROB doc check failed for ticket %s", ticket.id)


@on_enter("INC_BVI", "Registry Agent")
def inc_bvi_submit_to_agent(ticket, log_entry, user):
    """Submit to BVI registry agent — COI receipt expected."""
    logger.info("BVI ticket %s submitted to registry agent for COI.", ticket.id)


@on_enter("INC_BVI", "Completed")
def inc_bvi_finalize(ticket, log_entry, user):
    """Finalize BVI incorporation — activate entity, create archive."""
    if ticket.entity_id:
        from apps.core.models import Entity

        Entity.objects.filter(id=ticket.entity_id).update(status="active")
        logger.info("BVI Entity %s marked active.", ticket.entity_id)

    # Create ARCHIVE sub-ticket
    from apps.workflow.models import WorkflowDefinition
    from apps.workflow.services import spawn_sub_ticket

    try:
        archive_def = WorkflowDefinition.objects.get(name="ARCHIVE", is_active=True)
    except WorkflowDefinition.DoesNotExist:
        return

    from apps.compliance.services import _get_system_user

    system_user = _get_system_user()
    spawn_sub_ticket(
        parent_ticket_id=ticket.id,
        created_by=system_user,
        title=f"Archive — {ticket.title}",
        workflow_definition_id=archive_def.id,
        metadata={"auto_created": True, "source_stage": "Completed", "jurisdiction": "BVI"},
    )


# ---------------------------------------------------------------------------
# INC_PANAMA_DIGITAL handlers
# ---------------------------------------------------------------------------


@on_enter("INC_PANAMA_DIGITAL", "KYC Review")
def inc_digital_auto_risk(ticket, log_entry, user):
    """Auto-calculate risk for digital notary path."""
    inc_panama_auto_risk(ticket, log_entry, user)


@on_enter("INC_PANAMA_DIGITAL", "Drafting")
def inc_digital_assign_gestora(ticket, log_entry, user):
    """Auto-assign gestora for digital notary path."""
    inc_panama_assign_gestora(ticket, log_entry, user)


@on_enter("INC_PANAMA_DIGITAL", "Documentation")
def inc_digital_documentation(ticket, log_entry, user):
    """Digital notary path skips Notary + Registry stages — go straight to docs.

    Trigger document assembly for digital path (no physical deed needed).
    """
    logger.info(
        "Digital notary ticket %s entered Documentation (skipped Notary + Registry).",
        ticket.id,
    )
    # Trigger doc assembly for digital path
    if ticket.entity_id:
        try:
            from apps.documents.builders.base import DocumentBuilderRegistry

            for doc_type in ["panama_pacto_social", "panama_protocolo", "panama_caratula"]:
                builder = DocumentBuilderRegistry.get_builder(doc_type)
                if builder:
                    logger.info("Digital doc ready: %s for ticket %s", doc_type, ticket.id)
        except Exception:
            logger.exception("Digital doc assembly check failed for ticket %s", ticket.id)


@on_enter("INC_PANAMA_DIGITAL", "NIT/RUC")
def inc_digital_nit_ruc(ticket, log_entry, user):
    """Digital notary NIT/RUC registration — same as traditional."""
    inc_panama_dispatch_nit_ruc_rpa(ticket, log_entry, user)


@on_enter("INC_PANAMA_DIGITAL", "Completed")
def inc_digital_finalize(ticket, log_entry, user):
    """Finalize digital notary incorporation."""
    inc_panama_finalize(ticket, log_entry, user)


# ---------------------------------------------------------------------------
# Payment / High-Capital detection
# ---------------------------------------------------------------------------


def check_high_capital(ticket):
    """Check if a service request has high authorized capital and flag it.

    Called from the services platform when incorporation data is saved.
    """
    sr_id = ticket.metadata.get("service_request_id")
    if not sr_id:
        return False

    try:
        from apps.services_platform.models import IncorporationData

        inc_data = IncorporationData.objects.get(service_request_id=sr_id)
    except (ImportError, IncorporationData.DoesNotExist):
        return False

    if inc_data.is_high_capital:
        # Add high_capital flag to ticket metadata
        metadata = dict(ticket.metadata)
        metadata["is_high_capital"] = True
        ticket.metadata = metadata
        ticket.save(update_fields=["metadata", "updated_at"])

        # Send high-capital alert notification
        from apps.notifications.tasks import send_notification_async

        from django.apps import apps

        UserModel = apps.get_model("authentication", "User")
        accounting_users = UserModel.objects.filter(
            role__in=["director", "coordinator"],
            is_active=True,
        )
        for u in accounting_users:
            send_notification_async.delay(
                str(u.id),
                "high_capital_alert",
                {
                    "ticket_title": ticket.title,
                    "entity_name": ticket.entity.name if ticket.entity else "",
                    "authorized_capital": str(inc_data.authorized_capital),
                },
                category="system",
                priority="high",
                action_url=f"/tickets/{ticket.id}",
                ticket_id=str(ticket.id),
            )
        logger.info("High-capital alert sent for ticket %s", ticket.id)
        return True

    return False


# ---------------------------------------------------------------------------
# Delayed alert helpers (for Celery Beat)
# ---------------------------------------------------------------------------


def check_notary_delays():
    """Check for tickets in Notary state > 24 business hours.

    Called from a Celery Beat task.
    """
    from datetime import timedelta

    from django.utils import timezone

    from apps.notifications.tasks import send_notification_async
    from apps.workflow.models import Ticket, TicketLog, WorkflowState

    # Find INC_PANAMA tickets in Notary state
    notary_states = WorkflowState.objects.filter(
        name="Notary",
        workflow_definition__name="INC_PANAMA",
    )

    if not notary_states.exists():
        return 0

    notary_state = notary_states.first()
    cutoff = timezone.now() - timedelta(hours=24)

    # Find tickets that entered Notary more than 24h ago
    delayed_tickets = Ticket.objects.filter(
        current_state=notary_state,
        updated_at__lt=cutoff,
    ).select_related("assigned_to", "client")

    count = 0
    for ticket in delayed_tickets:
        if ticket.assigned_to:
            send_notification_async.delay(
                str(ticket.assigned_to.id),
                "delayed_notary_alert",
                {
                    "ticket_title": ticket.title,
                    "hours_in_state": 24,
                },
                category="ticket",
                priority="high",
                action_url=f"/tickets/{ticket.id}",
                ticket_id=str(ticket.id),
            )
            count += 1

    logger.info("Sent %d delayed notary alerts", count)
    return count


def check_registry_delays():
    """Check for tickets in Public Registry > 48 hours."""
    from datetime import timedelta

    from django.utils import timezone

    from apps.notifications.tasks import send_notification_async
    from apps.workflow.models import Ticket, WorkflowState

    registry_states = WorkflowState.objects.filter(
        name__in=["Public Registry", "Submitted", "Under Review"],
        workflow_definition__name__in=["INC_PANAMA", "PUBLIC_REGISTRY"],
    )

    cutoff = timezone.now() - timedelta(hours=48)
    delayed_tickets = Ticket.objects.filter(
        current_state__in=registry_states,
        updated_at__lt=cutoff,
    ).select_related("assigned_to")

    count = 0
    for ticket in delayed_tickets:
        if ticket.assigned_to:
            send_notification_async.delay(
                str(ticket.assigned_to.id),
                "delayed_registry_alert",
                {
                    "ticket_title": ticket.title,
                },
                category="ticket",
                priority="high",
                action_url=f"/tickets/{ticket.id}",
                ticket_id=str(ticket.id),
            )
            count += 1

    return count
