import factory
from decimal import Decimal

from factory.django import DjangoModelFactory

from apps.core.tests.factories import ClientFactory, EntityFactory
from apps.authentication.tests.factories import UserFactory
from apps.services_platform.constants import (
    DeedStatus,
    ExpenseCategory,
    PaymentStatus,
    QuotationStatus,
    RequestStatus,
    ServiceCategory,
)
from apps.services_platform.models import (
    ExpenseRecord,
    IncorporationData,
    NotaryDeedPool,
    Quotation,
    ServiceCatalog,
    ServiceRequest,
    ServiceRequestItem,
)


class ServiceCatalogFactory(DjangoModelFactory):
    class Meta:
        model = ServiceCatalog

    name = factory.Sequence(lambda n: f"Service {n}")
    code = factory.Sequence(lambda n: f"SVC-{n:04d}")
    category = ServiceCategory.INCORPORATION
    base_price = Decimal("500.00")
    currency = "USD"
    is_active = True


class ServiceRequestFactory(DjangoModelFactory):
    class Meta:
        model = ServiceRequest

    client = factory.SubFactory(ClientFactory)
    requested_by = factory.SubFactory(UserFactory)
    status = RequestStatus.DRAFT


class ServiceRequestItemFactory(DjangoModelFactory):
    class Meta:
        model = ServiceRequestItem

    service_request = factory.SubFactory(ServiceRequestFactory)
    service = factory.SubFactory(ServiceCatalogFactory)
    quantity = 1
    unit_price = Decimal("500.00")
    discount_amount = Decimal("0.00")
    subtotal = Decimal("500.00")


class QuotationFactory(DjangoModelFactory):
    class Meta:
        model = Quotation

    service_request = factory.SubFactory(ServiceRequestFactory)
    quotation_number = factory.Sequence(lambda n: f"Q-20260101-{n:04d}")
    subtotal = Decimal("500.00")
    discount_total = Decimal("0.00")
    tax_amount = Decimal("0.00")
    total = Decimal("500.00")
    currency = "USD"
    status = QuotationStatus.DRAFT


class NotaryDeedPoolFactory(DjangoModelFactory):
    class Meta:
        model = NotaryDeedPool

    deed_number = factory.Sequence(lambda n: f"DEED-{n:06d}")
    status = DeedStatus.AVAILABLE
    notary_name = "Notary Public"


class ExpenseRecordFactory(DjangoModelFactory):
    class Meta:
        model = ExpenseRecord

    category = ExpenseCategory.GOVERNMENT_FEE
    description = factory.Sequence(lambda n: f"Expense {n}")
    amount = Decimal("100.00")
    currency = "USD"
    payment_status = PaymentStatus.PENDING
