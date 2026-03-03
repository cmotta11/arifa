import pytest

from common.exceptions import ApplicationError

from apps.authentication.constants import (
    CLIENT,
    COMPLIANCE_OFFICER,
    COORDINATOR,
    DIRECTOR,
)
from apps.workflow.models import TicketLog
from apps.workflow.services import assign_ticket, create_ticket, transition_ticket

from .factories import (
    ClientFactory,
    UserFactory,
    WorkflowStateFactory,
    WorkflowTransitionFactory,
)


class TestCreateTicket:
    def test_creates_ticket_with_initial_state(self, initial_state, coordinator):
        client = ClientFactory()
        ticket = create_ticket(
            title="New Ticket",
            client_id=client.id,
            created_by=coordinator,
        )
        assert ticket.title == "New Ticket"
        assert ticket.current_state == initial_state
        assert ticket.created_by == coordinator
        assert ticket.client == client

    def test_creates_initial_log_entry(self, initial_state, coordinator):
        client = ClientFactory()
        ticket = create_ticket(
            title="New Ticket",
            client_id=client.id,
            created_by=coordinator,
        )
        logs = TicketLog.objects.filter(ticket=ticket)
        assert logs.count() == 1
        log = logs.first()
        assert log.previous_state is None
        assert log.new_state == initial_state
        assert log.changed_by == coordinator
        assert "created" in log.comment.lower()

    def test_accepts_optional_kwargs(self, initial_state, coordinator):
        client = ClientFactory()
        assignee = UserFactory()
        ticket = create_ticket(
            title="With Options",
            client_id=client.id,
            created_by=coordinator,
            assigned_to=assignee,
            priority="high",
        )
        assert ticket.assigned_to == assignee
        assert ticket.priority == "high"

    def test_raises_error_when_no_initial_state(self, coordinator):
        client = ClientFactory()
        with pytest.raises(ApplicationError, match="No initial workflow state"):
            create_ticket(
                title="Should Fail",
                client_id=client.id,
                created_by=coordinator,
            )

    def test_raises_error_when_multiple_initial_states(self, coordinator):
        WorkflowStateFactory(name="Init 1", is_initial=True, order_index=1)
        WorkflowStateFactory(name="Init 2", is_initial=True, order_index=2)
        client = ClientFactory()
        with pytest.raises(ApplicationError, match="Multiple initial"):
            create_ticket(
                title="Should Fail",
                client_id=client.id,
                created_by=coordinator,
            )


