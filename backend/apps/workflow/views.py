from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.authentication.permissions import IsDirector
from common.pagination import StandardPagination

from . import selectors, services
from .models import Ticket, WorkflowDefinition, WorkflowState, WorkflowTransition
from .serializers import (
    BulkTransitionInputSerializer,
    CloneWorkflowInputSerializer,
    SpawnSubTicketInputSerializer,
    TicketAssignInputSerializer,
    TicketCreateInputSerializer,
    TicketLogOutputSerializer,
    TicketOutputSerializer,
    TicketTransitionInputSerializer,
    WorkflowDefinitionCreateInputSerializer,
    WorkflowDefinitionOutputSerializer,
    WorkflowDefinitionUpdateInputSerializer,
    WorkflowStateCreateInputSerializer,
    WorkflowStateSerializer,
    WorkflowStateUpdateInputSerializer,
    WorkflowTransitionCreateInputSerializer,
    WorkflowTransitionSerializer,
    WorkflowTransitionUpdateInputSerializer,
)


@extend_schema_view(
    list=extend_schema(summary="List tickets"),
    retrieve=extend_schema(summary="Retrieve a ticket"),
    create=extend_schema(summary="Create a ticket"),
    update=extend_schema(summary="Update a ticket"),
    partial_update=extend_schema(summary="Partially update a ticket"),
    destroy=extend_schema(summary="Delete a ticket"),
)
class TicketViewSet(ModelViewSet):
    queryset = Ticket.objects.select_related(
        "current_state", "client", "assigned_to", "created_by",
        "workflow_definition", "parent_ticket", "jurisdiction",
    ).all()
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination

    def get_serializer_class(self):
        if self.action == "create":
            return TicketCreateInputSerializer
        if self.action == "transition":
            return TicketTransitionInputSerializer
        if self.action == "assign":
            return TicketAssignInputSerializer
        if self.action == "bulk_transition":
            return BulkTransitionInputSerializer
        if self.action == "spawn_sub_ticket":
            return SpawnSubTicketInputSerializer
        return TicketOutputSerializer

    def get_queryset(self):
        view = self.request.query_params.get("view")
        if view:
            qs = selectors.get_kanban_tickets(user=self.request.user, view=view)
        else:
            qs = selectors.get_tickets_for_user(user=self.request.user)
        client_id = self.request.query_params.get("client_id")
        if client_id:
            qs = qs.filter(client_id=client_id)
        entity_id = self.request.query_params.get("entity_id")
        if entity_id:
            qs = qs.filter(entity_id=entity_id)
        workflow_definition = self.request.query_params.get("workflow_definition")
        if workflow_definition:
            qs = qs.filter(workflow_definition_id=workflow_definition)
        workflow_definition_name = self.request.query_params.get("workflow_definition_name")
        if workflow_definition_name:
            names = [n.strip() for n in workflow_definition_name.split(",")]
            qs = qs.filter(workflow_definition__name__in=names)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = TicketCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        # Pop FK id fields that need explicit handling
        entity_id = data.pop("entity_id", None)
        assigned_to_id = data.pop("assigned_to_id", None)
        workflow_definition_id = data.pop("workflow_definition_id", None)
        parent_ticket_id = data.pop("parent_ticket_id", None)
        jurisdiction_id = data.pop("jurisdiction_id", None)

        kwargs_extra = {}
        if entity_id:
            kwargs_extra["entity_id"] = entity_id
        if assigned_to_id:
            kwargs_extra["assigned_to_id"] = assigned_to_id
        if parent_ticket_id:
            kwargs_extra["parent_ticket_id"] = parent_ticket_id
        if jurisdiction_id:
            kwargs_extra["jurisdiction_id"] = jurisdiction_id

        ticket = services.create_ticket(
            created_by=request.user,
            workflow_definition_id=workflow_definition_id,
            **data,
            **kwargs_extra,
        )

        output = TicketOutputSerializer(ticket)
        return Response(output.data, status=status.HTTP_201_CREATED)

    @extend_schema(
        summary="Transition a ticket to a new workflow state",
        request=TicketTransitionInputSerializer,
        responses={200: TicketOutputSerializer},
    )
    @action(detail=True, methods=["post"], url_path="transition")
    def transition(self, request, pk=None):
        serializer = TicketTransitionInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ticket = services.transition_ticket(
            ticket_id=pk,
            new_state_id=serializer.validated_data["new_state_id"],
            changed_by=request.user,
            comment=serializer.validated_data.get("comment", ""),
        )

        output = TicketOutputSerializer(ticket)
        return Response(output.data)

    @extend_schema(
        summary="Assign a ticket to a user",
        request=TicketAssignInputSerializer,
        responses={200: TicketOutputSerializer},
    )
    @action(detail=True, methods=["post"], url_path="assign")
    def assign(self, request, pk=None):
        serializer = TicketAssignInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ticket = services.assign_ticket(
            ticket_id=pk,
            assigned_to_id=serializer.validated_data["assigned_to_id"],
            changed_by=request.user,
        )

        output = TicketOutputSerializer(ticket)
        return Response(output.data)

    @extend_schema(
        summary="List audit logs for a ticket",
        responses={200: TicketLogOutputSerializer(many=True)},
    )
    @action(detail=True, methods=["get"], url_path="logs")
    def logs(self, request, pk=None):
        logs = selectors.get_ticket_logs(ticket_id=pk)
        page = self.paginate_queryset(logs)
        if page is not None:
            serializer = TicketLogOutputSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = TicketLogOutputSerializer(logs, many=True)
        return Response(serializer.data)

    @extend_schema(
        summary="List available transitions for a ticket",
        responses={200: WorkflowTransitionSerializer(many=True)},
    )
    @action(detail=True, methods=["get"], url_path="transitions")
    def transitions(self, request, pk=None):
        transitions = selectors.get_available_transitions(
            ticket_id=pk, user=request.user
        )
        serializer = WorkflowTransitionSerializer(transitions, many=True)
        return Response(serializer.data)

    @extend_schema(
        summary="List tickets for kanban board view",
        responses={200: TicketOutputSerializer(many=True)},
    )
    @action(detail=False, methods=["get"], url_path="kanban")
    def kanban(self, request):
        """Return tickets filtered for kanban board views.

        Accepts optional query parameters:
        - ``view``: 'all', 'my', 'gestora', 'compliance', 'registry'
        - ``workflow_definition``: filter by workflow definition UUID
        """
        view = request.query_params.get("view", "all")
        qs = selectors.get_kanban_tickets(user=request.user, view=view)
        workflow_definition = request.query_params.get("workflow_definition")
        if workflow_definition:
            qs = qs.filter(workflow_definition_id=workflow_definition)
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = TicketOutputSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = TicketOutputSerializer(qs, many=True)
        return Response(serializer.data)

    @extend_schema(
        summary="Bulk transition multiple tickets",
        request=BulkTransitionInputSerializer,
        responses={200: TicketOutputSerializer(many=True)},
    )
    @action(detail=False, methods=["post"], url_path="bulk-transition")
    def bulk_transition(self, request):
        serializer = BulkTransitionInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tickets = services.bulk_transition(
            ticket_ids=serializer.validated_data["ticket_ids"],
            new_state_id=serializer.validated_data["new_state_id"],
            changed_by=request.user,
            comment=serializer.validated_data.get("comment", ""),
        )
        return Response(TicketOutputSerializer(tickets, many=True).data)

    @extend_schema(
        summary="Get incorporation workflow metrics",
        responses={200: None},
    )
    @action(detail=False, methods=["get"], url_path="inc-metrics")
    def inc_metrics(self, request):
        """Return aggregate metrics for incorporation workflows."""
        from datetime import timedelta

        from django.db.models import Avg, Count, F, Q
        from django.utils import timezone

        inc_names = ["INC_PANAMA", "INC_BVI", "INC_PANAMA_DIGITAL"]
        inc_qs = Ticket.objects.filter(
            workflow_definition__name__in=inc_names
        ).select_related("current_state", "workflow_definition")

        now = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        total_active = inc_qs.exclude(current_state__is_final=True).count()
        completed_this_month = inc_qs.filter(
            current_state__is_final=True,
            updated_at__gte=month_start,
        ).count()

        # By stage distribution
        by_stage = {}
        stage_counts = (
            inc_qs.exclude(current_state__is_final=True)
            .values("current_state__name")
            .annotate(count=Count("id"))
            .order_by("current_state__name")
        )
        for entry in stage_counts:
            by_stage[entry["current_state__name"]] = entry["count"]

        # Avg processing days (completed tickets)
        completed_tickets = inc_qs.filter(current_state__is_final=True)
        avg_days = None
        if completed_tickets.exists():
            from django.db.models.functions import Extract

            avg_result = completed_tickets.aggregate(
                avg_duration=Avg(F("updated_at") - F("created_at"))
            )
            if avg_result["avg_duration"]:
                avg_days = round(avg_result["avg_duration"].total_seconds() / 86400, 1)

        # Pending payment (tickets with metadata is_high_capital or in specific stages)
        pending_payment = inc_qs.filter(
            current_state__name__in=["New", "KYC Review"],
        ).count()

        # High capital count
        high_capital_count = inc_qs.filter(
            metadata__is_high_capital=True,
        ).count()

        return Response({
            "total_active": total_active,
            "by_stage": by_stage,
            "avg_processing_days": avg_days or 0,
            "completed_this_month": completed_this_month,
            "pending_payment": pending_payment,
            "high_capital_count": high_capital_count,
        })

    @extend_schema(
        summary="Spawn a sub-ticket from an existing ticket",
        request=SpawnSubTicketInputSerializer,
        responses={201: TicketOutputSerializer},
    )
    @action(detail=True, methods=["post"], url_path="spawn-sub-ticket")
    def spawn_sub_ticket(self, request, pk=None):
        serializer = SpawnSubTicketInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ticket = services.spawn_sub_ticket(
            parent_ticket_id=pk,
            created_by=request.user,
            **serializer.validated_data,
        )
        return Response(
            TicketOutputSerializer(ticket).data,
            status=status.HTTP_201_CREATED,
        )


