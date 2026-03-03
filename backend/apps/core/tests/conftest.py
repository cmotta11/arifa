import pytest
from rest_framework.test import APIClient

from apps.authentication.models import User

from .factories import ClientFactory, EntityFactory, MatterFactory, PersonFactory


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email="testuser@example.com",
        password="testpassword123",
    )


@pytest.fixture
def authenticated_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def client_obj(db):
    return ClientFactory()


@pytest.fixture
def entity(db, client_obj):
    return EntityFactory(client=client_obj)


@pytest.fixture
def matter(db, client_obj, entity):
    return MatterFactory(client=client_obj, entity=entity)


@pytest.fixture
def person(db):
    return PersonFactory()
