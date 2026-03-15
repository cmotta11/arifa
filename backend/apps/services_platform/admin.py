from django.contrib import admin

from .models import (
    ExpenseRecord,
    IncorporationData,
    NotaryDeedPool,
    PricingRule,
    Quotation,
    ServiceCatalog,
    ServiceRequest,
    ServiceRequestItem,
)


class PricingRuleInline(admin.TabularInline):
    model = PricingRule
    extra = 0


@admin.register(ServiceCatalog)
class ServiceCatalogAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "name",
        "category",
        "jurisdiction",
        "base_price",
        "currency",
        "is_active",
        "requires_entity",
        "estimated_days",
    )
    list_filter = ("category", "is_active", "jurisdiction", "requires_entity")
    search_fields = ("name", "code", "description")
    readonly_fields = ("created_at", "updated_at")
    raw_id_fields = ("jurisdiction",)
    inlines = [PricingRuleInline]


@admin.register(PricingRule)
class PricingRuleAdmin(admin.ModelAdmin):
    list_display = (
        "service",
        "client_category",
        "discount_percentage",
        "override_price",
        "is_active",
    )
    list_filter = ("client_category", "is_active")
    search_fields = ("service__code", "service__name")
    readonly_fields = ("created_at", "updated_at")
    raw_id_fields = ("service",)


class ServiceRequestItemInline(admin.TabularInline):
    model = ServiceRequestItem
    extra = 0
    raw_id_fields = ("service",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(ServiceRequest)
class ServiceRequestAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "client",
        "entity",
        "status",
        "requested_by",
        "jurisdiction",
        "submitted_at",
        "created_at",
    )
    list_filter = ("status", "jurisdiction", "created_at")
    search_fields = ("id", "client__name", "entity__name", "notes")
    readonly_fields = ("created_at", "updated_at")
    raw_id_fields = ("client", "entity", "ticket", "requested_by", "jurisdiction")
    inlines = [ServiceRequestItemInline]


@admin.register(ServiceRequestItem)
class ServiceRequestItemAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "service_request",
        "service",
        "quantity",
        "unit_price",
        "discount_amount",
        "subtotal",
    )
    list_filter = ("service__category",)
    search_fields = ("service__code", "service__name", "notes")
    readonly_fields = ("created_at", "updated_at")
    raw_id_fields = ("service_request", "service")


@admin.register(Quotation)
class QuotationAdmin(admin.ModelAdmin):
    list_display = (
        "quotation_number",
        "service_request",
        "status",
        "subtotal",
        "discount_total",
        "tax_amount",
        "total",
        "currency",
        "valid_until",
        "accepted_at",
        "rejected_at",
    )
    list_filter = ("status", "currency", "created_at")
    search_fields = ("quotation_number", "notes")
    readonly_fields = ("created_at", "updated_at")
    raw_id_fields = ("service_request",)


@admin.register(IncorporationData)
class IncorporationDataAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "service_request",
        "entity_type",
        "authorized_capital",
        "capital_currency",
        "is_operative",
        "is_high_capital",
    )
    list_filter = ("entity_type", "is_operative", "is_high_capital")
    search_fields = ("service_request__id", "proposed_names")
    readonly_fields = ("created_at", "updated_at")
    raw_id_fields = ("service_request",)


@admin.register(NotaryDeedPool)
class NotaryDeedPoolAdmin(admin.ModelAdmin):
    list_display = (
        "deed_number",
        "jurisdiction",
        "notary_name",
        "status",
        "assigned_to_request",
        "assigned_at",
        "used_at",
    )
    list_filter = ("status", "jurisdiction")
    search_fields = ("deed_number", "notary_name", "notes")
    readonly_fields = ("created_at", "updated_at")
    raw_id_fields = ("jurisdiction", "assigned_to_request")


@admin.register(ExpenseRecord)
class ExpenseRecordAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "service_request",
        "entity",
        "category",
        "description",
        "amount",
        "currency",
        "payment_status",
        "paid_at",
        "recorded_by",
    )
    list_filter = ("category", "payment_status", "currency", "created_at")
    search_fields = ("description", "payment_reference")
    readonly_fields = ("created_at", "updated_at")
    raw_id_fields = ("service_request", "entity", "ticket", "recorded_by")
