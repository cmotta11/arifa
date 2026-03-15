from django.db import models


class ServiceCategory(models.TextChoices):
    INCORPORATION = "incorporation", "Incorporation"
    ANNUAL_RENEWAL = "annual_renewal", "Annual Renewal"
    COMPLIANCE_KYC = "compliance_kyc", "Compliance KYC"
    COMPLIANCE_ES = "compliance_es", "Compliance ES"
    COMPLIANCE_AR = "compliance_ar", "Compliance AR"
    DOCUMENT_GENERATION = "document_generation", "Document Generation"
    LEGAL_SUPPORT = "legal_support", "Legal Support"
    OTHER = "other", "Other"


class RequestStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    PENDING_QUOTATION = "pending_quotation", "Pending Quotation"
    QUOTED = "quoted", "Quoted"
    ACCEPTED = "accepted", "Accepted"
    REJECTED = "rejected", "Rejected"
    IN_PROGRESS = "in_progress", "In Progress"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"


class QuotationStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    SENT = "sent", "Sent"
    ACCEPTED = "accepted", "Accepted"
    REJECTED = "rejected", "Rejected"
    EXPIRED = "expired", "Expired"


class PaymentStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    PARTIAL = "partial", "Partial"
    PAID = "paid", "Paid"
    REFUNDED = "refunded", "Refunded"


class ExpenseCategory(models.TextChoices):
    GOVERNMENT_FEE = "government_fee", "Government Fee"
    NOTARY_FEE = "notary_fee", "Notary Fee"
    COURIER_FEE = "courier_fee", "Courier Fee"
    REGISTRY_FEE = "registry_fee", "Registry Fee"
    TRANSLATION_FEE = "translation_fee", "Translation Fee"
    LEGAL_FEE = "legal_fee", "Legal Fee"
    OTHER = "other", "Other"


class DeedStatus(models.TextChoices):
    AVAILABLE = "available", "Available"
    ASSIGNED = "assigned", "Assigned"
    USED = "used", "Used"
    VOIDED = "voided", "Voided"


class ClientPricingCategory(models.TextChoices):
    SILVER = "silver", "Silver"
    GOLD = "gold", "Gold"
    PLATINUM = "platinum", "Platinum"


class EntityType(models.TextChoices):
    CORP = "corp", "Corporation"
    LLC = "llc", "LLC"
    FOUNDATION = "foundation", "Foundation"
    TRUST = "trust", "Trust"
    BC = "bc", "Business Company"
    IBC = "ibc", "International Business Company"
    LP = "lp", "Limited Partnership"
    OTHER = "other", "Other"
