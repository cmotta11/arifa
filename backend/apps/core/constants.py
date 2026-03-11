from django.db import models


class ClientType(models.TextChoices):
    NATURAL = "natural", "Natural"
    CORPORATE = "corporate", "Corporate"


class ClientCategory(models.TextChoices):
    SILVER = "silver", "Silver"
    GOLD = "gold", "Gold"
    PLATINUM = "platinum", "Platinum"


class ClientStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    INACTIVE = "inactive", "Inactive"


class EntityJurisdiction(models.TextChoices):
    BVI = "bvi", "BVI"
    PANAMA = "panama", "Panama"
    BELIZE = "belize", "Belize"


class EntityStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    ACTIVE = "active", "Active"
    DISSOLVED = "dissolved", "Dissolved"
    STRUCK_OFF = "struck_off", "Struck Off"


class MatterStatus(models.TextChoices):
    OPEN = "open", "Open"
    CLOSED = "closed", "Closed"
    ON_HOLD = "on_hold", "On Hold"


class PersonType(models.TextChoices):
    NATURAL = "natural", "Natural"
    CORPORATE = "corporate", "Corporate"


class IdentificationType(models.TextChoices):
    PASSPORT = "passport", "Passport"
    CEDULA = "cedula", "Cedula"
    CORPORATE_REGISTRY = "corporate_registry", "Corporate Registry"


class RiskLevel(models.TextChoices):
    LOW = "low", "Low"
    MEDIUM = "medium", "Medium"
    HIGH = "high", "High"
    ULTRA_HIGH = "ultra_high", "Ultra High"


class OfficerPosition(models.TextChoices):
    DIRECTOR = "director", "Director"
    PRESIDENT = "president", "President"
    SECRETARY = "secretary", "Secretary"
    TREASURER = "treasurer", "Treasurer"
    REGISTERED_AGENT = "registered_agent", "Registered Agent"
    PROTECTOR = "protector", "Protector"
    AUTHORIZED_SIGNATORY = "authorized_signatory", "Authorized Signatory"
    OTHER = "other", "Other"


class PersonStatus(models.TextChoices):
    PENDING_APPROVAL = "pending_approval", "Pending Approval"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"


class AuditAction(models.TextChoices):
    CREATE = "create", "Create"
    UPDATE = "update", "Update"
    DELETE = "delete", "Delete"


class AuditSource(models.TextChoices):
    INTERNAL = "internal", "Internal Edit"
    GUEST_SUBMISSION = "guest_submission", "Guest Submission"
    APPROVAL = "approval", "Approval"
    SEND_BACK = "send_back", "Send Back"
