from rest_framework import serializers

from .constants import (
    AccountingRecordFormType,
    AccountingRecordStatus,
    CompletionMethod,
    DDChecklistSection,
    DocumentType,
    ESStatus,
    KYCStatus,
    LLMExtractionStatus,
    PartyRole,
    PartyType,
    RFIStatus,
    RiskFactorCategory,
    RiskFactorCode,
    RiskLevel,
    RiskTrigger,
    ScreeningStatus,
    SnapshotStatus,
    TriggerCondition,
)
from .models import (
    AccountingRecord,
    AccountingRecordDocument,
    AutomaticTriggerRule,
    ComplianceDelegation,
    ComplianceSnapshot,
    DocumentUpload,
    DueDiligenceChecklist,
    EconomicSubstanceSubmission,
    JurisdictionConfig,
    JurisdictionRisk,
    KYCSubmission,
    OwnershipSnapshot,
    Party,
    RFI,
    RiskAssessment,
    RiskFactor,
    RiskMatrixConfig,
    WorldCheckCase,
)


# ===========================================================================
# Output serializers (ModelSerializer)
# ===========================================================================


class KYCSubmissionOutputSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = KYCSubmission
        fields = [
            "id", "ticket", "status", "status_display", "submitted_at",
            "reviewed_by", "reviewed_at", "proposed_entity_data",
            "field_comments", "created_at", "updated_at",
        ]


class PartyOutputSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    party_type_display = serializers.CharField(source="get_party_type_display", read_only=True)

    class Meta:
        model = Party
        fields = [
            "id", "kyc_submission", "person", "party_type", "party_type_display",
            "role", "role_display", "name", "nationality", "country_of_residence",
            "pep_status", "ownership_percentage", "date_of_birth",
            "identification_number", "created_at", "updated_at",
        ]


class JurisdictionRiskOutputSerializer(serializers.ModelSerializer):
    class Meta:
        model = JurisdictionRisk
        fields = ["id", "country_code", "country_name", "risk_weight", "created_at", "updated_at"]


class RiskFactorOutputSerializer(serializers.ModelSerializer):
    code_display = serializers.CharField(source="get_code_display", read_only=True)
    category_display = serializers.CharField(source="get_category_display", read_only=True)

    class Meta:
        model = RiskFactor
        fields = [
            "id", "code", "code_display", "category", "category_display",
            "max_score", "description", "scoring_rules_json", "created_at", "updated_at",
        ]


class AutomaticTriggerRuleOutputSerializer(serializers.ModelSerializer):
    condition_display = serializers.CharField(source="get_condition_display", read_only=True)
    forced_risk_level_display = serializers.CharField(source="get_forced_risk_level_display", read_only=True)

    class Meta:
        model = AutomaticTriggerRule
        fields = [
            "id", "condition", "condition_display", "forced_risk_level",
            "forced_risk_level_display", "is_active", "description",
            "created_at", "updated_at",
        ]


class RiskMatrixConfigOutputSerializer(serializers.ModelSerializer):
    factors = RiskFactorOutputSerializer(many=True, read_only=True)
    trigger_rules = AutomaticTriggerRuleOutputSerializer(many=True, read_only=True)

    class Meta:
        model = RiskMatrixConfig
        fields = [
            "id", "name", "jurisdiction", "entity_type", "version",
            "is_active", "high_risk_threshold", "medium_risk_threshold",
            "created_by", "notes", "factors", "trigger_rules",
            "created_at", "updated_at",
        ]


class ComplianceSnapshotOutputSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ComplianceSnapshot
        fields = [
            "id", "name", "snapshot_date", "created_by", "status",
            "status_display", "total_entities", "total_persons",
            "high_risk_count", "medium_risk_count", "low_risk_count",
            "notes", "completed_at", "created_at", "updated_at",
        ]


class RiskAssessmentOutputSerializer(serializers.ModelSerializer):
    risk_level_display = serializers.CharField(source="get_risk_level_display", read_only=True)
    trigger_display = serializers.CharField(source="get_trigger_display", read_only=True)
    entity_name = serializers.CharField(source="entity.name", read_only=True, default=None)
    person_name = serializers.CharField(source="person.display_name", read_only=True, default=None)

    class Meta:
        model = RiskAssessment
        fields = [
            "id", "kyc_submission", "entity", "entity_name", "person", "person_name",
            "total_score", "risk_level", "risk_level_display",
            "breakdown_json", "is_current", "assessed_at",
            "trigger", "trigger_display",
            "matrix_config", "matrix_config_snapshot", "input_data_snapshot",
            "triggered_rules", "is_auto_triggered",
            "assessed_by", "snapshot",
            "created_at", "updated_at",
        ]


class RFIOutputSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = RFI
        fields = [
            "id", "kyc_submission", "requested_by", "requested_fields",
            "notes", "status", "status_display", "response_text",
            "responded_at", "created_at", "updated_at",
        ]


class WorldCheckCaseOutputSerializer(serializers.ModelSerializer):
    screening_status_display = serializers.CharField(source="get_screening_status_display", read_only=True)

    class Meta:
        model = WorldCheckCase
        fields = [
            "id", "party", "case_system_id", "screening_status",
            "screening_status_display", "last_screened_at",
            "ongoing_monitoring_enabled",
            "resolved_by", "resolved_at", "created_at", "updated_at",
        ]


class WorldCheckCaseDetailOutputSerializer(WorldCheckCaseOutputSerializer):
    """Extended serializer that includes match_data_json — restricted to compliance staff."""

    class Meta(WorldCheckCaseOutputSerializer.Meta):
        fields = [*WorldCheckCaseOutputSerializer.Meta.fields, "match_data_json"]


class DocumentUploadOutputSerializer(serializers.ModelSerializer):
    document_type_display = serializers.CharField(source="get_document_type_display", read_only=True)
    llm_extraction_status_display = serializers.CharField(source="get_llm_extraction_status_display", read_only=True)

    class Meta:
        model = DocumentUpload
        fields = [
            "id", "kyc_submission", "party", "document_type",
            "document_type_display", "original_filename",
            "sharepoint_file_id", "sharepoint_web_url",
            "sharepoint_drive_item_id", "uploaded_by", "file_size",
            "mime_type", "llm_extraction_status",
            "llm_extraction_status_display", "created_at", "updated_at",
        ]


class DocumentUploadDetailOutputSerializer(DocumentUploadOutputSerializer):
    """Extended serializer that includes llm_extraction_json — restricted to compliance staff."""

    class Meta(DocumentUploadOutputSerializer.Meta):
        fields = [*DocumentUploadOutputSerializer.Meta.fields, "llm_extraction_json"]


# ===========================================================================
# Input serializers
# ===========================================================================


class KYCSubmissionInputSerializer(serializers.Serializer):
    ticket_id = serializers.UUIDField()


class PartyInputSerializer(serializers.Serializer):
    party_type = serializers.ChoiceField(choices=PartyType.choices)
    role = serializers.ChoiceField(choices=PartyRole.choices)
    name = serializers.CharField(max_length=255)
    nationality = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    country_of_residence = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    pep_status = serializers.BooleanField(default=False)
    ownership_percentage = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, allow_null=True, default=None)
    date_of_birth = serializers.DateField(required=False, allow_null=True, default=None)
    identification_number = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    person_id = serializers.UUIDField(required=False, allow_null=True, default=None)


class RFIInputSerializer(serializers.Serializer):
    requested_fields = serializers.ListField(child=serializers.CharField(max_length=100), allow_empty=False)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class RFIRespondInputSerializer(serializers.Serializer):
    response_text = serializers.CharField()


class WorldCheckResolveInputSerializer(serializers.Serializer):
    resolution = serializers.ChoiceField(choices=[
        (ScreeningStatus.FALSE_POSITIVE, "False Positive"),
        (ScreeningStatus.TRUE_MATCH, "True Match"),
    ])


class DocumentUploadInputSerializer(serializers.Serializer):
    ALLOWED_MIME_TYPES = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "image/jpeg",
        "image/png",
    ]
    MIME_TO_EXTENSIONS = {
        "application/pdf": [".pdf"],
        "application/msword": [".doc"],
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
        "application/vnd.ms-excel": [".xls"],
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
        "image/jpeg": [".jpg", ".jpeg"],
        "image/png": [".png"],
    }
    MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB

    document_type = serializers.ChoiceField(choices=DocumentType.choices)
    file = serializers.FileField()
    party_id = serializers.UUIDField(required=False, allow_null=True, default=None)

    def validate_file(self, value):
        import os

        if value.size > self.MAX_FILE_SIZE:
            raise serializers.ValidationError(
                f"File size {value.size} bytes exceeds the 20MB limit."
            )
        content_type = getattr(value, "content_type", "")
        if content_type not in self.ALLOWED_MIME_TYPES:
            raise serializers.ValidationError(
                f"File type '{content_type}' is not allowed. "
                f"Allowed types: {', '.join(self.ALLOWED_MIME_TYPES)}"
            )
        ext = os.path.splitext(value.name)[1].lower()
        allowed_exts = self.MIME_TO_EXTENSIONS.get(content_type, [])
        if ext not in allowed_exts:
            raise serializers.ValidationError(
                f"File extension '{ext}' does not match content type '{content_type}'. "
                f"Expected one of: {', '.join(allowed_exts)}"
            )
        return value


