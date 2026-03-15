import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from common.base_model import TimeStampedModel

from .constants import (
    AccountingRecordFormType,
    AccountingRecordStatus,
    CompletionMethod,
    DDChecklistSection,
    DelegationModule,
    DelegationStatus,
    DocumentType,
    ESStatus,
    KYCStatus,
    LLMExtractionStatus,
    PartyRole,
    PartyType,
    RecalculationStatus,
    RFIStatus,
    RiskFactorCategory,
    RiskFactorCode,
    RiskLevel,
    RiskTrigger,
    ScreeningStatus,
    SnapshotStatus,
    TriggerCondition,
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


class RiskMatrixConfig(TimeStampedModel):
    name = models.CharField(max_length=255)
    jurisdiction = models.CharField(max_length=20, blank=True, default="")
    entity_type = models.CharField(max_length=20, blank=True, default="")
    version = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)
    high_risk_threshold = models.IntegerField(default=70)
    medium_risk_threshold = models.IntegerField(default=40)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="risk_matrix_configs",
    )
    notes = models.TextField(blank=True, default="")

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Risk Matrix Config"
        verbose_name_plural = "Risk Matrix Configs"

    def __str__(self):
        scope = []
        if self.jurisdiction:
            scope.append(self.jurisdiction)
        if self.entity_type:
            scope.append(self.entity_type)
        scope_str = " / ".join(scope) if scope else "Global"
        return f"{self.name} v{self.version} ({scope_str})"


class RiskFactor(TimeStampedModel):
    matrix_config = models.ForeignKey(
        RiskMatrixConfig,
        on_delete=models.CASCADE,
        related_name="factors",
    )
    code = models.CharField(
        max_length=30,
        choices=RiskFactorCode.choices,
    )
    category = models.CharField(
        max_length=10,
        choices=RiskFactorCategory.choices,
    )
    max_score = models.IntegerField()
    description = models.TextField(blank=True, default="")
    scoring_rules_json = models.JSONField(default=dict, blank=True)

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Risk Factor"
        verbose_name_plural = "Risk Factors"
        constraints = [
            models.UniqueConstraint(
                fields=["matrix_config", "code", "category"],
                name="unique_factor_per_config",
            )
        ]

    def __str__(self):
        return f"{self.get_code_display()} (max={self.max_score})"


class AutomaticTriggerRule(TimeStampedModel):
    matrix_config = models.ForeignKey(
        RiskMatrixConfig,
        on_delete=models.CASCADE,
        related_name="trigger_rules",
    )
    condition = models.CharField(
        max_length=30,
        choices=TriggerCondition.choices,
    )
    forced_risk_level = models.CharField(
        max_length=10,
        choices=RiskLevel.choices,
        default=RiskLevel.HIGH,
    )
    is_active = models.BooleanField(default=True)
    description = models.TextField(blank=True, default="")

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Automatic Trigger Rule"
        verbose_name_plural = "Automatic Trigger Rules"

    def __str__(self):
        return f"{self.get_condition_display()} -> {self.get_forced_risk_level_display()}"


class ComplianceSnapshot(TimeStampedModel):
    name = models.CharField(max_length=255)
    snapshot_date = models.DateTimeField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="compliance_snapshots",
    )
    status = models.CharField(
        max_length=20,
        choices=SnapshotStatus.choices,
        default=SnapshotStatus.RUNNING,
    )
    total_entities = models.IntegerField(default=0)
    total_persons = models.IntegerField(default=0)
    high_risk_count = models.IntegerField(default=0)
    medium_risk_count = models.IntegerField(default=0)
    low_risk_count = models.IntegerField(default=0)
    notes = models.TextField(blank=True, default="")
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Compliance Snapshot"
        verbose_name_plural = "Compliance Snapshots"

    def __str__(self):
        return f"{self.name} ({self.get_status_display()})"


