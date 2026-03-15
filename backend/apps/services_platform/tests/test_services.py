"""
Phase 4.1.7 - Service Platform Tests

Tests for:
- Service catalog CRUD
- Pricing calculation (base price, discount rules, override price)
- Quotation lifecycle (create, accept, reject)
- Model constraints (unique service code, unique pricing rule per category)
"""
import pytest
from decimal import Decimal

from apps.authentication.tests.factories import UserFactory
from apps.core.constants import ClientCategory
from apps.core.tests.factories import ClientFactory, EntityFactory
from apps.services_platform.constants import (
    ClientPricingCategory,
    QuotationStatus,
    RequestStatus,
    ServiceCategory,
)
from apps.services_platform.models import (
    PricingRule,
    Quotation,
    ServiceCatalog,
    ServiceRequest,
    ServiceRequestItem,
)
from apps.services_platform.services import (
    accept_quotation,
    add_service_to_request,
    create_service_request,
    generate_quotation,
    reject_quotation,
    remove_service_from_request,
    submit_service_request,
)

from common.exceptions import ApplicationError

from .factories import (
    QuotationFactory,
    ServiceCatalogFactory,
    ServiceRequestFactory,
    ServiceRequestItemFactory,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


@pytest.fixture
def user():
    return UserFactory()


@pytest.fixture
def client_obj():
    return ClientFactory(category=ClientCategory.SILVER)


@pytest.fixture
def gold_client():
    return ClientFactory(category=ClientCategory.GOLD)


@pytest.fixture
def service():
    return ServiceCatalogFactory(
        name="BVI Incorporation",
        code="INC-BVI",
        category=ServiceCategory.INCORPORATION,
        base_price=Decimal("1500.00"),
    )


@pytest.fixture
def service_request(client_obj, user):
    return create_service_request(
        client_id=client_obj.id,
        requested_by=user,
        notes="Test request",
    )


# ---------------------------------------------------------------------------
# Service catalog CRUD
# ---------------------------------------------------------------------------


class TestServiceCatalogCRUD:
    def test_create_service(self):
        svc = ServiceCatalog.objects.create(
            name="Annual Renewal BVI",
            code="REN-BVI-001",
            category=ServiceCategory.ANNUAL_RENEWAL,
            base_price=Decimal("800.00"),
        )
        assert svc.name == "Annual Renewal BVI"
        assert svc.code == "REN-BVI-001"
        assert svc.is_active is True

    def test_unique_service_code(self):
        ServiceCatalog.objects.create(
            name="Service A",
            code="UNIQUE-001",
            category=ServiceCategory.INCORPORATION,
            base_price=Decimal("100.00"),
        )
        with pytest.raises(Exception):
            ServiceCatalog.objects.create(
                name="Service B",
                code="UNIQUE-001",
                category=ServiceCategory.LEGAL_SUPPORT,
                base_price=Decimal("200.00"),
            )

    def test_deactivate_service(self, service):
        service.is_active = False
        service.save(update_fields=["is_active"])
        service.refresh_from_db()
        assert service.is_active is False

    def test_service_str_representation(self, service):
        expected = f"{service.name} ({service.code})"
        assert str(service) == expected

    def test_create_pricing_rule(self, service):
        rule = PricingRule.objects.create(
            service=service,
            client_category=ClientPricingCategory.GOLD,
            discount_percentage=Decimal("10.00"),
            is_active=True,
        )
        assert rule.service == service
        assert rule.discount_percentage == Decimal("10.00")

    def test_unique_pricing_rule_per_category(self, service):
        PricingRule.objects.create(
            service=service,
            client_category=ClientPricingCategory.GOLD,
            discount_percentage=Decimal("5.00"),
        )
        with pytest.raises(Exception):
            PricingRule.objects.create(
                service=service,
                client_category=ClientPricingCategory.GOLD,
                discount_percentage=Decimal("10.00"),
            )


# ---------------------------------------------------------------------------
# Service request creation
# ---------------------------------------------------------------------------


class TestServiceRequestCreation:
    def test_create_service_request(self, client_obj, user):
        sr = create_service_request(
            client_id=client_obj.id,
            requested_by=user,
            notes="Incorporation request",
        )
        assert sr.client == client_obj
        assert sr.requested_by == user
        assert sr.status == RequestStatus.DRAFT

    def test_create_with_entity(self, client_obj, user):
        entity = EntityFactory(client=client_obj)
        sr = create_service_request(
            client_id=client_obj.id,
            requested_by=user,
            entity_id=entity.id,
        )
        assert sr.entity == entity

    def test_create_with_nonexistent_client(self, user):
        import uuid
        with pytest.raises(ApplicationError, match="Client not found"):
            create_service_request(
                client_id=uuid.uuid4(),
                requested_by=user,
            )

    def test_metadata_defaults_to_empty_dict(self, client_obj, user):
        sr = create_service_request(
            client_id=client_obj.id,
            requested_by=user,
        )
        assert sr.metadata == {}


# ---------------------------------------------------------------------------
# Pricing calculation
# ---------------------------------------------------------------------------


class TestPricingCalculation:
    def test_base_price_when_no_rule(self, service_request, service):
        item = add_service_to_request(
            request_id=service_request.id,
            service_id=service.id,
        )
        assert item.unit_price == Decimal("1500.00")
        assert item.discount_amount == Decimal("0.00")
        assert item.subtotal == Decimal("1500.00")

    def test_discount_percentage_applied(self, gold_client, user, service):
        PricingRule.objects.create(
            service=service,
            client_category=ClientPricingCategory.GOLD,
            discount_percentage=Decimal("10.00"),
            is_active=True,
        )
        sr = create_service_request(
            client_id=gold_client.id,
            requested_by=user,
        )
        item = add_service_to_request(
            request_id=sr.id,
            service_id=service.id,
        )
        # 10% of 1500.00 = 150.00 discount
        assert item.discount_amount == Decimal("150.00")
        assert item.subtotal == Decimal("1350.00")

    def test_override_price_takes_precedence(self, gold_client, user, service):
        PricingRule.objects.create(
            service=service,
            client_category=ClientPricingCategory.GOLD,
            override_price=Decimal("1000.00"),
            is_active=True,
        )
        sr = create_service_request(
            client_id=gold_client.id,
            requested_by=user,
        )
        item = add_service_to_request(
            request_id=sr.id,
            service_id=service.id,
        )
        assert item.unit_price == Decimal("1000.00")
        assert item.subtotal == Decimal("1000.00")

    def test_quantity_multiplied(self, service_request, service):
        item = add_service_to_request(
            request_id=service_request.id,
            service_id=service.id,
            quantity=3,
        )
        # 1500.00 * 3 = 4500.00
        assert item.subtotal == Decimal("4500.00")
        assert item.quantity == 3

    def test_cannot_add_to_non_draft_request(self, service_request, service):
        # Add an item and submit first
        add_service_to_request(
            request_id=service_request.id,
            service_id=service.id,
        )
        submit_service_request(request_id=service_request.id)

        with pytest.raises(ApplicationError, match="Can only add services to draft"):
            add_service_to_request(
                request_id=service_request.id,
                service_id=service.id,
            )

    def test_cannot_add_inactive_service(self, service_request, service):
        service.is_active = False
        service.save(update_fields=["is_active"])

        with pytest.raises(ApplicationError, match="Service not found or inactive"):
            add_service_to_request(
                request_id=service_request.id,
                service_id=service.id,
            )

    def test_remove_service_from_draft(self, service_request, service):
        item = add_service_to_request(
            request_id=service_request.id,
            service_id=service.id,
        )
        remove_service_from_request(
            request_id=service_request.id,
            item_id=item.id,
        )
        assert not ServiceRequestItem.objects.filter(id=item.id).exists()


# ---------------------------------------------------------------------------
# Service request submission
# ---------------------------------------------------------------------------


class TestServiceRequestSubmission:
    def test_submit_draft_request(self, service_request, service):
        add_service_to_request(
            request_id=service_request.id,
            service_id=service.id,
        )
        submitted = submit_service_request(request_id=service_request.id)
        assert submitted.status == RequestStatus.PENDING_QUOTATION
        assert submitted.submitted_at is not None

    def test_cannot_submit_empty_request(self, service_request):
        with pytest.raises(ApplicationError, match="no service items"):
            submit_service_request(request_id=service_request.id)

    def test_cannot_submit_non_draft(self, service_request, service):
        add_service_to_request(
            request_id=service_request.id,
            service_id=service.id,
        )
        submit_service_request(request_id=service_request.id)

        with pytest.raises(ApplicationError, match="Only draft requests"):
            submit_service_request(request_id=service_request.id)


# ---------------------------------------------------------------------------
# Quotation lifecycle
# ---------------------------------------------------------------------------


class TestQuotationLifecycle:
    def test_generate_quotation(self, service_request, service):
        add_service_to_request(
            request_id=service_request.id,
            service_id=service.id,
        )
        submit_service_request(request_id=service_request.id)

        quotation = generate_quotation(request_id=service_request.id)
        assert quotation.status == QuotationStatus.DRAFT
        assert quotation.total == Decimal("1500.00")
        assert quotation.quotation_number.startswith("Q-")

        service_request.refresh_from_db()
        assert service_request.status == RequestStatus.QUOTED

    def test_quotation_number_format(self, service_request, service):
        add_service_to_request(
            request_id=service_request.id,
            service_id=service.id,
        )
        submit_service_request(request_id=service_request.id)

        quotation = generate_quotation(request_id=service_request.id)
        # Format: Q-YYYYMMDD-XXXX
        parts = quotation.quotation_number.split("-")
        assert parts[0] == "Q"
        assert len(parts[1]) == 8  # YYYYMMDD
        assert len(parts[2]) == 4  # 0001

    def test_accept_quotation(self, service_request, service):
        add_service_to_request(
            request_id=service_request.id,
            service_id=service.id,
        )
        submit_service_request(request_id=service_request.id)
        quotation = generate_quotation(request_id=service_request.id)

        accepted = accept_quotation(quotation_id=quotation.id)
        assert accepted.status == QuotationStatus.ACCEPTED
        assert accepted.accepted_at is not None

        service_request.refresh_from_db()
        assert service_request.status == RequestStatus.ACCEPTED

    def test_reject_quotation(self, service_request, service):
        add_service_to_request(
            request_id=service_request.id,
            service_id=service.id,
        )
        submit_service_request(request_id=service_request.id)
        quotation = generate_quotation(request_id=service_request.id)

        rejected = reject_quotation(
            quotation_id=quotation.id,
            notes="Too expensive.",
        )
        assert rejected.status == QuotationStatus.REJECTED
        assert rejected.rejected_at is not None
        assert rejected.notes == "Too expensive."

        service_request.refresh_from_db()
        assert service_request.status == RequestStatus.REJECTED

    def test_cannot_accept_already_accepted(self, service_request, service):
        add_service_to_request(
            request_id=service_request.id,
            service_id=service.id,
        )
        submit_service_request(request_id=service_request.id)
        quotation = generate_quotation(request_id=service_request.id)
        accept_quotation(quotation_id=quotation.id)

        with pytest.raises(ApplicationError, match="Only draft or sent"):
            accept_quotation(quotation_id=quotation.id)

    def test_cannot_reject_already_rejected(self, service_request, service):
        add_service_to_request(
            request_id=service_request.id,
            service_id=service.id,
        )
        submit_service_request(request_id=service_request.id)
        quotation = generate_quotation(request_id=service_request.id)
        reject_quotation(quotation_id=quotation.id)

        with pytest.raises(ApplicationError, match="Only draft or sent"):
            reject_quotation(quotation_id=quotation.id)

    def test_cannot_generate_quotation_for_draft_request(self, service_request, service):
        add_service_to_request(
            request_id=service_request.id,
            service_id=service.id,
        )
        # NOT submitted
        with pytest.raises(ApplicationError, match="Can only generate quotations"):
            generate_quotation(request_id=service_request.id)

    def test_re_quote_after_first_quotation(self, service_request, service):
        """A quoted request can have another quotation generated."""
        add_service_to_request(
            request_id=service_request.id,
            service_id=service.id,
        )
        submit_service_request(request_id=service_request.id)
        q1 = generate_quotation(request_id=service_request.id)
        q2 = generate_quotation(request_id=service_request.id)

        assert q1.id != q2.id
        assert q1.quotation_number != q2.quotation_number


# ---------------------------------------------------------------------------
# Model constraints
# ---------------------------------------------------------------------------


class TestModelConstraints:
    def test_quotation_number_unique(self):
        sr = ServiceRequestFactory()
        Quotation.objects.create(
            service_request=sr,
            quotation_number="Q-UNIQUE-001",
            subtotal=Decimal("100.00"),
            total=Decimal("100.00"),
        )
        with pytest.raises(Exception):
            Quotation.objects.create(
                service_request=sr,
                quotation_number="Q-UNIQUE-001",
                subtotal=Decimal("200.00"),
                total=Decimal("200.00"),
            )

    def test_service_request_item_references(self, service_request, service):
        item = add_service_to_request(
            request_id=service_request.id,
            service_id=service.id,
        )
        assert item.service_request == service_request
        assert item.service == service
