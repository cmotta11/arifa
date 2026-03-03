import pytest
from unittest.mock import patch, MagicMock

from apps.compliance.constants import (
    KYCStatus,
    LLMExtractionStatus,
    RecalculationStatus,
    RiskLevel,
    ScreeningStatus,
)
from apps.compliance.models import (
    DocumentUpload,
    RiskRecalculationLog,
    WorldCheckCase,
)
from apps.compliance.tasks import (
    extract_document_data,
    process_worldcheck_webhook,
    recalculate_all_risks,
    recalculate_high_risk_entities,
    screen_party_worldcheck,
    upload_document_to_sharepoint_async,
)

from .factories import (
    DocumentUploadFactory,
    KYCSubmissionFactory,
    PartyFactory,
    RiskAssessmentFactory,
    WorldCheckCaseFactory,
)


# ---------------------------------------------------------------------------
# extract_document_data
# ---------------------------------------------------------------------------


class TestExtractDocumentData:
    @patch("apps.compliance.tasks.LLMExtractionClient")
    def test_successful_extraction(self, mock_client_cls, document_upload):
        mock_client = MagicMock()
        mock_client.extract_from_image.return_value = {
            "full_name": "John Doe",
            "date_of_birth": "1990-01-01",
            "passport_number": "AB123456",
        }
        mock_client_cls.return_value = mock_client

        result = extract_document_data(str(document_upload.id))

        document_upload.refresh_from_db()
        assert document_upload.llm_extraction_status == LLMExtractionStatus.COMPLETED
        assert document_upload.llm_extraction_json["full_name"] == "John Doe"
        assert result["status"] == "completed"

    @patch("apps.compliance.tasks.LLMExtractionClient")
    def test_extraction_failure_retries(self, mock_client_cls, document_upload):
        mock_client = MagicMock()
        mock_client.extract_from_image.side_effect = Exception("API error")
        mock_client_cls.return_value = mock_client

        with pytest.raises(Exception, match="API error"):
            extract_document_data(str(document_upload.id))

        document_upload.refresh_from_db()
        assert document_upload.llm_extraction_status == LLMExtractionStatus.FAILED

    def test_missing_document_returns_error(self):
        result = extract_document_data("00000000-0000-0000-0000-000000000000")
        assert result["error"] == "DocumentUpload not found"


# ---------------------------------------------------------------------------
# screen_party_worldcheck
# ---------------------------------------------------------------------------


class TestScreenPartyWorldcheck:
    @patch("apps.compliance.tasks.WorldCheckClient")
    def test_successful_screening_with_matches(self, mock_client_cls, party):
        mock_client = MagicMock()
        mock_client.screen_entity.return_value = {
            "caseSystemId": "WC-SCREEN-001",
            "results": [{"matchId": "M1", "name": "John Doe"}],
        }
        mock_client_cls.return_value = mock_client

        result = screen_party_worldcheck(str(party.id))

        assert result["status"] == "completed"
        assert result["screening_status"] == ScreeningStatus.MATCHED
        assert result["matches_found"] == 1

        case = WorldCheckCase.objects.get(party=party)
        assert case.screening_status == ScreeningStatus.MATCHED
        assert case.case_system_id == "WC-SCREEN-001"

    @patch("apps.compliance.tasks.WorldCheckClient")
    def test_successful_screening_no_matches(self, mock_client_cls, party):
        mock_client = MagicMock()
        mock_client.screen_entity.return_value = {
            "caseSystemId": "WC-SCREEN-002",
            "results": [],
        }
        mock_client_cls.return_value = mock_client

        result = screen_party_worldcheck(str(party.id))

        assert result["screening_status"] == ScreeningStatus.CLEAR
        assert result["matches_found"] == 0

    @patch("apps.compliance.tasks.WorldCheckClient")
    def test_screening_failure_retries(self, mock_client_cls, party):
        mock_client = MagicMock()
        mock_client.screen_entity.side_effect = Exception("Connection error")
        mock_client_cls.return_value = mock_client

        with pytest.raises(Exception, match="Connection error"):
            screen_party_worldcheck(str(party.id))

    def test_missing_party_returns_error(self):
        result = screen_party_worldcheck("00000000-0000-0000-0000-000000000000")
        assert result["error"] == "Party not found"


# ---------------------------------------------------------------------------
# recalculate_all_risks
# ---------------------------------------------------------------------------