class RiskAssessment(TimeStampedModel):
    kyc_submission = models.ForeignKey(
        KYCSubmission,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="risk_assessments",
    )
    entity = models.ForeignKey(
        "core.Entity",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="risk_assessments",
    )
    person = models.ForeignKey(
        "core.Person",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
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
    matrix_config = models.ForeignKey(
        RiskMatrixConfig,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assessments",
    )
    matrix_config_snapshot = models.JSONField(default=dict, blank=True)
    input_data_snapshot = models.JSONField(default=dict, blank=True)
    triggered_rules = models.JSONField(default=list, blank=True)
    is_auto_triggered = models.BooleanField(default=False)
    assessed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="risk_assessments",
    )
    snapshot = models.ForeignKey(
        ComplianceSnapshot,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assessments",
    )

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Risk Assessment"
        verbose_name_plural = "Risk Assessments"
        indexes = [
            models.Index(fields=["entity", "is_current"], name="riskassess_entity_current_idx"),
            models.Index(fields=["person", "is_current"], name="riskassess_person_current_idx"),
        ]
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(entity__isnull=False)
                    | models.Q(person__isnull=False)
                    | models.Q(kyc_submission__isnull=False)
                ),
                name="risk_assessment_has_subject",
            )
        ]

    def __str__(self):
        subject = "Entity" if self.entity_id else "Person" if self.person_id else "KYC"
        subject_id = self.entity_id or self.person_id or self.kyc_submission_id
        return (
            f"Risk {self.get_risk_level_display()} "
            f"(score={self.total_score}) for {subject} {subject_id}"
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


class JurisdictionConfig(TimeStampedModel):
    """Jurisdiction-level configuration for workflows, compliance, and forms."""

    jurisdiction = models.OneToOneField(
        JurisdictionRisk,
        on_delete=models.CASCADE,
        related_name="config",
    )
    inc_workflow = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="Default incorporation workflow definition name",
    )
    requires_notary = models.BooleanField(default=False)
    requires_registry = models.BooleanField(default=False)
    requires_nit_ruc = models.BooleanField(default=False)
    requires_rbuf = models.BooleanField(default=False)
    supports_digital_notary = models.BooleanField(default=False)
    ubo_threshold_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=25,
        help_text="Ownership % threshold for UBO identification",
    )
    kyc_renewal_months = models.IntegerField(
        default=12,
        help_text="Months between KYC renewal cycles",
    )
    es_required = models.BooleanField(
        default=False,
        help_text="Whether Economic Substance filing is required",
    )
    ar_required = models.BooleanField(
        default=False,
        help_text="Whether Accounting Records (Panama Law 254) filing is required",
    )
    exempted_available = models.BooleanField(
        default=False,
        help_text="Whether exempted entity category is available",
    )
    default_risk_matrix = models.ForeignKey(
        RiskMatrixConfig,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="jurisdiction_configs",
        help_text="Default risk matrix for this jurisdiction",
    )
    entity_types = models.JSONField(
        default=list,
        blank=True,
        help_text="Available entity types for this jurisdiction",
    )
    form_config = models.JSONField(
        default=dict,
        blank=True,
        help_text="Jurisdiction-specific form field configuration",
    )
    es_flow_config = models.JSONField(
        default=dict,
        blank=True,
        help_text="Economic Substance flow configuration",
    )

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Jurisdiction Configuration"
        verbose_name_plural = "Jurisdiction Configurations"

    def __str__(self):
        return f"Config: {self.jurisdiction.country_name} ({self.jurisdiction.country_code})"


class AccountingRecord(TimeStampedModel):
    entity = models.ForeignKey(
        "core.Entity",
        on_delete=models.CASCADE,
        related_name="accounting_records",
    )
    fiscal_year = models.IntegerField(default=2025)
    form_type = models.CharField(
        max_length=20,
        choices=AccountingRecordFormType.choices,
        blank=True,
        default="",
    )
    status = models.CharField(
        max_length=20,
        choices=AccountingRecordStatus.choices,
        default=AccountingRecordStatus.PENDING,
    )
    form_data = models.JSONField(default=dict, blank=True)
    signature_data = models.TextField(blank=True, default="")
    signer_name = models.CharField(max_length=255, blank=True, default="")
    signer_identification = models.CharField(max_length=100, blank=True, default="")
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_accounting_records",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True, default="")
    completion_method = models.CharField(
        max_length=20,
        choices=CompletionMethod.choices,
        blank=True,
        default="",
    )
    uploaded_file = models.FileField(
        upload_to="accounting_records/uploads/",
        null=True,
        blank=True,
    )
    file_password = models.CharField(max_length=255, blank=True, default="")
    generated_pdf = models.FileField(
        upload_to="accounting_records/pdfs/",
        null=True,
        blank=True,
    )

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Accounting Record"
        verbose_name_plural = "Accounting Records"
        indexes = [
            models.Index(fields=["fiscal_year", "status"], name="accrec_fy_status_idx"),
            models.Index(fields=["entity", "fiscal_year"], name="accrec_entity_fy_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["entity", "fiscal_year"],
                name="unique_accounting_record_per_entity_year",
            )
        ]

    def __str__(self):
        return f"Accounting Record {self.entity_id} FY{self.fiscal_year} - {self.get_status_display()}"


