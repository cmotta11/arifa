import pytest
from decimal import Decimal
from unittest.mock import patch

from django.utils import timezone

from apps.compliance.constants import (
    KYCStatus,
    PartyRole,
    PartyType,
    RFIStatus,
    RiskLevel,
    RiskTrigger,
    ScreeningStatus,
)
from apps.compliance.models import KYCSubmission, Party, RFI, RiskAssessment
from apps.compliance.services import (
    add_party_to_kyc,
    approve_kyc,
    calculate_risk_score,
    create_kyc_submission,
    create_rfi,
    escalate_kyc,
    generate_risk_change_summary,
    link_existing_person_to_party,
    reject_kyc,
    resolve_worldcheck_match,
    respond_to_rfi,
    submit_kyc,
    upload_kyc_document,
)

from .factories import (
    JurisdictionRiskFactory,
    KYCSubmissionFactory,
    PartyFactory,
    RFIFactory,
    RiskAssessmentFactory,
    WorldCheckCaseFactory,
)

from common.exceptions import ApplicationError


# ---------------------------------------------------------------------------
# KYC lifecycle services
# ---------------------------------------------------------------------------


class TestCreateKYCSubmission:
    def test_creates_draft_kyc(self, kyc_submission):
        kyc = create_kyc_submission(ticket_id=kyc_submission.ticket_id)
        assert kyc.status == KYCStatus.DRAFT
        assert kyc.submitted_at is None

    def test_creates_kyc_with_ticket(self, kyc_submission):
        kyc = create_kyc_submission(ticket_id=kyc_submission.ticket_id)
        assert kyc.ticket_id == kyc_submission.ticket_id


class TestSubmitKYC:
    def test_submit_draft_kyc(self, kyc_submission):
        kyc = submit_kyc(kyc_id=kyc_submission.id, submitted_by=None)
        assert kyc.status == KYCStatus.SUBMITTED
        assert kyc.submitted_at is not None

    def test_cannot_submit_non_draft(self):
        kyc = KYCSubmissionFactory(status=KYCStatus.SUBMITTED)
        with pytest.raises(ApplicationError, match="Cannot submit"):
            submit_kyc(kyc_id=kyc.id, submitted_by=None)


class TestApproveKYC:
    def test_approve_submitted_kyc(self, submitted_kyc, compliance_officer_user):
        kyc = approve_kyc(kyc_id=submitted_kyc.id, reviewed_by=compliance_officer_user)
        assert kyc.status == KYCStatus.APPROVED
        assert kyc.reviewed_by == compliance_officer_user
        assert kyc.reviewed_at is not None

    def test_approve_under_review_kyc(self, compliance_officer_user):
        kyc = KYCSubmissionFactory(status=KYCStatus.UNDER_REVIEW)
        result = approve_kyc(kyc_id=kyc.id, reviewed_by=compliance_officer_user)
        assert result.status == KYCStatus.APPROVED

    def test_cannot_approve_draft(self, compliance_officer_user):
        kyc = KYCSubmissionFactory(status=KYCStatus.DRAFT)
        with pytest.raises(ApplicationError, match="Cannot approve"):
            approve_kyc(kyc_id=kyc.id, reviewed_by=compliance_officer_user)


class TestRejectKYC:
    def test_reject_submitted_kyc(self, submitted_kyc, compliance_officer_user):
        kyc = reject_kyc(kyc_id=submitted_kyc.id, reviewed_by=compliance_officer_user)
        assert kyc.status == KYCStatus.REJECTED
        assert kyc.reviewed_by == compliance_officer_user

    def test_cannot_reject_draft(self, compliance_officer_user):
        kyc = KYCSubmissionFactory(status=KYCStatus.DRAFT)
        with pytest.raises(ApplicationError, match="Cannot reject"):
            reject_kyc(kyc_id=kyc.id, reviewed_by=compliance_officer_user)


