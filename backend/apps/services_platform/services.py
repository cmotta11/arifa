import logging
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from common.exceptions import ApplicationError

from .constants import (
    DeedStatus,
    PaymentStatus,
    QuotationStatus,
    RequestStatus,
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

logger = logging.getLogger(__name__)


@transaction.atomic
def create_service_request(
    *,
    client_id,
    requested_by,
    jurisdiction_id=None,
    entity_id=None,
    notes="",
    metadata=None,
) -> ServiceRequest:
    """Create a new service request in draft status."""
    from apps.core.models import Client

    client = Client.objects.filter(id=client_id).first()
    if not client:
        raise ApplicationError("Client not found.")

    service_request = ServiceRequest.objects.create(
        client=client,
        requested_by=requested_by,
        jurisdiction_id=jurisdiction_id,
        entity_id=entity_id,
        notes=notes,
        metadata=metadata or {},
        status=RequestStatus.DRAFT,
    )

    logger.info(
        "Created service request %s for client %s",
        service_request.id,
        client_id,
    )
    return service_request


@transaction.atomic
def add_service_to_request(
    *,
    request_id,
    service_id,
    quantity=1,
) -> ServiceRequestItem:
    """Add a service item to a request, calculating price based on client category and pricing rules."""
    service_request = ServiceRequest.objects.select_related("client").filter(
        id=request_id,
    ).first()
    if not service_request:
        raise ApplicationError("Service request not found.")

    if service_request.status != RequestStatus.DRAFT:
        raise ApplicationError("Can only add services to draft requests.")

    service = ServiceCatalog.objects.filter(id=service_id, is_active=True).first()
    if not service:
        raise ApplicationError("Service not found or inactive.")

    # Determine price based on client category and pricing rules
    client_category = service_request.client.category
    unit_price = service.base_price
    discount_amount = Decimal("0.00")

    pricing_rule = PricingRule.objects.filter(
        service=service,
        client_category=client_category,
        is_active=True,
    ).first()

    if pricing_rule:
        if pricing_rule.override_price is not None:
            unit_price = pricing_rule.override_price
        elif pricing_rule.discount_percentage > 0:
            discount_amount = (
                service.base_price
                * pricing_rule.discount_percentage
                / Decimal("100")
            ).quantize(Decimal("0.01"))
            unit_price = service.base_price

    subtotal = (unit_price * quantity) - (discount_amount * quantity)

    item = ServiceRequestItem.objects.create(
        service_request=service_request,
        service=service,
        quantity=quantity,
        unit_price=unit_price,
        discount_amount=discount_amount,
        subtotal=subtotal,
    )

    logger.info(
        "Added service %s to request %s (qty=%d, subtotal=%s)",
        service.code,
        request_id,
        quantity,
        subtotal,
    )
    return item


@transaction.atomic
def remove_service_from_request(*, request_id, item_id):
    """Remove a service item from a draft request."""
    service_request = ServiceRequest.objects.filter(id=request_id).first()
    if not service_request:
        raise ApplicationError("Service request not found.")

    if service_request.status != RequestStatus.DRAFT:
        raise ApplicationError("Can only remove services from draft requests.")

    item = ServiceRequestItem.objects.filter(
        id=item_id,
        service_request=service_request,
    ).first()
    if not item:
        raise ApplicationError("Service request item not found.")

    item.delete()
    logger.info("Removed item %s from request %s", item_id, request_id)


@transaction.atomic
def submit_service_request(*, request_id) -> ServiceRequest:
    """Submit a service request for quotation."""
    service_request = ServiceRequest.objects.filter(id=request_id).first()
    if not service_request:
        raise ApplicationError("Service request not found.")

    if service_request.status != RequestStatus.DRAFT:
        raise ApplicationError("Only draft requests can be submitted.")

    if not service_request.items.exists():
        raise ApplicationError("Cannot submit a request with no service items.")

    service_request.status = RequestStatus.PENDING_QUOTATION
    service_request.submitted_at = timezone.now()
    service_request.save(update_fields=["status", "submitted_at", "updated_at"])

    logger.info("Submitted service request %s", request_id)
    return service_request


@transaction.atomic
def generate_quotation(*, request_id) -> Quotation:
    """Generate a quotation from a service request's items."""
    service_request = ServiceRequest.objects.filter(id=request_id).first()
    if not service_request:
        raise ApplicationError("Service request not found.")

    if service_request.status not in (
        RequestStatus.PENDING_QUOTATION,
        RequestStatus.QUOTED,
    ):
        raise ApplicationError(
            "Can only generate quotations for pending or previously quoted requests."
        )

    items = service_request.items.all()
    if not items.exists():
        raise ApplicationError("No items in service request to quote.")

    subtotal = sum(item.subtotal for item in items)
    discount_total = sum(item.discount_amount * item.quantity for item in items)
    tax_amount = Decimal("0.00")  # Tax can be configured later
    total = subtotal

    # Generate quotation number: Q-YYYYMMDD-XXXX
    now = timezone.now()
    date_prefix = now.strftime("%Y%m%d")
    existing_count = Quotation.objects.filter(
        quotation_number__startswith=f"Q-{date_prefix}",
    ).count()
    quotation_number = f"Q-{date_prefix}-{existing_count + 1:04d}"

    quotation = Quotation.objects.create(
        service_request=service_request,
        quotation_number=quotation_number,
        subtotal=subtotal,
        discount_total=discount_total,
        tax_amount=tax_amount,
        total=total,
        currency="USD",
        status=QuotationStatus.DRAFT,
    )

    service_request.status = RequestStatus.QUOTED
    service_request.save(update_fields=["status", "updated_at"])

    logger.info(
        "Generated quotation %s for request %s (total=%s)",
        quotation_number,
        request_id,
        total,
    )
    return quotation


@transaction.atomic
def accept_quotation(*, quotation_id) -> Quotation:
    """Accept a quotation and update the service request status."""
    quotation = Quotation.objects.select_related("service_request").filter(
        id=quotation_id,
    ).first()
    if not quotation:
        raise ApplicationError("Quotation not found.")

    if quotation.status not in (QuotationStatus.DRAFT, QuotationStatus.SENT):
        raise ApplicationError("Only draft or sent quotations can be accepted.")

    quotation.status = QuotationStatus.ACCEPTED
    quotation.accepted_at = timezone.now()
    quotation.save(update_fields=["status", "accepted_at", "updated_at"])

    service_request = quotation.service_request
    service_request.status = RequestStatus.ACCEPTED
    service_request.save(update_fields=["status", "updated_at"])

    logger.info("Accepted quotation %s", quotation.quotation_number)
    return quotation


@transaction.atomic
def reject_quotation(*, quotation_id, notes="") -> Quotation:
    """Reject a quotation."""
    quotation = Quotation.objects.select_related("service_request").filter(
        id=quotation_id,
    ).first()
    if not quotation:
        raise ApplicationError("Quotation not found.")

    if quotation.status not in (QuotationStatus.DRAFT, QuotationStatus.SENT):
        raise ApplicationError("Only draft or sent quotations can be rejected.")

    quotation.status = QuotationStatus.REJECTED
    quotation.rejected_at = timezone.now()
    if notes:
        quotation.notes = notes
    quotation.save(update_fields=["status", "rejected_at", "notes", "updated_at"])

    service_request = quotation.service_request
    service_request.status = RequestStatus.REJECTED
    service_request.save(update_fields=["status", "updated_at"])

    logger.info("Rejected quotation %s", quotation.quotation_number)
    return quotation


@transaction.atomic
def save_incorporation_data(*, request_id, **data) -> IncorporationData:
    """Create or update incorporation data for a service request, auto-detecting high capital."""
    service_request = ServiceRequest.objects.filter(id=request_id).first()
    if not service_request:
        raise ApplicationError("Service request not found.")

    inc_data, _created = IncorporationData.objects.get_or_create(
        service_request=service_request,
    )

    # Update fields from provided data
    allowed_fields = [
        "proposed_names",
        "entity_type",
        "authorized_capital",
        "capital_currency",
        "share_classes",
        "is_operative",
        "economic_activities",
        "directors",
        "shareholders",
        "resident_agent",
        "high_capital_threshold",
    ]

    update_fields = []
    for field in allowed_fields:
        if field in data:
            setattr(inc_data, field, data[field])
            update_fields.append(field)

    # Auto-detect high capital
    if inc_data.authorized_capital is not None:
        inc_data.is_high_capital = inc_data.authorized_capital > inc_data.high_capital_threshold
        if "is_high_capital" not in update_fields:
            update_fields.append("is_high_capital")

    if update_fields:
        update_fields.append("updated_at")
        inc_data.save(update_fields=update_fields)
    elif _created:
        # Already saved on creation, just re-check high capital
        if inc_data.authorized_capital is not None:
            inc_data.is_high_capital = inc_data.authorized_capital > inc_data.high_capital_threshold
            inc_data.save(update_fields=["is_high_capital", "updated_at"])

    logger.info(
        "Saved incorporation data for request %s (high_capital=%s)",
        request_id,
        inc_data.is_high_capital,
    )
    return inc_data


@transaction.atomic
def assign_deed(*, request_id, jurisdiction_id=None) -> NotaryDeedPool:
    """Find an available deed and assign it to a service request."""
    service_request = ServiceRequest.objects.filter(id=request_id).first()
    if not service_request:
        raise ApplicationError("Service request not found.")

    qs = NotaryDeedPool.objects.filter(status=DeedStatus.AVAILABLE)
    if jurisdiction_id:
        qs = qs.filter(jurisdiction_id=jurisdiction_id)
    elif service_request.jurisdiction_id:
        qs = qs.filter(jurisdiction_id=service_request.jurisdiction_id)

    deed = qs.order_by("created_at").select_for_update().first()
    if not deed:
        raise ApplicationError("No available deeds found for the specified jurisdiction.")

    deed.status = DeedStatus.ASSIGNED
    deed.assigned_to_request = service_request
    deed.assigned_at = timezone.now()
    deed.save(update_fields=["status", "assigned_to_request", "assigned_at", "updated_at"])

    logger.info(
        "Assigned deed %s to request %s",
        deed.deed_number,
        request_id,
    )
    return deed


@transaction.atomic
def record_expense(
    *,
    service_request_id=None,
    entity_id=None,
    ticket_id=None,
    category,
    description,
    amount,
    currency="USD",
    recorded_by=None,
) -> ExpenseRecord:
    """Record an expense associated with a service request, entity, or ticket."""
    if not any([service_request_id, entity_id, ticket_id]):
        raise ApplicationError(
            "At least one of service_request_id, entity_id, or ticket_id must be provided."
        )

    expense = ExpenseRecord.objects.create(
        service_request_id=service_request_id,
        entity_id=entity_id,
        ticket_id=ticket_id,
        category=category,
        description=description,
        amount=amount,
        currency=currency,
        payment_status=PaymentStatus.PENDING,
        recorded_by=recorded_by,
    )

    logger.info(
        "Recorded expense %s: %s %s for %s",
        expense.id,
        amount,
        currency,
        category,
    )
    return expense


@transaction.atomic
def mark_expense_paid(
    *,
    expense_id,
    payment_method="",
    payment_reference="",
) -> ExpenseRecord:
    """Mark an expense as paid."""
    expense = ExpenseRecord.objects.filter(id=expense_id).first()
    if not expense:
        raise ApplicationError("Expense record not found.")

    if expense.payment_status == PaymentStatus.PAID:
        raise ApplicationError("Expense is already marked as paid.")

    expense.payment_status = PaymentStatus.PAID
    expense.payment_method = payment_method
    expense.payment_reference = payment_reference
    expense.paid_at = timezone.now()
    expense.save(
        update_fields=[
            "payment_status",
            "payment_method",
            "payment_reference",
            "paid_at",
            "updated_at",
        ]
    )

    logger.info("Marked expense %s as paid", expense_id)
    return expense
