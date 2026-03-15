from django.contrib import admin

from .models import (
    AccountingRecord,
    AccountingRecordDocument,
    AutomaticTriggerRule,
    ComplianceDelegation,
    ComplianceSnapshot,
    DocumentUpload,
    DueDiligenceChecklist,
    EconomicSubstanceSubmission,
    JurisdictionRisk,
    KYCSubmission,
    OwnershipSnapshot,
    Party,
    RFI,
    RiskAssessment,
    RiskFactor,
    RiskMatrixConfig,
    RiskRecalculationLog,
    WorldCheckCase,
)


@admin.register(KYCSubmission)
class KYCSubmissionAdmin(admin.ModelAdmin):
    list_display = ("id", "ticket", "status", "submitted_at", "reviewed_by", "reviewed_at", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("id", "ticket__id")
    readonly_fields = ("created_at", "updated_at")
    raw_id_fields = ("ticket", "reviewed_by")


@admin.register(Party)
class PartyAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "party_type",
        "role",
        "nationality",
        "pep_status",
        "ownership_percentage",
        "kyc_submission",
    )
    list_filter = ("party_type", "role", "pep_status")
    search_fields = ("name", "identification_number")
    readonly_fields = ("created_at", "updated_at")
    raw_id_fields = ("kyc_submission", "person")


@admin.register(JurisdictionRisk)
class JurisdictionRiskAdmin(admin.ModelAdmin):
    list_display = ("country_code", "country_name", "risk_weight")
    list_filter = ("risk_weight",)
    search_fields = ("country_code", "country_name")
    readonly_fields = ("created_at", "updated_at")


class RiskFactorInline(admin.TabularInline):
    model = RiskFactor
    extra = 0


class AutomaticTriggerRuleInline(admin.TabularInline):
    model = AutomaticTriggerRule
    extra = 0


@admin.register(RiskMatrixConfig)
class RiskMatrixConfigAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "jurisdiction",
        "entity_type",
        "version",
        "is_active",
        "high_risk_threshold",
        "medium_risk_threshold",
        "created_by",
    )
    list_filter = ("is_active", "jurisdiction", "entity_type")
    search_fields = ("name",)
    readonly_fields = ("created_at", "updated_at")
    raw_id_fields = ("created_by",)
    inlines = [RiskFactorInline, AutomaticTriggerRuleInline]


@admin.register(RiskFactor)
class RiskFactorAdmin(admin.ModelAdmin):
    list_display = ("code", "category", "max_score", "matrix_config")
    list_filter = ("category", "code")
    search_fields = ("code", "description")
    readonly_fields = ("created_at", "updated_at")
    raw_id_fields = ("matrix_config",)


@admin.register(AutomaticTriggerRule)
class AutomaticTriggerRuleAdmin(admin.ModelAdmin):
    list_display = ("condition", "forced_risk_level", "is_active", "matrix_config")
    list_filter = ("condition", "forced_risk_level", "is_active")
    readonly_fields = ("created_at", "updated_at")
    raw_id_fields = ("matrix_config",)


@admin.register(ComplianceSnapshot)
class ComplianceSnapshotAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "snapshot_date",
        "status",
        "total_entities",
        "total_persons",
        "high_risk_count",
        "medium_risk_count",
        "low_risk_count",
        "created_by",
    )
    list_filter = ("status",)
    search_fields = ("name",)
    readonly_fields = ("created_at", "updated_at")
    raw_id_fields = ("created_by",)


@admin.register(RiskAssessment)
class RiskAssessmentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "entity",
        "person",
        "kyc_submission",
        "total_score",
        "risk_level",
        "is_current",
        "is_auto_triggered",
        "trigger",
        "assessed_at",
    )
    list_filter = ("risk_level", "is_current", "trigger", "is_auto_triggered")
    search_fields = ("kyc_submission__id", "entity__name", "person__full_name")
    readonly_fields = ("created_at", "updated_at", "assessed_at")
    raw_id_fields = ("kyc_submission", "entity", "person", "matrix_config", "assessed_by", "snapshot")


@admin.register(RiskRecalculationLog)
class RiskRecalculationLogAdmin(admin.ModelAdmin):
    list_display = (
        "batch_id",
        "status",
        "total_entities",
        "recalculated_count",
        "changed_count",
        "triggered_by",
        "started_at",
        "completed_at",
    )
    list_filter = ("status", "triggered_by")
    search_fields = ("batch_id",)
    readonly_fields = ("created_at", "updated_at", "started_at")


