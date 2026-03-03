from rest_framework import serializers

from apps.authentication.serializers import UserOutputSerializer

from .constants import TicketPriority
from .models import Ticket, TicketLog, WorkflowState, WorkflowTransition


# ---------------------------------------------------------------------------
# Output serializers
# ---------------------------------------------------------------------------


class WorkflowStateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkflowState
        fields = [
            "id",
            "name",
            "order_index",
            "is_initial",
            "is_final",
        ]


class WorkflowTransitionSerializer(serializers.ModelSerializer):
    from_state_name = serializers.CharField(source="from_state.name", read_only=True)
    to_state_name = serializers.CharField(source="to_state.name", read_only=True)
    from_state = WorkflowStateSerializer(read_only=True)
    to_state = WorkflowStateSerializer(read_only=True)

    class Meta:
        model = WorkflowTransition
        fields = [
            "id",
            "name",
            "from_state",
            "from_state_name",
            "to_state",
            "to_state_name",
            "allowed_roles",
        ]


class TicketOutputSerializer(serializers.ModelSerializer):
    current_state = WorkflowStateSerializer(read_only=True)
    assigned_to = UserOutputSerializer(read_only=True)
    created_by = UserOutputSerializer(read_only=True)
    client_name = serializers.CharField(source="client.name", read_only=True)

    class Meta:
        model = Ticket
        fields = [
            "id",
            "title",
            "client",
            "client_name",
            "entity",
            "current_state",
            "assigned_to",
            "created_by",
            "priority",
            "due_date",
            "created_at",
            "updated_at",
        ]


class TicketLogOutputSerializer(serializers.ModelSerializer):
    changed_by = UserOutputSerializer(read_only=True)
    previous_state = WorkflowStateSerializer(read_only=True)
    new_state = WorkflowStateSerializer(read_only=True)

    class Meta:
        model = TicketLog
        fields = [
            "id",
            "ticket",
            "changed_by",
            "previous_state",
            "new_state",
            "comment",
            "timestamp",
        ]


# ---------------------------------------------------------------------------
# Input serializers
# ---------------------------------------------------------------------------


class TicketCreateInputSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    client_id = serializers.UUIDField()
    entity_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    priority = serializers.ChoiceField(
        choices=TicketPriority.choices,
        default=TicketPriority.MEDIUM,
    )
    due_date = serializers.DateField(required=False, allow_null=True, default=None)
    assigned_to_id = serializers.UUIDField(
        required=False, allow_null=True, default=None
    )

    def create(self, validated_data):
        raise NotImplementedError("Use the create_ticket service instead.")

    def update(self, instance, validated_data):
        raise NotImplementedError("Use the create_ticket service instead.")


class TicketTransitionInputSerializer(serializers.Serializer):
    new_state_id = serializers.UUIDField()
    comment = serializers.CharField(required=False, default="", allow_blank=True)

    def create(self, validated_data):
        raise NotImplementedError("Use the transition_ticket service instead.")

    def update(self, instance, validated_data):
        raise NotImplementedError("Use the transition_ticket service instead.")


class TicketAssignInputSerializer(serializers.Serializer):
    assigned_to_id = serializers.UUIDField()

    def create(self, validated_data):
        raise NotImplementedError("Use the assign_ticket service instead.")

    def update(self, instance, validated_data):
        raise NotImplementedError("Use the assign_ticket service instead.")


# ---------------------------------------------------------------------------
# Workflow State input serializers
# ---------------------------------------------------------------------------


class WorkflowStateCreateInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    order_index = serializers.IntegerField()
    is_initial = serializers.BooleanField(default=False)
    is_final = serializers.BooleanField(default=False)

    def create(self, validated_data):
        raise NotImplementedError("Use the service layer instead.")

    def update(self, instance, validated_data):
        raise NotImplementedError("Use the service layer instead.")


class WorkflowStateUpdateInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100, required=False)
    order_index = serializers.IntegerField(required=False)
    is_initial = serializers.BooleanField(required=False)
    is_final = serializers.BooleanField(required=False)

    def create(self, validated_data):
        raise NotImplementedError("Use the service layer instead.")

    def update(self, instance, validated_data):
        raise NotImplementedError("Use the service layer instead.")


# ---------------------------------------------------------------------------
# Workflow Transition input serializers
# ---------------------------------------------------------------------------


class WorkflowTransitionCreateInputSerializer(serializers.Serializer):
    from_state = serializers.UUIDField()
    to_state = serializers.UUIDField()
    name = serializers.CharField(max_length=255)
    allowed_roles = serializers.ListField(
        child=serializers.CharField(max_length=30),
        required=False,
        default=list,
    )

    def create(self, validated_data):
        raise NotImplementedError("Use the service layer instead.")

    def update(self, instance, validated_data):
        raise NotImplementedError("Use the service layer instead.")


class WorkflowTransitionUpdateInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, required=False)
    allowed_roles = serializers.ListField(
        child=serializers.CharField(max_length=30),
        required=False,
    )

    def create(self, validated_data):
        raise NotImplementedError("Use the service layer instead.")

    def update(self, instance, validated_data):
        raise NotImplementedError("Use the service layer instead.")
