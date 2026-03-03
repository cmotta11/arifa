import pytest
from django.db import IntegrityError

from apps.core.constants import (
    ClientCategory,
    ClientStatus,
    ClientType,
    EntityJurisdiction,
    EntityStatus,
    MatterStatus,
    PersonType,
)
from apps.core.models import Client, Entity, Matter, Person

from .factories import ClientFactory, EntityFactory, MatterFactory, PersonFactory


class TestClientModel:
    def test_create_client(self, db):
        client = ClientFactory(
            name="Acme Corp",
            client_type=ClientType.CORPORATE,
            category=ClientCategory.GOLD,
        )
        assert client.name == "Acme Corp"
        assert client.client_type == ClientType.CORPORATE
        assert client.category == ClientCategory.GOLD
        assert client.status == ClientStatus.ACTIVE
        assert client.id is not None
        assert client.created_at is not None
        assert client.updated_at is not None

    def test_client_str(self, db):
        client = ClientFactory(name="Test Client", client_type=ClientType.NATURAL)
        assert str(client) == "Test Client (Natural)"

    def test_client_default_status(self, db):
        client = ClientFactory()
        assert client.status == ClientStatus.ACTIVE

    def test_client_default_category(self, db):
        client = Client.objects.create(
            name="Default Cat",
            client_type=ClientType.CORPORATE,
        )
        assert client.category == ClientCategory.SILVER

    def test_aderant_client_id_nullable(self, db):
        client = ClientFactory(aderant_client_id=None)
        assert client.aderant_client_id is None

    def test_aderant_client_id_unique(self, db):
        ClientFactory(aderant_client_id="ADE-001")
        with pytest.raises(IntegrityError):
            ClientFactory(aderant_client_id="ADE-001")

    def test_client_ordering(self, db):
        c1 = ClientFactory(name="First")
        c2 = ClientFactory(name="Second")
        clients = list(Client.objects.all())
        # Ordered by -created_at, so most recent first
        assert clients[0] == c2
        assert clients[1] == c1


class TestEntityModel:
    def test_create_entity(self, db):
        client = ClientFactory()
        entity = EntityFactory(
            name="BVI Holdings",
            jurisdiction=EntityJurisdiction.BVI,
            client=client,
        )
        assert entity.name == "BVI Holdings"
        assert entity.jurisdiction == EntityJurisdiction.BVI
        assert entity.client == client
        assert entity.status == EntityStatus.PENDING

    def test_entity_str(self, db):
        entity = EntityFactory(name="Panama LLC", jurisdiction=EntityJurisdiction.PANAMA)
        assert str(entity) == "Panama LLC (Panama)"

    def test_entity_cascade_delete(self, db):
        client = ClientFactory()
        EntityFactory(client=client)
        assert Entity.objects.count() == 1
        client.delete()
        assert Entity.objects.count() == 0

    def test_entity_incorporation_date_nullable(self, db):
        entity = EntityFactory(incorporation_date=None)
        assert entity.incorporation_date is None

    def test_entity_related_name(self, db):
        client = ClientFactory()
        e1 = EntityFactory(client=client)
        e2 = EntityFactory(client=client)
        assert set(client.entities.all()) == {e1, e2}


class TestMatterModel:
    def test_create_matter(self, db):
        client = ClientFactory()
        entity = EntityFactory(client=client)
        matter = MatterFactory(
            client=client,
            entity=entity,
            description="Incorporation matter",
        )
        assert matter.client == client
        assert matter.entity == entity
        assert matter.description == "Incorporation matter"
        assert matter.status == MatterStatus.OPEN
        assert matter.opened_date is not None

    def test_matter_str(self, db):
        client = ClientFactory(name="Acme")
        matter = MatterFactory(client=client, aderant_matter_id="M-100")
        assert "M-100" in str(matter)
        assert "Acme" in str(matter)

    def test_matter_entity_nullable(self, db):
        matter = MatterFactory(entity=None)
        assert matter.entity is None

    def test_matter_entity_set_null_on_delete(self, db):
        client = ClientFactory()
        entity = EntityFactory(client=client)
        matter = MatterFactory(client=client, entity=entity)
        entity.delete()
        matter.refresh_from_db()
        assert matter.entity is None

    def test_matter_cascade_on_client_delete(self, db):
        client = ClientFactory()
        MatterFactory(client=client, entity=None)
        assert Matter.objects.count() == 1
        client.delete()
        assert Matter.objects.count() == 0

    def test_matter_aderant_matter_id_unique(self, db):
        MatterFactory(aderant_matter_id="M-001")
        with pytest.raises(IntegrityError):
            MatterFactory(aderant_matter_id="M-001")


class TestPersonModel:
    def test_create_person(self, db):
        person = PersonFactory(
            full_name="John Doe",
            person_type=PersonType.NATURAL,
            nationality="American",
        )
        assert person.full_name == "John Doe"
        assert person.person_type == PersonType.NATURAL
        assert person.nationality == "American"
        assert person.pep_status is False

    def test_person_str(self, db):
        person = PersonFactory(full_name="Jane Doe", person_type=PersonType.NATURAL)
        assert str(person) == "Jane Doe (Natural)"

    def test_person_client_nullable(self, db):
        person = PersonFactory(client=None)
        assert person.client is None

    def test_person_client_set_null_on_delete(self, db):
        client = ClientFactory()
        person = PersonFactory(client=client)
        client.delete()
        person.refresh_from_db()
        assert person.client is None

    def test_person_pep_status_default(self, db):
        person = PersonFactory()
        assert person.pep_status is False

    def test_person_blank_fields(self, db):
        person = Person.objects.create(
            full_name="Minimal Person",
            person_type=PersonType.NATURAL,
        )
        assert person.nationality == ""
        assert person.country_of_residence == ""
        assert person.identification_number == ""
        assert person.identification_type == ""
