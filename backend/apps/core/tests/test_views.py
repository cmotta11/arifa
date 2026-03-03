import pytest
from django.urls import reverse
from rest_framework import status

from apps.core.constants import (
    ClientCategory,
    ClientType,
    EntityJurisdiction,
    EntityStatus,
    MatterStatus,
    PersonType,
)
from apps.core.models import Client, Entity, Matter, Person

from .factories import ClientFactory, EntityFactory, MatterFactory, PersonFactory


# ---------------------------------------------------------------------------
# Client endpoints
# ---------------------------------------------------------------------------


class TestClientViewSet:
    def test_list_clients(self, authenticated_client, db):
        ClientFactory.create_batch(3)
        url = reverse("client-list")
        response = authenticated_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 3

    def test_list_clients_unauthenticated(self, api_client, db):
        url = reverse("client-list")
        response = api_client.get(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_create_client(self, authenticated_client, db):
        url = reverse("client-list")
        data = {
            "name": "New Corp",
            "client_type": ClientType.CORPORATE,
            "category": ClientCategory.GOLD,
        }
        response = authenticated_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "New Corp"
        assert response.data["client_type"] == ClientType.CORPORATE
        assert response.data["category"] == ClientCategory.GOLD
        assert Client.objects.count() == 1

    def test_retrieve_client(self, authenticated_client, client_obj):
        url = reverse("client-detail", kwargs={"pk": client_obj.id})
        response = authenticated_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == client_obj.name

    def test_update_client(self, authenticated_client, client_obj):
        url = reverse("client-detail", kwargs={"pk": client_obj.id})
        data = {
            "name": "Updated Name",
            "client_type": ClientType.NATURAL,
            "category": ClientCategory.PLATINUM,
        }
        response = authenticated_client.put(url, data, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "Updated Name"
        assert response.data["category"] == ClientCategory.PLATINUM

    def test_partial_update_client(self, authenticated_client, client_obj):
        url = reverse("client-detail", kwargs={"pk": client_obj.id})
        response = authenticated_client.patch(
            url, {"name": "Patched"}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "Patched"

    def test_delete_client(self, authenticated_client, client_obj):
        url = reverse("client-detail", kwargs={"pk": client_obj.id})
        response = authenticated_client.delete(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert Client.objects.count() == 0

    def test_filter_clients_by_type(self, authenticated_client, db):
        ClientFactory(client_type=ClientType.NATURAL)
        ClientFactory(client_type=ClientType.CORPORATE)
        ClientFactory(client_type=ClientType.CORPORATE)
        url = reverse("client-list")
        response = authenticated_client.get(url, {"client_type": ClientType.CORPORATE})
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 2


# ---------------------------------------------------------------------------
# Entity endpoints
# ---------------------------------------------------------------------------


class TestEntityViewSet:
    def test_list_entities(self, authenticated_client, db):
        EntityFactory.create_batch(2)
        url = reverse("entity-list")
        response = authenticated_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 2

    def test_create_entity(self, authenticated_client, client_obj):
        url = reverse("entity-list")
        data = {
            "name": "BVI Holdings",
            "jurisdiction": EntityJurisdiction.BVI,
            "client_id": str(client_obj.id),
        }
        response = authenticated_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "BVI Holdings"
        assert Entity.objects.count() == 1

    def test_retrieve_entity(self, authenticated_client, entity):
        url = reverse("entity-detail", kwargs={"pk": entity.id})
        response = authenticated_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == entity.name
        # Nested client serializer
        assert "name" in response.data["client"]

    def test_update_entity(self, authenticated_client, entity):
        url = reverse("entity-detail", kwargs={"pk": entity.id})
        data = {
            "name": "Updated Entity",
            "jurisdiction": EntityJurisdiction.PANAMA,
            "client_id": str(entity.client_id),
            "status": EntityStatus.ACTIVE,
        }
        response = authenticated_client.put(url, data, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "Updated Entity"
        assert response.data["status"] == EntityStatus.ACTIVE

    def test_delete_entity(self, authenticated_client, entity):
        url = reverse("entity-detail", kwargs={"pk": entity.id})
        response = authenticated_client.delete(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert Entity.objects.count() == 0

    def test_filter_entities_by_jurisdiction(self, authenticated_client, db):
        EntityFactory(jurisdiction=EntityJurisdiction.BVI)
        EntityFactory(jurisdiction=EntityJurisdiction.PANAMA)
        url = reverse("entity-list")
        response = authenticated_client.get(
            url, {"jurisdiction": EntityJurisdiction.BVI}
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 1

    def test_filter_entities_by_client(self, authenticated_client, db):
        client = ClientFactory()
        EntityFactory(client=client)
        EntityFactory(client=client)
        EntityFactory()  # different client
        url = reverse("entity-list")
        response = authenticated_client.get(url, {"client_id": str(client.id)})
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 2


# ---------------------------------------------------------------------------
# Matter endpoints
# ---------------------------------------------------------------------------


class TestMatterViewSet:
    def test_list_matters(self, authenticated_client, db):
        MatterFactory.create_batch(3)
        url = reverse("matter-list")
        response = authenticated_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 3

    def test_create_matter(self, authenticated_client, client_obj):
        url = reverse("matter-list")
        data = {
            "client_id": str(client_obj.id),
            "description": "New incorporation matter",
        }
        response = authenticated_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["description"] == "New incorporation matter"
        assert Matter.objects.count() == 1

    def test_create_matter_with_entity(self, authenticated_client, client_obj, entity):
        url = reverse("matter-list")
        data = {
            "client_id": str(client_obj.id),
            "entity_id": str(entity.id),
            "description": "Entity-related matter",
        }
        response = authenticated_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["entity"] is not None

    def test_retrieve_matter(self, authenticated_client, matter):
        url = reverse("matter-detail", kwargs={"pk": matter.id})
        response = authenticated_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["description"] == matter.description

    def test_update_matter(self, authenticated_client, matter):
        url = reverse("matter-detail", kwargs={"pk": matter.id})
        data = {
            "client_id": str(matter.client_id),
            "description": "Updated description",
            "status": MatterStatus.CLOSED,
        }
        response = authenticated_client.put(url, data, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["description"] == "Updated description"
        assert response.data["status"] == MatterStatus.CLOSED

    def test_delete_matter(self, authenticated_client, matter):
        url = reverse("matter-detail", kwargs={"pk": matter.id})
        response = authenticated_client.delete(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert Matter.objects.count() == 0


# ---------------------------------------------------------------------------
# Person endpoints
# ---------------------------------------------------------------------------


class TestPersonViewSet:
    def test_list_persons(self, authenticated_client, db):
        PersonFactory.create_batch(3)
        url = reverse("person-list")
        response = authenticated_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 3

    def test_create_person(self, authenticated_client, db):
        url = reverse("person-list")
        data = {
            "full_name": "Alice Smith",
            "person_type": PersonType.NATURAL,
            "nationality": "American",
        }
        response = authenticated_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["full_name"] == "Alice Smith"
        assert Person.objects.count() == 1

    def test_create_person_with_client(self, authenticated_client, client_obj):
        url = reverse("person-list")
        data = {
            "full_name": "Bob Jones",
            "person_type": PersonType.CORPORATE,
            "client_id": str(client_obj.id),
        }
        response = authenticated_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["client"] is not None

    def test_retrieve_person(self, authenticated_client, person):
        url = reverse("person-detail", kwargs={"pk": person.id})
        response = authenticated_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["full_name"] == person.full_name

    def test_update_person(self, authenticated_client, person):
        url = reverse("person-detail", kwargs={"pk": person.id})
        data = {
            "full_name": "Updated Name",
            "person_type": PersonType.CORPORATE,
            "pep_status": True,
        }
        response = authenticated_client.put(url, data, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["full_name"] == "Updated Name"
        assert response.data["pep_status"] is True

    def test_delete_person(self, authenticated_client, person):
        url = reverse("person-detail", kwargs={"pk": person.id})
        response = authenticated_client.delete(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert Person.objects.count() == 0

    def test_search_persons(self, authenticated_client, db):
        PersonFactory(full_name="Alice Johnson")
        PersonFactory(full_name="Bob Smith")
        PersonFactory(full_name="Alice Williams")
        url = reverse("person-search")
        response = authenticated_client.get(url, {"q": "Alice"})
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 2

    def test_search_persons_no_query(self, authenticated_client, db):
        url = reverse("person-search")
        response = authenticated_client.get(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_search_persons_empty_results(self, authenticated_client, db):
        PersonFactory(full_name="Alice Johnson")
        url = reverse("person-search")
        response = authenticated_client.get(url, {"q": "Zebra"})
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 0

    def test_search_persons_case_insensitive(self, authenticated_client, db):
        PersonFactory(full_name="ALICE JOHNSON")
        url = reverse("person-search")
        response = authenticated_client.get(url, {"q": "alice"})
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 1
