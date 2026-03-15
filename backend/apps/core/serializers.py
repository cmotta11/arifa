from rest_framework import serializers

from apps.compliance.models import JurisdictionRisk

from .constants import (
    ClientCategory,
    ClientStatus,
    ClientType,
    EntityJurisdiction,
    EntityStatus,
    IdentificationType,
    MatterStatus,
    OfficerPosition,
    PersonStatus,
    PersonType,
    RiskLevel,
)
from .models import (
    ActivityCatalog,
    Client,
    ClientContact,
    Entity,
    EntityActivity,
    EntityAuditLog,
    EntityOfficer,
    Matter,
    Person,
    PersonAuditLog,
    SavedFilter,
    ShareClass,
    ShareIssuance,
    SourceOfFunds,
    SourceOfFundsCatalog,
    SourceOfWealth,
)


# ---------------------------------------------------------------------------
# Output serializers
# ---------------------------------------------------------------------------


class ClientOutputSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = [
            "id",
            "aderant_client_id",
            "name",
            "client_type",
            "category",
            "status",
            "created_at",
            "updated_at",
        ]


class ClientContactOutputSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientContact
        fields = [
            "id",
            "client",
            "user",
            "first_name",
            "last_name",
            "email",
            "phone",
            "position",
            "has_portal_access",
            "created_at",
            "updated_at",
        ]


class EntityOutputSerializer(serializers.ModelSerializer):
    client = ClientOutputSerializer(read_only=True)
    current_risk_level = serializers.SerializerMethodField()

    class Meta:
        model = Entity
        fields = [
            "id",
            "name",
            "jurisdiction",
            "client",
            "incorporation_date",
            "status",
            "current_risk_level",
            "created_at",
            "updated_at",
        ]

    def get_current_risk_level(self, obj):
        from apps.compliance.models import RiskAssessment

        assessment = RiskAssessment.objects.filter(
            entity=obj, is_current=True,
        ).values_list("risk_level", flat=True).first()
        return assessment


class MatterOutputSerializer(serializers.ModelSerializer):
    client = ClientOutputSerializer(read_only=True)
    entity = EntityOutputSerializer(read_only=True)

    class Meta:
        model = Matter
        fields = [
            "id",
            "aderant_matter_id",
            "client",
            "entity",
            "description",
            "status",
            "opened_date",
            "created_at",
            "updated_at",
        ]


class JurisdictionRiskMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = JurisdictionRisk
        fields = ["id", "country_code", "country_name", "risk_weight"]


class PersonOutputSerializer(serializers.ModelSerializer):
    client = ClientOutputSerializer(read_only=True)
    nationality = JurisdictionRiskMinimalSerializer(read_only=True)
    country_of_residence = JurisdictionRiskMinimalSerializer(read_only=True)
    full_name = serializers.CharField(source="display_name", read_only=True)

    class Meta:
        model = Person
        fields = [
            "id",
            "full_name",
            "last_name",
            "person_type",
            "nationality",
            "country_of_residence",
            "date_of_birth",
            "identification_number",
            "identification_type",
            "pep_status",
            "status",
            "client",
            "created_at",
            "updated_at",
        ]


# ---------------------------------------------------------------------------
# Input serializers
# ---------------------------------------------------------------------------


class ClientContactInputSerializer(serializers.Serializer):
    client_id = serializers.UUIDField()
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    position = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    has_portal_access = serializers.BooleanField(default=False)


class ClientInputSerializer(serializers.Serializer):
    aderant_client_id = serializers.CharField(
        max_length=50, required=False, allow_blank=True
    )
    name = serializers.CharField(max_length=255)
    client_type = serializers.ChoiceField(choices=ClientType.choices)
    category = serializers.ChoiceField(
        choices=ClientCategory.choices, default=ClientCategory.SILVER
    )
    status = serializers.ChoiceField(
        choices=ClientStatus.choices, default=ClientStatus.ACTIVE
    )


class EntityInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    jurisdiction = serializers.ChoiceField(choices=EntityJurisdiction.choices)
    client_id = serializers.UUIDField()
    incorporation_date = serializers.DateField(required=False, allow_null=True)
    status = serializers.ChoiceField(
        choices=EntityStatus.choices, default=EntityStatus.PENDING
    )


class MatterInputSerializer(serializers.Serializer):
    aderant_matter_id = serializers.CharField(
        max_length=50, required=False, allow_blank=True
    )
    client_id = serializers.UUIDField()
    entity_id = serializers.UUIDField(required=False, allow_null=True)
    description = serializers.CharField()
    status = serializers.ChoiceField(
        choices=MatterStatus.choices, default=MatterStatus.OPEN
    )


class PersonInputSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255)
    last_name = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    person_type = serializers.ChoiceField(choices=PersonType.choices)
    nationality_id = serializers.UUIDField(required=False, allow_null=True)
    country_of_residence_id = serializers.UUIDField(required=False, allow_null=True)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    identification_number = serializers.CharField(
        max_length=100, required=False, allow_blank=True
    )
    identification_type = serializers.ChoiceField(
        choices=IdentificationType.choices, required=False, allow_blank=True
    )
    pep_status = serializers.BooleanField(default=False)
    status = serializers.ChoiceField(
        choices=PersonStatus.choices, required=False
    )
    client_id = serializers.UUIDField(required=False, allow_null=True)


