from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    ClientPortalViewSet,
    ExtractDocumentView,
    JurisdictionRiskViewSet,
    KYCSubmissionViewSet,
    PartyViewSet,
    RFIViewSet,
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
]
