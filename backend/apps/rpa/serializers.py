from rest_framework import serializers

from .models import RPAJob, RPAJobDefinition, RPAJobStep


class RPAJobStepOutputSerializer(serializers.ModelSerializer):
    class Meta:
        model = RPAJobStep
        fields = [
            "id",
            "step_name",
            "order_index",
            "action",
            "config",
            "status",
            "input_data",
            "output_data",
            "error_message",
            "started_at",
            "completed_at",
        ]


class RPAJobDefinitionOutputSerializer(serializers.ModelSerializer):
    job_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = RPAJobDefinition
        fields = [
            "id",
            "name",
            "display_name",
            "description",
            "step_definitions",
            "required_input_fields",
            "target_integration",
            "is_active",
            "job_count",
            "created_at",
            "updated_at",
        ]


class RPAJobDefinitionCreateInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    display_name = serializers.CharField(max_length=200)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    step_definitions = serializers.JSONField(default=list)
    required_input_fields = serializers.JSONField(default=list)
    target_integration = serializers.ChoiceField(
        choices=["aderant_soap", "aderant_rest", "sharepoint", "worldcheck", "internal"],
        default="aderant_soap",
    )
    is_active = serializers.BooleanField(default=True)


class RPAJobOutputSerializer(serializers.ModelSerializer):
    definition_name = serializers.CharField(
        source="definition.display_name", read_only=True
    )
    definition_id = serializers.UUIDField(source="definition.id", read_only=True)
    ticket_title = serializers.CharField(
        source="ticket.title", read_only=True, default=None
    )
    entity_name = serializers.CharField(
        source="entity.name", read_only=True, default=None
    )
    created_by_email = serializers.CharField(
        source="created_by.email", read_only=True, default=None
    )
    steps = RPAJobStepOutputSerializer(many=True, read_only=True)
    progress = serializers.SerializerMethodField()

    def get_progress(self, obj):
        from .services import get_job_progress

        return get_job_progress(job_id=obj.id)

    class Meta:
        model = RPAJob
        fields = [
            "id",
            "definition_id",
            "definition_name",
            "ticket",
            "ticket_title",
            "entity",
            "entity_name",
            "status",
            "input_data",
            "output_data",
            "error_message",
            "celery_task_id",
            "retry_count",
            "max_retries",
            "started_at",
            "completed_at",
            "created_by",
            "created_by_email",
            "steps",
            "progress",
            "created_at",
            "updated_at",
        ]


class RPAJobListOutputSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views (no steps)."""

    definition_name = serializers.CharField(
        source="definition.display_name", read_only=True
    )
    ticket_title = serializers.CharField(
        source="ticket.title", read_only=True, default=None
    )
    entity_name = serializers.CharField(
        source="entity.name", read_only=True, default=None
    )
    progress = serializers.SerializerMethodField()

    def get_progress(self, obj):
        from .services import get_job_progress

        return get_job_progress(job_id=obj.id)

    class Meta:
        model = RPAJob
        fields = [
            "id",
            "definition_name",
            "ticket",
            "ticket_title",
            "entity",
            "entity_name",
            "status",
            "error_message",
            "retry_count",
            "max_retries",
            "started_at",
            "completed_at",
            "progress",
            "created_at",
        ]


class RPAJobCreateInputSerializer(serializers.Serializer):
    definition_id = serializers.UUIDField()
    input_data = serializers.JSONField(default=dict)
    ticket_id = serializers.UUIDField(required=False, allow_null=True)
    entity_id = serializers.UUIDField(required=False, allow_null=True)