class LinkPersonInputSerializer(serializers.Serializer):
    person_id = serializers.UUIDField()


class ExtractDocumentInputSerializer(serializers.Serializer):
    document_type = serializers.ChoiceField(choices=DocumentType.choices)
    file = serializers.FileField()


class CalculateRiskInputSerializer(serializers.Serializer):
    trigger = serializers.ChoiceField(choices=RiskTrigger.choices, default=RiskTrigger.MANUAL, required=False)


class JurisdictionRiskInputSerializer(serializers.Serializer):
    country_code = serializers.CharField(max_length=3)
    country_name = serializers.CharField(max_length=100)
    risk_weight = serializers.IntegerField(min_value=1, max_value=10)


# --- Risk Matrix Config ---

class RiskMatrixConfigInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    jurisdiction = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")
    entity_type = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")
    high_risk_threshold = serializers.IntegerField(default=70, required=False)
    medium_risk_threshold = serializers.IntegerField(default=40, required=False)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class RiskFactorInputSerializer(serializers.Serializer):
    code = serializers.ChoiceField(choices=RiskFactorCode.choices)
    category = serializers.ChoiceField(choices=RiskFactorCategory.choices)
    max_score = serializers.IntegerField(min_value=0)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    scoring_rules_json = serializers.JSONField(required=False, default=dict)


class AutomaticTriggerRuleInputSerializer(serializers.Serializer):
    condition = serializers.ChoiceField(choices=TriggerCondition.choices)
    forced_risk_level = serializers.ChoiceField(choices=RiskLevel.choices, default=RiskLevel.HIGH, required=False)
    is_active = serializers.BooleanField(default=True, required=False)
    description = serializers.CharField(required=False, allow_blank=True, default="")


class ComplianceSnapshotInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


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
# Guest entity snapshot & propose-changes
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


# ===========================================================================
# Accounting Records serializers
# ===========================================================================


class AccountingRecordDocumentOutputSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = AccountingRecordDocument
        fields = [
            "id", "accounting_record", "file_url", "original_filename",
            "file_size", "mime_type", "description", "created_at", "updated_at",
        ]

    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class AccountingRecordOutputSerializer(serializers.ModelSerializer):
    entity_name = serializers.CharField(source="entity.name", read_only=True)
    client_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    form_type_display = serializers.CharField(source="get_form_type_display", read_only=True, default="")
    reviewed_by_email = serializers.EmailField(source="reviewed_by.email", read_only=True, default=None)
    guest_link_token = serializers.SerializerMethodField()

    class Meta:
        model = AccountingRecord
        fields = [
            "id", "entity", "entity_name", "client_name", "fiscal_year",
            "form_type", "form_type_display", "status", "status_display",
            "form_data", "signature_data", "signer_name", "signer_identification",
            "submitted_at", "reviewed_by", "reviewed_by_email", "reviewed_at",
            "review_notes", "guest_link_token", "created_at", "updated_at",
        ]

    def get_client_name(self, obj):
        if obj.entity and obj.entity.client:
            return obj.entity.client.name
        return None

    def get_guest_link_token(self, obj):
        if hasattr(obj, "guest_links"):
            link = obj.guest_links.filter(is_active=True).first()
            if link:
                return str(link.token)
        return None


class AccountingRecordSummaryOutputSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    pending = serializers.IntegerField()
    draft = serializers.IntegerField()
    submitted = serializers.IntegerField()
    approved = serializers.IntegerField()
    rejected = serializers.IntegerField()


class AccountingRecordSaveDraftInputSerializer(serializers.Serializer):
    form_type = serializers.ChoiceField(
        choices=AccountingRecordFormType.choices, required=False, allow_blank=True, default=""
    )
    form_data = serializers.DictField(required=False, default=None)
    signature_data = serializers.CharField(
        max_length=500_000, required=False, allow_blank=True, default="",
    )
    signer_name = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    signer_identification = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")


class AccountingRecordReviewInputSerializer(serializers.Serializer):
    review_notes = serializers.CharField(required=False, allow_blank=True, default="")


