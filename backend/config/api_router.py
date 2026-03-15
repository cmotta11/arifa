from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path("auth/", include("apps.authentication.urls")),
    path("auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("core/", include("apps.core.urls")),
    path("workflow/", include("apps.workflow.urls")),
    path("compliance/", include("apps.compliance.urls")),
    path("documents/", include("apps.documents.urls")),
    path("rpa/", include("apps.rpa.urls")),
    path("notifications/", include("apps.notifications.urls")),
    path("services/", include("apps.services_platform.urls")),
]
