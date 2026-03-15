from rest_framework import serializers

from .models import (
    Notification,
    NotificationCategory,
    NotificationChannel,
    NotificationPreference,
    NotificationTemplate,
)


class NotificationTemplateOutputSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationTemplate
        fields = [
            "id",
            "key",
            "display_name",
            "subject_template",
            "body_template",
            "in_app_template",
            "category",
            "default_channel",
            "is_active",
            "created_at",
            "updated_at",
        ]


class NotificationTemplateInputSerializer(serializers.Serializer):
    key = serializers.CharField(max_length=100)
    display_name = serializers.CharField(max_length=200)
    subject_template = serializers.CharField(max_length=500)
    body_template = serializers.CharField()
    in_app_template = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")
    category = serializers.ChoiceField(
        choices=["ticket", "kyc", "compliance", "rpa", "document", "system", "reminder"],
        default="system",
    )
    default_channel = serializers.ChoiceField(
        choices=["in_app", "email", "both"],
        default="both",
    )
    is_active = serializers.BooleanField(default=True)


class NotificationOutputSerializer(serializers.ModelSerializer):
    template_key = serializers.CharField(
        source="template.key", read_only=True, default=None
    )

    class Meta:
        model = Notification
        fields = [
            "id",
            "title",
            "body",
            "channel",
            "priority",
            "category",
            "is_read",
            "read_at",
            "action_url",
            "ticket",
            "entity",
            "template_key",
            "metadata",
            "created_at",
        ]


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = [
            "id",
            "category_channels",
            "daily_digest_enabled",
            "digest_hour",
        ]


class NotificationPreferenceInputSerializer(serializers.Serializer):
    category_channels = serializers.JSONField(required=False)
    daily_digest_enabled = serializers.BooleanField(required=False)
    digest_hour = serializers.IntegerField(required=False, min_value=0, max_value=23)

    _valid_categories = {c.value for c in NotificationCategory}
    _valid_channels = {c.value for c in NotificationChannel}

    def validate_category_channels(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("category_channels must be a JSON object.")
        for key, channel in value.items():
            if key not in self._valid_categories:
                raise serializers.ValidationError(
                    f"Invalid category '{key}'. Valid categories: {sorted(self._valid_categories)}"
                )
            if channel not in self._valid_channels:
                raise serializers.ValidationError(
                    f"Invalid channel '{channel}' for category '{key}'. "
                    f"Valid channels: {sorted(self._valid_channels)}"
                )
        return value