class AccountingRecordDocumentUploadInputSerializer(serializers.Serializer):
    ALLOWED_MIME_TYPES = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "image/jpeg",
        "image/png",
    ]
    MIME_TO_EXTENSIONS = {
        "application/pdf": [".pdf"],
        "application/msword": [".doc"],
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
        "application/vnd.ms-excel": [".xls"],
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
        "image/jpeg": [".jpg", ".jpeg"],
        "image/png": [".png"],
    }
    MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB

    file = serializers.FileField()
    description = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")

    def validate_file(self, value):
        import os

        if value.size > self.MAX_FILE_SIZE:
            raise serializers.ValidationError(
                f"File size {value.size} bytes exceeds the 20MB limit."
            )
        content_type = getattr(value, "content_type", "")
        if content_type not in self.ALLOWED_MIME_TYPES:
            raise serializers.ValidationError(
                f"File type '{content_type}' is not allowed. "
                f"Allowed types: {', '.join(self.ALLOWED_MIME_TYPES)}"
            )
        ext = os.path.splitext(value.name)[1].lower()
        allowed_exts = self.MIME_TO_EXTENSIONS.get(content_type, [])
        if ext not in allowed_exts:
            raise serializers.ValidationError(
                f"File extension '{ext}' does not match content type '{content_type}'. "
                f"Expected one of: {', '.join(allowed_exts)}"
            )
        return value


class BulkCreateAccountingRecordsInputSerializer(serializers.Serializer):
    fiscal_year = serializers.IntegerField()


class AccountingRecordListOutputSerializer(AccountingRecordOutputSerializer):
    """List serializer that excludes PII (signature_data, form_data)."""

    class Meta(AccountingRecordOutputSerializer.Meta):
        fields = [
            f for f in AccountingRecordOutputSerializer.Meta.fields
            if f not in ("signature_data", "form_data")
        ]


class CreateForEntityInputSerializer(serializers.Serializer):
    entity_id = serializers.UUIDField()
    fiscal_year = serializers.IntegerField(default=lambda: __import__("datetime").date.today().year - 1)


# ===========================================================================
# Jurisdiction Configuration serializers
# ===========================================================================


class JurisdictionConfigOutputSerializer(serializers.ModelSerializer):
    jurisdiction_code = serializers.CharField(source="jurisdiction.country_code", read_only=True)
    jurisdiction_name = serializers.CharField(source="jurisdiction.country_name", read_only=True)
    risk_weight = serializers.IntegerField(source="jurisdiction.risk_weight", read_only=True)
    default_risk_matrix_name = serializers.CharField(
        source="default_risk_matrix.name", read_only=True, default=None,
    )

    class Meta:
        model = JurisdictionConfig
        fields = [
            "id", "jurisdiction", "jurisdiction_code", "jurisdiction_name",
            "risk_weight", "inc_workflow", "requires_notary", "requires_registry",
            "requires_nit_ruc", "requires_rbuf", "supports_digital_notary",
            "ubo_threshold_percent", "kyc_renewal_months",
            "es_required", "ar_required", "exempted_available",
            "default_risk_matrix", "default_risk_matrix_name",
            "entity_types", "form_config", "es_flow_config",
            "created_at", "updated_at",
        ]


class JurisdictionConfigInputSerializer(serializers.Serializer):
    jurisdiction_id = serializers.UUIDField()
    inc_workflow = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    requires_notary = serializers.BooleanField(default=False, required=False)
    requires_registry = serializers.BooleanField(default=False, required=False)
    requires_nit_ruc = serializers.BooleanField(default=False, required=False)
    requires_rbuf = serializers.BooleanField(default=False, required=False)
    supports_digital_notary = serializers.BooleanField(default=False, required=False)
    ubo_threshold_percent = serializers.DecimalField(
        max_digits=5, decimal_places=2, default=25, required=False,
    )
    kyc_renewal_months = serializers.IntegerField(default=12, required=False)
    es_required = serializers.BooleanField(default=False, required=False)
    ar_required = serializers.BooleanField(default=False, required=False)
    exempted_available = serializers.BooleanField(default=False, required=False)
    default_risk_matrix_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    entity_types = serializers.ListField(
        child=serializers.CharField(max_length=50), required=False, default=list,
    )
    form_config = serializers.DictField(required=False, default=dict)
    es_flow_config = serializers.DictField(required=False, default=dict)


# ===========================================================================
# Delegation serializers
# ===========================================================================


class ComplianceDelegationOutputSerializer(serializers.ModelSerializer):
    entity_name = serializers.CharField(source="entity.name", read_only=True)
    delegated_by_email = serializers.EmailField(source="delegated_by.email", read_only=True)
    delegate_user_email = serializers.EmailField(source="delegate_user.email", read_only=True, default=None)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    module_display = serializers.CharField(source="get_module_display", read_only=True)

    class Meta:
        model = ComplianceDelegation
        fields = [
            "id", "entity", "entity_name", "module", "module_display",
            "fiscal_year", "delegated_by", "delegated_by_email",
            "delegate_email", "delegate_user", "delegate_user_email",
            "status", "status_display",
            "accepted_at", "revoked_at", "created_at", "updated_at",
        ]


