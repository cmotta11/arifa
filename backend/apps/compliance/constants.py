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
