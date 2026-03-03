from rest_framework import serializers

from .constants import (
    DocumentType,
    KYCStatus,
    LLMExtractionStatus,
    PartyRole,
    PartyType,
    RFIStatus,
    RiskLevel,
    RiskTrigger,
    ScreeningStatus,
)
from .models import (
    DocumentUpload,
    JurisdictionRisk,
    KYCSubmission,
    Party,
    RFI,
    RiskAssessment,
    WorldCheckCase,
)


# ===========================================================================
# Output serializers (ModelSerializer)
# ===========================================================================


class KYCSubmissionOutputSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )

    class Meta:
        model = KYCSubmission
        fields = [
            "id",
            "ticket",
            "status",
            "status_display",
            "submitted_at",
            "reviewed_by",
            "reviewed_at",
            "proposed_entity_data",
            "field_comments",
            "created_at",
            "updated_at",
        ]


class PartyOutputSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(
        source="get_role_display", read_only=True
    )
    party_type_display = serializers.CharField(
        source="get_party_type_display", read_only=True
    )

    class Meta:
        model = Party
        fields = [
            "id",
            "kyc_submission",
            "person",
            "party_type",
            "party_type_display",
            "role",
            "role_display",
            "name",
            "nationality",
            "country_of_residence",
            "pep_status",
            "ownership_percentage",
            "date_of_birth",
            "identification_number",
            "created_at",
            "updated_at",
        ]


class JurisdictionRiskOutputSerializer(serializers.ModelSerializer):
    class Meta:
        model = JurisdictionRisk
        fields = [
            "id",
            "country_code",
            "country_name",
            "risk_weight",
            "created_at",
            "updated_at",
        ]


class RiskAssessmentOutputSerializer(serializers.ModelSerializer):
    risk_level_display = serializers.CharField(
        source="get_risk_level_display", read_only=True
    )
    trigger_display = serializers.CharField(
        source="get_trigger_display", read_only=True
    )

    class Meta:
        model = RiskAssessment
        fields = [
            "id",
            "kyc_submission",
            "total_score",
            "risk_level",
            "risk_level_display",
            "breakdown_json",
            "is_current",
            "assessed_at",
            "trigger",
            "trigger_display",
            "created_at",
            "updated_at",
        ]


class RFIOutputSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )

    class Meta:
        model = RFI
        fields = [
            "id",
            "kyc_submission",
            "requested_by",
            "requested_fields",
            "notes",
            "status",
            "status_display",
            "response_text",
            "responded_at",
            "created_at",
            "updated_at",
        ]


class WorldCheckCaseOutputSerializer(serializers.ModelSerializer):
    screening_status_display = serializers.CharField(
        source="get_screening_status_display", read_only=True
    )

    class Meta:
        model = WorldCheckCase
        fields = [
            "id",
            "party",
            "case_system_id",
            "screening_status",
            "screening_status_display",
            "last_screened_at",
            "ongoing_monitoring_enabled",
            "match_data_json",
            "resolved_by",
            "resolved_at",
            "created_at",
            "updated_at",
        ]


class DocumentUploadOutputSerializer(serializers.ModelSerializer):
    document_type_display = serializers.CharField(
        source="get_document_type_display", read_only=True
    )
    llm_extraction_status_display = serializers.CharField(
        source="get_llm_extraction_status_display", read_only=True
    )

    class Meta:
        model = DocumentUpload
        fields = [
            "id",
            "kyc_submission",
            "party",
            "document_type",
            "document_type_display",
            "original_filename",
            "sharepoint_file_id",
            "sharepoint_web_url",
            "sharepoint_drive_item_id",
            "uploaded_by",
            "file_size",
            "mime_type",
            "llm_extraction_json",
            "llm_extraction_status",
            "llm_extraction_status_display",
            "created_at",
            "updated_at",
        ]


# ===========================================================================
# Input serializers (plain Serializer -- no create/update)
# ===========================================================================


class KYCSubmissionInputSerializer(serializers.Serializer):
    ticket_id = serializers.UUIDField()


class PartyInputSerializer(serializers.Serializer):
    party_type = serializers.ChoiceField(choices=PartyType.choices)
    role = serializers.ChoiceField(choices=PartyRole.choices)
    name = serializers.CharField(max_length=255)
    nationality = serializers.CharField(
        max_length=100, required=False, allow_blank=True, default=""
    )
    country_of_residence = serializers.CharField(
        max_length=100, required=False, allow_blank=True, default=""
    )
    pep_status = serializers.BooleanField(default=False)
    ownership_percentage = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False, allow_null=True, default=None
    )
    date_of_birth = serializers.DateField(required=False, allow_null=True, default=None)
    identification_number = serializers.CharField(
        max_length=100, required=False, allow_blank=True, default=""
    )
    person_id = serializers.UUIDField(required=False, allow_null=True, default=None)


