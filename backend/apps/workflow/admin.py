from django.contrib import admin

from .models import Ticket, TicketLog, WorkflowState, WorkflowTransition


@admin.register(WorkflowState)
class WorkflowStateAdmin(admin.ModelAdmin):
    list_display = ["name", "order_index", "is_initial", "is_final"]
    list_filter = ["is_initial", "is_final"]
    ordering = ["order_index"]
    readonly_fields = ["id", "created_at", "updated_at"]


@admin.register(WorkflowTransition)
class WorkflowTransitionAdmin(admin.ModelAdmin):
    list_display = ["name", "from_state", "to_state", "allowed_roles"]
    list_filter = ["from_state", "to_state"]
    search_fields = ["name"]
    readonly_fields = ["id", "created_at", "updated_at"]
    raw_id_fields = ["from_state", "to_state"]


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = [
        "title",
        "client",
        "current_state",
        "assigned_to",
        "priority",
        "due_date",
        "created_by",
        "created_at",
    ]
    list_filter = ["current_state", "priority"]
    search_fields = ["title", "client__name"]
    readonly_fields = ["id", "created_at", "updated_at"]
    raw_id_fields = ["client", "entity", "current_state", "assigned_to", "created_by"]


@admin.register(TicketLog)
class TicketLogAdmin(admin.ModelAdmin):
    list_display = [
        "ticket",
        "changed_by",
        "previous_state",
        "new_state",
        "timestamp",
    ]
    list_filter = ["previous_state", "new_state"]
    search_fields = ["ticket__title", "comment"]
    readonly_fields = ["id", "created_at", "updated_at", "timestamp"]
    raw_id_fields = ["ticket", "changed_by", "previous_state", "new_state"]
