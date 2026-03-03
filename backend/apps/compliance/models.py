import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from common.base_model import TimeStampedModel

from .constants import (
    DocumentType,
    KYCStatus,
    LLMExtractionStatus,
    PartyRole,
    PartyType,
    RecalculationStatus,
    RFIStatus,
    RiskLevel,
    RiskTrigger,
    ScreeningStatus,
)


class KYCSubmission(TimeStampedModel):
    ticket = models.ForeignKey(
        "workflow.Ticket",
        on_delete=models.CASCADE,
        related_name="kyc_submissions",
    )
    status = models.CharField(
        max_length=20,
        choices=KYCStatus.choices,
        default=KYCStatus.DRAFT,
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_kyc_submissions",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    proposed_entity_data = models.JSONField(default=dict, blank=True)
    field_comments = models.JSONField(default=dict, blank=True)

    class Meta(TimeStampedModel.Meta):
        verbose_name = "KYC Submission"
        verbose_name_plural = "KYC Submissions"

    def __str__(self):
        return f"KYC {self.id} - {self.get_status_display()}"


class Party(TimeStampedModel):
    kyc_submission = models.ForeignKey(
        KYCSubmission,
        on_delete=models.CASCADE,
        related_name="parties",
    )
    person = models.ForeignKey(
        "core.Person",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="compliance_parties",
    )
    party_type = models.CharField(
        max_length=20,
        choices=PartyType.choices,
    )
    role = models.CharField(
        max_length=30,
        choices=PartyRole.choices,
    )
    name = models.CharField(max_length=255)
    nationality = models.CharField(max_length=100, blank=True, default="")
    country_of_residence = models.CharField(max_length=100, blank=True, default="")
    pep_status = models.BooleanField(default=False)
    ownership_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
    )
    date_of_birth = models.DateField(null=True, blank=True)
    identification_number = models.CharField(max_length=100, blank=True, default="")

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Party"
        verbose_name_plural = "Parties"

    def __str__(self):
        return f"{self.name} ({self.get_role_display()})"


class JurisdictionRisk(TimeStampedModel):
    country_code = models.CharField(max_length=3, unique=True)
    country_name = models.CharField(max_length=100)
    risk_weight = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(10)],
    )

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Jurisdiction Risk"
        verbose_name_plural = "Jurisdiction Risks"

    def __str__(self):
        return f"{self.country_name} ({self.country_code}) - weight {self.risk_weight}"


class RiskAssessment(TimeStampedModel):
    kyc_submission = models.ForeignKey(
        KYCSubmission,
        on_delete=models.CASCADE,
        related_name="risk_assessments",
    )
    total_score = models.IntegerField()
    risk_level = models.CharField(
        max_length=10,
        choices=RiskLevel.choices,
    )
    breakdown_json = models.JSONField(default=dict)
    is_current = models.BooleanField(default=True)
    assessed_at = models.DateTimeField(auto_now_add=True)
    trigger = models.CharField(
        max_length=20,
        choices=RiskTrigger.choices,
    )

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Risk Assessment"
        verbose_name_plural = "Risk Assessments"

    def __str__(self):
        return (
            f"Risk {self.get_risk_level_display()} "
            f"(score={self.total_score}) for KYC {self.kyc_submission_id}"
        )


class RiskRecalculationLog(TimeStampedModel):
    batch_id = models.UUIDField(default=uuid.uuid4)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    total_entities = models.IntegerField(default=0)
    recalculated_count = models.IntegerField(default=0)
    changed_count = models.IntegerField(default=0)
    status = models.CharField(
        max_length=20,
        choices=RecalculationStatus.choices,
    )
    triggered_by = models.CharField(max_length=100)

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Risk Recalculation Log"
        verbose_name_plural = "Risk Recalculation Logs"

    def __str__(self):
        return f"Recalc batch {self.batch_id} - {self.get_status_display()}"


class RFI(TimeStampedModel):
    kyc_submission = models.ForeignKey(
        KYCSubmission,
        on_delete=models.CASCADE,
        related_name="rfis",
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="requested_rfis",
    )
    requested_fields = models.JSONField(default=list)
    notes = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=20,
        choices=RFIStatus.choices,
        default=RFIStatus.OPEN,
    )
    response_text = models.TextField(blank=True, default="")
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta(TimeStampedModel.Meta):
        verbose_name = "RFI"
        verbose_name_plural = "RFIs"

    def __str__(self):
        return f"RFI {self.id} for KYC {self.kyc_submission_id} - {self.get_status_display()}"


class WorldCheckCase(TimeStampedModel):
    party = models.ForeignKey(
        Party,
        on_delete=models.CASCADE,
        related_name="worldcheck_cases",
    )
    case_system_id = models.CharField(max_length=255, blank=True, default="")
    screening_status = models.CharField(
        max_length=20,
        choices=ScreeningStatus.choices,
        default=ScreeningStatus.PENDING,
    )
    last_screened_at = models.DateTimeField(null=True, blank=True)
    ongoing_monitoring_enabled = models.BooleanField(default=False)
    match_data_json = models.JSONField(default=dict)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resolved_worldcheck_cases",
    )
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta(TimeStampedModel.Meta):
        verbose_name = "World-Check Case"
        verbose_name_plural = "World-Check Cases"

    def __str__(self):
        return (
            f"WC Case {self.case_system_id or self.id} "
            f"- {self.get_screening_status_display()}"
        )


class DocumentUpload(TimeStampedModel):
    kyc_submission = models.ForeignKey(
        KYCSubmission,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="documents",
    )
    party = models.ForeignKey(
        Party,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="documents",
    )
    document_type = models.CharField(
        max_length=30,
        choices=DocumentType.choices,
    )
    original_filename = models.CharField(max_length=255)
    sharepoint_file_id = models.CharField(max_length=255, blank=True, default="")
    sharepoint_web_url = models.URLField(max_length=1024, blank=True, default="")
    sharepoint_drive_item_id = models.CharField(max_length=255, blank=True, default="")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_documents",
    )
    file_size = models.IntegerField(default=0)
    mime_type = models.CharField(max_length=100, blank=True, default="")
    llm_extraction_json = models.JSONField(default=dict)
    llm_extraction_status = models.CharField(
        max_length=20,
        choices=LLMExtractionStatus.choices,
        default=LLMExtractionStatus.PENDING,
    )

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Document Upload"
        verbose_name_plural = "Document Uploads"

    def __str__(self):
        return f"{self.original_filename} ({self.get_document_type_display()})"
