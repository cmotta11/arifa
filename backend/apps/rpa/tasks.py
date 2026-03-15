"""Celery tasks for RPA job execution.

Tasks are routed to the dedicated ``rpa`` queue via CELERY_TASK_ROUTES.
"""

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=0, queue="rpa")
def execute_rpa_job(self, job_id: str):
    """Execute an RPA job on the dedicated rpa worker.

    This task runs with concurrency=1 on the celery-rpa worker,
    ensuring sequential execution of RPA operations.
    """
    from .executor import RPAExecutor

    logger.info("Starting RPA job execution: %s", job_id)

    executor = RPAExecutor()
    job = executor.execute(job_id)

    logger.info("RPA job %s finished with status: %s", job_id, job.status)
    return {"job_id": job_id, "status": job.status}