class PersonSearchSerializer(serializers.Serializer):
    query = serializers.CharField(max_length=255)


# ---------------------------------------------------------------------------
# Corporate-structure output serializers
# ---------------------------------------------------------------------------


class EntityMinimalOutputSerializer(serializers.ModelSerializer):
    """Non-recursive entity serializer (id + name only) for share issuances and officers."""

    class Meta:
        model = Entity
        fields = ["id", "name"]


class EntityOfficerOutputSerializer(serializers.ModelSerializer):
    officer_person = PersonOutputSerializer(read_only=True)
    officer_entity = EntityMinimalOutputSerializer(read_only=True)

    class Meta:
        model = EntityOfficer
        fields = [
            "id",
            "entity",
            "officer_person",
            "officer_entity",
            "positions",
            "start_date",
            "end_date",
            "is_active",
            "created_at",
            "updated_at",
        ]


class ShareIssuanceOutputSerializer(serializers.ModelSerializer):
    shareholder_person = PersonOutputSerializer(read_only=True)
    shareholder_entity = EntityMinimalOutputSerializer(read_only=True)

    class Meta:
        model = ShareIssuance
        fields = [
            "id",
            "share_class",
            "shareholder_person",
            "shareholder_entity",
            "num_shares",
            "issue_date",
            "certificate_number",
            "is_jtwros",
            "jtwros_partner_name",
            "is_trustee",
            "trustee_for",
            "created_at",
            "updated_at",
        ]


class ShareClassOutputSerializer(serializers.ModelSerializer):
    issuances = ShareIssuanceOutputSerializer(many=True, read_only=True)

    class Meta:
        model = ShareClass
        fields = [
            "id",
            "entity",
            "name",
            "currency",
            "par_value",
            "authorized_shares",
            "voting_rights",
            "issuances",
            "created_at",
            "updated_at",
        ]


class ActivityCatalogOutputSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityCatalog
        fields = ["id", "name", "default_risk_level"]


class EntityActivityOutputSerializer(serializers.ModelSerializer):
    activity = ActivityCatalogOutputSerializer(read_only=True)
    countries = JurisdictionRiskMinimalSerializer(many=True, read_only=True)

    class Meta:
        model = EntityActivity
        fields = [
            "id",
            "entity",
            "activity",
            "countries",
            "country_risk_level",
            "risk_level",
            "description",
            "created_at",
            "updated_at",
        ]


class SourceOfFundsCatalogOutputSerializer(serializers.ModelSerializer):
    class Meta:
        model = SourceOfFundsCatalog
        fields = ["id", "name", "default_risk_level"]


class SourceOfFundsOutputSerializer(serializers.ModelSerializer):
    source = SourceOfFundsCatalogOutputSerializer(read_only=True)
    countries = JurisdictionRiskMinimalSerializer(many=True, read_only=True)

    class Meta:
        model = SourceOfFunds
        fields = [
            "id",
            "entity",
            "source",
            "countries",
            "country_risk_level",
            "risk_level",
            "description",
            "created_at",
            "updated_at",
        ]


class SourceOfWealthOutputSerializer(serializers.ModelSerializer):
    class Meta:
        model = SourceOfWealth
        fields = [
            "id",
            "person",
            "description",
            "risk_level",
            "created_at",
            "updated_at",
        ]


# ---------------------------------------------------------------------------
# Corporate-structure input serializers
# ---------------------------------------------------------------------------


class EntityOfficerInputSerializer(serializers.Serializer):
    entity_id = serializers.UUIDField()
    officer_person_id = serializers.UUIDField(required=False, allow_null=True)
    officer_entity_id = serializers.UUIDField(required=False, allow_null=True)
    positions = serializers.ListField(
        child=serializers.ChoiceField(choices=OfficerPosition.choices),
        min_length=1,
    )
    start_date = serializers.DateField(required=False, allow_null=True)
    end_date = serializers.DateField(required=False, allow_null=True)
    is_active = serializers.BooleanField(default=True)

    def validate(self, attrs):
        person = attrs.get("officer_person_id")
        entity = attrs.get("officer_entity_id")
        if person and entity:
            raise serializers.ValidationError(
                "Provide either officer_person_id or officer_entity_id, not both."
            )
        if not self.partial and not person and not entity:
            raise serializers.ValidationError(
                "Provide either officer_person_id or officer_entity_id."
            )
        return attrs


class ShareClassInputSerializer(serializers.Serializer):
    entity_id = serializers.UUIDField()
    name = serializers.CharField(max_length=100)
    currency = serializers.CharField(max_length=3, default="USD")
    par_value = serializers.DecimalField(
        max_digits=12, decimal_places=4, required=False, allow_null=True
    )
    authorized_shares = serializers.IntegerField(required=False, allow_null=True)
    voting_rights = serializers.BooleanField(default=True)


