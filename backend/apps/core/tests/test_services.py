import pytest

from apps.core.constants import (
    ClientCategory,
    ClientType,
    EntityJurisdiction,
    EntityStatus,
    MatterStatus,
    PersonType,
)
from apps.core.models import Client, Entity, Matter, Person
from apps.core.services import (
    create_client,
    create_entity,
    create_matter,
    create_person,
    search_persons,
)

from .factories import ClientFactory, PersonFactory


class TestCreateClient:
    def test_create_client_minimal(self, db):
        client = create_client(
            name="New Client",
            client_type=ClientType.CORPORATE,
        )
        assert isinstance(client, Client)
        assert client.name == "New Client"
        assert client.client_type == ClientType.CORPORATE
        assert client.category == ClientCategory.SILVER

    def test_create_client_with_category(self, db):
        client = create_client(
            name="Gold Client",
            client_type=ClientType.NATURAL,
            category=ClientCategory.GOLD,
        )
        assert client.category == ClientCategory.GOLD

    def test_create_client_with_kwargs(self, db):
        client = create_client(
            name="Full Client",
            client_type=ClientType.CORPORATE,
            category=ClientCategory.PLATINUM,
            aderant_client_id="ADE-999",
        )
        assert client.aderant_client_id == "ADE-999"
        assert client.category == ClientCategory.PLATINUM


class TestCreateEntity:
    def test_create_entity(self, db):
        client = ClientFactory()
        entity = create_entity(
            name="BVI Entity",
            jurisdiction=EntityJurisdiction.BVI,
            client_id=client.id,
        )
        assert isinstance(entity, Entity)
        assert entity.name == "BVI Entity"
        assert entity.jurisdiction == EntityJurisdiction.BVI
        assert entity.client_id == client.id
        assert entity.status == EntityStatus.PENDING

    def test_create_entity_with_status(self, db):
        client = ClientFactory()
        entity = create_entity(
            name="Active Entity",
            jurisdiction=EntityJurisdiction.PANAMA,
            client_id=client.id,
            status=EntityStatus.ACTIVE,
        )
        assert entity.status == EntityStatus.ACTIVE

    def test_create_entity_invalid_client(self, db):
        import uuid

        with pytest.raises(Exception):
            create_entity(
                name="Orphan",
                jurisdiction=EntityJurisdiction.BELIZE,
                client_id=uuid.uuid4(),
            )


class TestCreateMatter:
    def test_create_matter(self, db):
        client = ClientFactory()
        matter = create_matter(
            client_id=client.id,
            description="Test matter",
        )
        assert isinstance(matter, Matter)
        assert matter.client_id == client.id
        assert matter.description == "Test matter"
        assert matter.status == MatterStatus.OPEN
        assert matter.opened_date is not None

    def test_create_matter_with_entity(self, db):
        from .factories import EntityFactory

        client = ClientFactory()
        entity = EntityFactory(client=client)
        matter = create_matter(
            client_id=client.id,
            description="Entity matter",
            entity_id=entity.id,
        )
        assert matter.entity_id == entity.id

    def test_create_matter_with_aderant_id(self, db):
        client = ClientFactory()
        matter = create_matter(
            client_id=client.id,
            description="Aderant matter",
            aderant_matter_id="M-500",
        )
        assert matter.aderant_matter_id == "M-500"


class TestCreatePerson:
    def test_create_person(self, db):
        person = create_person(
            full_name="Alice Smith",
            person_type=PersonType.NATURAL,
        )
        assert isinstance(person, Person)
        assert person.full_name == "Alice Smith"
        assert person.person_type == PersonType.NATURAL

    def test_create_person_with_all_fields(self, db):
        client = ClientFactory()
        person = create_person(
            full_name="Bob Jones",
            person_type=PersonType.CORPORATE,
            nationality="British",
            country_of_residence="Belize",
            identification_number="CR-12345",
            identification_type="corporate_registry",
            pep_status=True,
            client_id=client.id,
        )
        assert person.nationality == "British"
        assert person.country_of_residence == "Belize"
        assert person.identification_number == "CR-12345"
        assert person.pep_status is True
        assert person.client_id == client.id


class TestSearchPersons:
    def test_search_persons_by_name(self, db):
        PersonFactory(full_name="Alice Johnson")
        PersonFactory(full_name="Bob Smith")
        PersonFactory(full_name="Alice Williams")

        results = search_persons(query="Alice")
        assert results.count() == 2

    def test_search_persons_case_insensitive(self, db):
        PersonFactory(full_name="ALICE JOHNSON")
        results = search_persons(query="alice")
        assert results.count() == 1

    def test_search_persons_no_results(self, db):
        PersonFactory(full_name="Alice Johnson")
        results = search_persons(query="Zebra")
        assert results.count() == 0

    def test_search_persons_partial_match(self, db):
        PersonFactory(full_name="Alice Johnson")
        results = search_persons(query="John")
        assert results.count() == 1
