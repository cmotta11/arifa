from django.db.models import Count
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.authentication.permissions import IsDirector, IsInternalUser
from common.pagination import StandardPagination

from . import services
from .models import RPAJob, RPAJobDefinition
from .serializers import (
    RPAJobCreateInputSerializer,
    RPAJobDefinitionCreateInputSerializer,
    RPAJobDefinitionOutputSerializer,
    RPAJobListOutputSerializer,
    RPAJobOutputSerializer,
)


@extend_schema_view(
    list=extend_schema(summary="List RPA job definitions"),
    retrieve=extend_schema(summary="Get RPA job definition detail"),
    partial_update=extend_schema(summary="Partial update RPA job definition"),
)
class RPAJobDefinitionViewSet(ModelViewSet):
    queryset = RPAJobDefinition.objects.annotate(job_count=Count("jobs"))
    permission_classes = [IsAuthenticated, IsDirector]
    pagination_class = StandardPagination
    http_method_names = ["get", "patch", "head", "options"]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return RPAJobDefinitionCreateInputSerializer
        return RPAJobDefinitionOutputSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == "true")
        target = self.request.query_params.get("target_integration")
        if target:
            qs = qs.filter(target_integration=target)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = RPAJobDefinitionCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        definition = RPAJobDefinition.objects.create(**serializer.validated_data)
        return Response(
            RPAJobDefinitionOutputSerializer(definition).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = RPAJobDefinitionCreateInputSerializer(
            data=request.data, partial=kwargs.get("partial", False)
        )
        serializer.is_valid(raise_exception=True)
        for attr, value in serializer.validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return Response(RPAJobDefinitionOutputSerializer(instance).data)


@extend_schema_view(
    list=extend_schema(summary="List RPA jobs"),
    retrieve=extend_schema(summary="Get RPA job detail with steps"),
    create=extend_schema(summary="Create and dispatch an RPA job"),
)
class RPAJobViewSet(ModelViewSet):
    queryset = RPAJob.objects.select_related(
        "definition", "ticket", "entity", "created_by"
    ).prefetch_related("steps")
    permission_classes = [IsAuthenticated, IsInternalUser]
    pagination_class = StandardPagination
    http_method_names = ["get", "post", "head", "options"]

    def get_serializer_class(self):
        if self.action == "create":
            return RPAJobCreateInputSerializer
        if self.action == "list":
            return RPAJobListOutputSerializer
        return RPAJobOutputSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        definition_id = self.request.query_params.get("definition_id")
        if definition_id:
            qs = qs.filter(definition_id=definition_id)
        ticket_id = self.request.query_params.get("ticket_id")
        if ticket_id:
            qs = qs.filter(ticket_id=ticket_id)
        entity_id = self.request.query_params.get("entity_id")
        if entity_id:
            qs = qs.filter(entity_id=entity_id)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = RPAJobCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        job = services.create_rpa_job(
            definition_id=data["definition_id"],
            input_data=data.get("input_data", {}),
            created_by=request.user,
            ticket_id=data.get("ticket_id"),
            entity_id=data.get("entity_id"),
        )

        # Auto-start the job
        job = services.start_rpa_job(job_id=job.id)

        return Response(
            RPAJobOutputSerializer(job).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(summary="Pause a running RPA job")
    @action(detail=True, methods=["post"])
    def pause(self, request, pk=None):
        job = services.pause_rpa_job(job_id=pk)
        return Response(RPAJobOutputSerializer(job).data)

    @extend_schema(summary="Resume a paused RPA job")
    @action(detail=True, methods=["post"])
    def resume(self, request, pk=None):
        job = services.resume_rpa_job(job_id=pk)
        return Response(RPAJobOutputSerializer(job).data)

    @extend_schema(summary="Retry a failed RPA job")
    @action(detail=True, methods=["post"])
    def retry(self, request, pk=None):
        job = services.retry_rpa_job(job_id=pk)
        return Response(RPAJobOutputSerializer(job).data)

    @extend_schema(summary="Cancel an RPA job")
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        job = services.cancel_rpa_job(job_id=pk)
        return Response(RPAJobOutputSerializer(job).data)
