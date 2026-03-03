import uuid

import pytest

from apps.documents.constants import DocumentFormat
from apps.documents.models import DocumentTemplate, GeneratedDocument


class TestDocumentTemplate:
    def test_create_template(self, template):
        assert isinstance(template.id, uuid.UUID)
        assert template.name.startswith("Template")
        assert template.is_active is True
        assert template.entity_type == "corporation"
        assert template.jurisdiction == "bvi"

    def test_template_str(self, template):
        assert str(template) == template.name

    def test_template_has_timestamps(self, template):
        assert template.created_at is not None
        assert template.updated_at is not None

    def test_template_default_is_active(self, db):
        from django.core.files.base import ContentFile

        t = DocumentTemplate.objects.create(
            name="Inactive Test",
            file=ContentFile(b"content", name="test.docx"),
        )
        assert t.is_active is True

    def test_template_blank_entity_type_and_jurisdiction(self, db):
        from django.core.files.base import ContentFile

        t = DocumentTemplate.objects.create(
            name="Blank Fields",
            file=ContentFile(b"content", name="test.docx"),
        )
        assert t.entity_type == ""
        assert t.jurisdiction == ""

    def test_template_ordering(self, db):
        """Templates should be ordered by -created_at (most recent first)."""
        from apps.documents.tests.factories import DocumentTemplateFactory

        t1 = DocumentTemplateFactory(name="First")
        t2 = DocumentTemplateFactory(name="Second")
        templates = list(DocumentTemplate.objects.all())
        assert templates[0] == t2
        assert templates[1] == t1


class TestGeneratedDocument:
    def test_create_generated_document(self, generated_document):
        assert isinstance(generated_document.id, uuid.UUID)
        assert generated_document.format == DocumentFormat.DOCX
        assert generated_document.ticket is not None
        assert generated_document.template is not None
        assert generated_document.generated_by is not None

    def test_generated_document_str(self, generated_document):
        result = str(generated_document)
        assert "Document" in result
        assert str(generated_document.ticket_id) in result

    def test_generated_document_has_timestamps(self, generated_document):
        assert generated_document.created_at is not None
        assert generated_document.updated_at is not None

    def test_generated_document_default_format(self, generated_document):
        assert generated_document.format == DocumentFormat.DOCX

    def test_generated_document_sharepoint_file_id_blank(self, generated_document):
        assert generated_document.sharepoint_file_id == ""

    def test_generated_document_template_nullable(self, ticket, user):
        """Template FK can be null (SET_NULL on delete)."""
        doc = GeneratedDocument.objects.create(
            ticket=ticket,
            template=None,
            generated_file="generated/test.docx",
            format=DocumentFormat.DOCX,
            generated_by=user,
        )
        assert doc.template is None

    def test_generated_document_cascade_on_ticket_delete(
        self, ticket, generated_document
    ):
        """Deleting a ticket cascades to generated documents."""
        doc_id = generated_document.id
        ticket.delete()
        assert not GeneratedDocument.objects.filter(id=doc_id).exists()