class TestTransitionTicket:
    def test_valid_transition(self, ticket, forward_transition, coordinator):
        review_state = forward_transition.to_state
        result = transition_ticket(
            ticket_id=ticket.id,
            new_state_id=review_state.id,
            changed_by=coordinator,
            comment="Moving forward",
        )
        result.refresh_from_db()
        assert result.current_state == review_state

    def test_creates_log_entry(self, ticket, forward_transition, coordinator):
        initial_state = ticket.current_state
        review_state = forward_transition.to_state
        transition_ticket(
            ticket_id=ticket.id,
            new_state_id=review_state.id,
            changed_by=coordinator,
            comment="Moving to compliance",
        )
        log = TicketLog.objects.filter(ticket=ticket).order_by("-timestamp").first()
        assert log.previous_state == initial_state
        assert log.new_state == review_state
        assert log.changed_by == coordinator
        assert log.comment == "Moving to compliance"

    def test_raises_error_for_invalid_transition(self, ticket, completed_state):
        coordinator = ticket.created_by
        with pytest.raises(ApplicationError, match="No valid transition"):
            transition_ticket(
                ticket_id=ticket.id,
                new_state_id=completed_state.id,
                changed_by=coordinator,
            )

    def test_raises_error_for_unauthorized_role(
        self, ticket, forward_transition, compliance_officer
    ):
        review_state = forward_transition.to_state
        # forward_transition only allows COORDINATOR, not COMPLIANCE_OFFICER
        with pytest.raises(ApplicationError, match="not authorized"):
            transition_ticket(
                ticket_id=ticket.id,
                new_state_id=review_state.id,
                changed_by=compliance_officer,
            )

    def test_allows_transition_when_roles_list_empty(self, ticket):
        """When allowed_roles is empty, any role should be allowed."""
        target_state = WorkflowStateFactory(name="Open", order_index=10)
        WorkflowTransitionFactory(
            from_state=ticket.current_state,
            to_state=target_state,
            name="Open Transition",
            allowed_roles=[],
        )
        client_user = UserFactory(role=CLIENT)
        result = transition_ticket(
            ticket_id=ticket.id,
            new_state_id=target_state.id,
            changed_by=client_user,
        )
        assert result.current_state == target_state

    def test_raises_error_for_nonexistent_ticket(self):
        import uuid

        fake_state = WorkflowStateFactory()
        user = UserFactory()
        with pytest.raises(ApplicationError, match="Ticket not found"):
            transition_ticket(
                ticket_id=uuid.uuid4(),
                new_state_id=fake_state.id,
                changed_by=user,
            )

    def test_raises_error_for_nonexistent_state(self, ticket, coordinator):
        import uuid

        with pytest.raises(ApplicationError, match="Target workflow state not found"):
            transition_ticket(
                ticket_id=ticket.id,
                new_state_id=uuid.uuid4(),
                changed_by=coordinator,
            )

    def test_multiple_transitions_chain(
        self,
        ticket,
        forward_transition,
        compliance_transition,
        coordinator,
        compliance_officer,
    ):
        """Test chaining two consecutive transitions."""
        review_state = forward_transition.to_state
        in_progress_state = compliance_transition.to_state

        # First transition: coordinator moves to review
        transition_ticket(
            ticket_id=ticket.id,
            new_state_id=review_state.id,
            changed_by=coordinator,
        )
        ticket.refresh_from_db()
        assert ticket.current_state == review_state

        # Second transition: compliance officer approves
        transition_ticket(
            ticket_id=ticket.id,
            new_state_id=in_progress_state.id,
            changed_by=compliance_officer,
        )
        ticket.refresh_from_db()
        assert ticket.current_state == in_progress_state

        # Should have 2 transition logs (plus the initial creation log if it exists)
        transition_logs = TicketLog.objects.filter(ticket=ticket)
        assert transition_logs.count() >= 2

    def test_rejection_transition(self, ticket, reject_transition, coordinator):
        rejected_state = reject_transition.to_state
        result = transition_ticket(
            ticket_id=ticket.id,
            new_state_id=rejected_state.id,
            changed_by=coordinator,
            comment="Requirements incomplete",
        )
        result.refresh_from_db()
        assert result.current_state == rejected_state


class TestAssignTicket:
    def test_assigns_user_to_ticket(self, ticket, coordinator):
        assignee = UserFactory()
        result = assign_ticket(
            ticket_id=ticket.id,
            assigned_to_id=assignee.id,
            changed_by=coordinator,
        )
        assert result.assigned_to == assignee

    def test_creates_log_entry_for_assignment(self, ticket, coordinator):
        assignee = UserFactory()
        assign_ticket(
            ticket_id=ticket.id,
            assigned_to_id=assignee.id,
            changed_by=coordinator,
        )
        log = TicketLog.objects.filter(ticket=ticket).order_by("-timestamp").first()
        assert assignee.email in log.comment
        assert log.changed_by == coordinator

    def test_raises_error_for_nonexistent_ticket(self, coordinator):
        import uuid

        assignee = UserFactory()
        with pytest.raises(ApplicationError, match="Ticket not found"):
            assign_ticket(
                ticket_id=uuid.uuid4(),
                assigned_to_id=assignee.id,
                changed_by=coordinator,
            )

    def test_raises_error_for_nonexistent_assignee(self, ticket, coordinator):
        import uuid

        with pytest.raises(ApplicationError, match="Assignee user not found"):
            assign_ticket(
                ticket_id=ticket.id,
                assigned_to_id=uuid.uuid4(),
                changed_by=coordinator,
            )

    def test_reassign_ticket(self, ticket, coordinator):
        assignee_1 = UserFactory()
        assignee_2 = UserFactory()
        assign_ticket(
            ticket_id=ticket.id,
            assigned_to_id=assignee_1.id,
            changed_by=coordinator,
        )
        ticket.refresh_from_db()
        assert ticket.assigned_to == assignee_1

        assign_ticket(
            ticket_id=ticket.id,
            assigned_to_id=assignee_2.id,
            changed_by=coordinator,
        )
        ticket.refresh_from_db()
        assert ticket.assigned_to == assignee_2
