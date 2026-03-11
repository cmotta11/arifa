from django.db.models import QuerySet

from .constants import KYCStatus, RFIStatus
from .models import (
    ComplianceSnapshot,
    KYCSubmission,
    Party,
    RFI,
    RiskAssessment,
    RiskMatrixConfig,
    WorldCheckCase,
)


def get_kyc_submissions_for_review() -> QuerySet[KYCSubmission]:
    from django.db.models import Case, IntegerField, Value, When

    priority_ordering = Case(
        When(status=KYCStatus.UNDER_REVIEW, then=Value(0)),
        When(status=KYCStatus.SUBMITTED, then=Value(1)),
        default=Value(2),
        output_field=IntegerField(),
    )
    return (
        KYCSubmission.objects.filter(
            status__in=[KYCStatus.SUBMITTED, KYCStatus.UNDER_REVIEW],
        )
        .annotate(review_priority=priority_ordering)
        .select_related("ticket", "reviewed_by")
        .order_by("review_priority", "submitted_at")
    )


def get_parties_for_kyc(*, kyc_id) -> QuerySet[Party]:
    return (
        Party.objects.filter(kyc_submission_id=kyc_id)
        .select_related("person", "kyc_submission")
        .order_by("name")
    )


# ===========================================================================
# KYC-level risk selectors (legacy)
# ===========================================================================


def get_risk_history(*, kyc_id) -> QuerySet[RiskAssessment]:
    return RiskAssessment.objects.filter(kyc_submission_id=kyc_id).order_by("-assessed_at")


def get_current_risk_assessment(*, kyc_id) -> RiskAssessment | None:
    return RiskAssessment.objects.filter(kyc_submission_id=kyc_id, is_current=True).first()


# ===========================================================================
# Entity risk selectors
# ===========================================================================


def get_current_entity_risk(*, entity_id) -> RiskAssessment | None:
    return (
        RiskAssessment.objects.filter(entity_id=entity_id, is_current=True)
        .select_related("matrix_config", "assessed_by")
        .first()
    )


def get_entity_risk_history(*, entity_id) -> QuerySet[RiskAssessment]:
    return (
        RiskAssessment.objects.filter(entity_id=entity_id)
        .select_related("matrix_config", "assessed_by", "snapshot")
        .order_by("-assessed_at")
    )


# ===========================================================================
# Person risk selectors
# ===========================================================================


def get_current_person_risk(*, person_id) -> RiskAssessment | None:
    return (
        RiskAssessment.objects.filter(person_id=person_id, is_current=True)
        .select_related("matrix_config", "assessed_by")
        .first()
    )


def get_person_risk_history(*, person_id) -> QuerySet[RiskAssessment]:
    return (
        RiskAssessment.objects.filter(person_id=person_id)
        .select_related("matrix_config", "assessed_by", "snapshot")
        .order_by("-assessed_at")
    )


# ===========================================================================
# Other selectors
# ===========================================================================


def get_pending_rfis() -> QuerySet[RFI]:
    return (
        RFI.objects.filter(status=RFIStatus.OPEN)
        .select_related("kyc_submission", "requested_by")
        .order_by("created_at")
    )


def get_worldcheck_results(*, party_id) -> QuerySet[WorldCheckCase]:
    return (
        WorldCheckCase.objects.filter(party_id=party_id)
        .select_related("party", "resolved_by")
        .order_by("-last_screened_at")
    )


def get_active_matrix_configs() -> QuerySet[RiskMatrixConfig]:
    return RiskMatrixConfig.objects.filter(is_active=True).order_by("-version")


def get_compliance_snapshots() -> QuerySet[ComplianceSnapshot]:
    return ComplianceSnapshot.objects.all().order_by("-snapshot_date")


def get_snapshot_assessments(*, snapshot_id) -> QuerySet[RiskAssessment]:
    return (
        RiskAssessment.objects.filter(snapshot_id=snapshot_id)
        .select_related("entity", "person")
        .order_by("-total_score")
    )


def get_risk_stats() -> dict:
    """Return aggregate risk stats for the compliance dashboard."""
    from .constants import RiskLevel

    current = RiskAssessment.objects.filter(is_current=True)
    return {
        "high_risk_count": current.filter(risk_level=RiskLevel.HIGH).count(),
        "medium_risk_count": current.filter(risk_level=RiskLevel.MEDIUM).count(),
        "low_risk_count": current.filter(risk_level=RiskLevel.LOW).count(),
    }
