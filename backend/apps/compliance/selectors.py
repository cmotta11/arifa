from django.db.models import QuerySet

from .constants import KYCStatus, RFIStatus
from .models import (
    KYCSubmission,
    Party,
    RFI,
    RiskAssessment,
    WorldCheckCase,
)


def get_kyc_submissions_for_review() -> QuerySet[KYCSubmission]:
    """Return KYC submissions that need review, ordered by priority.

    Priority order:
    1. UNDER_REVIEW first (already escalated)
    2. SUBMITTED (awaiting initial review)
    Within each group, oldest first (FIFO).
    """
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
    """Return all parties linked to a KYC submission with related data."""
    return (
        Party.objects.filter(kyc_submission_id=kyc_id)
        .select_related("person", "kyc_submission")
        .order_by("name")
    )


def get_risk_history(*, kyc_id) -> QuerySet[RiskAssessment]:
    """Return the full risk assessment history for a KYC submission,
    ordered by most recent first.
    """
    return (
        RiskAssessment.objects.filter(kyc_submission_id=kyc_id)
        .order_by("-assessed_at")
    )


def get_current_risk_assessment(*, kyc_id) -> RiskAssessment | None:
    """Return the current (active) risk assessment for a KYC submission,
    or None if no assessment has been made yet.
    """
    return (
        RiskAssessment.objects.filter(
            kyc_submission_id=kyc_id,
            is_current=True,
        )
        .first()
    )


def get_pending_rfis() -> QuerySet[RFI]:
    """Return all open RFIs, ordered by creation date (oldest first)."""
    return (
        RFI.objects.filter(status=RFIStatus.OPEN)
        .select_related("kyc_submission", "requested_by")
        .order_by("created_at")
    )


def get_worldcheck_results(*, party_id) -> QuerySet[WorldCheckCase]:
    """Return all World-Check cases for a given party."""
    return (
        WorldCheckCase.objects.filter(party_id=party_id)
        .select_related("party", "resolved_by")
        .order_by("-last_screened_at")
    )
