import base64

from django.http import HttpResponse, HttpResponseRedirect
from django.utils import timezone
from django.utils.http import url_has_allowed_host_and_scheme
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet, GenericViewSet
from rest_framework.mixins import ListModelMixin, RetrieveModelMixin

from apps.authentication.permissions import IsDirector
from common.pagination import StandardPagination

from . import services
from .models import DeliveryLog, Notification, NotificationPreference, NotificationTemplate
from .serializers import (
    NotificationOutputSerializer,
    NotificationPreferenceInputSerializer,
    NotificationPreferenceSerializer,
    NotificationTemplateInputSerializer,
    NotificationTemplateOutputSerializer,
)

# 1x1 transparent PNG pixel
TRANSPARENT_PIXEL = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4"
    "nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="
)


@extend_schema_view(
    list=extend_schema(summary="List notifications for current user"),
    retrieve=extend_schema(summary="Get notification detail"),
)
class NotificationViewSet(ListModelMixin, RetrieveModelMixin, GenericViewSet):
    serializer_class = NotificationOutputSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination

    def get_queryset(self):
        qs = Notification.objects.filter(
            recipient=self.request.user
        ).select_related("template")
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)
        is_read = self.request.query_params.get("is_read")
        if is_read is not None:
            qs = qs.filter(is_read=is_read.lower() == "true")
        return qs

    @extend_schema(summary="Get unread notification count")
    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        count = services.get_unread_count(user=request.user)
        return Response({"count": count})

    @extend_schema(summary="Mark a notification as read")
    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        notification = services.mark_as_read(
            notification_id=pk, user=request.user
        )
        return Response(NotificationOutputSerializer(notification).data)

    @extend_schema(summary="Mark all notifications as read")
    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        count = services.mark_all_as_read(user=request.user)
        return Response({"marked": count})

    @extend_schema(summary="Get notification preferences")
    @action(detail=False, methods=["get", "patch"])
    def preferences(self, request):
        if request.method == "GET":
            pref = NotificationPreference.objects.filter(
                user=request.user
            ).first()
            if pref is None:
                # Return defaults without creating a DB record
                default_data = {
                    "category_channels": {},
                    "daily_digest_enabled": True,
                    "digest_hour": 8,
                }
                return Response(default_data)
            return Response(NotificationPreferenceSerializer(pref).data)

        serializer = NotificationPreferenceInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pref = services.update_preferences(
            user=request.user, **serializer.validated_data
        )
        return Response(NotificationPreferenceSerializer(pref).data)


@extend_schema_view(
    list=extend_schema(summary="List notification templates"),
    retrieve=extend_schema(summary="Get notification template detail"),
    create=extend_schema(summary="Create notification template"),
    update=extend_schema(summary="Update notification template"),
    partial_update=extend_schema(summary="Partial update notification template"),
    destroy=extend_schema(summary="Delete notification template"),
)
class NotificationTemplateViewSet(ModelViewSet):
    queryset = NotificationTemplate.objects.all()
    permission_classes = [IsAuthenticated, IsDirector]
    pagination_class = StandardPagination

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return NotificationTemplateInputSerializer
        return NotificationTemplateOutputSerializer

    def create(self, request, *args, **kwargs):
        serializer = NotificationTemplateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        template = NotificationTemplate.objects.create(**serializer.validated_data)
        return Response(
            NotificationTemplateOutputSerializer(template).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = NotificationTemplateInputSerializer(
            data=request.data, partial=kwargs.get("partial", False)
        )
        serializer.is_valid(raise_exception=True)
        for attr, value in serializer.validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return Response(NotificationTemplateOutputSerializer(instance).data)


# ---------------------------------------------------------------------------
# Email tracking views (unauthenticated)
# ---------------------------------------------------------------------------


class TrackOpenView(APIView):
    """Return a 1x1 transparent pixel and record that the email was opened."""

    permission_classes = [AllowAny]
    authentication_classes = []  # No auth required for tracking pixels

    @extend_schema(
        summary="Track email open via invisible pixel",
        parameters=[
            OpenApiParameter(
                name="delivery_id",
                location=OpenApiParameter.PATH,
                description="UUID of the DeliveryLog entry",
                type=str,
            ),
        ],
        responses={200: bytes},
    )
    def get(self, request, delivery_id):
        try:
            log = DeliveryLog.objects.get(id=delivery_id)
            if log.opened_at is None:
                log.opened_at = timezone.now()
                log.save(update_fields=["opened_at", "updated_at"])
        except DeliveryLog.DoesNotExist:
            pass  # Silently ignore — tracking should never error for the user

        return HttpResponse(
            TRANSPARENT_PIXEL,
            content_type="image/png",
        )


class TrackClickView(APIView):
    """Record that a tracked link was clicked, then redirect to the target URL."""

    permission_classes = [AllowAny]
    authentication_classes = []  # No auth required for tracking redirects

    @extend_schema(
        summary="Track email link click and redirect",
        parameters=[
            OpenApiParameter(
                name="delivery_id",
                location=OpenApiParameter.PATH,
                description="UUID of the DeliveryLog entry",
                type=str,
            ),
        ],
        responses={302: None},
    )
    def get(self, request, delivery_id):
        redirect_url = "/"
        try:
            log = DeliveryLog.objects.select_related("notification").get(id=delivery_id)
            if log.clicked_at is None:
                log.clicked_at = timezone.now()
                log.save(update_fields=["clicked_at", "updated_at"])
            # Use the notification's action_url as the redirect target
            if log.notification.action_url:
                redirect_url = log.notification.action_url
        except DeliveryLog.DoesNotExist:
            pass  # Silently ignore

        # Validate redirect URL to prevent open redirect attacks
        if not url_has_allowed_host_and_scheme(
            redirect_url, allowed_hosts={request.get_host()}
        ):
            redirect_url = "/"

        return HttpResponseRedirect(redirect_url)
