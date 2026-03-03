import pytest
from decimal import Decimal
from unittest.mock import patch, MagicMock

from django.urls import reverse

from apps.compliance.constants import (
    KYCStatus,
    PartyRole,
    PartyType,
    RFIStatus,
    RiskLevel,
    ScreeningStatus,
)
from apps.compliance.models import KYCSubmission

from .factories import (
    DocumentUploadFactory,
    KYCSubmissionFactory,
    PartyFactory,
    RFIFactory,
    RiskAssessmentFactory,
    WorldCheckCaseFactory,
)


# ---------------------------------------------------------------------------
# KYCSubmission endpoints
# ---------------------------------------------------------------------------


class TestKYCSubmissionViewSet:
    def test_list_kyc_submissions(self, compliance_client):
        KYCSubmissionFactory.create_batch(3)
        response = compliance_client.get("/api/v1/compliance/kyc/")
        assert response.status_code == 200
        assert response.data["count"] == 3

    def test_create_kyc_submission(self, compliance_client, kyc_submission):
        data = {"ticket_id": str(kyc_submission.ticket_id)}
        response = compliance_client.post("/api/v1/compliance/kyc/", data=data)
        assert response.status_code == 201
        assert response.data["status"] == KYCStatus.DRAFT

    def test_retrieve_kyc_submission(self, compliance_client, kyc_submission):
        response = compliance_client.get(f"/api/v1/compliance/kyc/{kyc_submission.id}/")
        assert response.status_code == 200
        assert response.data["id"] == str(kyc_submission.id)

    def test_submit_action(self, compliance_client, kyc_submission):
        response = compliance_client.post(
            f"/api/v1/compliance/kyc/{kyc_submission.id}/submit/"
        )
        assert response.status_code == 200
        assert response.data["status"] == KYCStatus.SUBMITTED

    def test_approve_action(self, compliance_client, submitted_kyc):
        response = compliance_client.post(
            f"/api/v1/compliance/kyc/{submitted_kyc.id}/approve/"
        )
        assert response.status_code == 200
        assert response.data["status"] == KYCStatus.APPROVED

    def test_reject_action(self, compliance_client, submitted_kyc):
        response = compliance_client.post(
            f"/api/v1/compliance/kyc/{submitted_kyc.id}/reject/"
        )
        assert response.status_code == 200
        assert response.data["status"] == KYCStatus.REJECTED

    def test_escalate_action(self, compliance_client, submitted_kyc):
        response = compliance_client.post(
            f"/api/v1/compliance/kyc/{submitted_kyc.id}/escalate/"
        )
        assert response.status_code == 200
        assert response.data["status"] == KYCStatus.UNDER_REVIEW

    def test_calculate_risk(self, compliance_client, kyc_submission):
        PartyFactory(kyc_submission=kyc_submission)
        response = compliance_client.post(
            f"/api/v1/compliance/kyc/{kyc_submission.id}/calculate-risk/",
            data={"trigger": "manual"},
        )
        assert response.status_code == 200
        assert "total_score" in response.data
        assert "risk_level" in response.data

    def test_risk_assessment(self, compliance_client, kyc_submission):
        RiskAssessmentFactory(kyc_submission=kyc_submission, is_current=True)
        response = compliance_client.get(
            f"/api/v1/compliance/kyc/{kyc_submission.id}/risk-assessment/"
        )
        assert response.status_code == 200
        assert "total_score" in response.data

    def test_risk_assessment_not_found(self, compliance_client, kyc_submission):
        response = compliance_client.get(
            f"/api/v1/compliance/kyc/{kyc_submission.id}/risk-assessment/"
        )
        assert response.status_code == 404

    def test_risk_history(self, compliance_client, kyc_submission):
        RiskAssessmentFactory.create_batch(3, kyc_submission=kyc_submission)
        response = compliance_client.get(
            f"/api/v1/compliance/kyc/{kyc_submission.id}/risk-history/"
        )
        assert response.status_code == 200

    def test_documents_list(self, compliance_client, kyc_submission):
        DocumentUploadFactory.create_batch(2, kyc_submission=kyc_submission)
        response = compliance_client.get(
            f"/api/v1/compliance/kyc/{kyc_submission.id}/documents/"
        )
        assert response.status_code == 200

    def test_filter_by_status(self, compliance_client):
        KYCSubmissionFactory(status=KYCStatus.DRAFT)
        KYCSubmissionFactory(status=KYCStatus.SUBMITTED)
        response = compliance_client.get("/api/v1/compliance/kyc/?status=submitted")
        assert response.status_code == 200
        assert response.data["count"] == 1

    def test_unauthenticated_access_denied(self, api_client):
        response = api_client.get("/api/v1/compliance/kyc/")
        assert response.status_code in (401, 403)


