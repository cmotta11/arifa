import pytest

from apps.workflow.models import Ticket, TicketLog, WorkflowState, WorkflowTransition

from .factories import (
    ClientFactory,
    TicketFactory,
    TicketLogFactory,
    UserFactory,
    WorkflowStateFactory,
    WorkflowTransitionFactory,
)


class TestWorkflowState:
    def test_str_returns_name(self):
        state = WorkflowStateFactory(name="Recibido")
        assert str(state) == "Recibido"

    def test_ordering_by_order_index(self):
        state_b = WorkflowStateFactory(name="B", order_index=2)
        state_a = WorkflowStateFactory(name="A", order_index=1)
        state_c = WorkflowStateFactory(name="C", order_index=3)

        states = list(WorkflowState.objects.all())
        assert states[0].name == "A"
        assert states[1].name == "B"
        assert states[2].name == "C"

    def test_unique_name_constraint(self):
        WorkflowStateFactory(name="Unique State")
        with pytest.raises(Exception):
            WorkflowStateFactory(name="Unique State")

    def test_is_initial_default_false(self):
        state = WorkflowStateFactory()
        assert state.is_initial is False

    def test_is_final_default_false(self):
        state = WorkflowStateFactory()
        assert state.is_final is False


class TestWorkflowTransition:
    def test_str_representation(self):
        state_a = WorkflowStateFactory(name="From")
        state_b = WorkflowStateFactory(name="To")
        transition = WorkflowTransitionFactory(
            from_state=state_a,
            to_state=state_b,
            name="Move Forward",
        )
        assert "Move Forward" in str(transition)
        assert "From" in str(transition)
        assert "To" in str(transition)

    def test_unique_together_constraint(self):
        state_a = WorkflowStateFactory()
        state_b = WorkflowStateFactory()
        WorkflowTransitionFactory(from_state=state_a, to_state=state_b)
        with pytest.raises(Exception):
            WorkflowTransitionFactory(from_state=state_a, to_state=state_b)

    def test_allowed_roles_defaults_to_empty_list(self):
        state_a = WorkflowStateFactory()
        state_b = WorkflowStateFactory()
        transition = WorkflowTransition.objects.create(
            from_state=state_a,
            to_state=state_b,
            name="Test",
        )
        assert transition.allowed_roles == []

    def test_outgoing_transitions_related_name(self):
        state_a = WorkflowStateFactory()
        state_b = WorkflowStateFactory()
        state_c = WorkflowStateFactory()
        WorkflowTransitionFactory(from_state=state_a, to_state=state_b)
        WorkflowTransitionFactory(from_state=state_a, to_state=state_c)
        assert state_a.outgoing_transitions.count() == 2

    def test_incoming_transitions_related_name(self):
        state_a = WorkflowStateFactory()
        state_b = WorkflowStateFactory()
        state_c = WorkflowStateFactory()
        WorkflowTransitionFactory(from_state=state_a, to_state=state_c)
        WorkflowTransitionFactory(from_state=state_b, to_state=state_c)
        assert state_c.incoming_transitions.count() == 2


class TestTicket:
    def test_str_representation(self, initial_state, client_record, coordinator):
        ticket = TicketFactory(
            title="Test Ticket",
            current_state=initial_state,
            client=client_record,
            created_by=coordinator,
        )
        result = str(ticket)
        assert "Test Ticket" in result
        assert "Recibido" in result

    def test_default_priority_is_medium(self, initial_state, client_record, coordinator):
        ticket = Ticket.objects.create(
            title="Default Priority",
            client=client_record,
            current_state=initial_state,
            created_by=coordinator,
        )
        assert ticket.priority == "medium"

    def test_entity_is_nullable(self, initial_state, client_record, coordinator):
        ticket = TicketFactory(
            current_state=initial_state,
            client=client_record,
            created_by=coordinator,
            entity=None,
        )
        assert ticket.entity is None

    def test_assigned_to_is_nullable(self, initial_state, client_record, coordinator):
        ticket = TicketFactory(
            current_state=initial_state,
            client=client_record,
            created_by=coordinator,
            assigned_to=None,
        )
        assert ticket.assigned_to is None

    def test_due_date_is_nullable(self, initial_state, client_record, coordinator):
        ticket = TicketFactory(
            current_state=initial_state,
            client=client_record,
            created_by=coordinator,
            due_date=None,
        )
        assert ticket.due_date is None


class TestTicketLog:
    def test_str_representation(self):
        log = TicketLogFactory()
        result = str(log)
        assert "Log for" in result

    def test_ordering_by_timestamp_desc(self, ticket):
        log1 = TicketLogFactory(ticket=ticket, comment="First")
        log2 = TicketLogFactory(ticket=ticket, comment="Second")
        logs = list(TicketLog.objects.filter(ticket=ticket))
        # Most recent first
        assert logs[0].id == log2.id
        assert logs[1].id == log1.id

    def test_logs_related_name(self, ticket):
        TicketLogFactory(ticket=ticket)
        TicketLogFactory(ticket=ticket)
        assert ticket.logs.count() == 2

    def test_comment_can_be_blank(self, ticket):
        log = TicketLogFactory(ticket=ticket, comment="")
        assert log.comment == ""

    def test_previous_state_nullable(self, ticket):
        log = TicketLogFactory(ticket=ticket, previous_state=None)
        assert log.previous_state is None
