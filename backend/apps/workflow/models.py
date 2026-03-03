from django.conf import settings
from django.db import models

from common.base_model import TimeStampedModel

from .constants import TicketPriority


class WorkflowState(TimeStampedModel):
    name = models.CharField(max_length=100, unique=True)
    order_index = models.IntegerField()
    is_initial = models.BooleanField(default=False)
    is_final = models.BooleanField(default=False)

    class Meta:
        ordering = ["order_index"]
        verbose_name = "Workflow State"
        verbose_name_plural = "Workflow States"

    def __str__(self):
        return self.name


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

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Ticket"
        verbose_name_plural = "Tickets"

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
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]
        verbose_name = "Ticket Log"
        verbose_name_plural = "Ticket Logs"

    def __str__(self):
        return f"Log for {self.ticket} at {self.timestamp}"
