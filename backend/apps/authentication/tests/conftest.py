import pytest

from apps.authentication.constants import (
    COMPLIANCE_OFFICER,
    COORDINATOR,
    DIRECTOR,
    GESTORA,
)
from apps.authentication.tests.factories import UserFactory


@pytest.fixture
def coordinator_user():
    return UserFactory(role=COORDINATOR)


@pytest.fixture
def compliance_officer_user():
    return UserFactory(role=COMPLIANCE_OFFICER)


@pytest.fixture
def gestora_user():
    return UserFactory(role=GESTORA)


@pytest.fixture
def director_user():
    return UserFactory(role=DIRECTOR)


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient

    return APIClient()


@pytest.fixture
def authenticated_client(coordinator_user, api_client):
    api_client.force_authenticate(user=coordinator_user)
    return api_client