@admin.register(RFI)
class RFIAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "kyc_submission",
        "requested_by",
        "status",
        "responded_at",
        "created_at",
    )
    list_filter = ("status",)
    search_fields = ("kyc_submission__id", "requested_by__email")
    readonly_fields = ("created_at", "updated_at")
    raw_id_fields = ("kyc_submission", "requested_by")


@admin.register(WorldCheckCase)
class WorldCheckCaseAdmin(admin.ModelAdmin):
    list_display = (
        "party",
        "case_system_id",
        "screening_status",
        "last_screened_at",
        "ongoing_monitoring_enabled",
        "resolved_by",
        "resolved_at",
    )
    list_filter = ("screening_status", "ongoing_monitoring_enabled")
    search_fields = ("case_system_id", "party__name")
    readonly_fields = ("created_at", "updated_at")
    raw_id_fields = ("party", "resolved_by")


@admin.register(DocumentUpload)
class DocumentUploadAdmin(admin.ModelAdmin):
    list_display = (
        "original_filename",
        "document_type",
        "kyc_submission",
        "party",
        "uploaded_by",
        "file_size",
        "llm_extraction_status",
        "created_at",
    )
    list_filter = ("document_type", "llm_extraction_status")
    search_fields = ("original_filename", "sharepoint_file_id")
    readonly_fields = ("created_at", "updated_at")
    raw_id_fields = ("kyc_submission", "party", "uploaded_by")


class AccountingRecordDocumentInline(admin.TabularInline):
    model = AccountingRecordDocument
    extra = 0
    readonly_fields = ("created_at",)


@admin.register(AccountingRecord)
class AccountingRecordAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "entity",
        "fiscal_year",
        "form_type",
        "status",
        "signer_name",
        "submitted_at",
        "reviewed_by",
        "created_at",
    )
    list_filter = ("status", "form_type", "fiscal_year")
    search_fields = ("entity__name", "signer_name", "signer_identification")
    readonly_fields = ("created_at", "updated_at")
    raw_id_fields = ("entity", "reviewed_by")
    inlines = [AccountingRecordDocumentInline]


@admin.register(AccountingRecordDocument)
class AccountingRecordDocumentAdmin(admin.ModelAdmin):
    list_display = (
        "original_filename",
        "accounting_record",
        "file_size",
        "mime_type",
        "description",
        "created_at",
    )
    search_fields = ("original_filename", "description")
    readonly_fields = ("created_at", "updated_at")
    raw_id_fields = ("accounting_record",)


@admin.register(ComplianceDelegation)
class ComplianceDelegationAdmin(admin.ModelAdmin):
    list_display = (
        "entity",
        "module",
        "fiscal_year",
        "delegate_email",
        "status",
        "delegated_by",
        "accepted_at",
        "created_at",
    )
    list_filter = ("status", "module", "fiscal_year")
    search_fields = ("delegate_email", "entity__name")
    readonly_fields = ("created_at", "updated_at")
    raw_id_fields = ("entity", "delegated_by", "delegate_user")


@admin.register(DueDiligenceChecklist)
class DueDiligenceChecklistAdmin(admin.ModelAdmin):
    list_display = ("kyc_submission", "section", "completed_at", "completed_by", "created_at")
    list_filter = ("section",)
    readonly_fields = ("created_at", "updated_at")
    raw_id_fields = ("kyc_submission", "completed_by")


@admin.register(EconomicSubstanceSubmission)
class EconomicSubstanceSubmissionAdmin(admin.ModelAdmin):
    list_display = (
        "entity", "fiscal_year", "status", "current_step",
        "submitted_at", "reviewed_by", "created_at",
    )
    list_filter = ("status", "fiscal_year")
    search_fields = ("entity__name",)
    readonly_fields = ("created_at", "updated_at")
    raw_id_fields = ("entity", "reviewed_by")


@admin.register(OwnershipSnapshot)
class OwnershipSnapshotAdmin(admin.ModelAdmin):
    list_display = ("entity", "saved_by", "created_at")
    search_fields = ("entity__name",)
    readonly_fields = ("created_at", "updated_at")
    raw_id_fields = ("entity", "saved_by")
