from rest_framework import serializers

from apps.authentication.serializers import UserOutputSerializer

from .constants import TicketPriority, WorkflowCategory
from .models import Ticket, TicketLog, WorkflowDefinition, WorkflowState, WorkflowTransition


# ---------------------------------------------------------------------------
# Output serializers
# ---------------------------------------------------------------------------


class WorkflowDefinitionOutputSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(
        source="get_category_display", read_only=True,
    )
    jurisdiction_code = serializers.CharField(
        source="jurisdiction.country_code", read_only=True, default=None,
    )
    jurisdiction_name = serializers.CharField(
        source="jurisdiction.country_name", read_only=True, default=None,
    )
    state_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = WorkflowDefinition
        fields = [
            "id", "name", "display_name", "description",
            "jurisdiction", "jurisdiction_code", "jurisdiction_name",
            "category", "category_display",
            "is_active", "config", "state_count",
            "created_at", "updated_at",
        ]


class WorkflowStateSerializer(serializers.ModelSerializer):
    workflow_definition_name = serializers.CharField(
        source="workflow_definition.name", read_only=True, default=None,
    )

    class Meta:
        model = WorkflowState
        fields = [
            "id", "name", "workflow_definition", "workflow_definition_name",
            "order_index", "is_initial", "is_final",
            "color", "auto_transition_hours",
            "required_fields", "on_enter_actions",
        ]


class WorkflowTransitionSerializer(serializers.ModelSerializer):
    from_state_name = serializers.CharField(source="from_state.name", read_only=True)
    to_state_name = serializers.CharField(source="to_state.name", read_only=True)
    from_state = WorkflowStateSerializer(read_only=True)
    to_state = WorkflowStateSerializer(read_only=True)

    class Meta:
        model = WorkflowTransition
        fields = [
            "id", "name",
            "from_state", "from_state_name",
            "to_state", "to_state_name",
            "allowed_roles",
        ]


class TicketOutputSerializer(serializers.ModelSerializer):
    current_state = WorkflowStateSerializer(read_only=True)
    assigned_to = UserOutputSerializer(read_only=True)
    created_by = UserOutputSerializer(read_only=True)
    client_name = serializers.CharField(source="client.name", read_only=True)
    workflow_definition_name = serializers.CharField(
        source="workflow_definition.name", read_only=True, default=None,
    )
    parent_ticket_title = serializers.CharField(
        source="parent_ticket.title", read_only=True, default=None,
    )
    jurisdiction_code = serializers.CharField(
        source="jurisdiction.country_code", read_only=True, default=None,
    )
    sub_ticket_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Ticket
        fields = [
            "id", "title",
            "client", "client_name",
            "entity",
            "current_state",
            "workflow_definition", "workflow_definition_name",
            "parent_ticket", "parent_ticket_title",
            "jurisdiction", "jurisdiction_code",
            "assigned_to", "created_by",
            "priority", "due_date",
            "metadata", "sub_ticket_count",
            "created_at", "updated_at",
        ]


class TicketLogOutputSerializer(serializers.ModelSerializer):
    changed_by = UserOutputSerializer(read_only=True)
    previous_state = WorkflowStateSerializer(read_only=True)
    new_state = WorkflowStateSerializer(read_only=True)

    class Meta:
        model = TicketLog
        fields = [
            "id", "ticket",
            "changed_by", "previous_state", "new_state",
            "comment", "created_at",
        ]


# ---------------------------------------------------------------------------
# Input serializers
# ---------------------------------------------------------------------------


class TicketCreateInputSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    client_id = serializers.UUIDField()
    entity_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    workflow_definition_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    parent_ticket_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    jurisdiction_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    priority = serializers.ChoiceField(
        choices=TicketPriority.choices,
        default=TicketPriority.MEDIUM,
    )
    due_date = serializers.DateField(required=False, allow_null=True, default=None)
    assigned_to_id = serializers.UUIDField(
        required=False, allow_null=True, default=None,
    )
    metadata = serializers.DictField(required=False, default=dict)


class TicketTransitionInputSerializer(serializers.Serializer):
    new_state_id = serializers.UUIDField()
    comment = serializers.CharField(required=False, default="", allow_blank=True)


class TicketAssignInputSerializer(serializers.Serializer):
    assigned_to_id = serializers.UUIDField()


class BulkTransitionInputSerializer(serializers.Serializer):
    ticket_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
    )
    new_state_id = serializers.UUIDField()
    comment = serializers.CharField(required=False, default="", allow_blank=True)


class SpawnSubTicketInputSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    workflow_definition_id = serializers.UUIDField()
    priority = serializers.ChoiceField(
        choices=TicketPriority.choices,
        default=TicketPriority.MEDIUM,
        required=False,
    )
    assigned_to_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    metadata = serializers.DictField(required=False, default=dict)


# ---------------------------------------------------------------------------
# Workflow State input serializers
# ---------------------------------------------------------------------------


class WorkflowStateCreateInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    workflow_definition_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    order_index = serializers.IntegerField()
    is_initial = serializers.BooleanField(default=False)
    is_final = serializers.BooleanField(default=False)
    color = serializers.CharField(max_length=7, required=False, default="#6B7280")
    auto_transition_hours = serializers.IntegerField(
        required=False, allow_null=True, default=None,
    )
    required_fields = serializers.ListField(
        child=serializers.CharField(max_length=100),
        required=False, default=list,
    )
    on_enter_actions = serializers.ListField(
        child=serializers.DictField(),
        required=False, default=list,
    )


class WorkflowStateUpdateInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100, required=False)
    order_index = serializers.IntegerField(required=False)
    is_initial = serializers.BooleanField(required=False)
    is_final = serializers.BooleanField(required=False)
    color = serializers.CharField(max_length=7, required=False)
    auto_transition_hours = serializers.IntegerField(
        required=False, allow_null=True,
    )
    required_fields = serializers.ListField(
        child=serializers.CharField(max_length=100),
        required=False,
    )
    on_enter_actions = serializers.ListField(
        child=serializers.DictField(),
        required=False,
    )


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


class WorkflowTransitionUpdateInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, required=False)
    allowed_roles = serializers.ListField(
        child=serializers.CharField(max_length=30),
        required=False,
    )


# ---------------------------------------------------------------------------
# Workflow Definition input serializers
# ---------------------------------------------------------------------------


class WorkflowDefinitionCreateInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    display_name = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    jurisdiction_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    category = serializers.ChoiceField(
        choices=WorkflowCategory.choices,
        default=WorkflowCategory.CUSTOM,
        required=False,
    )
    is_active = serializers.BooleanField(default=True, required=False)
    config = serializers.DictField(required=False, default=dict)


class WorkflowDefinitionUpdateInputSerializer(serializers.Serializer):
    display_name = serializers.CharField(max_length=255, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    jurisdiction_id = serializers.UUIDField(required=False, allow_null=True)
    category = serializers.ChoiceField(choices=WorkflowCategory.choices, required=False)
    is_active = serializers.BooleanField(required=False)
    config = serializers.DictField(required=False)


class CloneWorkflowInputSerializer(serializers.Serializer):
    new_name = serializers.CharField(max_length=100)
    new_display_name = serializers.CharField(max_length=255)
    jurisdiction_id = serializers.UUIDField(required=False, allow_null=True, default=None)
