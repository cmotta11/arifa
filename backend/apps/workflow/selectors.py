from django.db.models import Q

from apps.authentication.constants import (
    CLIENT,
    COMPLIANCE_OFFICER,
    COORDINATOR,
    DIRECTOR,
    GESTORA,
)

from .models import Ticket, TicketLog, WorkflowTransition


def _base_ticket_qs():
    """Return the base queryset with common select_related calls."""
    return Ticket.objects.select_related(
        "current_state",
        "client",
        "assigned_to",
        "created_by",
    )


def get_tickets_for_user(*, user):
    """Return tickets visible to the given user based on their role.

    - Director: all tickets
    - Coordinator: tickets they created or are assigned to
    - Compliance Officer: tickets in 'Revision Compliance' state + assigned to them
    - Gestora: tickets in 'En Proceso' state + assigned to them
    - Client: tickets where client matches their associated client
    - Default: all tickets
    """
    qs = _base_ticket_qs()
    role = getattr(user, "role", None)

    if role == DIRECTOR:
        return qs.all()

    if role == COORDINATOR:
        return qs.filter(Q(created_by=user) | Q(assigned_to=user))

    if role == COMPLIANCE_OFFICER:
        return qs.filter(
            Q(current_state__name="Revisión Compliance") | Q(assigned_to=user)
        )

    if role == GESTORA:
        return qs.filter(
            Q(current_state__name="En Proceso") | Q(assigned_to=user)
        )

    if role == CLIENT:
        return qs.filter(client_id=user.client_id)

    return qs.all()


def get_kanban_tickets(*, user, view=None):
    """Return tickets for kanban board views.

    Accepts an optional ``view`` parameter:
    - 'all': all tickets (respects role-based filtering)
    - 'my': tickets assigned to or created by the current user
    - 'gestora': tickets in 'En Proceso' state
    - 'compliance': tickets in 'Revision Compliance' state
    - 'registry': tickets in 'Registro' state
    - None/default: same as role-based filtering
    """
    qs = _base_ticket_qs()

    if view == "my":
        return qs.filter(Q(assigned_to=user) | Q(created_by=user))

    if view == "gestora":
        return qs.filter(current_state__name="En Proceso")

    if view == "compliance":
        return qs.filter(current_state__name="Revisión Compliance")

    if view == "registry":
        return qs.filter(current_state__name="Registro")

    # 'all' or default: use role-based filtering
    return get_tickets_for_user(user=user)


def get_available_transitions(*, ticket_id, user):
    """Return transitions available from the ticket's current state,
    filtered by the user's role.
    """
    try:
        ticket = Ticket.objects.select_related("current_state").get(id=ticket_id)
    except Ticket.DoesNotExist:
        return []

    transitions = WorkflowTransition.objects.select_related(
        "from_state", "to_state"
    ).filter(from_state=ticket.current_state)

    user_role = getattr(user, "role", None)
    result = []
    for transition in transitions:
        if not transition.allowed_roles or user_role in transition.allowed_roles:
            result.append(transition)
    return result


def get_ticket_logs(*, ticket_id):
    """Return all log entries for a ticket, ordered by most recent first."""
    return (
        TicketLog.objects.select_related(
            "changed_by", "previous_state", "new_state"
        )
        .filter(ticket_id=ticket_id)
        .order_by("-timestamp")
    )


def get_tickets_by_state(*, state_id):
    """Return all tickets currently in the given workflow state."""
    return (
        Ticket.objects.select_related(
            "current_state",
            "client",
            "assigned_to",
            "created_by",
        )
        .filter(current_state_id=state_id)
    )
