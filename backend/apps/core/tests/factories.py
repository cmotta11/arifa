import factory
from factory.django import DjangoModelFactory

from apps.core.constants import (
    ClientCategory,
    ClientStatus,
    ClientType,
    EntityJurisdiction,
    EntityStatus,
    IdentificationType,
    MatterStatus,
    PersonType,
)
from apps.core.models import Client, Entity, Matter, Person


class ClientFactory(DjangoModelFactory):
    class Meta:
        model = Client

    name = factory.Sequence(lambda n: f"Client {n}")
    client_type = ClientType.CORPORATE
    category = ClientCategory.SILVER
    status = ClientStatus.ACTIVE


class EntityFactory(DjangoModelFactory):
    class Meta:
        model = Entity

    name = factory.Sequence(lambda n: f"Entity {n}")
    jurisdiction = EntityJurisdiction.BVI
    client = factory.SubFactory(ClientFactory)
    status = EntityStatus.PENDING


class MatterFactory(DjangoModelFactory):
    class Meta:
        model = Matter

    client = factory.SubFactory(ClientFactory)
    entity = factory.SubFactory(EntityFactory, client=factory.SelfAttribute("..client"))
    description = factory.Sequence(lambda n: f"Matter description {n}")
    status = MatterStatus.OPEN


class PersonFactory(DjangoModelFactory):
    class Meta:
        model = Person

    full_name = factory.Sequence(lambda n: f"Person {n}")
    person_type = PersonType.NATURAL
    nationality = "Panamanian"
    country_of_residence = "Panama"
    identification_number = factory.Sequence(lambda n: f"ID-{n:06d}")
    identification_type = IdentificationType.PASSPORT
    pep_status = False