class ComplianceDelegationCreateInputSerializer(serializers.Serializer):
    entity_id = serializers.UUIDField()
    module = serializers.ChoiceField(choices=["accounting_records", "economic_substance", "kyc"])
    fiscal_year = serializers.IntegerField()
    delegate_email = serializers.EmailField()


# ===========================================================================
# Due Diligence Checklist serializers
# ===========================================================================


class DueDiligenceChecklistOutputSerializer(serializers.ModelSerializer):
    section_display = serializers.CharField(source="get_section_display", read_only=True)
    completed_by_email = serializers.EmailField(source="completed_by.email", read_only=True, default=None)

    class Meta:
        model = DueDiligenceChecklist
        fields = [
            "id", "kyc_submission", "section", "section_display", "items",
            "completed_at", "completed_by", "completed_by_email",
            "created_at", "updated_at",
        ]


class DueDiligenceChecklistInputSerializer(serializers.Serializer):
    section = serializers.ChoiceField(choices=DDChecklistSection.choices)
    items = serializers.ListField(child=serializers.DictField(), default=list)


# ===========================================================================
# Field Comment serializers
# ===========================================================================


class FieldCommentInputSerializer(serializers.Serializer):
    field_name = serializers.CharField(max_length=255)
    text = serializers.CharField()
    parent_id = serializers.UUIDField(required=False, allow_null=True, default=None)


# ===========================================================================
# Economic Substance serializers
# ===========================================================================


class EconomicSubstanceOutputSerializer(serializers.ModelSerializer):
    entity_name = serializers.CharField(source="entity.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    reviewed_by_email = serializers.EmailField(source="reviewed_by.email", read_only=True, default=None)

    class Meta:
        model = EconomicSubstanceSubmission
        fields = [
            "id", "entity", "entity_name", "fiscal_year", "status", "status_display",
            "flow_answers", "current_step", "shareholders_data",
            "submitted_at", "reviewed_by", "reviewed_by_email", "reviewed_at",
            "field_comments", "attention_reason",
            "created_at", "updated_at",
        ]


class EconomicSubstanceListOutputSerializer(EconomicSubstanceOutputSerializer):
    """List serializer that excludes large JSON fields."""

    class Meta(EconomicSubstanceOutputSerializer.Meta):
        fields = [
            f for f in EconomicSubstanceOutputSerializer.Meta.fields
            if f not in ("flow_answers", "shareholders_data", "field_comments")
        ]


class EconomicSubstanceCreateInputSerializer(serializers.Serializer):
    entity_id = serializers.UUIDField()
    fiscal_year = serializers.IntegerField()


class EconomicSubstanceSaveDraftInputSerializer(serializers.Serializer):
    flow_answers = serializers.DictField(required=False, default=None)
    current_step = serializers.CharField(max_length=50, required=False, default=None)
    shareholders_data = serializers.ListField(
        child=serializers.DictField(), required=False, default=None,
    )


class ESAdvanceStepInputSerializer(serializers.Serializer):
    step_key = serializers.CharField(max_length=50)
    answer = serializers.JSONField()


class ESBulkCreateInputSerializer(serializers.Serializer):
    fiscal_year = serializers.IntegerField()


class ESRejectInputSerializer(serializers.Serializer):
    field_comments = serializers.DictField(required=False, default=None)


# ===========================================================================
# Help Request serializers
# ===========================================================================


class HelpRequestInputSerializer(serializers.Serializer):
    entity_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    module = serializers.CharField(max_length=50)
    current_page = serializers.CharField(max_length=255)
    message = serializers.CharField(required=False, allow_blank=True, default="")


# ===========================================================================
# Ownership Tree serializers
# ===========================================================================


class OwnershipSnapshotOutputSerializer(serializers.ModelSerializer):
    saved_by_email = serializers.EmailField(source="saved_by.email", read_only=True, default=None)

    class Meta:
        model = OwnershipSnapshot
        fields = [
            "id", "entity", "nodes", "edges", "reportable_ubos", "warnings",
            "saved_by", "saved_by_email", "created_at",
        ]


class SaveOwnershipTreeInputSerializer(serializers.Serializer):
    nodes = serializers.ListField(child=serializers.DictField())
    edges = serializers.ListField(child=serializers.DictField())
