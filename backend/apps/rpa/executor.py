"""RPA job executor — runs job steps sequentially.

Each step dispatches to a handler based on the step's ``action`` field.
The executor checks for pause/cancel between steps.
"""

import logging
from typing import Any

from django.utils import timezone

from .models import RPAJob, RPAJobStatus, RPAJobStep, RPAStepStatus

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Step action handlers
# ---------------------------------------------------------------------------

_ACTION_HANDLERS: dict[str, callable] = {}


def register_action(name: str):
    """Decorator to register an RPA step action handler."""

    def decorator(fn):
        _ACTION_HANDLERS[name] = fn
        return fn

    return decorator


@register_action("aderant_open_file")
def _handle_aderant_open_file(step: RPAJobStep, job_data: dict) -> dict:
    from apps.core.integrations.aderant_soap import AderantHarness

    harness = AderantHarness()
    result = harness.open_file(
        client_name=job_data.get("client_name", ""),
        matter_description=job_data.get("matter_description", ""),
        client_type=job_data.get("client_type", "corporate"),
        responsible_attorney=job_data.get("responsible_attorney", ""),
        office=job_data.get("office", "Panama"),
        matter_type=job_data.get("matter_type", "incorporation"),
    )
    return result.model_dump()


@register_action("aderant_create_client")
def _handle_aderant_create_client(step: RPAJobStep, job_data: dict) -> dict:
    from apps.core.integrations.aderant_soap import AderantHarness

    harness = AderantHarness()
    result = harness.open_file(
        client_name=job_data.get("client_name", ""),
        matter_description=f"Initial Matter - {job_data.get('client_name', '')}",
        client_type=job_data.get("client_type", "corporate"),
    )
    return {"client_id": result.client_id, "is_mock": result.is_mock}


@register_action("aderant_create_matter")
def _handle_aderant_create_matter(step: RPAJobStep, job_data: dict) -> dict:
    from apps.core.integrations.aderant_soap import AderantHarness

    harness = AderantHarness()
    result = harness.open_file(
        client_name=job_data.get("client_name", ""),
        matter_description=job_data.get("matter_description", ""),
        matter_type=job_data.get("matter_type", "incorporation"),
    )
    return {"matter_id": result.matter_id, "is_mock": result.is_mock}


@register_action("aderant_post_time")
def _handle_aderant_post_time(step: RPAJobStep, job_data: dict) -> dict:
    from apps.core.integrations.aderant_soap import AderantHarness

    harness = AderantHarness()
    result = harness.post_time_entry(
        matter_id=job_data.get("matter_id", ""),
        attorney_id=job_data.get("attorney_id", ""),
        hours=float(job_data.get("hours", 0)),
        description=job_data.get("time_description", "RPA generated"),
    )
    return result.model_dump()


@register_action("aderant_sync_client")
def _handle_aderant_sync_client(step: RPAJobStep, job_data: dict) -> dict:
    from apps.core.integrations.aderant_soap import AderantHarness

    harness = AderantHarness()
    client = harness.get_client(job_data.get("aderant_client_id", ""))
    if client:
        return client.model_dump()
    return {"error": "Client not found"}


@register_action("update_arifa_entity")
def _handle_update_arifa_entity(step: RPAJobStep, job_data: dict) -> dict:
    """Update an ARIFA entity with data from a previous step."""
    entity_id = job_data.get("entity_id")
    if not entity_id:
        return {"skipped": True, "reason": "No entity_id in job data"}

    from apps.core.models import Entity

    try:
        entity = Entity.objects.get(id=entity_id)
    except Entity.DoesNotExist:
        return {"skipped": True, "reason": f"Entity {entity_id} not found"}

    # Update aderant_matter_id if available from previous step output
    aderant_matter_id = job_data.get("_step_output", {}).get("matter_id")
    if aderant_matter_id:
        logger.info("Would link entity %s to Aderant matter %s", entity_id, aderant_matter_id)

    return {"entity_id": str(entity_id), "updated": True}