# ---------------------------------------------------------------------------
# Nested party endpoints
# ---------------------------------------------------------------------------


class TestPartyEndpoints:
    def test_list_parties_for_kyc(self, compliance_client, kyc_submission):
        PartyFactory.create_batch(2, kyc_submission=kyc_submission)
        response = compliance_client.get(
            f"/api/v1/compliance/kyc/{kyc_submission.id}/parties/"
        )
        assert response.status_code == 200

    def test_create_party_for_kyc(self, compliance_client, kyc_submission):
        data = {
            "party_type": PartyType.NATURAL,
            "role": PartyRole.UBO,
            "name": "Test Party",
            "nationality": "US",
            "pep_status": False,
            "ownership_percentage": "25.00",
        }
        response = compliance_client.post(
            f"/api/v1/compliance/kyc/{kyc_submission.id}/parties/",
            data=data,
        )
        assert response.status_code == 201
        assert response.data["name"] == "Test Party"

    def test_retrieve_party(self, compliance_client, party):
        response = compliance_client.get(
            f"/api/v1/compliance/parties/{party.id}/"
        )
        assert response.status_code == 200
        assert response.data["id"] == str(party.id)

    def test_update_party(self, compliance_client, party):
        data = {
            "party_type": PartyType.NATURAL,
            "role": PartyRole.DIRECTOR,
            "name": "Updated Name",
        }
        response = compliance_client.put(
            f"/api/v1/compliance/parties/{party.id}/",
            data=data,
        )
        assert response.status_code == 200
        assert response.data["name"] == "Updated Name"
        assert response.data["role"] == PartyRole.DIRECTOR

    def test_delete_party(self, compliance_client, party):
        response = compliance_client.delete(
            f"/api/v1/compliance/parties/{party.id}/"
        )
        assert response.status_code == 204

    @patch("apps.compliance.tasks.screen_party_worldcheck.delay")
    def test_screen_party(self, mock_task, compliance_client, party):
        mock_task.return_value = MagicMock(id="test-task-id")
        response = compliance_client.post(
            f"/api/v1/compliance/parties/{party.id}/screen/"
        )
        assert response.status_code == 202
        assert response.data["task_id"] == "test-task-id"
        mock_task.assert_called_once()

    def test_worldcheck_results(self, compliance_client, party):
        WorldCheckCaseFactory.create_batch(2, party=party)
        response = compliance_client.get(
            f"/api/v1/compliance/parties/{party.id}/worldcheck/"
        )
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# RFI endpoints
# ---------------------------------------------------------------------------


class TestRFIEndpoints:
    def test_list_rfis(self, compliance_client):
        RFIFactory.create_batch(3)
        response = compliance_client.get("/api/v1/compliance/rfis/")
        assert response.status_code == 200
        assert response.data["count"] == 3

    def test_create_rfi_via_kyc(self, compliance_client, kyc_submission):
        data = {
            "requested_fields": ["passport", "utility_bill"],
            "notes": "Please provide documents",
        }
        response = compliance_client.post(
            f"/api/v1/compliance/kyc/{kyc_submission.id}/rfis/",
            data=data,
            format="json",
        )
        assert response.status_code == 201
        assert response.data["status"] == RFIStatus.OPEN

    def test_respond_to_rfi(self, compliance_client, rfi):
        data = {"response_text": "Documents have been uploaded."}
        response = compliance_client.post(
            f"/api/v1/compliance/rfis/{rfi.id}/respond/",
            data=data,
        )
        assert response.status_code == 200
        assert response.data["status"] == RFIStatus.RESPONDED


