from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.authentication.permissions import IsDirector
from common.pagination import StandardPagination

from . import selectors, services
from .models import Ticket, WorkflowState, WorkflowTransition
from .serializers import (
    TicketAssignInputSerializer,
    TicketCreateInputSerializer,
    TicketLogOutputSerializer,
    TicketOutputSerializer,
    TicketTransitionInputSerializer,
    WorkflowStateCreateInputSerializer,
    WorkflowStateSerializer,
    WorkflowStateUpdateInputSerializer,
    WorkflowTransitionCreateInputSerializer,
    WorkflowTransitionSerializer,
    WorkflowTransitionUpdateInputSerializer,
)


class TicketViewSet(ModelViewSet):
    queryset = Ticket.objects.select_related(
        "current_state", "client", "assigned_to", "created_by"
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
        return qs

    def create(self, request, *args, **kwargs):
        serializer = TicketCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        entity_id = data.pop("entity_id", None)
        assigned_to_id = data.pop("assigned_to_id", None)

        kwargs_extra = {}
        if entity_id:
            kwargs_extra["entity_id"] = entity_id
        if assigned_to_id:
            kwargs_extra["assigned_to_id"] = assigned_to_id

        ticket = services.create_ticket(
            created_by=request.user,
            **data,
            **kwargs_extra,
        )

        output = TicketOutputSerializer(ticket)
        return Response(output.data, status=status.HTTP_201_CREATED)

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

    @action(detail=True, methods=["get"], url_path="logs")
    def logs(self, request, pk=None):
        logs = selectors.get_ticket_logs(ticket_id=pk)
        page = self.paginate_queryset(logs)
        if page is not None:
            serializer = TicketLogOutputSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = TicketLogOutputSerializer(logs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="transitions")
    def transitions(self, request, pk=None):
        transitions = selectors.get_available_transitions(
            ticket_id=pk, user=request.user
        )
        serializer = WorkflowTransitionSerializer(transitions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="kanban")
    def kanban(self, request):
        """Return tickets filtered for kanban board views.

        Accepts an optional ``view`` query parameter:
        'all', 'my', 'gestora', 'compliance', 'registry'.
        """
        view = request.query_params.get("view", "all")
        qs = selectors.get_kanban_tickets(user=request.user, view=view)
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = TicketOutputSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = TicketOutputSerializer(qs, many=True)
        return Response(serializer.data)


class WorkflowStateViewSet(ModelViewSet):
    queryset = WorkflowState.objects.all()
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

    def create(self, request, *args, **kwargs):
        serializer = WorkflowStateCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        state = WorkflowState.objects.create(**serializer.validated_data)

        return Response(
            WorkflowStateSerializer(state).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = WorkflowStateUpdateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        for attr, value in serializer.validated_data.items():
            setattr(instance, attr, value)

        update_fields = list(serializer.validated_data.keys())
        if update_fields:
            update_fields.append("updated_at")
            instance.save(update_fields=update_fields)

        return Response(WorkflowStateSerializer(instance).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


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

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = WorkflowTransitionUpdateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        for attr, value in serializer.validated_data.items():
            setattr(instance, attr, value)

        update_fields = list(serializer.validated_data.keys())
        if update_fields:
            update_fields.append("updated_at")
            instance.save(update_fields=update_fields)

        return Response(WorkflowTransitionSerializer(instance).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