class TestEscalateKYC:
    def test_escalate_submitted_kyc(self, submitted_kyc, compliance_officer_user):
        kyc = escalate_kyc(kyc_id=submitted_kyc.id, escalated_by=compliance_officer_user)
        assert kyc.status == KYCStatus.UNDER_REVIEW

    def test_cannot_escalate_draft(self, compliance_officer_user):
        kyc = KYCSubmissionFactory(status=KYCStatus.DRAFT)
        with pytest.raises(ApplicationError, match="Cannot escalate"):
            escalate_kyc(kyc_id=kyc.id, escalated_by=compliance_officer_user)


# ---------------------------------------------------------------------------
# Party services
# ---------------------------------------------------------------------------


class TestAddPartyToKYC:
    def test_add_party(self, kyc_submission):
        party_data = {
            "party_type": PartyType.NATURAL,
            "role": PartyRole.UBO,
            "name": "John Doe",
            "nationality": "US",
            "country_of_residence": "US",
            "pep_status": False,
            "ownership_percentage": Decimal("50.00"),
        }
        party = add_party_to_kyc(kyc_id=kyc_submission.id, party_data=party_data)
        assert party.name == "John Doe"
        assert party.kyc_submission == kyc_submission

    def test_cannot_add_party_to_approved_kyc(self):
        kyc = KYCSubmissionFactory(status=KYCStatus.APPROVED)
        with pytest.raises(ApplicationError, match="Cannot add parties"):
            add_party_to_kyc(
                kyc_id=kyc.id,
                party_data={
                    "party_type": PartyType.NATURAL,
                    "role": PartyRole.DIRECTOR,
                    "name": "Jane Doe",
                },
            )


class TestLinkExistingPerson:
    def test_link_person_to_party(self, party):
        from apps.core.models import Person

        person = Person.objects.create(
            full_name="Linked Person",
            person_type="natural",
            nationality="PA",
            country_of_residence="PA",
            pep_status=True,
        )

        result = link_existing_person_to_party(
            party_id=party.id, person_id=person.id
        )
        assert result.person == person
        assert result.name == "Linked Person"
        assert result.pep_status is True
        assert result.nationality == "PA"


# ---------------------------------------------------------------------------
# Risk assessment services
# ---------------------------------------------------------------------------