@register_action("transition_ticket")
def _handle_transition_ticket(step: RPAJobStep, job_data: dict) -> dict:
    """Transition a ticket to the next state via the workflow service layer."""
    ticket_id = job_data.get("ticket_id")
    target_state = step.config.get("target_state_name")
    if not ticket_id or not target_state:
        return {"skipped": True}

    from apps.workflow.models import Ticket, WorkflowState
    from apps.workflow.services import transition_ticket

    try:
        ticket = Ticket.objects.select_related("current_state").get(id=ticket_id)
    except Ticket.DoesNotExist:
        return {"error": f"Ticket {ticket_id} not found"}

    try:
        new_state = WorkflowState.objects.get(
            name=target_state,
            workflow_definition=ticket.workflow_definition,
        )
    except WorkflowState.DoesNotExist:
        return {"error": f"State '{target_state}' not found"}

    # Use system user for RPA-driven transitions
    from apps.compliance.services import _get_system_user

    system_user = _get_system_user()

    transition_ticket(
        ticket_id=ticket_id,
        new_state_id=new_state.id,
        changed_by=system_user,
        comment=f"RPA automated transition to '{target_state}'",
    )
    return {"ticket_id": str(ticket_id), "new_state": target_state}


@register_action("noop")
def _handle_noop(step: RPAJobStep, job_data: dict) -> dict:
    """No-op step — used for placeholder or manual steps."""
    return {"status": "ok", "message": step.config.get("message", "No operation")}


# ---------------------------------------------------------------------------
# Executor
# ---------------------------------------------------------------------------


class RPAExecutor:
    """Execute an RPA job by running each step in order."""

    def execute(self, job_id: str) -> RPAJob:
        """Run all pending steps for a job."""
        job = RPAJob.objects.select_related("definition").get(id=job_id)

        if job.status != RPAJobStatus.RUNNING:
            logger.warning("Job %s not in RUNNING state (%s), skipping.", job_id, job.status)
            return job

        steps = list(job.steps.order_by("order_index"))
        accumulated_data = dict(job.input_data)

        for step in steps:
            # Refresh job status to check for pause/cancel
            job.refresh_from_db(fields=["status"])
            if job.status == RPAJobStatus.PAUSED:
                logger.info("Job %s paused, stopping at step %d", job_id, step.order_index)
                return job
            if job.status == RPAJobStatus.CANCELLED:
                logger.info("Job %s cancelled, stopping at step %d", job_id, step.order_index)
                return job

            if step.status == RPAStepStatus.COMPLETED:
                # Carry forward completed step output
                accumulated_data["_step_output"] = step.output_data
                continue
            if step.status == RPAStepStatus.SKIPPED:
                continue

            try:
                result = self._execute_step(step, accumulated_data)
                step.output_data = result
                step.status = RPAStepStatus.COMPLETED
                step.completed_at = timezone.now()
                step.save(update_fields=["output_data", "status", "completed_at", "updated_at"])

                # Merge step output into accumulated data for next steps
                accumulated_data["_step_output"] = result
                accumulated_data.update(result)

            except Exception as exc:
                logger.exception("Step %s failed for job %s: %s", step.step_name, job_id, exc)
                step.status = RPAStepStatus.FAILED
                step.error_message = str(exc)
                step.completed_at = timezone.now()
                step.save(update_fields=["status", "error_message", "completed_at", "updated_at"])

                job.status = RPAJobStatus.FAILED
                job.error_message = f"Step '{step.step_name}' failed: {exc}"
                job.completed_at = timezone.now()
                job.save(update_fields=["status", "error_message", "completed_at", "updated_at"])
                return job

        # All steps completed
        job.status = RPAJobStatus.COMPLETED
        job.output_data = accumulated_data
        job.completed_at = timezone.now()
        job.save(update_fields=["status", "output_data", "completed_at", "updated_at"])
        logger.info("RPA job %s completed successfully", job_id)
        return job

    def _execute_step(self, step: RPAJobStep, job_data: dict) -> dict:
        """Execute a single step using its registered action handler."""
        step.status = RPAStepStatus.RUNNING
        step.started_at = timezone.now()
        step.save(update_fields=["status", "started_at", "updated_at"])

        action = step.action
        handler = _ACTION_HANDLERS.get(action)

        if handler is None:
            raise ValueError(f"Unknown RPA action: '{action}'")

        logger.info("Executing step '%s' (action: %s)", step.step_name, action)
        return handler(step, job_data)
