"""RPA job execution services."""

import logging

from django.db import transaction
from django.utils import timezone

from common.exceptions import ApplicationError

from .models import RPAJob, RPAJobDefinition, RPAJobStatus, RPAJobStep, RPAStepStatus

logger = logging.getLogger(__name__)


@transaction.atomic
def create_rpa_job(
    *,
    definition_id,
    input_data: dict,
    created_by=None,
    ticket_id=None,
    entity_id=None,
) -> RPAJob:
    """Create a new RPA job from a definition and materialize its steps."""
    try:
        definition = RPAJobDefinition.objects.get(id=definition_id, is_active=True)
    except RPAJobDefinition.DoesNotExist:
        raise ApplicationError("RPA job definition not found or inactive.")

    # Validate required input fields
    missing = [f for f in definition.required_input_fields if f not in input_data]
    if missing:
        raise ApplicationError(f"Missing required input fields: {', '.join(missing)}")

    job = RPAJob.objects.create(
        definition=definition,
        input_data=input_data,
        created_by=created_by,
        ticket_id=ticket_id,
        entity_id=entity_id,
        max_retries=3,
    )

    # Materialize steps from definition
    for idx, step_def in enumerate(definition.step_definitions):
        RPAJobStep.objects.create(
            job=job,
            step_name=step_def.get("name", f"Step {idx + 1}"),
            order_index=idx,
            action=step_def.get("action", ""),
            config=step_def.get("config", {}),
        )

    logger.info("Created RPA job %s from definition '%s' with %d steps",
                job.id, definition.name, len(definition.step_definitions))
    return job


@transaction.atomic
def start_rpa_job(*, job_id) -> RPAJob:
    """Mark job as running and dispatch to Celery."""
    try:
        job = RPAJob.objects.select_for_update().get(id=job_id)
    except RPAJob.DoesNotExist:
        raise ApplicationError("RPA job not found.")

    if job.status not in (RPAJobStatus.PENDING, RPAJobStatus.PAUSED):
        raise ApplicationError(f"Cannot start job in '{job.status}' status.")

    job.status = RPAJobStatus.RUNNING
    job.started_at = job.started_at or timezone.now()
    job.save(update_fields=["status", "started_at", "updated_at"])

    # Dispatch to Celery
    from .tasks import execute_rpa_job

    result = execute_rpa_job.delay(str(job.id))
    job.celery_task_id = result.id
    job.save(update_fields=["celery_task_id", "updated_at"])

    logger.info("Started RPA job %s (celery task: %s)", job.id, result.id)
    return job


@transaction.atomic
def pause_rpa_job(*, job_id) -> RPAJob:
    """Pause a running job (will stop after current step completes)."""
    try:
        job = RPAJob.objects.select_for_update().get(id=job_id)
    except RPAJob.DoesNotExist:
        raise ApplicationError("RPA job not found.")

    if job.status != RPAJobStatus.RUNNING:
        raise ApplicationError("Can only pause running jobs.")

    job.status = RPAJobStatus.PAUSED
    job.save(update_fields=["status", "updated_at"])
    logger.info("Paused RPA job %s", job.id)
    return job


@transaction.atomic
def resume_rpa_job(*, job_id) -> RPAJob:
    """Resume a paused job."""
    try:
        job = RPAJob.objects.select_for_update().get(id=job_id)
    except RPAJob.DoesNotExist:
        raise ApplicationError("RPA job not found.")

    if job.status != RPAJobStatus.PAUSED:
        raise ApplicationError("Can only resume paused jobs.")

    return start_rpa_job(job_id=job_id)


@transaction.atomic
def retry_rpa_job(*, job_id) -> RPAJob:
    """Retry a failed job from the failed step."""
    try:
        job = RPAJob.objects.select_for_update().get(id=job_id)
    except RPAJob.DoesNotExist:
        raise ApplicationError("RPA job not found.")

    if job.status != RPAJobStatus.FAILED:
        raise ApplicationError("Can only retry failed jobs.")

    if job.retry_count >= job.max_retries:
        raise ApplicationError("Maximum retries exceeded.")

    job.retry_count += 1
    job.error_message = ""
    job.save(update_fields=["retry_count", "error_message", "updated_at"])

    # Reset the failed step to pending
    failed_steps = job.steps.filter(status=RPAStepStatus.FAILED)
    failed_steps.update(status=RPAStepStatus.PENDING, error_message="")

    return start_rpa_job(job_id=job_id)


def get_job_progress(*, job_id) -> dict:
    """Return step completion progress for an RPA job."""
    from django.db.models import Count, Q

    job = RPAJob.objects.get(id=job_id)
    total = job.steps.count()
    completed = job.steps.filter(status=RPAStepStatus.COMPLETED).count()
    return {"total": total, "completed": completed}


@transaction.atomic
def cancel_rpa_job(*, job_id) -> RPAJob:
    """Cancel a pending or running job."""
    try:
        job = RPAJob.objects.select_for_update().get(id=job_id)
    except RPAJob.DoesNotExist:
        raise ApplicationError("RPA job not found.")

    if job.status in (RPAJobStatus.COMPLETED, RPAJobStatus.CANCELLED):
        raise ApplicationError(f"Cannot cancel job in '{job.status}' status.")

    job.status = RPAJobStatus.CANCELLED
    job.completed_at = timezone.now()
    job.save(update_fields=["status", "completed_at", "updated_at"])

    # Cancel pending steps
    job.steps.filter(
        status__in=[RPAStepStatus.PENDING, RPAStepStatus.RUNNING]
    ).update(status=RPAStepStatus.SKIPPED)

    # Revoke Celery task if running
    if job.celery_task_id:
        from celery import current_app

        current_app.control.revoke(job.celery_task_id)

    logger.info("Cancelled RPA job %s", job.id)
    return job
