from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    NotificationTemplateViewSet,
    NotificationViewSet,
    TrackClickView,
    TrackOpenView,
)

router = DefaultRouter()
router.register("templates", NotificationTemplateViewSet, basename="notification-template")
router.register("", NotificationViewSet, basename="notification")

urlpatterns = [
    path(
        "track/open/<uuid:delivery_id>/",
        TrackOpenView.as_view(),
        name="notification-track-open",
    ),
    path(
        "track/click/<uuid:delivery_id>/",
        TrackClickView.as_view(),
        name="notification-track-click",
    ),
] + router.urls
