from django.conf import settings
from django.db import models

from common.base_model import TimeStampedModel

from .constants import (
    ClientPricingCategory,
    DeedStatus,
    EntityType,
    ExpenseCategory,
    PaymentStatus,
    QuotationStatus,
    RequestStatus,
    ServiceCategory,
)


class ServiceCatalog(TimeStampedModel):
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=50, unique=True)
    category = models.CharField(
        max_length=30,
        choices=ServiceCategory.choices,
    )
    jurisdiction = models.ForeignKey(
        "compliance.JurisdictionRisk",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="service_catalog_items",
    )
    description = models.TextField(blank=True, default="")
    base_price = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default="USD")
    is_active = models.BooleanField(default=True)
    requires_entity = models.BooleanField(default=False)
    estimated_days = models.PositiveIntegerField(null=True, blank=True)
    config = models.JSONField(default=dict, blank=True)

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Service Catalog"
        verbose_name_plural = "Service Catalog Items"

    def __str__(self):
        return f"{self.name} ({self.code})"


class PricingRule(TimeStampedModel):
    service = models.ForeignKey(
        ServiceCatalog,
        on_delete=models.CASCADE,
        related_name="pricing_rules",
    )
    client_category = models.CharField(
        max_length=20,
        choices=ClientPricingCategory.choices,
    )
    discount_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
    )
    override_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )
    is_active = models.BooleanField(default=True)

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Pricing Rule"
        verbose_name_plural = "Pricing Rules"
        unique_together = [("service", "client_category")]

    def __str__(self):
        return f"{self.service.code} - {self.get_client_category_display()}"


class ServiceRequest(TimeStampedModel):
    client = models.ForeignKey(
        "core.Client",
        on_delete=models.CASCADE,
        related_name="service_requests",
    )
    entity = models.ForeignKey(
        "core.Entity",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="service_requests",
    )
    ticket = models.ForeignKey(
        "workflow.Ticket",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="service_requests",
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="service_requests",
    )
    services = models.ManyToManyField(
        ServiceCatalog,
        through="ServiceRequestItem",
        related_name="service_requests",
    )
    status = models.CharField(
        max_length=30,
        choices=RequestStatus.choices,
        default=RequestStatus.DRAFT,
    )
    jurisdiction = models.ForeignKey(
        "compliance.JurisdictionRisk",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="service_requests",
    )
    notes = models.TextField(blank=True, default="")
    submitted_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Service Request"
        verbose_name_plural = "Service Requests"

    def __str__(self):
        return f"SR-{str(self.id)[:8]} ({self.get_status_display()})"


class ServiceRequestItem(TimeStampedModel):
    service_request = models.ForeignKey(
        ServiceRequest,
        on_delete=models.CASCADE,
        related_name="items",
    )
    service = models.ForeignKey(
        ServiceCatalog,
        on_delete=models.CASCADE,
        related_name="request_items",
    )
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    discount_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    notes = models.TextField(blank=True, default="")

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Service Request Item"
        verbose_name_plural = "Service Request Items"

    def __str__(self):
        return f"{self.service.code} x{self.quantity} = {self.subtotal}"


class Quotation(TimeStampedModel):
    service_request = models.ForeignKey(
        ServiceRequest,
        on_delete=models.CASCADE,
        related_name="quotations",
    )
    quotation_number = models.CharField(max_length=50, unique=True)
    status = models.CharField(
        max_length=20,
        choices=QuotationStatus.choices,
        default=QuotationStatus.DRAFT,
    )
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    discount_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )
    tax_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )
    total = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default="USD")
    valid_until = models.DateField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")
    pdf_file = models.FileField(
        upload_to="quotations/",
        blank=True,
        null=True,
    )

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Quotation"
        verbose_name_plural = "Quotations"

    def __str__(self):
        return f"{self.quotation_number} - {self.get_status_display()}"


class IncorporationData(TimeStampedModel):
    service_request = models.OneToOneField(
        ServiceRequest,
        on_delete=models.CASCADE,
        related_name="incorporation_data",
    )
    proposed_names = models.JSONField(default=list, blank=True)
    entity_type = models.CharField(
        max_length=20,
        choices=EntityType.choices,
        blank=True,
        default="",
    )
    authorized_capital = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
    )
    capital_currency = models.CharField(max_length=3, default="USD")
    share_classes = models.JSONField(default=list, blank=True)
    is_operative = models.BooleanField(default=False)
    economic_activities = models.JSONField(default=list, blank=True)
    directors = models.JSONField(default=list, blank=True)
    shareholders = models.JSONField(default=list, blank=True)
    resident_agent = models.CharField(max_length=200, blank=True, default="")
    is_high_capital = models.BooleanField(default=False)
    high_capital_threshold = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=100000,
    )

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Incorporation Data"
        verbose_name_plural = "Incorporation Data"

    def __str__(self):
        names = self.proposed_names[:1] if self.proposed_names else ["N/A"]
        return f"Inc. Data for SR-{str(self.service_request_id)[:8]} - {names[0]}"


class NotaryDeedPool(TimeStampedModel):
    deed_number = models.CharField(max_length=50, unique=True)
    jurisdiction = models.ForeignKey(
        "compliance.JurisdictionRisk",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notary_deeds",
    )
    notary_name = models.CharField(max_length=200, blank=True, default="")
    status = models.CharField(
        max_length=20,
        choices=DeedStatus.choices,
        default=DeedStatus.AVAILABLE,
    )
    assigned_to_request = models.ForeignKey(
        ServiceRequest,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_deeds",
    )
    assigned_at = models.DateTimeField(null=True, blank=True)
    used_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Notary Deed"
        verbose_name_plural = "Notary Deed Pool"

    def __str__(self):
        return f"Deed {self.deed_number} - {self.get_status_display()}"


class ExpenseRecord(TimeStampedModel):
    service_request = models.ForeignKey(
        ServiceRequest,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="expenses",
    )
    entity = models.ForeignKey(
        "core.Entity",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="expenses",
    )
    ticket = models.ForeignKey(
        "workflow.Ticket",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="expenses",
    )
    category = models.CharField(
        max_length=30,
        choices=ExpenseCategory.choices,
    )
    description = models.CharField(max_length=500)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default="USD")
    payment_status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
    )
    payment_method = models.CharField(max_length=100, blank=True, default="")
    payment_reference = models.CharField(max_length=200, blank=True, default="")
    paid_at = models.DateTimeField(null=True, blank=True)
    receipt_file = models.FileField(
        upload_to="expenses/",
        blank=True,
        null=True,
    )
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recorded_expenses",
    )

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Expense Record"
        verbose_name_plural = "Expense Records"

    def __str__(self):
        return f"{self.get_category_display()} - {self.description[:50]} ({self.amount} {self.currency})"