class TestCalculateRiskScore:
    def test_basic_risk_calculation(self, kyc_submission):
        # Create a party with a known jurisdiction
        PartyFactory(
            kyc_submission=kyc_submission,
            nationality="PA",
            country_of_residence="PA",
            pep_status=False,
        )
        JurisdictionRiskFactory(
            country_code="PA",
            country_name="Panama",
            risk_weight=7,
        )

        assessment = calculate_risk_score(
            kyc_id=kyc_submission.id, trigger=RiskTrigger.MANUAL
        )
        assert assessment.is_current is True
        assert assessment.trigger == RiskTrigger.MANUAL
        assert assessment.total_score >= 0
        assert assessment.risk_level in {
            RiskLevel.LOW,
            RiskLevel.MEDIUM,
            RiskLevel.HIGH,
        }
        assert "jurisdiction" in assessment.breakdown_json
        assert "pep" in assessment.breakdown_json

    def test_pep_increases_score(self, kyc_submission):
        PartyFactory(
            kyc_submission=kyc_submission,
            pep_status=True,
            nationality="US",
        )
        JurisdictionRiskFactory(
            country_code="US",
            country_name="United States",
            risk_weight=2,
        )

        assessment = calculate_risk_score(kyc_id=kyc_submission.id)
        pep_score = assessment.breakdown_json["pep"]["score"]
        assert pep_score == 25  # Full PEP weight

    def test_high_risk_jurisdiction_raises_score(self, kyc_submission):
        PartyFactory(
            kyc_submission=kyc_submission,
            nationality="NK",
            country_of_residence="NK",
        )
        JurisdictionRiskFactory(
            country_code="NK",
            country_name="North Korea",
            risk_weight=10,
        )

        assessment = calculate_risk_score(kyc_id=kyc_submission.id)
        assert assessment.breakdown_json["jurisdiction"]["score"] == 30

    def test_worldcheck_matches_increase_score(self, kyc_submission):
        party = PartyFactory(kyc_submission=kyc_submission)
        WorldCheckCaseFactory(
            party=party,
            screening_status=ScreeningStatus.MATCHED,
        )

        assessment = calculate_risk_score(kyc_id=kyc_submission.id)
        wc_score = assessment.breakdown_json["worldcheck"]["score"]
        assert wc_score == 10  # 1 match * 10

    def test_previous_assessment_marked_non_current(self, kyc_submission):
        PartyFactory(kyc_submission=kyc_submission)

        first = calculate_risk_score(kyc_id=kyc_submission.id)
        assert first.is_current is True

        second = calculate_risk_score(kyc_id=kyc_submission.id)
        assert second.is_current is True

        first.refresh_from_db()
        assert first.is_current is False

    def test_empty_kyc_has_zero_score(self, kyc_submission):
        # No parties
        assessment = calculate_risk_score(kyc_id=kyc_submission.id)
        assert assessment.total_score == 0
        assert assessment.risk_level == RiskLevel.LOW

    def test_corporate_structure_adds_complexity(self, kyc_submission):
        for _ in range(3):
            PartyFactory(
                kyc_submission=kyc_submission,
                party_type=PartyType.CORPORATE,
            )

        assessment = calculate_risk_score(kyc_id=kyc_submission.id)
        structure_score = assessment.breakdown_json["structure"]["score"]
        assert structure_score > 0


class TestGenerateRiskChangeSummary:
    def test_summary_with_level_change(self, kyc_submission):
        prev = RiskAssessmentFactory(
            kyc_submission=kyc_submission,
            total_score=30,
            risk_level=RiskLevel.LOW,
            is_current=False,
            breakdown_json={
                "jurisdiction": {"score": 10},
                "pep": {"score": 0},
                "structure": {"score": 10},
                "worldcheck": {"score": 10},
            },
        )
        new = RiskAssessmentFactory(
            kyc_submission=kyc_submission,
            total_score=75,
            risk_level=RiskLevel.HIGH,
            is_current=True,
            breakdown_json={
                "jurisdiction": {"score": 20},
                "pep": {"score": 25},
                "structure": {"score": 10},
                "worldcheck": {"score": 20},
            },
        )
        summary = generate_risk_change_summary(
            previous_assessment=prev, new_assessment=new
        )
        assert "increased" in summary
        assert "30" in summary
        assert "75" in summary
        assert "Low" in summary
        assert "High" in summary

    def test_summary_no_level_change(self, kyc_submission):
        prev = RiskAssessmentFactory(
            kyc_submission=kyc_submission,
            total_score=50,
            risk_level=RiskLevel.MEDIUM,
            is_current=False,
            breakdown_json={
                "jurisdiction": {"score": 15},
                "pep": {"score": 25},
                "structure": {"score": 5},
                "worldcheck": {"score": 5},
            },
        )
        new = RiskAssessmentFactory(
            kyc_submission=kyc_submission,
            total_score=55,
            risk_level=RiskLevel.MEDIUM,
            is_current=True,
            breakdown_json={
                "jurisdiction": {"score": 15},
                "pep": {"score": 25},
                "structure": {"score": 5},
                "worldcheck": {"score": 10},
            },
        )
        summary = generate_risk_change_summary(
            previous_assessment=prev, new_assessment=new
        )
        assert "remains Medium" in summary


# ---------------------------------------------------------------------------
# RFI services
# ---------------------------------------------------------------------------


