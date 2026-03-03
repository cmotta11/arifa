import uuid
from unittest.mock import patch

import pytest
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status


class TestDocumentTemplateViewSet:
    def test_list_templates(self, authenticated_client, template):
        response = authenticated_client.get("/api/documents/templates/")
        assert response.status_code == status.HTTP_200_OK
        # Paginated response
        assert "results" in response.data
        assert len(response.data["results"]) >= 1

    def test_list_templates_filter_by_entity_type(
        self, authenticated_client, template
    ):
        response = authenticated_client.get(
            "/api/documents/templates/", {"entity_type": "corporation"}
        )
        assert response.status_code == status.HTTP_200_OK
        for t in response.data["results"]:
            assert t["entity_type"] == "corporation"

    def test_list_templates_filter_by_jurisdiction(
        self, authenticated_client, template
    ):
        response = authenticated_client.get(
            "/api/documents/templates/", {"jurisdiction": "bvi"}
        )
        assert response.status_code == status.HTTP_200_OK
        for t in response.data["results"]:
            assert t["jurisdiction"] == "bvi"

    def test_list_templates_filter_by_is_active(self, authenticated_client, template):
        response = authenticated_client.get(
            "/api/documents/templates/", {"is_active": "true"}
        )
        assert response.status_code == status.HTTP_200_OK
        for t in response.data["results"]:
            assert t["is_active"] is True

    def test_create_template(self, authenticated_client):
        file = SimpleUploadedFile(
            "test_template.docx",
            b"fake docx content",
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        data = {
            "name": "New Template",
            "file": file,
            "entity_type": "trust",
            "jurisdiction": "panama",
        }
        response = authenticated_client.post(
            "/api/documents/templates/", data, format="multipart"
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "New Template"
        assert response.data["entity_type"] == "trust"
        assert response.data["jurisdiction"] == "panama"

    def test_retrieve_template(self, authenticated_client, template):
        response = authenticated_client.get(
            f"/api/documents/templates/{template.id}/"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == str(template.id)
        assert response.data["name"] == template.name

    def test_list_templates_unauthenticated(self, api_client, template):
        response = api_client.get("/api/documents/templates/")
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )


class TestGeneratedDocumentViewSet:
    def test_generate_document(self, authenticated_client, ticket, template):
        data = {
            "ticket_id": str(ticket.id),
            "template_id": str(template.id),
        }
        response = authenticated_client.post(
            "/api/documents/generate/", data, format="json"
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["ticket"] == str(ticket.id)
        assert response.data["template"] == str(template.id)

    def test_generate_document_invalid_template(self, authenticated_client, ticket):
        data = {
            "ticket_id": str(ticket.id),
            "template_id": str(uuid.uuid4()),
        }
        response = authenticated_client.post(
            "/api/documents/generate/", data, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_retrieve_generated_document(
        self, authenticated_client, generated_document
    ):
        response = authenticated_client.get(
            f"/api/documents/generated/{generated_document.id}/"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == str(generated_document.id)

    def test_retrieve_generated_document_not_found(self, authenticated_client):
        response = authenticated_client.get(
            f"/api/documents/generated/{uuid.uuid4()}/"
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_list_generated_documents(
        self, authenticated_client, generated_document
    ):
        response = authenticated_client.get("/api/documents/generated/")
        assert response.status_code == status.HTTP_200_OK
        assert "results" in response.data
        assert len(response.data["results"]) >= 1

    def test_list_generated_documents_filter_by_ticket(
        self, authenticated_client, ticket, generated_document
    ):
        response = authenticated_client.get(
            "/api/documents/generated/", {"ticket_id": str(ticket.id)}
        )
        assert response.status_code == status.HTTP_200_OK
        for doc in response.data["results"]:
            assert doc["ticket"] == str(ticket.id)

    @patch("apps.documents.views.convert_to_pdf_async")
    def test_convert_pdf_action(
        self, mock_task, authenticated_client, generated_document
    ):
        mock_task.delay.return_value = None
        response = authenticated_client.post(
            f"/api/documents/generated/{generated_document.id}/convert-pdf/"
        )
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert "queued" in response.data["detail"].lower()
        mock_task.delay.assert_called_once_with(str(generated_document.id))

    def test_convert_pdf_not_found(self, authenticated_client):
        response = authenticated_client.post(
            f"/api/documents/generated/{uuid.uuid4()}/convert-pdf/"
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_download_document(self, authenticated_client, generated_document):
        response = authenticated_client.get(
            f"/api/documents/generated/{generated_document.id}/download/"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Disposition"] is not None
        assert "attachment" in response["Content-Disposition"]

    def test_download_document_not_found(self, authenticated_client):
        response = authenticated_client.get(
            f"/api/documents/generated/{uuid.uuid4()}/download/"
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_generate_document_unauthenticated(self, api_client, ticket, template):
        data = {
            "ticket_id": str(ticket.id),
            "template_id": str(template.id),
        }
        response = api_client.post("/api/documents/generate/", data, format="json")
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )
