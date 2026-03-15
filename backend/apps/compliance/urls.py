from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AccountingRecordGuestDocumentView,
    AccountingRecordGuestSubmitView,
    AccountingRecordGuestView,
    AccountingRecordViewSet,
    ClientPortalViewSet,
    ComplianceDelegationViewSet,
    ComplianceSnapshotViewSet,
    DueDiligenceChecklistCompleteView,
    DueDiligenceChecklistView,
    EconomicSubstanceViewSet,
    EntityCalculateRiskView,
    EntityRiskHistoryView,
    EntityRiskView,
    ESGuestSubmitView,
    ESGuestView,
    ExtractDocumentView,
    FieldCommentResolveView,
    FieldCommentView,
    HelpRequestView,
    JurisdictionConfigViewSet,
    JurisdictionRiskViewSet,
    KYCSubmissionViewSet,
    OwnershipTreeAuditView,
    OwnershipTreeSaveView,
    OwnershipTreeView,
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
router.register(r"accounting-records", AccountingRecordViewSet, basename="accounting-record")
router.register(r"jurisdiction-configs", JurisdictionConfigViewSet, basename="jurisdiction-config")
router.register(r"delegations", ComplianceDelegationViewSet, basename="delegation")
router.register(r"es-submissions", EconomicSubstanceViewSet, basename="es-submission")

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
    # Accounting records guest endpoints
    path(
        "accounting-records/<uuid:pk>/guest/",
        AccountingRecordGuestView.as_view(),
        name="accounting-record-guest",
    ),
    path(
        "accounting-records/<uuid:pk>/guest/submit/",
        AccountingRecordGuestSubmitView.as_view(),
        name="accounting-record-guest-submit",
    ),
    path(
        "accounting-records/<uuid:pk>/guest/documents/",
        AccountingRecordGuestDocumentView.as_view(),
        name="accounting-record-guest-documents",
    ),
    # Due Diligence Checklists
    path(
        "kyc/<uuid:kyc_id>/checklists/",
        DueDiligenceChecklistView.as_view(),
        name="kyc-checklists",
    ),
    path(
        "checklists/<uuid:checklist_id>/complete/",
        DueDiligenceChecklistCompleteView.as_view(),
        name="checklist-complete",
    ),
    # Field Comments
    path(
        "kyc/<uuid:kyc_id>/field-comments/",
        FieldCommentView.as_view(),
        name="kyc-field-comments",
    ),
    path(
        "kyc/<uuid:kyc_id>/field-comments/<str:field_name>/resolve/",
        FieldCommentResolveView.as_view(),
        name="kyc-field-comment-resolve",
    ),
    # ES Guest endpoints
    path(
        "es-submissions/<uuid:pk>/guest/",
        ESGuestView.as_view(),
        name="es-guest",
    ),
    path(
        "es-submissions/<uuid:pk>/guest/submit/",
        ESGuestSubmitView.as_view(),
        name="es-guest-submit",
    ),
    # Help request
    path(
        "help-request/",
        HelpRequestView.as_view(),
        name="help-request",
    ),
    # Ownership Tree
    path(
        "entities/<uuid:entity_id>/ownership-tree/",
        OwnershipTreeView.as_view(),
        name="entity-ownership-tree",
    ),
    path(
        "entities/<uuid:entity_id>/ownership-tree/save/",
        OwnershipTreeSaveView.as_view(),
        name="entity-ownership-tree-save",
    ),
    path(
        "entities/<uuid:entity_id>/ownership-tree/audit-log/",
        OwnershipTreeAuditView.as_view(),
        name="entity-ownership-tree-audit",
    ),
]
