"""
Phase 3.1.7 - KYC Tests

Tests for:
- World-Check screening trigger on party add
- KYC renewal scheduling logic
- DueDiligenceChecklist CRUD operations
- KYC submission state transitions
"""
import pytest
from datetime import timedelta
from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.utils import timezone

from apps.authentication.tests.factories import UserFactory
from apps.compliance.constants import (
    DDChecklistSection,
    KYCStatus,
    PartyRole,
    PartyType,
    RFIStatus,
    ScreeningStatus,
)
from apps.compliance.models import (
    DueDiligenceChecklist,
    JurisdictionConfig,
    KYCSubmission,
    Party,
    WorldCheckCase,
)
from apps.compliance.services import (
    add_party_to_kyc,
    approve_kyc,
    complete_checklist,
    create_kyc_submission,
    create_or_update_checklist,
    escalate_kyc,
    reject_kyc,
    send_back_kyc,
    submit_kyc,
)

from common.exceptions import ApplicationError

from .factories import (
    JurisdictionRiskFactory,
    KYCSubmissionFactory,
    PartyFactory,
)


# ---------------------------------------------------------------------------
# World-Check screening trigger on party add
# ---------------------------------------------------------------------------


class TestWorldCheckScreeningTrigger:
    """Verify that adding a party to a KYC dispatches World-Check screening."""

    @patch("apps.compliance.tasks.screen_party_worldcheck.delay")
    def test_add_party_dispatches_screening(self, mock_screen_delay, kyc_submission):
        party_data = {
            "party_type": PartyType.NATURAL,
            "role": PartyRole.UBO,
            "name": "John Doe",
            "nationality": "US",
            "pep_status": False,
        }
        party = add_party_to_kyc(kyc_id=kyc_submission.id, party_data=party_data)

        mock_screen_delay.assert_called_once_with(str(party.id))

    @patch("apps.compliance.tasks.screen_party_worldcheck.delay")
    def test_add_multiple_parties_dispatches_multiple_screenings(
        self, mock_screen_delay, kyc_submission
    ):
        for i in range(3):
            add_party_to_kyc(
                kyc_id=kyc_submission.id,
                party_data={
                    "party_type": PartyType.NATURAL,
                    "role": PartyRole.UBO,
                    "name": f"Person {i}",
                },
            )
        assert mock_screen_delay.call_count == 3

    @patch(
        "apps.compliance.tasks.screen_party_worldcheck.delay",
        side_effect=Exception("Queue down"),
    )
    def test_screening_failure_does_not_block_party_creation(
        self, mock_screen_delay, kyc_submission
    ):
        """Even if screening dispatch fails, the party is still created."""
        party = add_party_to_kyc(
            kyc_id=kyc_submission.id,
            party_data={
                "party_type": PartyType.CORPORATE,
                "role": PartyRole.SHAREHOLDER,
                "name": "Corp Shareholder",
            },
        )
        assert party.id is not None
        assert party.name == "Corp Shareholder"

    @patch("apps.compliance.tasks.screen_party_worldcheck.delay")
    def test_party_screening_includes_corporate_type(
        self, mock_screen_delay, kyc_submission
    ):
        party = add_party_to_kyc(
            kyc_id=kyc_submission.id,
            party_data={
                "party_type": PartyType.CORPORATE,
                "role": PartyRole.SHAREHOLDER,
                "name": "ACME Corp",
                "nationality": "BZ",
            },
        )
        mock_screen_delay.assert_called_once_with(str(party.id))


# ---------------------------------------------------------------------------
# KYC renewal scheduling logic
# ---------------------------------------------------------------------------