# ---------------------------------------------------------------------------
# Extract document endpoint
# ---------------------------------------------------------------------------


class TestExtractDocumentView:
    @patch("apps.compliance.tasks.extract_document_data.delay")
    @patch("apps.compliance.tasks.upload_document_to_sharepoint_async.delay")
    def test_extract_document(
        self, mock_sp_task, mock_extract_task, compliance_client
    ):
        mock_extract_task.return_value = MagicMock(id="extract-task-123")

        from io import BytesIO

        fake_file = BytesIO(b"fake-image-content")
        fake_file.name = "document.jpg"

        response = compliance_client.post(
            "/api/v1/compliance/extract-document/",
            data={"document_type": "passport", "file": fake_file},
            format="multipart",
        )
        assert response.status_code == 202
        assert "task_id" in response.data
        assert "document_upload_id" in response.data


# ---------------------------------------------------------------------------
# World-Check webhook endpoint
# ---------------------------------------------------------------------------


class TestWorldCheckWebhookView:
    @patch("apps.compliance.tasks.process_worldcheck_webhook.delay")
    def test_webhook_receives_payload(self, mock_task, api_client):
        mock_task.return_value = MagicMock(id="webhook-task-456")

        payload = {
            "caseSystemId": "WC-001",
            "eventType": "NEW_MATCH",
            "matchData": {"matches": [{"name": "Test"}]},
        }
        response = api_client.post(
            "/api/v1/compliance/webhooks/world-check/",
            data=payload,
            format="json",
        )
        assert response.status_code == 202
        assert response.data["message"] == "Webhook received."
        mock_task.assert_called_once_with(payload)

    def test_empty_payload_rejected(self, api_client):
        response = api_client.post(
            "/api/v1/compliance/webhooks/world-check/",
            data={},
            format="json",
        )
        # Empty dict is falsy, should get 400
        assert response.status_code == 400


# ---------------------------------------------------------------------------
# Task status endpoint
# ---------------------------------------------------------------------------


class TestTaskStatusView:
    @patch("apps.compliance.views.AsyncResult")
    def test_pending_task(self, mock_async, compliance_client):
        mock_result = MagicMock()
        mock_result.status = "PENDING"
        mock_result.ready.return_value = False
        mock_async.return_value = mock_result

        response = compliance_client.get(
            "/api/v1/compliance/tasks/test-task-id/status/"
        )
        assert response.status_code == 200
        assert response.data["status"] == "PENDING"

    @patch("apps.compliance.views.AsyncResult")
    def test_successful_task(self, mock_async, compliance_client):
        mock_result = MagicMock()
        mock_result.status = "SUCCESS"
        mock_result.ready.return_value = True
        mock_result.successful.return_value = True
        mock_result.result = {"extracted": "data"}
        mock_async.return_value = mock_result

        response = compliance_client.get(
            "/api/v1/compliance/tasks/test-task-id/status/"
        )
        assert response.status_code == 200
        assert response.data["status"] == "SUCCESS"
        assert response.data["result"] == {"extracted": "data"}

    @patch("apps.compliance.views.AsyncResult")
    def test_failed_task(self, mock_async, compliance_client):
        mock_result = MagicMock()
        mock_result.status = "FAILURE"
        mock_result.ready.return_value = True
        mock_result.successful.return_value = False
        mock_result.result = Exception("Something went wrong")
        mock_async.return_value = mock_result

        response = compliance_client.get(
            "/api/v1/compliance/tasks/test-task-id/status/"
        )
        assert response.status_code == 200
        assert response.data["status"] == "FAILURE"
        assert "error" in response.data
