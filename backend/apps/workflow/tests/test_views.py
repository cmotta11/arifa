import pytest
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.constants import COMPLIANCE_OFFICER, COORDINATOR
from apps.workflow.models import TicketLog

from .factories import (
    ClientFactory,
    TicketFactory,
    TicketLogFactory,
    UserFactory,
    WorkflowStateFactory,
    WorkflowTransitionFactory,
)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def authenticated_client(api_client, coordinator):
    api_client.force_authenticate(user=coordinator)
    return api_client


class TestTicketViewSetList:
    def test_list_tickets_authenticated(self, authenticated_client, ticket):
        response = authenticated_client.get("/api/v1/workflow/tickets/")
        assert response.status_code == status.HTTP_200_OK

    def test_list_tickets_unauthenticated(self, api_client):
        response = api_client.get("/api/v1/workflow/tickets/")
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )


class TestTicketViewSetCreate:
    def test_create_ticket(self, authenticated_client, initial_state, client_record):
        payload = {
            "title": "New Incorporation",
            "client_id": str(client_record.id),
            "priority": "high",
        }
        response = authenticated_client.post(
            "/api/v1/workflow/tickets/", data=payload, format="json"
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["title"] == "New Incorporation"
        assert response.data["current_state"]["name"] == initial_state.name
        assert response.data["priority"] == "high"

    def test_create_ticket_with_defaults(
        self, authenticated_client, initial_state, client_record
    ):
        payload = {
            "title": "Default Priority Ticket",
            "client_id": str(client_record.id),
        }
        response = authenticated_client.post(
            "/api/v1/workflow/tickets/", data=payload, format="json"
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["priority"] == "medium"

    def test_create_ticket_missing_title(
        self, authenticated_client, initial_state, client_record
    ):
        payload = {
            "client_id": str(client_record.id),
        }
        response = authenticated_client.post(
            "/api/v1/workflow/tickets/", data=payload, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestTicketViewSetRetrieve:
    def test_retrieve_ticket(self, authenticated_client, ticket):
        response = authenticated_client.get(
            f"/api/v1/workflow/tickets/{ticket.id}/"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == str(ticket.id)
        assert response.data["title"] == ticket.title


class TestTicketViewSetTransition:
    def test_transition_ticket(
        self,
        authenticated_client,
        ticket,
        forward_transition,
    ):
        review_state = forward_transition.to_state
        payload = {
            "new_state_id": str(review_state.id),
            "comment": "Sending to compliance",
        }
        response = authenticated_client.post(
            f"/api/v1/workflow/tickets/{ticket.id}/transition/",
            data=payload,
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["current_state"]["id"] == str(review_state.id)

    def test_transition_ticket_invalid(
        self, authenticated_client, ticket, completed_state
    ):
        payload = {
            "new_state_id": str(completed_state.id),
        }
        response = authenticated_client.post(
            f"/api/v1/workflow/tickets/{ticket.id}/transition/",
            data=payload,
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_transition_unauthorized_role(
        self, api_client, ticket, forward_transition
    ):
        """A compliance officer should not be able to perform a coordinator-only transition."""
        co = UserFactory(role=COMPLIANCE_OFFICER)
        api_client.force_authenticate(user=co)
        review_state = forward_transition.to_state
        payload = {
            "new_state_id": str(review_state.id),
        }
        response = api_client.post(
            f"/api/v1/workflow/tickets/{ticket.id}/transition/",
            data=payload,
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestTicketViewSetAssign:
    def test_assign_ticket(self, authenticated_client, ticket):
        assignee = UserFactory()
        payload = {"assigned_to_id": str(assignee.id)}
        response = authenticated_client.post(
            f"/api/v1/workflow/tickets/{ticket.id}/assign/",
            data=payload,
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["assigned_to"]["id"] == str(assignee.id)

    def test_assign_ticket_nonexistent_user(self, authenticated_client, ticket):
        import uuid

        payload = {"assigned_to_id": str(uuid.uuid4())}
        response = authenticated_client.post(
            f"/api/v1/workflow/tickets/{ticket.id}/assign/",
            data=payload,
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestTicketViewSetLogs:
    def test_get_ticket_logs(self, authenticated_client, ticket):
        TicketLogFactory(ticket=ticket, comment="First action")
        TicketLogFactory(ticket=ticket, comment="Second action")
        response = authenticated_client.get(
            f"/api/v1/workflow/tickets/{ticket.id}/logs/"
        )
        assert response.status_code == status.HTTP_200_OK
        # Paginated response contains results key
        results = response.data.get("results", response.data)
        assert len(results) == 2


class TestTicketViewSetTransitions:
    def test_get_available_transitions(
        self, authenticated_client, ticket, forward_transition, reject_transition
    ):
        response = authenticated_client.get(
            f"/api/v1/workflow/tickets/{ticket.id}/transitions/"
        )
        assert response.status_code == status.HTTP_200_OK
        # Coordinator should see both forward and reject transitions
        assert len(response.data) == 2
        names = {t["name"] for t in response.data}
        assert "Enviar a Compliance" in names
        assert "Rechazar desde Recibido" in names


class TestWorkflowStateViewSet:
    def test_list_states(self, authenticated_client):
        WorkflowStateFactory(name="State A", order_index=1)
        WorkflowStateFactory(name="State B", order_index=2)
        response = authenticated_client.get("/api/v1/workflow/states/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 2

    def test_retrieve_state(self, authenticated_client):
        state = WorkflowStateFactory(name="Recibido", order_index=1)
        response = authenticated_client.get(
            f"/api/v1/workflow/states/{state.id}/"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "Recibido"

    def test_states_readonly(self, authenticated_client):
        response = authenticated_client.post(
            "/api/v1/workflow/states/",
            data={"name": "New State", "order_index": 99},
            format="json",
        )
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED


class TestWorkflowTransitionViewSet:
    def test_list_transitions(self, authenticated_client, forward_transition):
        response = authenticated_client.get("/api/v1/workflow/transitions/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 1

    def test_retrieve_transition(self, authenticated_client, forward_transition):
        response = authenticated_client.get(
            f"/api/v1/workflow/transitions/{forward_transition.id}/"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == forward_transition.name
        assert "from_state_name" in response.data
        assert "to_state_name" in response.data

    def test_transitions_readonly(self, authenticated_client):
        response = authenticated_client.post(
            "/api/v1/workflow/transitions/",
            data={"name": "New Transition"},
            format="json",
        )
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