class TestRecalculateAllRisks:
    def test_recalculates_active_submissions(self):
        kyc1 = KYCSubmissionFactory(status=KYCStatus.SUBMITTED)
        kyc2 = KYCSubmissionFactory(status=KYCStatus.APPROVED)
        kyc3 = KYCSubmissionFactory(status=KYCStatus.DRAFT)  # Should be skipped

        PartyFactory(kyc_submission=kyc1)
        PartyFactory(kyc_submission=kyc2)
        PartyFactory(kyc_submission=kyc3)

        result = recalculate_all_risks()

        assert result["status"] == "completed"
        assert result["recalculated"] == 2  # Draft is excluded

        log = RiskRecalculationLog.objects.get(batch_id=result["batch_id"])
        assert log.status == RecalculationStatus.COMPLETED
        assert log.total_entities == 2

    def test_empty_submissions(self):
        result = recalculate_all_risks()
        assert result["status"] == "completed"
        assert result["recalculated"] == 0


class TestRecalculateHighRiskEntities:
    def test_recalculates_only_high_risk(self):
        kyc_high = KYCSubmissionFactory(status=KYCStatus.SUBMITTED)
        kyc_low = KYCSubmissionFactory(status=KYCStatus.SUBMITTED)

        PartyFactory(kyc_submission=kyc_high)
        PartyFactory(kyc_submission=kyc_low)

        RiskAssessmentFactory(
            kyc_submission=kyc_high,
            risk_level=RiskLevel.HIGH,
            is_current=True,
        )
        RiskAssessmentFactory(
            kyc_submission=kyc_low,
            risk_level=RiskLevel.LOW,
            is_current=True,
        )

        result = recalculate_high_risk_entities()

        assert result["status"] == "completed"
        assert result["recalculated"] == 1  # Only the high-risk one


# ---------------------------------------------------------------------------
# process_worldcheck_webhook
# ---------------------------------------------------------------------------


class TestProcessWorldcheckWebhook:
    def test_new_match_event(self, party):
        case = WorldCheckCaseFactory(
            party=party,
            case_system_id="WC-HOOK-001",
            screening_status=ScreeningStatus.CLEAR,
        )

        payload = {
            "caseSystemId": "WC-HOOK-001",
            "eventType": "NEW_MATCH",
            "matchData": {"matches": [{"name": "Suspicious Person"}]},
        }

        result = process_worldcheck_webhook(payload)

        assert result["status"] == "processed"
        case.refresh_from_db()
        assert case.screening_status == ScreeningStatus.MATCHED

    def test_resolved_event(self, party):
        case = WorldCheckCaseFactory(
            party=party,
            case_system_id="WC-HOOK-002",
            screening_status=ScreeningStatus.MATCHED,
        )

        payload = {
            "caseSystemId": "WC-HOOK-002",
            "eventType": "RESOLVED",
            "resolution": ScreeningStatus.CLEAR,
        }

        result = process_worldcheck_webhook(payload)

        assert result["status"] == "processed"
        case.refresh_from_db()
        assert case.screening_status == ScreeningStatus.CLEAR

    def test_unknown_case_skipped(self):
        payload = {
            "caseSystemId": "UNKNOWN-CASE",
            "eventType": "NEW_MATCH",
        }
        result = process_worldcheck_webhook(payload)
        assert result["status"] == "skipped"

    def test_empty_case_id_skipped(self):
        result = process_worldcheck_webhook({"eventType": "NEW_MATCH"})
        assert result["status"] == "skipped"
        assert result["reason"] == "no case ID in payload"


# ---------------------------------------------------------------------------
# upload_document_to_sharepoint_async
# ---------------------------------------------------------------------------


class TestUploadDocumentToSharepointAsync:
    @patch("apps.compliance.tasks.SharePointClient")
    def test_successful_upload(self, mock_client_cls, document_upload):
        mock_client = MagicMock()
        mock_client.upload_document.return_value = {
            "id": "sp-file-123",
            "webUrl": "https://sharepoint.example.com/doc.pdf",
            "driveItemId": "drive-item-456",
        }
        mock_client_cls.return_value = mock_client

        result = upload_document_to_sharepoint_async(str(document_upload.id))

        document_upload.refresh_from_db()
        assert document_upload.sharepoint_file_id == "sp-file-123"
        assert "sharepoint.example.com" in document_upload.sharepoint_web_url
        assert result["status"] == "uploaded"

    @patch("apps.compliance.tasks.SharePointClient")
    def test_upload_failure_retries(self, mock_client_cls, document_upload):
        mock_client = MagicMock()
        mock_client.upload_document.side_effect = Exception("SharePoint unavailable")
        mock_client_cls.return_value = mock_client

        with pytest.raises(Exception, match="SharePoint unavailable"):
            upload_document_to_sharepoint_async(str(document_upload.id))

    def test_missing_document_returns_error(self):
        result = upload_document_to_sharepoint_async(
            "00000000-0000-0000-0000-000000000000"
        )
        assert result["error"] == "DocumentUpload not found"
