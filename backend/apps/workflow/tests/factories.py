import factory
from django.conf import settings

from apps.authentication.constants import COORDINATOR
from apps.core.models import Client
from apps.workflow.constants import TicketPriority
from apps.workflow.models import Ticket, TicketLog, WorkflowState, WorkflowTransition


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = settings.AUTH_USER_MODEL

    email = factory.Sequence(lambda n: f"user{n}@example.com")
    role = COORDINATOR
    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        manager = cls._get_manager(model_class)
        password = kwargs.pop("password", "testpass123")
        return manager.create_user(*args, password=password, **kwargs)


class ClientFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Client

    name = factory.Sequence(lambda n: f"Client {n}")
    client_type = "natural"
    category = "silver"
    status = "active"


class WorkflowStateFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = WorkflowState

    name = factory.Sequence(lambda n: f"State {n}")
    order_index = factory.Sequence(lambda n: n)
    is_initial = False
    is_final = False


class WorkflowTransitionFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = WorkflowTransition

    from_state = factory.SubFactory(WorkflowStateFactory)
    to_state = factory.SubFactory(WorkflowStateFactory)
    allowed_roles = factory.LazyFunction(lambda: [COORDINATOR])
    name = factory.LazyAttribute(
        lambda obj: f"{obj.from_state.name} -> {obj.to_state.name}"
    )


class TicketFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Ticket

    title = factory.Sequence(lambda n: f"Ticket {n}")
    client = factory.SubFactory(ClientFactory)
    current_state = factory.SubFactory(WorkflowStateFactory)
    created_by = factory.SubFactory(UserFactory)
    priority = TicketPriority.MEDIUM


class TicketLogFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = TicketLog

    ticket = factory.SubFactory(TicketFactory)
    changed_by = factory.SubFactory(UserFactory)
    previous_state = factory.SubFactory(WorkflowStateFactory)
    new_state = factory.SubFactory(WorkflowStateFactory)
    comment = "Test log entry."