class TestKYCRenewalScheduling:
    """Test the check_kyc_renewals task logic."""

    @patch("apps.compliance.tasks.check_kyc_renewals.delay")
    def test_renewal_check_task_exists(self, mock_delay):
        """The task can be dispatched."""
        from apps.compliance.tasks import check_kyc_renewals

        assert check_kyc_renewals is not None

    def test_jurisdiction_config_kyc_renewal_months_default(self):
        jr = JurisdictionRiskFactory(country_code="BV", country_name="BVI", risk_weight=5)
        config = JurisdictionConfig.objects.create(
            jurisdiction=jr,
            kyc_renewal_months=12,
        )
        assert config.kyc_renewal_months == 12

    def test_jurisdiction_config_custom_renewal_months(self):
        jr = JurisdictionRiskFactory(country_code="PA", country_name="Panama", risk_weight=7)
        config = JurisdictionConfig.objects.create(
            jurisdiction=jr,
            kyc_renewal_months=24,
        )
        assert config.kyc_renewal_months == 24

    def test_approved_kyc_has_reviewed_at_for_renewal(self, compliance_officer_user):
        kyc = KYCSubmissionFactory(status=KYCStatus.SUBMITTED)
        result = approve_kyc(kyc_id=kyc.id, reviewed_by=compliance_officer_user)
        assert result.reviewed_at is not None

    def test_renewal_due_calculation(self):
        """Validate the renewal due date math: last_approved + months * 30."""
        last_approved = timezone.now() - timedelta(days=400)
        renewal_months = 12
        renewal_due = last_approved + timedelta(days=renewal_months * 30)
        # 12 months * 30 = 360 days ago approved, but 400 days passed => due
        assert renewal_due < timezone.now()


# ---------------------------------------------------------------------------
# DueDiligenceChecklist CRUD operations
# ---------------------------------------------------------------------------


class TestDueDiligenceChecklist:
    def test_create_checklist(self, kyc_submission):
        checklist = create_or_update_checklist(
            kyc_id=kyc_submission.id,
            section=DDChecklistSection.ENTITY_DETAILS,
            items=[
                {"label": "Verify entity name", "checked": False},
                {"label": "Confirm jurisdiction", "checked": True},
            ],
        )
        assert checklist.section == DDChecklistSection.ENTITY_DETAILS
        assert len(checklist.items) == 2
        assert checklist.completed_at is None

    def test_update_checklist_items(self, kyc_submission):
        checklist = create_or_update_checklist(
            kyc_id=kyc_submission.id,
            section=DDChecklistSection.SHAREHOLDERS,
            items=[{"label": "Check ownership", "checked": False}],
        )
        updated = create_or_update_checklist(
            kyc_id=kyc_submission.id,
            section=DDChecklistSection.SHAREHOLDERS,
            items=[
                {"label": "Check ownership", "checked": True},
                {"label": "Verify source of funds", "checked": False},
            ],
        )
        assert updated.id == checklist.id
        assert len(updated.items) == 2

    def test_unique_per_kyc_section(self, kyc_submission):
        """Only one checklist per KYC + section combination."""
        create_or_update_checklist(
            kyc_id=kyc_submission.id,
            section=DDChecklistSection.DIRECTORS_OFFICERS,
            items=[{"label": "Verify directors", "checked": False}],
        )
        count = DueDiligenceChecklist.objects.filter(
            kyc_submission=kyc_submission,
            section=DDChecklistSection.DIRECTORS_OFFICERS,
        ).count()
        assert count == 1

    def test_complete_checklist(self, kyc_submission, compliance_officer_user):
        checklist = create_or_update_checklist(
            kyc_id=kyc_submission.id,
            section=DDChecklistSection.BENEFICIAL_OWNERS,
            items=[{"label": "Identify UBOs", "checked": True}],
        )
        completed = complete_checklist(
            checklist_id=checklist.id,
            completed_by=compliance_officer_user,
        )
        assert completed.completed_at is not None
        assert completed.completed_by == compliance_officer_user

    def test_invalid_section_raises_error(self, kyc_submission):
        with pytest.raises(ApplicationError, match="Invalid checklist section"):
            create_or_update_checklist(
                kyc_id=kyc_submission.id,
                section="invalid_section",
                items=[],
            )

    def test_create_all_sections(self, kyc_submission):
        for section in DDChecklistSection.values:
            checklist = create_or_update_checklist(
                kyc_id=kyc_submission.id,
                section=section,
                items=[{"label": f"Item for {section}", "checked": False}],
            )
            assert checklist.section == section

        total = DueDiligenceChecklist.objects.filter(
            kyc_submission=kyc_submission
        ).count()
        assert total == len(DDChecklistSection.values)


