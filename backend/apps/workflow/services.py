from django.db import transaction
from django.db.models import Count

from common.exceptions import ApplicationError

from .models import Ticket, TicketLog, WorkflowDefinition, WorkflowState, WorkflowTransition


@transaction.atomic
def create_ticket(
    *,
    title: str,
    client_id,
    created_by,
    workflow_definition_id=None,
    **kwargs,
) -> Ticket:
    """Create a new ticket and set its initial workflow state.

    If ``workflow_definition_id`` is provided, the initial state is found
    within that definition.  Otherwise falls back to a global initial state.
    """
    state_qs = WorkflowState.objects.filter(is_initial=True)

    if workflow_definition_id:
        state_qs = state_qs.filter(workflow_definition_id=workflow_definition_id)

    initial_states = list(state_qs[:2])

    if not initial_states:
        raise ApplicationError(
            "No initial workflow state found. "
            "Please run the seed_workflows management command."
        )
    if len(initial_states) > 1:
        raise ApplicationError(
            "Multiple initial states found for this workflow. "
            "Exactly one state should be marked as initial."
        )

    initial_state = initial_states[0]

    ticket = Ticket.objects.create(
        title=title,
        client_id=client_id,
        created_by=created_by,
        current_state=initial_state,
        workflow_definition_id=workflow_definition_id or initial_state.workflow_definition_id,
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


# ---------------------------------------------------------------------------
# Update services (P1-09: service layer for view updates)
# ---------------------------------------------------------------------------


@transaction.atomic
def update_workflow_state(*, state_id, **data) -> WorkflowState:
    state = WorkflowState.objects.get(id=state_id)
    for attr, value in data.items():
        setattr(state, attr, value)
    update_fields = list(data.keys())
    if update_fields:
        update_fields.append("updated_at")
        state.save(update_fields=update_fields)
    return state


@transaction.atomic
def clone_workflow_for_jurisdiction(
    *,
    source_definition_id,
    new_name: str,
    new_display_name: str,
    jurisdiction_id=None,
) -> WorkflowDefinition:
    """Clone a workflow definition including all its states and transitions."""
    try:
        source = WorkflowDefinition.objects.get(id=source_definition_id)
    except WorkflowDefinition.DoesNotExist:
        raise ApplicationError("Source workflow definition not found.")

    if WorkflowDefinition.objects.filter(name=new_name).exists():
        raise ApplicationError(f"A workflow definition with name '{new_name}' already exists.")

    cloned_def = WorkflowDefinition.objects.create(
        name=new_name,
        display_name=new_display_name,
        description=source.description,
        jurisdiction_id=jurisdiction_id or source.jurisdiction_id,
        category=source.category,
        is_active=True,
        config=source.config,
    )

    # Clone states and build ID mapping
    state_map = {}
    for state in source.states.all().order_by("order_index"):
        old_id = state.id
        new_state = WorkflowState.objects.create(
            name=state.name,
            workflow_definition=cloned_def,
            order_index=state.order_index,
            is_initial=state.is_initial,
            is_final=state.is_final,
            color=state.color,
            auto_transition_hours=state.auto_transition_hours,
            required_fields=state.required_fields,
            on_enter_actions=state.on_enter_actions,
        )
        state_map[old_id] = new_state

    # Clone transitions
    from .models import WorkflowTransition as WFT

    for trans in WFT.objects.filter(from_state__workflow_definition=source):
        if trans.from_state_id in state_map and trans.to_state_id in state_map:
            WFT.objects.create(
                from_state=state_map[trans.from_state_id],
                to_state=state_map[trans.to_state_id],
                name=trans.name,
                allowed_roles=trans.allowed_roles,
            )

    return cloned_def


@transaction.atomic
def spawn_sub_ticket(
    *,
    parent_ticket_id,
    created_by,
    title: str,
    workflow_definition_id,
    priority: str = "medium",
    assigned_to_id=None,
    metadata=None,
) -> Ticket:
    """Create a sub-ticket linked to a parent ticket."""
    try:
        parent = Ticket.objects.select_related("client", "entity", "jurisdiction").get(
            id=parent_ticket_id,
        )
    except Ticket.DoesNotExist:
        raise ApplicationError("Parent ticket not found.")

    kwargs = {
        "parent_ticket_id": parent_ticket_id,
        "entity_id": parent.entity_id,
        "jurisdiction_id": parent.jurisdiction_id,
        "priority": priority,
    }
    if assigned_to_id:
        kwargs["assigned_to_id"] = assigned_to_id
    if metadata:
        kwargs["metadata"] = metadata

    return create_ticket(
        title=title,
        client_id=parent.client_id,
        created_by=created_by,
        workflow_definition_id=workflow_definition_id,
        **kwargs,
    )


@transaction.atomic
def bulk_transition(
    *,
    ticket_ids: list,
    new_state_id,
    changed_by,
    comment: str = "",
) -> list[Ticket]:
    """Transition multiple tickets to a new state."""
    results = []
    for ticket_id in ticket_ids:
        ticket = transition_ticket(
            ticket_id=ticket_id,
            new_state_id=new_state_id,
            changed_by=changed_by,
            comment=comment,
        )
        results.append(ticket)
    return results


def auto_assign_ticket(*, ticket_id) -> Ticket:
    """Auto-assign a ticket to the least-loaded user with the appropriate role."""
    from django.apps import apps
    from django.conf import settings as django_settings
    from django.db.models import Count

    try:
        ticket = Ticket.objects.select_related("current_state").get(id=ticket_id)
    except Ticket.DoesNotExist:
        raise ApplicationError("Ticket not found.")

    UserModel = apps.get_model(django_settings.AUTH_USER_MODEL)

    # Find active non-client users, ordered by assigned ticket count
    candidates = (
        UserModel.objects.filter(is_active=True)
        .exclude(role="client")
        .annotate(ticket_count=Count("assigned_tickets"))
        .order_by("ticket_count")
    )

    if not candidates.exists():
        raise ApplicationError("No available users to assign.")

    least_loaded = candidates.first()
    ticket.assigned_to = least_loaded
    ticket.save(update_fields=["assigned_to", "updated_at"])
    return ticket


@transaction.atomic
def update_workflow_transition(*, transition_id, **data) -> WorkflowTransition:
    transition = WorkflowTransition.objects.get(id=transition_id)
    for attr, value in data.items():
        setattr(transition, attr, value)
    update_fields = list(data.keys())
    if update_fields:
        update_fields.append("updated_at")
        transition.save(update_fields=update_fields)
    return transition