class AccountingRecordDocument(TimeStampedModel):
    accounting_record = models.ForeignKey(
        AccountingRecord,
        on_delete=models.CASCADE,
        related_name="documents",
    )
    file = models.FileField(upload_to="accounting_records/%Y/")
    original_filename = models.CharField(max_length=255)
    file_size = models.IntegerField(default=0)
    mime_type = models.CharField(max_length=100, blank=True, default="")
    description = models.CharField(max_length=255, blank=True, default="")

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Accounting Record Document"
        verbose_name_plural = "Accounting Record Documents"

    def __str__(self):
        return f"{self.original_filename} for {self.accounting_record}"


class ComplianceDelegation(TimeStampedModel):
    entity = models.ForeignKey(
        "core.Entity",
        on_delete=models.CASCADE,
        related_name="delegations",
    )
    module = models.CharField(
        max_length=30,
        choices=DelegationModule.choices,
    )
    fiscal_year = models.IntegerField(default=2025)
    delegated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="delegations_created",
    )
    delegate_email = models.EmailField()
    delegate_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="delegations_received",
    )
    status = models.CharField(
        max_length=20,
        choices=DelegationStatus.choices,
        default=DelegationStatus.PENDING,
    )
    accepted_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Compliance Delegation"
        verbose_name_plural = "Compliance Delegations"
        constraints = [
            models.UniqueConstraint(
                fields=["entity", "module", "fiscal_year", "delegate_email"],
                condition=models.Q(status__in=["pending", "accepted"]),
                name="unique_active_delegation",
            )
        ]

    def __str__(self):
        return f"{self.module} delegation for {self.entity_id} -> {self.delegate_email}"


class DueDiligenceChecklist(TimeStampedModel):
    kyc_submission = models.ForeignKey(
        KYCSubmission,
        on_delete=models.CASCADE,
        related_name="checklists",
    )
    section = models.CharField(
        max_length=50,
        choices=DDChecklistSection.choices,
    )
    items = models.JSONField(default=list)
    completed_at = models.DateTimeField(null=True, blank=True)
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="completed_checklists",
    )

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Due Diligence Checklist"
        verbose_name_plural = "Due Diligence Checklists"
        constraints = [
            models.UniqueConstraint(
                fields=["kyc_submission", "section"],
                name="unique_checklist_per_kyc_section",
            )
        ]

    def __str__(self):
        return f"DD Checklist {self.get_section_display()} for KYC {self.kyc_submission_id}"


class EconomicSubstanceSubmission(TimeStampedModel):
    entity = models.ForeignKey(
        "core.Entity",
        on_delete=models.CASCADE,
        related_name="es_submissions",
    )
    fiscal_year = models.IntegerField()
    status = models.CharField(
        max_length=20,
        choices=ESStatus.choices,
        default=ESStatus.PENDING,
    )
    flow_answers = models.JSONField(default=dict)
    current_step = models.CharField(max_length=50, blank=True, default="")
    shareholders_data = models.JSONField(default=list)
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reviewed_es_submissions",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    field_comments = models.JSONField(default=dict, blank=True)
    attention_reason = models.CharField(max_length=100, blank=True, default="")

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Economic Substance Submission"
        verbose_name_plural = "Economic Substance Submissions"
        constraints = [
            models.UniqueConstraint(
                fields=["entity", "fiscal_year"],
                name="unique_es_per_entity_year",
            )
        ]
        indexes = [
            models.Index(fields=["entity", "fiscal_year"], name="es_entity_fy_idx"),
            models.Index(fields=["status"], name="es_status_idx"),
        ]

    def __str__(self):
        return f"ES {self.entity_id} FY{self.fiscal_year} - {self.get_status_display()}"


class OwnershipSnapshot(TimeStampedModel):
    entity = models.ForeignKey(
        "core.Entity",
        on_delete=models.CASCADE,
        related_name="ownership_snapshots",
    )
    nodes = models.JSONField(default=list)
    edges = models.JSONField(default=list)
    reportable_ubos = models.JSONField(default=list)
    warnings = models.JSONField(default=list)
    saved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="saved_ownership_snapshots",
    )

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Ownership Snapshot"
        verbose_name_plural = "Ownership Snapshots"

    def __str__(self):
        return f"Ownership snapshot for {self.entity_id} at {self.created_at}"
