from django.urls import path

from .views import (
    GuestLinkValidateView,
    GuestLinkView,
    IntegrationStatusView,
    LoginView,
    LogoutView,
    MagicLinkRequestView,
    MagicLinkSendView,
    MagicLinkValidateView,
    MeView,
    RegisterView,
    UserAdminViewSet,
)

app_name = "authentication"

user_list = UserAdminViewSet.as_view({"get": "list", "post": "create"})
user_detail = UserAdminViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
    path("users/", user_list, name="user-list"),
    path("users/<uuid:pk>/", user_detail, name="user-detail"),
    path("guest-links/", GuestLinkView.as_view(), name="guest-links"),
    path(
        "guest-links/<uuid:token>/validate/",
        GuestLinkValidateView.as_view(),
        name="guest-link-validate",
    ),
    path("magic-link/request/", MagicLinkRequestView.as_view(), name="magic-link-request"),
    path("magic-link/send/", MagicLinkSendView.as_view(), name="magic-link-send"),
    path(
        "magic-link/validate/",
        MagicLinkValidateView.as_view(),
        name="magic-link-validate",
    ),
    path(
        "integrations/status/",
        IntegrationStatusView.as_view(),
        name="integration-status",
    ),
]
