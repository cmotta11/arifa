from django.db import models


class TicketPriority(models.TextChoices):
    LOW = "low", "Low"
    MEDIUM = "medium", "Medium"
    HIGH = "high", "High"
    URGENT = "urgent", "Urgent"


class WorkflowCategory(models.TextChoices):
    INCORPORATION = "incorporation", "Incorporation"
    COMPLIANCE = "compliance", "Compliance"
    DOCUMENTS = "documents", "Documents"
    LEGAL_SUPPORT = "legal_support", "Legal Support"
    REGISTRY = "registry", "Registry"
    ACCOUNTING = "accounting", "Accounting"
    ARCHIVE = "archive", "Archive"
    CUSTOM = "custom", "Custom"
