import pytest
from decimal import Decimal

from django.core.exceptions import ValidationError

from apps.compliance.constants import (
    DocumentType,
    KYCStatus,
    LLMExtractionStatus,
    PartyRole,
    PartyType,
    RFIStatus,
    RiskLevel,
    ScreeningStatus,
)
from apps.compliance.models import (
    DocumentUpload,
    JurisdictionRisk,
    KYCSubmission,
    Party,
    RFI,
    RiskAssessment,
    RiskRecalculationLog,
    WorldCheckCase,
)

from .factories import (
    DocumentUploadFactory,
    JurisdictionRiskFactory,
    KYCSubmissionFactory,
    PartyFactory,
    RFIFactory,
    RiskAssessmentFactory,
    RiskRecalculationLogFactory,
    WorldCheckCaseFactory,
)


# ---------------------------------------------------------------------------
# KYCSubmission
# ---------------------------------------------------------------------------


class TestKYCSubmission:
    def test_create_kyc_submission(self, kyc_submission):
        assert kyc_submission.status == KYCStatus.DRAFT
        assert kyc_submission.submitted_at is None
        assert kyc_submission.reviewed_by is None
        assert kyc_submission.reviewed_at is None
        assert kyc_submission.id is not None

    def test_str_representation(self, kyc_submission):
        result = str(kyc_submission)
        assert "KYC" in result
        assert "Draft" in result

    def test_default_ordering(self):
        kyc1 = KYCSubmissionFactory()
        kyc2 = KYCSubmissionFactory()
        submissions = list(KYCSubmission.objects.all())
        # Default ordering is -created_at (newest first)
        assert submissions[0].id == kyc2.id
        assert submissions[1].id == kyc1.id


# ---------------------------------------------------------------------------
# Party
# ---------------------------------------------------------------------------


class TestParty:
    def test_create_party(self, party):
        assert party.party_type == PartyType.NATURAL
        assert party.role == PartyRole.UBO
        assert party.pep_status is False
        assert party.ownership_percentage == Decimal("25.00")

    def test_str_representation(self, party):
        result = str(party)
        assert "UBO" in result

    def test_party_with_pep_status(self, pep_party):
        assert pep_party.pep_status is True
        assert pep_party.name == "PEP Person"

    def test_party_belongs_to_kyc(self, kyc_submission, party):
        assert party.kyc_submission == kyc_submission
        assert kyc_submission.parties.count() == 1


# ---------------------------------------------------------------------------
# JurisdictionRisk
# ---------------------------------------------------------------------------


class TestJurisdictionRisk:
    def test_create_jurisdiction_risk(self, jurisdiction_risk_high):
        assert jurisdiction_risk_high.country_code == "PA"
        assert jurisdiction_risk_high.risk_weight == 8

    def test_unique_country_code(self, jurisdiction_risk_high):
        with pytest.raises(Exception):
            JurisdictionRiskFactory(country_code="PA")

    def test_risk_weight_validators(self):
        jr = JurisdictionRisk(
            country_code="XX",
            country_name="Test",
            risk_weight=15,
        )
        with pytest.raises(ValidationError):
            jr.full_clean()

    def test_risk_weight_min_validator(self):
        jr = JurisdictionRisk(
            country_code="YY",
            country_name="Test",
            risk_weight=0,
        )
        with pytest.raises(ValidationError):
            jr.full_clean()

    def test_str_representation(self, jurisdiction_risk_high):
        result = str(jurisdiction_risk_high)
        assert "Panama" in result
        assert "PA" in result
        assert "8" in result


# ---------------------------------------------------------------------------
# RiskAssessment
# ---------------------------------------------------------------------------


class TestRiskAssessment:
    def test_create_risk_assessment(self, risk_assessment):
        assert risk_assessment.total_score == 45
        assert risk_assessment.risk_level == RiskLevel.MEDIUM
        assert risk_assessment.is_current is True
        assert risk_assessment.breakdown_json is not None

    def test_str_representation(self, risk_assessment):
        result = str(risk_assessment)
        assert "Medium" in result
        assert "45" in result

    def test_multiple_assessments_for_kyc(self, kyc_submission):
        a1 = RiskAssessmentFactory(kyc_submission=kyc_submission, is_current=False)
        a2 = RiskAssessmentFactory(kyc_submission=kyc_submission, is_current=True)
        assessments = kyc_submission.risk_assessments.all()
        assert assessments.count() == 2
        current = assessments.filter(is_current=True)
        assert current.count() == 1
        assert current.first().id == a2.id


# ---------------------------------------------------------------------------
# RiskRecalculationLog
# ---------------------------------------------------------------------------


class TestRiskRecalculationLog:
    def test_create_log(self):
        log = RiskRecalculationLogFactory()
        assert log.total_entities == 10
        assert log.recalculated_count == 10
        assert log.changed_count == 2

    def test_str_representation(self):
        log = RiskRecalculationLogFactory()
        result = str(log)
        assert "Recalc batch" in result


# ---------------------------------------------------------------------------
# RFI
# ---------------------------------------------------------------------------


class TestRFI:
    def test_create_rfi(self, rfi):
        assert rfi.status == RFIStatus.OPEN
        assert rfi.responded_at is None
        assert isinstance(rfi.requested_fields, list)

    def test_str_representation(self, rfi):
        result = str(rfi)
        assert "RFI" in result
        assert "Open" in result


# ---------------------------------------------------------------------------
# WorldCheckCase
# ---------------------------------------------------------------------------


class TestWorldCheckCase:
    def test_create_worldcheck_case(self, worldcheck_case):
        assert worldcheck_case.screening_status == ScreeningStatus.PENDING
        assert worldcheck_case.ongoing_monitoring_enabled is False

    def test_str_representation(self, worldcheck_case):
        result = str(worldcheck_case)
        assert "WC Case" in result

    def test_worldcheck_case_belongs_to_party(self, party, worldcheck_case):
        assert worldcheck_case.party == party
        assert party.worldcheck_cases.count() == 1


# ---------------------------------------------------------------------------
# DocumentUpload
# ---------------------------------------------------------------------------


class TestDocumentUpload:
    def test_create_document(self, document_upload):
        assert document_upload.document_type == DocumentType.PASSPORT
        assert document_upload.llm_extraction_status == LLMExtractionStatus.PENDING
        assert document_upload.file_size == 1024000

    def test_str_representation(self, document_upload):
        result = str(document_upload)
        assert "passport_scan.pdf" in result
        assert "Passport" in result

    def test_document_belongs_to_kyc(self, kyc_submission, document_upload):
        assert document_upload.kyc_submission == kyc_submission
        assert kyc_submission.documents.count() == 1
