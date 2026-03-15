from rest_framework import serializers

from .models import DocumentTemplate, GeneratedDocument


# ---------------------------------------------------------------------------
# Output serializers
# ---------------------------------------------------------------------------


class DocumentTemplateOutputSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentTemplate
        fields = [
            "id",
            "name",
            "file",
            "entity_type",
            "jurisdiction",
            "is_active",
            "created_at",
            "updated_at",
        ]


class GeneratedDocumentOutputSerializer(serializers.ModelSerializer):
    template_name = serializers.CharField(
        source="template.name", read_only=True, default=""
    )
    generated_by_email = serializers.EmailField(
        source="generated_by.email", read_only=True
    )

    class Meta:
        model = GeneratedDocument
        fields = [
            "id",
            "ticket",
            "template",
            "template_name",
            "generated_file",
            "format",
            "generated_by",
            "generated_by_email",
            "sharepoint_file_id",
            "created_at",
            "updated_at",
        ]


# ---------------------------------------------------------------------------
# Input serializers
# ---------------------------------------------------------------------------


class DocumentTemplateCreateInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    file = serializers.FileField()
    entity_type = serializers.CharField(
        max_length=50, required=False, allow_blank=True, default=""
    )
    jurisdiction = serializers.CharField(
        max_length=50, required=False, allow_blank=True, default=""
    )


class GenerateDocumentInputSerializer(serializers.Serializer):
    ticket_id = serializers.UUIDField()
    template_id = serializers.UUIDField()
    context_data = serializers.DictField(required=False, allow_null=True, default=None)


class AssembleDocumentInputSerializer(serializers.Serializer):
    """Input for the document assembly endpoint."""

    builder_name = serializers.CharField(max_length=100)
    ticket_id = serializers.UUIDField()
    context_data = serializers.DictField()


class ConvertPDFInputSerializer(serializers.Serializer):
    """Empty serializer used as action trigger for PDF conversion."""

    pass
