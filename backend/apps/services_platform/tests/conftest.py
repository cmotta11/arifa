import pytest

from apps.authentication.tests.factories import UserFactory
from apps.core.tests.factories import ClientFactory

from .factories import ServiceCatalogFactory, ServiceRequestFactory


@pytest.fixture
def user():
    return UserFactory()


@pytest.fixture
def client_obj():
    return ClientFactory()