class TestCreateRFI:
    def test_create_rfi(self, kyc_submission, compliance_officer_user):
        rfi = create_rfi(
            kyc_id=kyc_submission.id,
            requested_by=compliance_officer_user,
            requested_fields=["passport", "proof_of_address"],
            notes="Urgent",
        )
        assert rfi.status == RFIStatus.OPEN
        assert rfi.notes == "Urgent"
        assert len(rfi.requested_fields) == 2


class TestRespondToRFI:
    def test_respond_to_open_rfi(self, rfi):
        result = respond_to_rfi(rfi_id=rfi.id, response_text="Documents attached.")
        assert result.status == RFIStatus.RESPONDED
        assert result.response_text == "Documents attached."
        assert result.responded_at is not None

    def test_cannot_respond_to_already_responded_rfi(self, rfi):
        respond_to_rfi(rfi_id=rfi.id, response_text="First response.")
        with pytest.raises(ApplicationError, match="Cannot respond"):
            respond_to_rfi(rfi_id=rfi.id, response_text="Second response.")


# ---------------------------------------------------------------------------
# World-Check resolution
# ---------------------------------------------------------------------------


class TestResolveWorldCheckMatch:
    def test_resolve_as_false_positive(self, compliance_officer_user):
        case = WorldCheckCaseFactory(screening_status=ScreeningStatus.MATCHED)
        result = resolve_worldcheck_match(
            case_id=case.id,
            resolution=ScreeningStatus.FALSE_POSITIVE,
            resolved_by=compliance_officer_user,
        )
        assert result.screening_status == ScreeningStatus.FALSE_POSITIVE
        assert result.resolved_by == compliance_officer_user
        assert result.resolved_at is not None

    def test_resolve_as_true_match(self, compliance_officer_user):
        case = WorldCheckCaseFactory(screening_status=ScreeningStatus.ESCALATED)
        result = resolve_worldcheck_match(
            case_id=case.id,
            resolution=ScreeningStatus.TRUE_MATCH,
            resolved_by=compliance_officer_user,
        )
        assert result.screening_status == ScreeningStatus.TRUE_MATCH

    def test_cannot_resolve_clear_case(self, compliance_officer_user):
        case = WorldCheckCaseFactory(screening_status=ScreeningStatus.CLEAR)
        with pytest.raises(ApplicationError, match="Cannot resolve"):
            resolve_worldcheck_match(
                case_id=case.id,
                resolution=ScreeningStatus.FALSE_POSITIVE,
                resolved_by=compliance_officer_user,
            )

    def test_invalid_resolution_raises_error(self, compliance_officer_user):
        case = WorldCheckCaseFactory(screening_status=ScreeningStatus.MATCHED)
        with pytest.raises(ApplicationError, match="Invalid resolution"):
            resolve_worldcheck_match(
                case_id=case.id,
                resolution="invalid_status",
                resolved_by=compliance_officer_user,
            )


# ---------------------------------------------------------------------------
# Document upload
# ---------------------------------------------------------------------------


class TestUploadKYCDocument:
    @patch("apps.compliance.tasks.upload_document_to_sharepoint_async.delay")
    def test_upload_creates_record(self, mock_sp_task, kyc_submission, coordinator_user):
        doc = upload_kyc_document(
            kyc_id=kyc_submission.id,
            document_type="passport",
            file_data={
                "original_filename": "scan.pdf",
                "file_size": 500000,
                "mime_type": "application/pdf",
            },
            uploaded_by=coordinator_user,
        )
        assert doc.original_filename == "scan.pdf"
        assert doc.file_size == 500000
        assert doc.kyc_submission == kyc_submission
        mock_sp_task.assert_called_once_with(str(doc.id))

    @patch("apps.compliance.tasks.upload_document_to_sharepoint_async.delay")
    def test_upload_requires_kyc_or_party(self, mock_sp_task, coordinator_user):
        with pytest.raises(ApplicationError, match="At least one"):
            upload_kyc_document(
                document_type="passport",
                file_data={"original_filename": "test.pdf"},
                uploaded_by=coordinator_user,
            )
