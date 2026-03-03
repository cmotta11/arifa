import factory
from django.core.files.base import ContentFile
from factory.django import DjangoModelFactory

from apps.authentication.tests.factories import UserFactory
from apps.documents.constants import DocumentFormat
from apps.documents.models import DocumentTemplate, GeneratedDocument


class DocumentTemplateFactory(DjangoModelFactory):
    class Meta:
        model = DocumentTemplate

    name = factory.Sequence(lambda n: f"Template {n}")
    file = factory.LazyFunction(
        lambda: ContentFile(b"Fake DOCX content", name="template.docx")
    )
    entity_type = "corporation"
    jurisdiction = "bvi"
    is_active = True


class GeneratedDocumentFactory(DjangoModelFactory):
    class Meta:
        model = GeneratedDocument

    ticket = factory.LazyFunction(lambda: _create_ticket())
    template = factory.SubFactory(DocumentTemplateFactory)
    generated_file = factory.LazyFunction(
        lambda: ContentFile(b"Fake generated content", name="generated.docx")
    )
    format = DocumentFormat.DOCX
    generated_by = factory.SubFactory(UserFactory)


def _create_ticket():
    """Create a minimal Ticket instance for FK integrity in tests.

    Imports are kept inside the function to avoid circular import issues.
    """
    from apps.authentication.tests.factories import UserFactory
    from apps.core.tests.factories import ClientFactory
    from apps.workflow.models import Ticket, WorkflowState

    state, _ = WorkflowState.objects.get_or_create(
        name="Initial",
        defaults={"order_index": 0, "is_initial": True, "is_final": False},
    )
    client = ClientFactory()
    user = UserFactory()
    return Ticket.objects.create(
        title="Test Ticket",
        client=client,
        current_state=state,
        created_by=user,
    )
