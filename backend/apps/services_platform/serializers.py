from rest_framework import serializers

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


# ===========================================================================
# Output serializers (ModelSerializer)
# ===========================================================================


class ServiceCatalogOutputSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    jurisdiction_name = serializers.CharField(
        source="jurisdiction.country_name", read_only=True, default=None,
    )

    class Meta:
        model = ServiceCatalog
        fields = [
            "id", "name", "code", "category", "category_display",
            "jurisdiction", "jurisdiction_name", "description",
            "base_price", "currency", "is_active", "requires_entity",
            "estimated_days", "config", "created_at", "updated_at",
        ]


class PricingRuleOutputSerializer(serializers.ModelSerializer):
    client_category_display = serializers.CharField(
        source="get_client_category_display", read_only=True,
    )
    service_code = serializers.CharField(source="service.code", read_only=True)

    class Meta:
        model = PricingRule
        fields = [
            "id", "service", "service_code", "client_category",
            "client_category_display", "discount_percentage",
            "override_price", "is_active", "created_at", "updated_at",
        ]


class ServiceRequestItemOutputSerializer(serializers.ModelSerializer):
    service_code = serializers.CharField(source="service.code", read_only=True)
    service_name = serializers.CharField(source="service.name", read_only=True)

    class Meta:
        model = ServiceRequestItem
        fields = [
            "id", "service_request", "service", "service_code",
            "service_name", "quantity", "unit_price", "discount_amount",
            "subtotal", "notes", "created_at", "updated_at",
        ]


class ServiceRequestOutputSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    client_name = serializers.CharField(source="client.name", read_only=True, default=None)
    entity_name = serializers.CharField(source="entity.name", read_only=True, default=None)
    items = ServiceRequestItemOutputSerializer(many=True, read_only=True)

    class Meta:
        model = ServiceRequest
        fields = [
            "id", "client", "client_name", "entity", "entity_name",
            "ticket", "requested_by", "status", "status_display",
            "jurisdiction", "notes", "submitted_at", "metadata",
            "items", "created_at", "updated_at",
        ]


class QuotationOutputSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    service_request_id = serializers.UUIDField(source="service_request.id", read_only=True)

    class Meta:
        model = Quotation
        fields = [
            "id", "service_request", "service_request_id",
            "quotation_number", "status", "status_display",
            "subtotal", "discount_total", "tax_amount", "total",
            "currency", "valid_until", "accepted_at", "rejected_at",
            "notes", "pdf_file", "created_at", "updated_at",
        ]


class IncorporationDataOutputSerializer(serializers.ModelSerializer):
    entity_type_display = serializers.CharField(
        source="get_entity_type_display", read_only=True,
    )

    class Meta:
        model = IncorporationData
        fields = [
            "id", "service_request", "proposed_names", "entity_type",
            "entity_type_display", "authorized_capital", "capital_currency",
            "share_classes", "is_operative", "economic_activities",
            "directors", "shareholders", "resident_agent",
            "is_high_capital", "high_capital_threshold",
            "created_at", "updated_at",
        ]


class NotaryDeedPoolOutputSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    jurisdiction_name = serializers.CharField(
        source="jurisdiction.country_name", read_only=True, default=None,
    )

    class Meta:
        model = NotaryDeedPool
        fields = [
            "id", "deed_number", "jurisdiction", "jurisdiction_name",
            "notary_name", "status", "status_display",
            "assigned_to_request", "assigned_at", "used_at",
            "notes", "created_at", "updated_at",
        ]


class ExpenseRecordOutputSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    payment_status_display = serializers.CharField(
        source="get_payment_status_display", read_only=True,
    )

    class Meta:
        model = ExpenseRecord
        fields = [
            "id", "service_request", "entity", "ticket",
            "category", "category_display", "description",
            "amount", "currency", "payment_status",
            "payment_status_display", "payment_method",
            "payment_reference", "paid_at", "receipt_file",
            "recorded_by", "created_at", "updated_at",
        ]


# ===========================================================================
# Input serializers
# ===========================================================================


class ServiceCatalogInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    code = serializers.CharField(max_length=50)
    category = serializers.ChoiceField(choices=ServiceCategory.choices)
    jurisdiction_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    base_price = serializers.DecimalField(max_digits=12, decimal_places=2)
    currency = serializers.CharField(max_length=3, default="USD", required=False)
    is_active = serializers.BooleanField(default=True, required=False)
    requires_entity = serializers.BooleanField(default=False, required=False)
    estimated_days = serializers.IntegerField(required=False, allow_null=True, default=None)
    config = serializers.JSONField(required=False, default=dict)


