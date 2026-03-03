import uuid
from unittest.mock import MagicMock, patch

import pytest

from apps.documents.constants import DocumentFormat
from apps.documents.models import GeneratedDocument
from apps.documents.tasks import (
    convert_to_pdf_async,
    generate_document_async,
    upload_to_sharepoint,
)


class TestGenerateDocumentAsync:
    def test_generate_document_async_success(self, ticket, template, user):
        result = generate_document_async(
            str(ticket.id), str(template.id), str(user.id)
        )
        assert result is not None
        # Result is the string ID of the created document
        doc = GeneratedDocument.objects.get(id=result)
        assert doc.ticket_id == ticket.id
        assert doc.template_id == template.id
        assert doc.generated_by_id == user.id

    def test_generate_document_async_invalid_user(self, ticket, template):
        with pytest.raises(Exception):
            generate_document_async(
                str(ticket.id), str(template.id), str(uuid.uuid4())
            )

    def test_generate_document_async_invalid_template(self, ticket, user):
        with pytest.raises(Exception):
            generate_document_async(
                str(ticket.id), str(uuid.uuid4()), str(user.id)
            )


class TestConvertToPdfAsync:
    @patch("apps.documents.tasks.GotenbergClient")
    def test_convert_to_pdf_success(self, mock_client_cls, generated_document):
        mock_client = MagicMock()
        mock_client.convert_docx_to_pdf.return_value = b"%PDF-1.4 fake content"
        mock_client_cls.return_value = mock_client

        result = convert_to_pdf_async(str(generated_document.id))

        assert result is not None
        pdf_doc = GeneratedDocument.objects.get(id=result)
        assert pdf_doc.format == DocumentFormat.PDF
        assert pdf_doc.ticket_id == generated_document.ticket_id
        mock_client.convert_docx_to_pdf.assert_called_once()

    @patch("apps.documents.tasks.GotenbergClient")
    def test_convert_to_pdf_already_pdf(self, mock_client_cls, generated_document):
        # Mark document as already PDF
        generated_document.format = DocumentFormat.PDF
        generated_document.save()

        result = convert_to_pdf_async(str(generated_document.id))

        # Should return same document ID without calling Gotenberg
        assert result == str(generated_document.id)
        mock_client_cls.return_value.convert_docx_to_pdf.assert_not_called()

    def test_convert_to_pdf_nonexistent_document(self, db):
        with pytest.raises(GeneratedDocument.DoesNotExist):
            convert_to_pdf_async(str(uuid.uuid4()))


class TestUploadToSharepoint:
    @patch("apps.documents.tasks.requests")
    def test_upload_to_sharepoint_success(self, mock_requests, generated_document):
        # Mock token response
        mock_token_response = MagicMock()
        mock_token_response.json.return_value = {"access_token": "fake-token"}
        mock_token_response.raise_for_status = MagicMock()

        # Mock upload response
        mock_upload_response = MagicMock()
        mock_upload_response.json.return_value = {"id": "sp-file-123"}
        mock_upload_response.raise_for_status = MagicMock()

        mock_requests.post.return_value = mock_token_response
        mock_requests.put.return_value = mock_upload_response

        result = upload_to_sharepoint(str(generated_document.id))

        assert result == "sp-file-123"
        generated_document.refresh_from_db()
        assert generated_document.sharepoint_file_id == "sp-file-123"
        mock_requests.post.assert_called_once()
        mock_requests.put.assert_called_once()

    @patch("apps.documents.tasks.requests")
    def test_upload_to_sharepoint_token_failure(
        self, mock_requests, generated_document
    ):
        import requests as real_requests

        mock_requests.post.side_effect = real_requests.RequestException("Auth failed")
        mock_requests.RequestException = real_requests.RequestException

        with pytest.raises(Exception):
            upload_to_sharepoint(str(generated_document.id))

    def test_upload_to_sharepoint_nonexistent_document(self, db):
        with pytest.raises(GeneratedDocument.DoesNotExist):
            upload_to_sharepoint(str(uuid.uuid4()))
