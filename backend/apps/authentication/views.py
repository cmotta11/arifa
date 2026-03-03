from django.contrib.auth import authenticate, login, logout
from django.db import models
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet

from common.pagination import StandardPagination

from .models import GuestLink
from .permissions import IsDirector
from .serializers import (
    GuestLinkCreateInputSerializer,
    GuestLinkOutputSerializer,
    LoginInputSerializer,
    MagicLinkRequestInputSerializer,
    MagicLinkSendInputSerializer,
    MagicLinkValidateInputSerializer,
    RegisterInputSerializer,
    UserCreateInputSerializer,
    UserListOutputSerializer,
    UserOutputSerializer,
    UserUpdateInputSerializer,
)
from .services import (
    create_guest_link,
    create_magic_login_token,
    deactivate_user,
    get_user,
    list_users,
    register_user,
    request_magic_link_for_email,
    send_magic_link_email,
    update_user,
    validate_guest_link,
    validate_magic_login_token,
)


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = register_user(**serializer.validated_data)

        return Response(
            UserOutputSerializer(user).data,
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = authenticate(
            request,
            email=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
        )

        if user is None:
            return Response(
                {"message": "Invalid email or password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        login(request, user)

        return Response(
            UserOutputSerializer(user).data,
            status=status.HTTP_200_OK,
        )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response(
            {"message": "Successfully logged out."},
            status=status.HTTP_200_OK,
        )


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            UserOutputSerializer(request.user).data,
            status=status.HTTP_200_OK,
        )


class GuestLinkView(APIView):
    """GET: List guest links (filterable by client_id / entity_id).
    POST: Create a new guest link.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = GuestLink.objects.select_related(
            "created_by",
            "ticket__client",
            "ticket__entity",
            "kyc_submission__ticket__client",
            "kyc_submission__ticket__entity",
        ).filter(is_active=True, expires_at__gt=timezone.now())

        client_id = request.query_params.get("client_id")
        entity_id = request.query_params.get("entity_id")

        if client_id:
            qs = qs.filter(
                models.Q(kyc_submission__ticket__client_id=client_id)
                | models.Q(ticket__client_id=client_id)
            )
        if entity_id:
            qs = qs.filter(
                models.Q(kyc_submission__ticket__entity_id=entity_id)
                | models.Q(ticket__entity_id=entity_id)
            )

        qs = qs.order_by("-created_at")
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        if page is not None:
            serializer = GuestLinkOutputSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        return Response(GuestLinkOutputSerializer(qs, many=True).data)

    def post(self, request):
        serializer = GuestLinkCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        ticket = None
        kyc_submission = None

        if data.get("ticket"):
            from apps.workflow.models import Ticket

            ticket = Ticket.objects.get(id=data["ticket"])

        if data.get("kyc_submission"):
            from apps.compliance.models import KYCSubmission

            kyc_submission = KYCSubmission.objects.get(id=data["kyc_submission"])

        guest_link = create_guest_link(
            created_by=request.user,
            ticket=ticket,
            kyc_submission=kyc_submission,
        )

        return Response(
            GuestLinkOutputSerializer(guest_link).data,
            status=status.HTTP_201_CREATED,
        )


class GuestLinkValidateView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token):
        guest_link = validate_guest_link(token=token)

        return Response(
            GuestLinkOutputSerializer(guest_link).data,
            status=status.HTTP_200_OK,
        )


class IntegrationStatusView(APIView):
    """Report which external integrations are configured vs using mock data."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from common.integration_status import get_integration_status

        return Response(get_integration_status(), status=status.HTTP_200_OK)


class MagicLinkRequestView(APIView):
    """Public: client enters email, receives magic link if they have portal access."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = MagicLinkRequestInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        request_magic_link_for_email(email=email)

        return Response(
            {"message": "If your email has portal access, you will receive a login link."},
            status=status.HTTP_200_OK,
        )


class MagicLinkSendView(APIView):
    """Send a magic link to a client user. Director-only."""

    permission_classes = [IsAuthenticated, IsDirector]

    def post(self, request):
        serializer = MagicLinkSendInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = get_user(user_id=serializer.validated_data["user_id"])
        token = create_magic_login_token(user=user)
        send_magic_link_email(user=user, token=token)

        return Response(
            {"message": "Magic link sent."},
            status=status.HTTP_200_OK,
        )


class MagicLinkValidateView(APIView):
    """Validate a magic token and log the user in."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = MagicLinkValidateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = validate_magic_login_token(
            token=str(serializer.validated_data["token"])
        )
        login(request, user, backend="django.contrib.auth.backends.ModelBackend")

        return Response(
            UserOutputSerializer(user).data,
            status=status.HTTP_200_OK,
        )


class UserAdminViewSet(ViewSet):
    """Full CRUD for user management. Director-only access."""

    permission_classes = [IsAuthenticated, IsDirector]
    pagination_class = StandardPagination

    def list(self, request):
        role = request.query_params.get("role")
        is_active = request.query_params.get("is_active")
        client_id = request.query_params.get("client_id")

        qs = list_users(role=role)

        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ("true", "1"))

        if client_id:
            qs = qs.filter(client_id=client_id)

        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        if page is not None:
            serializer = UserListOutputSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = UserListOutputSerializer(qs, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        user = get_user(user_id=pk)
        serializer = UserListOutputSerializer(user)
        return Response(serializer.data)

    def create(self, request):
        serializer = UserCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = register_user(**serializer.validated_data)

        return Response(
            UserListOutputSerializer(user).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, pk=None):
        serializer = UserUpdateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = update_user(user_id=pk, **serializer.validated_data)

        return Response(UserListOutputSerializer(user).data)

    def destroy(self, request, pk=None):
        deactivate_user(user_id=pk)
        return Response(status=status.HTTP_204_NO_CONTENT)
