"""
Phase 3.8.5 - Compliance Dashboard Tests

Tests for:
- KPI aggregation queries (risk stats)
- Filtering by jurisdiction/type/status
- Compliance snapshot creation and assessment listing
"""
import pytest
from unittest.mock import patch

from apps.authentication.constants import COMPLIANCE_OFFICER
from apps.authentication.tests.factories import UserFactory
from apps.compliance.constants import (
    KYCStatus,
    RiskLevel,
    RiskTrigger,
    SnapshotStatus,
)
from apps.compliance.models import (
    ComplianceSnapshot,
    RiskAssessment,
)
from apps.compliance.services import create_compliance_snapshot
from apps.core.tests.factories import ClientFactory, EntityFactory, PersonFactory

from .factories import (
    KYCSubmissionFactory,
    RiskAssessmentFactory,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


@pytest.fixture
def assessments_set():
    """Create a diverse set of risk assessments for aggregate testing."""
    kyc1 = KYCSubmissionFactory()
    kyc2 = KYCSubmissionFactory()
    kyc3 = KYCSubmissionFactory()
    kyc4 = KYCSubmissionFactory()
    kyc5 = KYCSubmissionFactory()

    a1 = RiskAssessmentFactory(
        kyc_submission=kyc1, total_score=80, risk_level=RiskLevel.HIGH, is_current=True,
    )
    a2 = RiskAssessmentFactory(
        kyc_submission=kyc2, total_score=55, risk_level=RiskLevel.MEDIUM, is_current=True,
    )
    a3 = RiskAssessmentFactory(
        kyc_submission=kyc3, total_score=20, risk_level=RiskLevel.LOW, is_current=True,
    )
    a4 = RiskAssessmentFactory(
        kyc_submission=kyc4, total_score=75, risk_level=RiskLevel.HIGH, is_current=True,
    )
    a5 = RiskAssessmentFactory(
        kyc_submission=kyc5, total_score=45, risk_level=RiskLevel.MEDIUM, is_current=True,
    )
    return [a1, a2, a3, a4, a5]


# ---------------------------------------------------------------------------
# KPI aggregation queries
# ---------------------------------------------------------------------------


class TestKPIAggregation:
    def test_risk_assessment_count_by_level(self, assessments_set):
        high = RiskAssessment.objects.filter(is_current=True, risk_level=RiskLevel.HIGH).count()
        medium = RiskAssessment.objects.filter(is_current=True, risk_level=RiskLevel.MEDIUM).count()
        low = RiskAssessment.objects.filter(is_current=True, risk_level=RiskLevel.LOW).count()

        assert high == 2
        assert medium == 2
        assert low == 1

    def test_total_current_assessments(self, assessments_set):
        total = RiskAssessment.objects.filter(is_current=True).count()
        assert total == 5

    def test_average_risk_score(self, assessments_set):
        from django.db.models import Avg
        avg = RiskAssessment.objects.filter(is_current=True).aggregate(
            avg_score=Avg("total_score"),
        )["avg_score"]
        # (80 + 55 + 20 + 75 + 45) / 5 = 55.0
        assert abs(avg - 55.0) < 0.01

    def test_non_current_assessments_excluded(self, assessments_set):
        """Old assessments should not appear in KPI stats."""
        kyc = KYCSubmissionFactory()
        RiskAssessmentFactory(
            kyc_submission=kyc, total_score=90, risk_level=RiskLevel.HIGH,
            is_current=False,
        )
        # Only current ones counted
        high = RiskAssessment.objects.filter(is_current=True, risk_level=RiskLevel.HIGH).count()
        assert high == 2  # Still 2, the non-current one is excluded

    def test_kyc_status_distribution(self):
        KYCSubmissionFactory(status=KYCStatus.DRAFT)
        KYCSubmissionFactory(status=KYCStatus.DRAFT)
        KYCSubmissionFactory(status=KYCStatus.SUBMITTED)
        KYCSubmissionFactory(status=KYCStatus.APPROVED)
        KYCSubmissionFactory(status=KYCStatus.REJECTED)

        from apps.compliance.models import KYCSubmission
        from django.db.models import Count

        distribution = dict(
            KYCSubmission.objects.values_list("status")
            .annotate(count=Count("id"))
            .values_list("status", "count")
        )
        assert distribution.get(KYCStatus.DRAFT, 0) >= 2
        assert distribution.get(KYCStatus.SUBMITTED, 0) >= 1


# ---------------------------------------------------------------------------
# Filtering by jurisdiction/type/status
# ---------------------------------------------------------------------------


class TestFiltering:
    def test_filter_assessments_by_risk_level(self, assessments_set):
        high = RiskAssessment.objects.filter(
            is_current=True, risk_level=RiskLevel.HIGH,
        )
        assert high.count() == 2
        assert all(a.total_score >= 70 for a in high)

    def test_filter_entity_assessments(self):
        client = ClientFactory()
        entity = EntityFactory(client=client, jurisdiction="BVI")
        RiskAssessmentFactory(
            entity=entity, kyc_submission=None,
            total_score=65, risk_level=RiskLevel.MEDIUM, is_current=True,
        )
        entity_assessments = RiskAssessment.objects.filter(
            entity=entity, is_current=True,
        )
        assert entity_assessments.count() == 1

    def test_filter_person_assessments(self):
        person = PersonFactory()
        RiskAssessmentFactory(
            person=person, kyc_submission=None,
            total_score=85, risk_level=RiskLevel.HIGH, is_current=True,
        )
        person_assessments = RiskAssessment.objects.filter(
            person=person, is_current=True,
        )
        assert person_assessments.count() == 1


# ---------------------------------------------------------------------------
# Compliance Snapshot
# ---------------------------------------------------------------------------


class TestComplianceSnapshot:
    @patch("apps.compliance.tasks.run_compliance_snapshot_task.delay")
    def test_create_snapshot(self, mock_task):
        user = UserFactory(role=COMPLIANCE_OFFICER)
        snapshot = create_compliance_snapshot(
            name="Q4 2025 Snapshot",
            notes="Quarterly compliance review",
            created_by=user,
        )
        assert snapshot.name == "Q4 2025 Snapshot"
        assert snapshot.status == SnapshotStatus.RUNNING
        assert snapshot.created_by == user
        mock_task.assert_called_once_with(str(snapshot.id))

    @patch("apps.compliance.tasks.run_compliance_snapshot_task.delay")
    def test_snapshot_fields_initialized(self, mock_task):
        user = UserFactory(role=COMPLIANCE_OFFICER)
        snapshot = create_compliance_snapshot(
            name="Year-End 2025",
            created_by=user,
        )
        assert snapshot.total_entities == 0
        assert snapshot.total_persons == 0
        assert snapshot.high_risk_count == 0
        assert snapshot.medium_risk_count == 0
        assert snapshot.low_risk_count == 0
        assert snapshot.completed_at is None

    def test_snapshot_assessments_query(self):
        snapshot = ComplianceSnapshot.objects.create(
            name="Test Snapshot",
            snapshot_date="2025-12-31T00:00:00Z",
            status=SnapshotStatus.COMPLETED,
            total_entities=3,
            high_risk_count=1,
            medium_risk_count=1,
            low_risk_count=1,
        )
        kyc = KYCSubmissionFactory()
        RiskAssessmentFactory(
            kyc_submission=kyc, snapshot=snapshot,
            total_score=80, risk_level=RiskLevel.HIGH,
        )
        RiskAssessmentFactory(
            kyc_submission=KYCSubmissionFactory(), snapshot=snapshot,
            total_score=50, risk_level=RiskLevel.MEDIUM,
        )

        assessments = RiskAssessment.objects.filter(snapshot=snapshot)
        assert assessments.count() == 2

        high_only = assessments.filter(risk_level=RiskLevel.HIGH)
        assert high_only.count() == 1
