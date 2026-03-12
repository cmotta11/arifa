from rest_framework import serializers

from .constants import ROLE_CHOICES
from .models import GuestLink, User


class UserOutputSerializer(serializers.ModelSerializer):
    client_id = serializers.UUIDField(source="client.id", read_only=True, default=None)
    client_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "email", "first_name", "last_name", "role", "client_id", "client_name")

    def get_client_name(self, obj):
        return obj.client.name if obj.client else None


class RegisterInputSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    role = serializers.ChoiceField(choices=ROLE_CHOICES)
    first_name = serializers.CharField(required=False, default="", allow_blank=True)
    last_name = serializers.CharField(required=False, default="", allow_blank=True)

    def create(self, validated_data):
        raise NotImplementedError("Use the register_user service instead.")

    def update(self, instance, validated_data):
        raise NotImplementedError("Use the register_user service instead.")


class LoginInputSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def create(self, validated_data):
        raise NotImplementedError("LoginInputSerializer does not support create.")

    def update(self, instance, validated_data):
        raise NotImplementedError("LoginInputSerializer does not support update.")


class UserListOutputSerializer(serializers.ModelSerializer):
    client_id = serializers.UUIDField(source="client.id", read_only=True, default=None)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "role",
            "is_active",
            "date_joined",
            "client_id",
        )


class UserUpdateInputSerializer(serializers.Serializer):
    first_name = serializers.CharField(required=False)
    last_name = serializers.CharField(required=False)
    role = serializers.ChoiceField(choices=ROLE_CHOICES, required=False)
    is_active = serializers.BooleanField(required=False)
    client_id = serializers.UUIDField(required=False, allow_null=True)

    def create(self, validated_data):
        raise NotImplementedError("Use the update_user service instead.")

    def update(self, instance, validated_data):
        raise NotImplementedError("Use the update_user service instead.")


class UserCreateInputSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(
        write_only=True, min_length=8, required=False, allow_blank=True, default=""
    )
    first_name = serializers.CharField(required=False, default="", allow_blank=True)
    last_name = serializers.CharField(required=False, default="", allow_blank=True)
    role = serializers.ChoiceField(
        choices=ROLE_CHOICES, default="coordinator", required=False
    )
    client_id = serializers.UUIDField(required=False, allow_null=True, default=None)

    def validate(self, attrs):
        # Client-role users don't need passwords (magic link auth).
        # All other roles require a password.
        role = attrs.get("role", "coordinator")
        password = attrs.get("password", "")
        if role != "client" and not password:
            raise serializers.ValidationError(
                {"password": "Password is required for non-client roles."}
            )
        # Normalise empty string to None for the service layer
        if not password:
            attrs["password"] = None
        return attrs

    def create(self, validated_data):
        raise NotImplementedError("Use the register_user service instead.")

    def update(self, instance, validated_data):
        raise NotImplementedError("Use the register_user service instead.")


class GuestLinkOutputSerializer(serializers.ModelSerializer):
    created_by = serializers.EmailField(source="created_by.email", read_only=True)
    client_name = serializers.SerializerMethodField()
    entity_name = serializers.SerializerMethodField()

    class Meta:
        model = GuestLink
        fields = (
            "id",
            "token",
            "created_by",
            "expires_at",
            "is_active",
            "ticket",
            "kyc_submission",
            "accounting_record",
            "client_name",
            "entity_name",
        )

    def get_client_name(self, obj):
        if obj.kyc_submission and hasattr(obj.kyc_submission, "ticket"):
            ticket = obj.kyc_submission.ticket
            if ticket and ticket.client:
                return ticket.client.name
        if obj.ticket and obj.ticket.client:
            return obj.ticket.client.name
        if obj.accounting_record and obj.accounting_record.entity:
            entity = obj.accounting_record.entity
            if entity.client:
                return entity.client.name
        return None

    def get_entity_name(self, obj):
        if obj.kyc_submission and hasattr(obj.kyc_submission, "ticket"):
            ticket = obj.kyc_submission.ticket
            if ticket and ticket.entity:
                return ticket.entity.name
        if obj.ticket and obj.ticket.entity:
            return obj.ticket.entity.name
        if obj.accounting_record and obj.accounting_record.entity:
            return obj.accounting_record.entity.name
        return None


class GuestLinkCreateInputSerializer(serializers.Serializer):
    ticket = serializers.UUIDField(required=False, allow_null=True, default=None)
    kyc_submission = serializers.UUIDField(required=False, allow_null=True, default=None)
    accounting_record = serializers.UUIDField(required=False, allow_null=True, default=None)

    def create(self, validated_data):
        raise NotImplementedError("Use the create_guest_link service instead.")

    def update(self, instance, validated_data):
        raise NotImplementedError("Use the create_guest_link service instead.")


class MagicLinkRequestInputSerializer(serializers.Serializer):
    email = serializers.EmailField()


class MagicLinkSendInputSerializer(serializers.Serializer):
    user_id = serializers.UUIDField()


class MagicLinkValidateInputSerializer(serializers.Serializer):
    token = serializers.UUIDField()