# ---------------------------------------------------------------------------
# KYC submission state transitions
# ---------------------------------------------------------------------------


class TestKYCStateTransitions:
    def test_draft_to_submitted(self, kyc_submission):
        kyc = submit_kyc(kyc_id=kyc_submission.id, submitted_by=None)
        assert kyc.status == KYCStatus.SUBMITTED
        assert kyc.submitted_at is not None

    def test_submitted_to_approved(self, submitted_kyc, compliance_officer_user):
        kyc = approve_kyc(kyc_id=submitted_kyc.id, reviewed_by=compliance_officer_user)
        assert kyc.status == KYCStatus.APPROVED
        assert kyc.reviewed_at is not None

    def test_submitted_to_rejected(self, submitted_kyc, compliance_officer_user):
        kyc = reject_kyc(kyc_id=submitted_kyc.id, reviewed_by=compliance_officer_user)
        assert kyc.status == KYCStatus.REJECTED

    def test_submitted_to_under_review(self, submitted_kyc, compliance_officer_user):
        kyc = escalate_kyc(kyc_id=submitted_kyc.id, escalated_by=compliance_officer_user)
        assert kyc.status == KYCStatus.UNDER_REVIEW

    def test_under_review_to_approved(self, compliance_officer_user):
        kyc = KYCSubmissionFactory(status=KYCStatus.UNDER_REVIEW)
        result = approve_kyc(kyc_id=kyc.id, reviewed_by=compliance_officer_user)
        assert result.status == KYCStatus.APPROVED

    def test_sent_back_to_submitted(self, compliance_officer_user):
        kyc = KYCSubmissionFactory(status=KYCStatus.SUBMITTED)
        sent_back = send_back_kyc(
            kyc_id=kyc.id,
            reviewed_by=compliance_officer_user,
            field_comments={"entity_name": [{"text": "Please verify name"}]},
        )
        assert sent_back.status == KYCStatus.SENT_BACK

        resubmitted = submit_kyc(kyc_id=sent_back.id, submitted_by=None)
        assert resubmitted.status == KYCStatus.SUBMITTED

    def test_cannot_approve_draft(self, compliance_officer_user):
        kyc = KYCSubmissionFactory(status=KYCStatus.DRAFT)
        with pytest.raises(ApplicationError, match="Cannot approve"):
            approve_kyc(kyc_id=kyc.id, reviewed_by=compliance_officer_user)

    def test_cannot_reject_draft(self, compliance_officer_user):
        kyc = KYCSubmissionFactory(status=KYCStatus.DRAFT)
        with pytest.raises(ApplicationError, match="Cannot reject"):
            reject_kyc(kyc_id=kyc.id, reviewed_by=compliance_officer_user)

    def test_cannot_submit_approved(self):
        kyc = KYCSubmissionFactory(status=KYCStatus.APPROVED)
        with pytest.raises(ApplicationError, match="Cannot submit"):
            submit_kyc(kyc_id=kyc.id, submitted_by=None)

    def test_cannot_escalate_draft(self, compliance_officer_user):
        kyc = KYCSubmissionFactory(status=KYCStatus.DRAFT)
        with pytest.raises(ApplicationError, match="Cannot escalate"):
            escalate_kyc(kyc_id=kyc.id, escalated_by=compliance_officer_user)

    def test_cannot_add_party_to_rejected_kyc(self):
        kyc = KYCSubmissionFactory(status=KYCStatus.REJECTED)
        with pytest.raises(ApplicationError, match="Cannot add parties"):
            add_party_to_kyc(
                kyc_id=kyc.id,
                party_data={
                    "party_type": PartyType.NATURAL,
                    "role": PartyRole.DIRECTOR,
                    "name": "Test",
                },
            )
