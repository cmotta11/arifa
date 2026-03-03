from django.urls import include, path

urlpatterns = [
    path("auth/", include("apps.authentication.urls")),
    path("core/", include("apps.core.urls")),
    path("workflow/", include("apps.workflow.urls")),
    path("compliance/", include("apps.compliance.urls")),
    path("documents/", include("apps.documents.urls")),
]
