import uuid

import pytest
from django.core.files.base import ContentFile

from apps.documents.models import DocumentTemplate, GeneratedDocument
from apps.documents.services import (
    create_template,
    generate_document,
    get_document_download_url,
)
from common.exceptions import ApplicationError


class TestCreateTemplate:
    def test_create_template_success(self, db):
        file = ContentFile(b"template content", name="contract.docx")
        template = create_template(
            name="Contract Template",
            file=file,
            entity_type="corporation",
            jurisdiction="bvi",
        )
        assert isinstance(template, DocumentTemplate)
        assert template.name == "Contract Template"
        assert template.entity_type == "corporation"
        assert template.jurisdiction == "bvi"
        assert template.is_active is True

    def test_create_template_default_fields(self, db):
        file = ContentFile(b"content", name="basic.docx")
        template = create_template(name="Basic Template", file=file)
        assert template.entity_type == ""
        assert template.jurisdiction == ""

    def test_create_template_persisted(self, db):
        file = ContentFile(b"content", name="persisted.docx")
        template = create_template(name="Persisted", file=file)
        assert DocumentTemplate.objects.filter(id=template.id).exists()


class TestGenerateDocument:
    def test_generate_document_success(self, ticket, template, user):
        document = generate_document(
            ticket_id=ticket.id,
            template_id=template.id,
            generated_by=user,
        )
        assert isinstance(document, GeneratedDocument)
        assert document.ticket_id == ticket.id
        assert document.template_id == template.id
        assert document.generated_by_id == user.id
        assert document.format == "docx"
        assert document.generated_file is not None

    def test_generate_document_nonexistent_template_raises(self, ticket, user):
        with pytest.raises(ApplicationError, match="template not found"):
            generate_document(
                ticket_id=ticket.id,
                template_id=uuid.uuid4(),
                generated_by=user,
            )

    def test_generate_document_inactive_template_raises(self, ticket, user):
        from apps.documents.tests.factories import DocumentTemplateFactory

        inactive_template = DocumentTemplateFactory(is_active=False)
        with pytest.raises(ApplicationError, match="not active"):
            generate_document(
                ticket_id=ticket.id,
                template_id=inactive_template.id,
                generated_by=user,
            )

    def test_generate_document_with_context_no_docxtpl(
        self, ticket, template, user, mocker
    ):
        """When docxtpl is not available, the file is copied as-is even with context."""
        mocker.patch.dict("sys.modules", {"docxtpl": None})
        # Force ImportError by patching the import inside services
        mocker.patch(
            "apps.documents.services.io",
            side_effect=None,
        )
        document = generate_document(
            ticket_id=ticket.id,
            template_id=template.id,
            generated_by=user,
            context_data={"company_name": "Test Corp"},
        )
        assert isinstance(document, GeneratedDocument)
        assert document.generated_file is not None

    def test_generate_document_persisted(self, ticket, template, user):
        document = generate_document(
            ticket_id=ticket.id,
            template_id=template.id,
            generated_by=user,
        )
        assert GeneratedDocument.objects.filter(id=document.id).exists()


class TestGetDocumentDownloadUrl:
    def test_get_download_url_success(self, generated_document):
        url = get_document_download_url(document_id=generated_document.id)
        assert isinstance(url, str)
        assert len(url) > 0

    def test_get_download_url_nonexistent_raises(self, db):
        with pytest.raises(ApplicationError, match="not found"):
            get_document_download_url(document_id=uuid.uuid4())
