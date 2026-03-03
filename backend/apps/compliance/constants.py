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
