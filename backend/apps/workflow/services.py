from django.db import transaction

from common.exceptions import ApplicationError

from .models import Ticket, TicketLog, WorkflowState, WorkflowTransition


@transaction.atomic
def create_ticket(
    *,
    title: str,
    client_id,
    created_by,
    **kwargs,
) -> Ticket:
    """Create a new ticket and set its initial workflow state.

    The initial state is the WorkflowState with ``is_initial=True``.
    An initial TicketLog entry is created to record the ticket creation.
    """
    try:
        initial_state = WorkflowState.objects.get(is_initial=True)
    except WorkflowState.DoesNotExist:
        raise ApplicationError(
            "No initial workflow state has been configured. "
            "Please run the seed_workflow_states management command."
        )
    except WorkflowState.MultipleObjectsReturned:
        raise ApplicationError(
            "Multiple initial workflow states found. "
            "Exactly one state must be marked as initial."
        )

    ticket = Ticket.objects.create(
        title=title,
        client_id=client_id,
        created_by=created_by,
        current_state=initial_state,
        **kwargs,
    )

    TicketLog.objects.create(
        ticket=ticket,
        changed_by=created_by,
        previous_state=None,
        new_state=initial_state,
        comment="Ticket created.",
    )

    return ticket


@transaction.atomic
def transition_ticket(
    *,
    ticket_id,
    new_state_id,
    changed_by,
    comment: str = "",
) -> Ticket:
    """Move a ticket from its current state to a new state.

    Validates that:
    1. A WorkflowTransition exists from the current state to the target state.
    2. The ``changed_by`` user's role is included in the transition's
       ``allowed_roles``.

    Raises ``ApplicationError`` when the transition is invalid or the user
    is not authorized for the transition.
    """
    try:
        ticket = Ticket.objects.select_related("current_state").get(id=ticket_id)
    except Ticket.DoesNotExist:
        raise ApplicationError("Ticket not found.")

    try:
        new_state = WorkflowState.objects.get(id=new_state_id)
    except WorkflowState.DoesNotExist:
        raise ApplicationError("Target workflow state not found.")

    try:
        transition = WorkflowTransition.objects.get(
            from_state=ticket.current_state,
            to_state=new_state,
        )
    except WorkflowTransition.DoesNotExist:
        raise ApplicationError(
            f"No valid transition from '{ticket.current_state.name}' "
            f"to '{new_state.name}'."
        )

    user_role = getattr(changed_by, "role", None)
    if transition.allowed_roles and user_role not in transition.allowed_roles:
        raise ApplicationError(
            f"User with role '{user_role}' is not authorized for "
            f"the transition '{transition.name}'."
        )

    previous_state = ticket.current_state
    ticket.current_state = new_state
    ticket.save(update_fields=["current_state", "updated_at"])

    TicketLog.objects.create(
        ticket=ticket,
        changed_by=changed_by,
        previous_state=previous_state,
        new_state=new_state,
        comment=comment,
    )

    return ticket


@transaction.atomic
def assign_ticket(
    *,
    ticket_id,
    assigned_to_id,
    changed_by,
) -> Ticket:
    """Assign a ticket to a user.

    Creates a TicketLog entry to record the assignment change.
    """
    try:
        ticket = Ticket.objects.select_related("current_state").get(id=ticket_id)
    except Ticket.DoesNotExist:
        raise ApplicationError("Ticket not found.")

    from django.conf import settings
    from django.apps import apps

    UserModel = apps.get_model(settings.AUTH_USER_MODEL)

    try:
        assigned_to = UserModel.objects.get(id=assigned_to_id)
    except UserModel.DoesNotExist:
        raise ApplicationError("Assignee user not found.")

    ticket.assigned_to = assigned_to
    ticket.save(update_fields=["assigned_to", "updated_at"])

    TicketLog.objects.create(
        ticket=ticket,
        changed_by=changed_by,
        previous_state=ticket.current_state,
        new_state=ticket.current_state,
        comment=f"Ticket assigned to {assigned_to.email}.",
    )

    return ticket