class RFIInputSerializer(serializers.Serializer):
    requested_fields = serializers.ListField(
        child=serializers.CharField(max_length=100),
        allow_empty=False,
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class RFIRespondInputSerializer(serializers.Serializer):
    response_text = serializers.CharField()


class WorldCheckResolveInputSerializer(serializers.Serializer):
    resolution = serializers.ChoiceField(
        choices=[
            (ScreeningStatus.FALSE_POSITIVE, "False Positive"),
            (ScreeningStatus.TRUE_MATCH, "True Match"),
        ]
    )


class DocumentUploadInputSerializer(serializers.Serializer):
    document_type = serializers.ChoiceField(choices=DocumentType.choices)
    file = serializers.FileField()
    party_id = serializers.UUIDField(required=False, allow_null=True, default=None)


class LinkPersonInputSerializer(serializers.Serializer):
    person_id = serializers.UUIDField()


class ExtractDocumentInputSerializer(serializers.Serializer):
    document_type = serializers.ChoiceField(choices=DocumentType.choices)
    file = serializers.FileField()


class CalculateRiskInputSerializer(serializers.Serializer):
    trigger = serializers.ChoiceField(
        choices=RiskTrigger.choices,
        default=RiskTrigger.MANUAL,
        required=False,
    )


class JurisdictionRiskInputSerializer(serializers.Serializer):
    country_code = serializers.CharField(max_length=3)
    country_name = serializers.CharField(max_length=100)
    risk_weight = serializers.IntegerField(min_value=1, max_value=10)

    def create(self, validated_data):
        raise NotImplementedError("Use the view/service layer instead.")

    def update(self, instance, validated_data):
        raise NotImplementedError("Use the view/service layer instead.")


# ===========================================================================
# Self-service onboarding
# ===========================================================================


class OnboardingInputSerializer(serializers.Serializer):
    client_name = serializers.CharField(max_length=255)
    client_type = serializers.ChoiceField(choices=[("natural", "Natural"), ("corporate", "Corporate")])
    entity_name = serializers.CharField(max_length=255)
    jurisdiction = serializers.ChoiceField(choices=[("bvi", "BVI"), ("panama", "Panama"), ("belize", "Belize")])
    contact_email = serializers.EmailField()
    contact_name = serializers.CharField(max_length=255)


class OnboardingOutputSerializer(serializers.Serializer):
    guest_link_token = serializers.UUIDField()
    kyc_id = serializers.UUIDField()
    client_id = serializers.UUIDField()
    entity_id = serializers.UUIDField()
    expires_at = serializers.DateTimeField()


# ===========================================================================
# Guest entity snapshot & propose-changes serializers
# ===========================================================================


class EntitySnapshotPersonSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    full_name = serializers.CharField()
    person_type = serializers.CharField()


class EntitySnapshotOfficerSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    officer_person = EntitySnapshotPersonSerializer(allow_null=True)
    officer_entity_id = serializers.UUIDField(allow_null=True)
    officer_entity_name = serializers.CharField(allow_null=True)
    positions = serializers.ListField(child=serializers.CharField())
    start_date = serializers.DateField(allow_null=True)
    end_date = serializers.DateField(allow_null=True)
    is_active = serializers.BooleanField()


class EntitySnapshotShareIssuanceSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    share_class_id = serializers.UUIDField()
    shareholder_person = EntitySnapshotPersonSerializer(allow_null=True)
    shareholder_entity_id = serializers.UUIDField(allow_null=True)
    shareholder_entity_name = serializers.CharField(allow_null=True)
    num_shares = serializers.IntegerField()
    issue_date = serializers.DateField(allow_null=True)
    certificate_number = serializers.CharField(allow_blank=True)
    is_jtwros = serializers.BooleanField()
    jtwros_partner_name = serializers.CharField(allow_blank=True)
    is_trustee = serializers.BooleanField()
    trustee_for = serializers.CharField(allow_blank=True)


class EntitySnapshotShareClassSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    currency = serializers.CharField()
    par_value = serializers.DecimalField(max_digits=12, decimal_places=4, allow_null=True)
    authorized_shares = serializers.IntegerField(allow_null=True)
    voting_rights = serializers.BooleanField()
    issuances = EntitySnapshotShareIssuanceSerializer(many=True)


class EntitySnapshotCountrySerializer(serializers.Serializer):
    id = serializers.UUIDField()
    country_code = serializers.CharField()
    country_name = serializers.CharField()
    risk_weight = serializers.IntegerField()


class EntitySnapshotActivitySerializer(serializers.Serializer):
    id = serializers.UUIDField()
    activity_id = serializers.UUIDField()
    activity_name = serializers.CharField()
    countries = EntitySnapshotCountrySerializer(many=True)
    risk_level = serializers.CharField()
    description = serializers.CharField(allow_blank=True)


class EntitySnapshotSourceOfFundsSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    source_id = serializers.UUIDField()
    source_name = serializers.CharField()
    countries = EntitySnapshotCountrySerializer(many=True)
    risk_level = serializers.CharField()
    description = serializers.CharField(allow_blank=True)


class CatalogItemSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    default_risk_level = serializers.CharField()


class EntitySnapshotOutputSerializer(serializers.Serializer):
    general = serializers.DictField()
    officers = EntitySnapshotOfficerSerializer(many=True)
    share_classes = EntitySnapshotShareClassSerializer(many=True)
    activities = EntitySnapshotActivitySerializer(many=True)
    sources_of_funds = EntitySnapshotSourceOfFundsSerializer(many=True)
    persons = EntitySnapshotPersonSerializer(many=True)
    activity_catalog = CatalogItemSerializer(many=True)
    sof_catalog = CatalogItemSerializer(many=True)
    countries = EntitySnapshotCountrySerializer(many=True)
    field_comments = serializers.DictField(required=False, default=dict)
    kyc_status = serializers.CharField()
    proposed_entity_data = serializers.DictField(required=False, default=dict)


class ProposeChangesInputSerializer(serializers.Serializer):
    proposed_entity_data = serializers.DictField()


class SendBackInputSerializer(serializers.Serializer):
    field_comments = serializers.DictField()


class ApproveWithChangesInputSerializer(serializers.Serializer):
    modified_data = serializers.DictField(required=False, default=None)
