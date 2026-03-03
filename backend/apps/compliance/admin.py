from django.contrib import admin

from .models import (
    DocumentUpload,
    JurisdictionRisk,
    KYCSubmission,
    Party,
    RFI,
    RiskAssessment,
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


@admin.register(RiskAssessment)
class RiskAssessmentAdmin(admin.ModelAdmin):
    list_display = (
        "kyc_submission",
        "total_score",
        "risk_level",
        "is_current",
        "trigger",
        "assessed_at",
    )
    list_filter = ("risk_level", "is_current", "trigger")
    search_fields = ("kyc_submission__id",)
    readonly_fields = ("created_at", "updated_at", "assessed_at")
    raw_id_fields = ("kyc_submission",)


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
