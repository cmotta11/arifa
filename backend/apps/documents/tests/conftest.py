import pytest
from rest_framework.test import APIClient

from apps.authentication.models import User
from apps.authentication.tests.factories import UserFactory
from apps.core.tests.factories import ClientFactory
from apps.workflow.models import Ticket, WorkflowState

from .factories import DocumentTemplateFactory, GeneratedDocumentFactory


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return UserFactory(email="docuser@example.com")


@pytest.fixture
def authenticated_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def workflow_state(db):
    state, _ = WorkflowState.objects.get_or_create(
        name="Initial",
        defaults={"order_index": 0, "is_initial": True, "is_final": False},
    )
    return state


@pytest.fixture
def ticket(db, workflow_state, user):
    client_obj = ClientFactory()
    return Ticket.objects.create(
        title="Test Ticket",
        client=client_obj,
        current_state=workflow_state,
        created_by=user,
    )


@pytest.fixture
def template(db):
    return DocumentTemplateFactory()


@pytest.fixture
def generated_document(db, ticket, template, user):
    return GeneratedDocumentFactory(
        ticket=ticket,
        template=template,
        generated_by=user,
    )
