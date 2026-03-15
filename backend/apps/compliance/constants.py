from django.db import models


class KYCStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    SUBMITTED = "submitted", "Submitted"
    UNDER_REVIEW = "under_review", "Under Review"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"
    SENT_BACK = "sent_back", "Sent Back"


class PartyRole(models.TextChoices):
    UBO = "ubo", "UBO"
    DIRECTOR = "director", "Director"
    SHAREHOLDER = "shareholder", "Shareholder"
    PROTECTOR = "protector", "Protector"
    AUTHORIZED_SIGNATORY = "authorized_signatory", "Authorized Signatory"


class PartyType(models.TextChoices):
    NATURAL = "natural", "Natural"
    CORPORATE = "corporate", "Corporate"


class RiskLevel(models.TextChoices):
    LOW = "low", "Low"
    MEDIUM = "medium", "Medium"
    HIGH = "high", "High"


class RiskTrigger(models.TextChoices):
    MANUAL = "manual", "Manual"
    AUTO = "auto", "Auto"
    SCHEDULED = "scheduled", "Scheduled"
    WEBHOOK = "webhook", "Webhook"


class ScreeningStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    CLEAR = "clear", "Clear"
    MATCHED = "matched", "Matched"
    FALSE_POSITIVE = "false_positive", "False Positive"
    TRUE_MATCH = "true_match", "True Match"
    ESCALATED = "escalated", "Escalated"


class DocumentType(models.TextChoices):
    PASSPORT = "passport", "Passport"
    CEDULA = "cedula", "Cedula"
    UTILITY_BILL = "utility_bill", "Utility Bill"
    CORPORATE_REGISTRY = "corporate_registry", "Corporate Registry"
    PROOF_OF_ADDRESS = "proof_of_address", "Proof of Address"
    SOURCE_OF_WEALTH = "source_of_wealth", "Source of Wealth"
    OTHER = "other", "Other"


class LLMExtractionStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    PROCESSING = "processing", "Processing"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"


class RFIStatus(models.TextChoices):
    OPEN = "open", "Open"
    RESPONDED = "responded", "Responded"
    CLOSED = "closed", "Closed"


class RecalculationStatus(models.TextChoices):
    RUNNING = "running", "Running"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"


class RiskFactorCode(models.TextChoices):
    # Entity-level factors
    JURISDICTION = "jurisdiction", "Jurisdiction Risk"
    STRUCTURE_COMPLEXITY = "structure_complexity", "Structure Complexity"
    ACTIVITY_RISK = "activity_risk", "Activity Risk"
    SOURCE_OF_FUNDS_RISK = "source_of_funds_risk", "Source of Funds Risk"
    OWNERSHIP_OPACITY = "ownership_opacity", "Ownership Opacity"
    MULTI_JURISDICTION = "multi_jurisdiction", "Multi-Jurisdiction Exposure"
    RELATIONSHIP_AGE = "relationship_age", "Relationship Age"
    # Person-level factors
    NATIONALITY_RISK = "nationality_risk", "Nationality Risk"
    RESIDENCE_RISK = "residence_risk", "Residence Risk"
    PEP_STATUS = "pep_status", "PEP Status"
    SANCTIONS_SCREENING = "sanctions_screening", "Sanctions Screening"
    SOURCE_OF_WEALTH_RISK = "source_of_wealth_risk", "Source of Wealth Risk"
    ID_VERIFICATION = "id_verification", "ID Verification"


class RiskFactorCategory(models.TextChoices):
    ENTITY = "entity", "Entity"
    PERSON = "person", "Person"


class TriggerCondition(models.TextChoices):
    PEP_STATUS = "pep_status", "PEP Detected"
    SANCTIONS_MATCH = "sanctions_match", "Sanctions Match"
    HIGH_RISK_JURISDICTION = "high_risk_jurisdiction", "High-Risk Jurisdiction"
    COMPLEX_STRUCTURE = "complex_structure", "Complex Structure"


class SnapshotStatus(models.TextChoices):
    RUNNING = "running", "Running"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"


class AccountingRecordFormType(models.TextChoices):
    NO_OPERATIONS = "no_operations", "Sociedad sin operaciones"
    PANAMA_ASSETS = "panama_assets", "Formulario B - Tenedora de activos"
    BALANCE_GENERAL = "balance_general", "Balance general"
    EXEMPT_LICENSE = "exempt_license", "Exento por aviso de operación"


class AccountingRecordStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    DRAFT = "draft", "Draft"
    SUBMITTED = "submitted", "Submitted"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"


class DelegationStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    ACCEPTED = "accepted", "Accepted"
    REVOKED = "revoked", "Revoked"


class DelegationModule(models.TextChoices):
    ACCOUNTING_RECORDS = "accounting_records", "Accounting Records"
    ECONOMIC_SUBSTANCE = "economic_substance", "Economic Substance"
    KYC = "kyc", "KYC"


class ESStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    IN_PROGRESS = "in_progress", "In Progress"
    IN_REVIEW = "in_review", "In Review"
    COMPLETED = "completed", "Completed"


class DDChecklistSection(models.TextChoices):
    ENTITY_DETAILS = "entity_details", "Entity Details"
    DIRECTORS_OFFICERS = "directors_officers", "Directors & Officers"
    SHAREHOLDERS = "shareholders", "Shareholders"
    BENEFICIAL_OWNERS = "beneficial_owners", "Beneficial Owners"
    ATTORNEYS_IN_FACT = "attorneys_in_fact", "Attorneys-in-Fact"


class CompletionMethod(models.TextChoices):
    UPLOAD_INFORMATION = "upload_information", "Upload Information"
    SEVEN_STEPS = "seven_steps", "Seven Steps"