class ShareIssuanceInputSerializer(serializers.Serializer):
    share_class_id = serializers.UUIDField()
    shareholder_person_id = serializers.UUIDField(required=False, allow_null=True)
    shareholder_entity_id = serializers.UUIDField(required=False, allow_null=True)
    num_shares = serializers.IntegerField()
    issue_date = serializers.DateField(required=False, allow_null=True)
    certificate_number = serializers.CharField(
        max_length=50, required=False, allow_blank=True
    )
    is_jtwros = serializers.BooleanField(default=False)
    jtwros_partner_name = serializers.CharField(
        max_length=255, required=False, allow_blank=True
    )
    is_trustee = serializers.BooleanField(default=False)
    trustee_for = serializers.CharField(
        max_length=255, required=False, allow_blank=True
    )


class EntityActivityInputSerializer(serializers.Serializer):
    entity_id = serializers.UUIDField()
    activity_id = serializers.UUIDField()
    country_ids = serializers.ListField(
        child=serializers.UUIDField(), allow_empty=False
    )
    risk_level = serializers.ChoiceField(choices=RiskLevel.choices)
    description = serializers.CharField(required=False, allow_blank=True, default="")


class SourceOfFundsInputSerializer(serializers.Serializer):
    entity_id = serializers.UUIDField()
    source_id = serializers.UUIDField()
    country_ids = serializers.ListField(
        child=serializers.UUIDField(), allow_empty=False
    )
    risk_level = serializers.ChoiceField(choices=RiskLevel.choices)
    description = serializers.CharField(required=False, allow_blank=True, default="")


class SourceOfWealthInputSerializer(serializers.Serializer):
    person_id = serializers.UUIDField()
    description = serializers.CharField()
    risk_level = serializers.ChoiceField(
        choices=RiskLevel.choices, default=RiskLevel.LOW
    )


# ---------------------------------------------------------------------------
# Audit log serializer
# ---------------------------------------------------------------------------


class AuditLogUserSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    email = serializers.EmailField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()


class EntityAuditLogOutputSerializer(serializers.ModelSerializer):
    changed_by = AuditLogUserSerializer(read_only=True)

    class Meta:
        model = EntityAuditLog
        fields = [
            "id",
            "entity",
            "kyc_submission",
            "model_name",
            "record_id",
            "action",
            "field_name",
            "old_value",
            "new_value",
            "changed_by",
            "source",
            "comment",
            "created_at",
        ]


class PersonAuditLogOutputSerializer(serializers.ModelSerializer):
    changed_by = AuditLogUserSerializer(read_only=True)

    class Meta:
        model = PersonAuditLog
        fields = [
            "id",
            "person",
            "model_name",
            "record_id",
            "action",
            "field_name",
            "old_value",
            "new_value",
            "changed_by",
            "source",
            "comment",
            "created_at",
        ]


# ---------------------------------------------------------------------------
# Global search serializers
# ---------------------------------------------------------------------------


class GlobalSearchResultSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    type = serializers.CharField()
    title = serializers.CharField()
    subtitle = serializers.CharField()
    url = serializers.CharField()


# ---------------------------------------------------------------------------
# Saved filter serializers
# ---------------------------------------------------------------------------


class SavedFilterOutputSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedFilter
        fields = [
            "id",
            "name",
            "module",
            "filters",
            "is_default",
            "created_at",
            "updated_at",
        ]


class SavedFilterInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    module = serializers.CharField(max_length=50)
    filters = serializers.JSONField(default=dict)
    is_default = serializers.BooleanField(default=False)


# ---------------------------------------------------------------------------
# Portal Entity Serializer (client-facing, read-only)
# ---------------------------------------------------------------------------


class PortalEntityOutputSerializer(serializers.ModelSerializer):
    entity_type = serializers.SerializerMethodField()
    current_risk_level = serializers.SerializerMethodField()
    kyc_status = serializers.SerializerMethodField()
    es_status = serializers.SerializerMethodField()
    ar_status = serializers.SerializerMethodField()

    class Meta:
        model = Entity
        fields = [
            "id",
            "name",
            "entity_type",
            "jurisdiction",
            "status",
            "incorporation_date",
            "current_risk_level",
            "kyc_status",
            "es_status",
            "ar_status",
            "created_at",
        ]

    def get_entity_type(self, obj):
        return "corporation"

    def get_current_risk_level(self, obj):
        from apps.compliance.models import RiskAssessment

        return RiskAssessment.objects.filter(
            entity=obj, is_current=True,
        ).values_list("risk_level", flat=True).first()

    def get_kyc_status(self, obj):
        from apps.compliance.models import KYCSubmission

        return KYCSubmission.objects.filter(
            ticket__entity=obj,
        ).order_by("-created_at").values_list("status", flat=True).first()

    def get_es_status(self, obj):
        from apps.compliance.models import EconomicSubstanceSubmission

        return EconomicSubstanceSubmission.objects.filter(
            entity=obj,
        ).order_by("-created_at").values_list("status", flat=True).first()

    def get_ar_status(self, obj):
        from apps.compliance.models import AccountingRecord

        return AccountingRecord.objects.filter(
            entity=obj,
        ).order_by("-created_at").values_list("status", flat=True).first()
