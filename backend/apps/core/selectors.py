from .models import Client, Entity, Person


def get_clients_by_type(*, client_type: str):
    return Client.objects.filter(client_type=client_type)


def get_entities_by_jurisdiction(*, jurisdiction: str):
    return Entity.objects.filter(jurisdiction=jurisdiction)


def get_entities_for_client(*, client_id):
    return Entity.objects.filter(client_id=client_id).select_related("client")


def search_persons_by_name(*, query: str):
    return Person.objects.filter(full_name__icontains=query)