@extend_schema_view(
    list=extend_schema(summary="List workflow states"),
    retrieve=extend_schema(summary="Retrieve a workflow state"),
    create=extend_schema(summary="Create a workflow state"),
    update=extend_schema(summary="Update a workflow state"),
    partial_update=extend_schema(summary="Partially update a workflow state"),
    destroy=extend_schema(summary="Delete a workflow state"),
)
class WorkflowStateViewSet(ModelViewSet):
    queryset = WorkflowState.objects.select_related("workflow_definition").all()
    serializer_class = WorkflowStateSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_permissions(self):
        if self.action in ("create", "partial_update", "update", "destroy"):
            return [IsAuthenticated(), IsDirector()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == "create":
            return WorkflowStateCreateInputSerializer
        if self.action in ("partial_update", "update"):
            return WorkflowStateUpdateInputSerializer
        return WorkflowStateSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        workflow_definition = self.request.query_params.get("workflow_definition")
        if workflow_definition:
            import uuid as _uuid

            try:
                _uuid.UUID(workflow_definition)
            except (ValueError, AttributeError):
                return qs.none()
            qs = qs.filter(workflow_definition_id=workflow_definition)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = WorkflowStateCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        workflow_definition_id = data.pop("workflow_definition_id", None)
        state = WorkflowState.objects.create(
            workflow_definition_id=workflow_definition_id,
            **data,
        )
        return Response(
            WorkflowStateSerializer(state).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = WorkflowStateUpdateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        state = services.update_workflow_state(
            state_id=instance.id, **serializer.validated_data
        )
        return Response(WorkflowStateSerializer(state).data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = WorkflowStateUpdateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        state = services.update_workflow_state(
            state_id=instance.id, **serializer.validated_data
        )
        return Response(WorkflowStateSerializer(state).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema_view(
    list=extend_schema(summary="List workflow transitions"),
    retrieve=extend_schema(summary="Retrieve a workflow transition"),
    create=extend_schema(summary="Create a workflow transition"),
    update=extend_schema(summary="Update a workflow transition"),
    partial_update=extend_schema(summary="Partially update a workflow transition"),
    destroy=extend_schema(summary="Delete a workflow transition"),
)
class WorkflowTransitionViewSet(ModelViewSet):
    queryset = WorkflowTransition.objects.select_related(
        "from_state", "to_state"
    ).all()
    serializer_class = WorkflowTransitionSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_permissions(self):
        if self.action in ("create", "partial_update", "update", "destroy"):
            return [IsAuthenticated(), IsDirector()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == "create":
            return WorkflowTransitionCreateInputSerializer
        if self.action in ("partial_update", "update"):
            return WorkflowTransitionUpdateInputSerializer
        return WorkflowTransitionSerializer

    def create(self, request, *args, **kwargs):
        serializer = WorkflowTransitionCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        transition = WorkflowTransition.objects.create(
            from_state_id=data["from_state"],
            to_state_id=data["to_state"],
            name=data["name"],
            allowed_roles=data.get("allowed_roles", []),
        )
        return Response(
            WorkflowTransitionSerializer(transition).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = WorkflowTransitionUpdateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        transition = services.update_workflow_transition(
            transition_id=instance.id, **serializer.validated_data
        )
        return Response(WorkflowTransitionSerializer(transition).data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = WorkflowTransitionUpdateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        transition = services.update_workflow_transition(
            transition_id=instance.id, **serializer.validated_data
        )
        return Response(WorkflowTransitionSerializer(transition).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ===========================================================================
# WorkflowDefinition ViewSet
# ===========================================================================


@extend_schema_view(
    list=extend_schema(summary="List workflow definitions"),
    retrieve=extend_schema(summary="Retrieve a workflow definition"),
    create=extend_schema(summary="Create a workflow definition"),
    update=extend_schema(summary="Update a workflow definition"),
    partial_update=extend_schema(summary="Partially update a workflow definition"),
    destroy=extend_schema(summary="Delete a workflow definition"),
)
class WorkflowDefinitionViewSet(ModelViewSet):
    queryset = WorkflowDefinition.objects.select_related("jurisdiction").all()
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_permissions(self):
        if self.action in ("create", "partial_update", "update", "destroy", "clone"):
            return [IsAuthenticated(), IsDirector()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == "create":
            return WorkflowDefinitionCreateInputSerializer
        if self.action in ("partial_update", "update"):
            return WorkflowDefinitionUpdateInputSerializer
        if self.action == "clone":
            return CloneWorkflowInputSerializer
        return WorkflowDefinitionOutputSerializer

    def get_queryset(self):
        from django.db.models import Count

        qs = super().get_queryset().annotate(state_count=Count("states"))
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == "true")
        return qs

    def create(self, request, *args, **kwargs):
        serializer = WorkflowDefinitionCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        jurisdiction_id = data.pop("jurisdiction_id", None)
        definition = WorkflowDefinition.objects.create(
            jurisdiction_id=jurisdiction_id,
            **data,
        )
        return Response(
            WorkflowDefinitionOutputSerializer(definition).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = WorkflowDefinitionUpdateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        jurisdiction_id = data.pop("jurisdiction_id", None)
        if jurisdiction_id is not None:
            instance.jurisdiction_id = jurisdiction_id
        for attr, value in data.items():
            setattr(instance, attr, value)
        instance.save()
        return Response(WorkflowDefinitionOutputSerializer(instance).data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = WorkflowDefinitionUpdateInputSerializer(
            data=request.data, partial=True,
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        jurisdiction_id = data.pop("jurisdiction_id", None)
        if jurisdiction_id is not None:
            instance.jurisdiction_id = jurisdiction_id
        for attr, value in data.items():
            setattr(instance, attr, value)
        instance.save()
        return Response(WorkflowDefinitionOutputSerializer(instance).data)

    @extend_schema(
        summary="Clone a workflow definition",
        request=CloneWorkflowInputSerializer,
        responses={201: WorkflowDefinitionOutputSerializer},
    )
    @action(detail=True, methods=["post"], url_path="clone")
    def clone(self, request, pk=None):
        serializer = CloneWorkflowInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cloned = services.clone_workflow_for_jurisdiction(
            source_definition_id=pk,
            new_name=serializer.validated_data["new_name"],
            new_display_name=serializer.validated_data["new_display_name"],
            jurisdiction_id=serializer.validated_data.get("jurisdiction_id"),
        )
        return Response(
            WorkflowDefinitionOutputSerializer(cloned).data,
            status=status.HTTP_201_CREATED,
        )
