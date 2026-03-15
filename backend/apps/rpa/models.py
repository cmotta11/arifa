import uuid

from django.conf import settings
from django.db import models

from common.base_model import TimeStampedModel


class RPAJobStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    RUNNING = "running", "Running"
    PAUSED = "paused", "Paused"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"
    CANCELLED = "cancelled", "Cancelled"


class RPAStepStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    RUNNING = "running", "Running"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"
    SKIPPED = "skipped", "Skipped"


class TargetIntegration(models.TextChoices):
    ADERANT_SOAP = "aderant_soap", "Aderant SOAP"
    ADERANT_REST = "aderant_rest", "Aderant REST"
    SHAREPOINT = "sharepoint", "SharePoint"
    WORLDCHECK = "worldcheck", "World-Check"
    INTERNAL = "internal", "Internal"


class RPAJobDefinition(TimeStampedModel):
    """Template for an RPA job — defines steps and required inputs."""

    name = models.CharField(max_length=100, unique=True)
    display_name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    step_definitions = models.JSONField(
        default=list,
        help_text="Ordered list of step configs: [{name, action, config}]",
    )
    required_input_fields = models.JSONField(
        default=list,
        help_text="List of input field names required to run this job.",
    )
    target_integration = models.CharField(
        max_length=20,
        choices=TargetIntegration.choices,
        default=TargetIntegration.ADERANT_SOAP,
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.display_name


class RPAJob(TimeStampedModel):
    """A single execution of an RPA job definition."""

    definition = models.ForeignKey(
        RPAJobDefinition,
        on_delete=models.CASCADE,
        related_name="jobs",
    )
    ticket = models.ForeignKey(
        "workflow.Ticket",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="rpa_jobs",
    )
    entity = models.ForeignKey(
        "core.Entity",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="rpa_jobs",
    )
    status = models.CharField(
        max_length=20,
        choices=RPAJobStatus.choices,
        default=RPAJobStatus.PENDING,
    )
    input_data = models.JSONField(default=dict)
    output_data = models.JSONField(default=dict)
    error_message = models.TextField(blank=True)
    celery_task_id = models.CharField(max_length=255, blank=True)
    retry_count = models.PositiveIntegerField(default=0)
    max_retries = models.PositiveIntegerField(default=3)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="rpa_jobs_created",
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.definition.display_name} [{self.status}]"


class RPAJobStep(TimeStampedModel):
    """A single step within an RPA job execution."""

    job = models.ForeignKey(
        RPAJob,
        on_delete=models.CASCADE,
        related_name="steps",
    )
    step_name = models.CharField(max_length=100)
    order_index = models.PositiveIntegerField()
    action = models.CharField(max_length=100, blank=True)
    config = models.JSONField(default=dict)
    status = models.CharField(
        max_length=20,
        choices=RPAStepStatus.choices,
        default=RPAStepStatus.PENDING,
    )
    input_data = models.JSONField(default=dict)
    output_data = models.JSONField(default=dict)
    error_message = models.TextField(blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["order_index"]
        constraints = [
            models.UniqueConstraint(
                fields=["job", "order_index"],
                name="unique_rpa_step_order",
            ),
        ]

    def __str__(self):
        return f"Step {self.order_index}: {self.step_name} [{self.status}]"
