from django.conf import settings
from django.db import models

from common.base_model import TimeStampedModel

from .constants import TicketPriority, WorkflowCategory


class WorkflowDefinition(TimeStampedModel):
    """A named workflow template (e.g. INC_PANAMA, COMPLIANCE_KYC)."""

    name = models.CharField(max_length=100, unique=True)
    display_name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    jurisdiction = models.ForeignKey(
        "compliance.JurisdictionRisk",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="workflow_definitions",
    )
    category = models.CharField(
        max_length=20,
        choices=WorkflowCategory.choices,
        default=WorkflowCategory.CUSTOM,
    )
    is_active = models.BooleanField(default=True)
    config = models.JSONField(default=dict, blank=True)

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Workflow Definition"
        verbose_name_plural = "Workflow Definitions"

    def __str__(self):
        return f"{self.display_name} ({self.name})"


class WorkflowState(TimeStampedModel):
    name = models.CharField(max_length=100)
    workflow_definition = models.ForeignKey(
        WorkflowDefinition,
        on_delete=models.CASCADE,
        related_name="states",
        null=True,
        blank=True,
    )
    order_index = models.IntegerField()
    is_initial = models.BooleanField(default=False)
    is_final = models.BooleanField(default=False)
    color = models.CharField(max_length=7, blank=True, default="#6B7280")
    auto_transition_hours = models.IntegerField(
        null=True,
        blank=True,
        help_text="Automatically transition after N hours (null = disabled)",
    )
    required_fields = models.JSONField(
        default=list,
        blank=True,
        help_text="Fields required before entering this state",
    )
    on_enter_actions = models.JSONField(
        default=list,
        blank=True,
        help_text="Actions to trigger when entering this state",
    )

    class Meta:
        ordering = ["order_index"]
        verbose_name = "Workflow State"
        verbose_name_plural = "Workflow States"
        constraints = [
            models.UniqueConstraint(
                fields=["workflow_definition", "name"],
                name="unique_state_per_workflow",
            )
        ]

    def __str__(self):
        prefix = f"[{self.workflow_definition.name}] " if self.workflow_definition else ""
        return f"{prefix}{self.name}"


class WorkflowTransition(TimeStampedModel):
    from_state = models.ForeignKey(
        WorkflowState,
        on_delete=models.CASCADE,
        related_name="outgoing_transitions",
    )
    to_state = models.ForeignKey(
        WorkflowState,
        on_delete=models.CASCADE,
        related_name="incoming_transitions",
    )
    allowed_roles = models.JSONField(default=list)
    name = models.CharField(max_length=255)

    class Meta:
        unique_together = [("from_state", "to_state")]
        verbose_name = "Workflow Transition"
        verbose_name_plural = "Workflow Transitions"

    def __str__(self):
        return f"{self.name} ({self.from_state} -> {self.to_state})"


class Ticket(TimeStampedModel):
    title = models.CharField(max_length=255)
    client = models.ForeignKey(
        "core.Client",
        on_delete=models.CASCADE,
        related_name="tickets",
    )
    entity = models.ForeignKey(
        "core.Entity",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tickets",
    )
    current_state = models.ForeignKey(
        WorkflowState,
        on_delete=models.PROTECT,
        related_name="tickets",
    )
    workflow_definition = models.ForeignKey(
        WorkflowDefinition,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tickets",
    )
    parent_ticket = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sub_tickets",
    )
    jurisdiction = models.ForeignKey(
        "compliance.JurisdictionRisk",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tickets",
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_tickets",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_tickets",
    )
    priority = models.CharField(
        max_length=20,
        choices=TicketPriority.choices,
        default=TicketPriority.MEDIUM,
    )
    due_date = models.DateField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Ticket"
        verbose_name_plural = "Tickets"
        indexes = [
            models.Index(fields=["current_state"], name="ticket_current_state_idx"),
            models.Index(fields=["assigned_to"], name="ticket_assigned_to_idx"),
            models.Index(fields=["client"], name="ticket_client_idx"),
            models.Index(fields=["entity"], name="ticket_entity_idx"),
        ]

    def __str__(self):
        return f"{self.title} [{self.current_state}]"


class TicketLog(TimeStampedModel):
    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.CASCADE,
        related_name="logs",
    )
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ticket_log_entries",
    )
    previous_state = models.ForeignKey(
        WorkflowState,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    new_state = models.ForeignKey(
        WorkflowState,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    comment = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Ticket Log"
        verbose_name_plural = "Ticket Logs"

    def __str__(self):
        return f"Log for {self.ticket} at {self.created_at}"