class PricingRuleInputSerializer(serializers.Serializer):
    service_id = serializers.UUIDField()
    client_category = serializers.ChoiceField(choices=ClientPricingCategory.choices)
    discount_percentage = serializers.DecimalField(
        max_digits=5, decimal_places=2, default=0, required=False,
    )
    override_price = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True, default=None,
    )
    is_active = serializers.BooleanField(default=True, required=False)


class ServiceRequestCreateInputSerializer(serializers.Serializer):
    client_id = serializers.UUIDField()
    jurisdiction_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    entity_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    metadata = serializers.JSONField(required=False, default=dict)


class ServiceRequestAddItemInputSerializer(serializers.Serializer):
    service_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1, default=1, required=False)


class ServiceRequestRemoveItemInputSerializer(serializers.Serializer):
    item_id = serializers.UUIDField()


class QuotationGenerateInputSerializer(serializers.Serializer):
    """No additional input needed; generated from service request items."""
    pass


class QuotationRejectInputSerializer(serializers.Serializer):
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class IncorporationDataInputSerializer(serializers.Serializer):
    proposed_names = serializers.ListField(
        child=serializers.CharField(max_length=255),
        required=False,
        default=list,
    )
    entity_type = serializers.ChoiceField(
        choices=EntityType.choices, required=False, allow_blank=True, default="",
    )
    authorized_capital = serializers.DecimalField(
        max_digits=15, decimal_places=2, required=False, allow_null=True, default=None,
    )
    capital_currency = serializers.CharField(max_length=3, default="USD", required=False)
    share_classes = serializers.ListField(
        child=serializers.DictField(), required=False, default=list,
    )
    is_operative = serializers.BooleanField(default=False, required=False)
    economic_activities = serializers.ListField(
        child=serializers.CharField(max_length=255),
        required=False,
        default=list,
    )
    directors = serializers.ListField(
        child=serializers.DictField(), required=False, default=list,
    )
    shareholders = serializers.ListField(
        child=serializers.DictField(), required=False, default=list,
    )
    resident_agent = serializers.CharField(
        max_length=200, required=False, allow_blank=True, default="",
    )
    high_capital_threshold = serializers.DecimalField(
        max_digits=15, decimal_places=2, required=False, default=100000,
    )


class NotaryDeedBulkCreateInputSerializer(serializers.Serializer):
    deeds = serializers.ListField(
        child=serializers.DictField(),
        allow_empty=False,
    )


class NotaryDeedAssignInputSerializer(serializers.Serializer):
    request_id = serializers.UUIDField()
    jurisdiction_id = serializers.UUIDField(required=False, allow_null=True, default=None)


class ExpenseRecordInputSerializer(serializers.Serializer):
    service_request_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    entity_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    ticket_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    category = serializers.ChoiceField(choices=ExpenseCategory.choices)
    description = serializers.CharField(max_length=500)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    currency = serializers.CharField(max_length=3, default="USD", required=False)


class ExpenseMarkPaidInputSerializer(serializers.Serializer):
    payment_method = serializers.CharField(
        max_length=100, required=False, allow_blank=True, default="",
    )
    payment_reference = serializers.CharField(
        max_length=200, required=False, allow_blank=True, default="",
    )


# ===========================================================================
# Portal (client-facing) serializers
# ===========================================================================


class PortalServiceRequestOutputSerializer(serializers.ModelSerializer):
    service_type = serializers.SerializerMethodField()
    current_stage = serializers.SerializerMethodField()

    class Meta:
        model = ServiceRequest
        fields = [
            "id",
            "service_type",
            "status",
            "notes",
            "current_stage",
            "created_at",
            "updated_at",
        ]

    def get_service_type(self, obj):
        first_item = obj.items.select_related("service").first()
        if first_item:
            return first_item.service.name
        return obj.metadata.get("service_type", "General")

    def get_current_stage(self, obj):
        if obj.ticket:
            return obj.ticket.current_state.name if obj.ticket.current_state else None
        return None


class PortalServiceRequestCreateInputSerializer(serializers.Serializer):
    entity_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    service_ids = serializers.ListField(
        child=serializers.UUIDField(), allow_empty=False,
    )
