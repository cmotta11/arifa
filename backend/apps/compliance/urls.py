from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    ClientPortalViewSet,
    ComplianceSnapshotViewSet,
    EntityCalculateRiskView,
    EntityRiskHistoryView,
    EntityRiskView,
    ExtractDocumentView,
    JurisdictionRiskViewSet,
    KYCSubmissionViewSet,
    PartyViewSet,
    PersonCalculateRiskView,
    PersonRiskHistoryView,
    PersonRiskView,
    RFIViewSet,
    RiskAssessmentExportPDFView,
    RiskMatrixConfigViewSet,
    RiskStatsView,
    SelfServiceOnboardingView,
    TaskStatusView,
    WorldCheckWebhookView,
)

app_name = "compliance"

router = DefaultRouter()
router.register(r"kyc", KYCSubmissionViewSet, basename="kyc")
router.register(r"parties", PartyViewSet, basename="party")
router.register(r"rfis", RFIViewSet, basename="rfi")
router.register(r"jurisdiction-risks", JurisdictionRiskViewSet, basename="jurisdiction-risk")
router.register(r"portal/kyc", ClientPortalViewSet, basename="portal-kyc")
router.register(r"risk-matrix-configs", RiskMatrixConfigViewSet, basename="risk-matrix-config")
router.register(r"snapshots", ComplianceSnapshotViewSet, basename="snapshot")

urlpatterns = router.urls + [
    # Standalone endpoints
    path(
        "extract-document/",
        ExtractDocumentView.as_view(),
        name="extract-document",
    ),
    path(
        "webhooks/world-check/",
        WorldCheckWebhookView.as_view(),
        name="worldcheck-webhook",
    ),
    path(
        "tasks/<str:task_id>/status/",
        TaskStatusView.as_view(),
        name="task-status",
    ),
    path(
        "onboarding/",
        SelfServiceOnboardingView.as_view(),
        name="self-service-onboarding",
    ),
    # Risk stats
    path(
        "risk-stats/",
        RiskStatsView.as_view(),
        name="risk-stats",
    ),
    # Entity risk endpoints
    path(
        "entities/<uuid:entity_id>/risk-assessment/",
        EntityRiskView.as_view(),
        name="entity-risk-assessment",
    ),
    path(
        "entities/<uuid:entity_id>/risk-history/",
        EntityRiskHistoryView.as_view(),
        name="entity-risk-history",
    ),
    path(
        "entities/<uuid:entity_id>/calculate-risk/",
        EntityCalculateRiskView.as_view(),
        name="entity-calculate-risk",
    ),
    # Person risk endpoints
    path(
        "persons/<uuid:person_id>/risk-assessment/",
        PersonRiskView.as_view(),
        name="person-risk-assessment",
    ),
    path(
        "persons/<uuid:person_id>/risk-history/",
        PersonRiskHistoryView.as_view(),
        name="person-risk-history",
    ),
    path(
        "persons/<uuid:person_id>/calculate-risk/",
        PersonCalculateRiskView.as_view(),
        name="person-calculate-risk",
    ),
    # PDF export
    path(
        "risk-assessments/<uuid:assessment_id>/export-pdf/",
        RiskAssessmentExportPDFView.as_view(),
        name="risk-assessment-export-pdf",
    ),
]
