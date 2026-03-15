"""
Phase 4.4.8 - Incorporation Workflow Tests

Tests for:
- Payment recording and lifecycle (record, mark paid, constraints)
- High-capital auto-detection via save_incorporation_data
- RPA job trigger chain (creation, step materialization, lifecycle)
- Deed assignment from pool
"""
import pytest
from decimal import Decimal
from unittest.mock import patch

from apps.authentication.tests.factories import UserFactory
from apps.core.tests.factories import ClientFactory, EntityFactory
from apps.services_platform.constants import (
    DeedStatus,
    ExpenseCategory,
    PaymentStatus,
    RequestStatus,
)
from apps.services_platform.models import (
    ExpenseRecord,
    IncorporationData,
    NotaryDeedPool,
)
from apps.services_platform.services import (
    assign_deed,
    create_service_request,
    mark_expense_paid,
    record_expense,
    save_incorporation_data,
)
from apps.rpa.models import RPAJob, RPAJobDefinition, RPAJobStatus, RPAStepStatus
from apps.rpa.services import (
    cancel_rpa_job,
    create_rpa_job,
    pause_rpa_job,
    retry_rpa_job,
    start_rpa_job,
)

from common.exceptions import ApplicationError

from .factories import (
    NotaryDeedPoolFactory,
    ServiceCatalogFactory,
    ServiceRequestFactory,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


@pytest.fixture
def user():
    return UserFactory()


@pytest.fixture
def client_obj():
    return ClientFactory()


@pytest.fixture
def entity():
    client = ClientFactory()
    return EntityFactory(client=client)


@pytest.fixture
def service_request(client_obj, user):
    return create_service_request(
        client_id=client_obj.id,
        requested_by=user,
    )


@pytest.fixture
def rpa_definition():
    return RPAJobDefinition.objects.create(
        name="incorporation_bvi",
        display_name="BVI Incorporation",
        description="Full BVI incorporation workflow",
        step_definitions=[
            {"name": "Create Aderant Matter", "action": "aderant.create_matter", "config": {}},
            {"name": "Upload to SharePoint", "action": "sharepoint.upload", "config": {}},
            {"name": "Generate Documents", "action": "internal.generate_docs", "config": {}},
        ],
        required_input_fields=["entity_name", "jurisdiction"],
        is_active=True,
    )


# ---------------------------------------------------------------------------
# Payment recording
# ---------------------------------------------------------------------------


class TestPaymentRecording:
    def test_record_expense_for_service_request(self, service_request, user):
        expense = record_expense(
            service_request_id=service_request.id,
            category=ExpenseCategory.GOVERNMENT_FEE,
            description="BVI Registry Fee",
            amount=Decimal("350.00"),
            currency="USD",
            recorded_by=user,
        )
        assert expense.service_request == service_request
        assert expense.amount == Decimal("350.00")
        assert expense.payment_status == PaymentStatus.PENDING
        assert expense.recorded_by == user

    def test_record_expense_for_entity(self, entity, user):
        expense = record_expense(
            entity_id=entity.id,
            category=ExpenseCategory.NOTARY_FEE,
            description="Notary authentication fee",
            amount=Decimal("150.00"),
            recorded_by=user,
        )
        assert expense.entity == entity
        assert expense.category == ExpenseCategory.NOTARY_FEE

    def test_record_expense_requires_association(self, user):
        with pytest.raises(ApplicationError, match="At least one of"):
            record_expense(
                category=ExpenseCategory.COURIER_FEE,
                description="DHL shipment",
                amount=Decimal("50.00"),
                recorded_by=user,
            )

    def test_mark_expense_paid(self, service_request, user):
        expense = record_expense(
            service_request_id=service_request.id,
            category=ExpenseCategory.GOVERNMENT_FEE,
            description="Annual fee",
            amount=Decimal("200.00"),
            recorded_by=user,
        )
        paid = mark_expense_paid(
            expense_id=expense.id,
            payment_method="wire_transfer",
            payment_reference="REF-2024-001",
        )
        assert paid.payment_status == PaymentStatus.PAID
        assert paid.payment_method == "wire_transfer"
        assert paid.payment_reference == "REF-2024-001"
        assert paid.paid_at is not None

    def test_cannot_mark_already_paid(self, service_request, user):
        expense = record_expense(
            service_request_id=service_request.id,
            category=ExpenseCategory.LEGAL_FEE,
            description="Legal consultation",
            amount=Decimal("500.00"),
            recorded_by=user,
        )
        mark_expense_paid(expense_id=expense.id)

        with pytest.raises(ApplicationError, match="already marked as paid"):
            mark_expense_paid(expense_id=expense.id)


# ---------------------------------------------------------------------------
# High-capital auto-detection
# ---------------------------------------------------------------------------


class TestHighCapitalDetection:
    def test_below_threshold_not_high_capital(self, service_request):
        inc = save_incorporation_data(
            request_id=service_request.id,
            authorized_capital=Decimal("50000.00"),
            proposed_names=["Low Cap Corp"],
        )
        assert inc.is_high_capital is False
        assert inc.authorized_capital == Decimal("50000.00")

    def test_above_threshold_is_high_capital(self, service_request):
        inc = save_incorporation_data(
            request_id=service_request.id,
            authorized_capital=Decimal("200000.00"),
            proposed_names=["High Cap Corp"],
        )
        assert inc.is_high_capital is True

    def test_at_threshold_not_high_capital(self, service_request):
        """Capital equal to the threshold is NOT high capital (> not >=)."""
        inc = save_incorporation_data(
            request_id=service_request.id,
            authorized_capital=Decimal("100000.00"),
        )
        assert inc.is_high_capital is False

    def test_custom_threshold(self, service_request):
        inc = save_incorporation_data(
            request_id=service_request.id,
            authorized_capital=Decimal("60000.00"),
            high_capital_threshold=Decimal("50000.00"),
        )
        assert inc.is_high_capital is True

    def test_update_capital_recalculates_flag(self, service_request):
        inc = save_incorporation_data(
            request_id=service_request.id,
            authorized_capital=Decimal("50000.00"),
        )
        assert inc.is_high_capital is False

        # Update capital above threshold
        inc2 = save_incorporation_data(
            request_id=service_request.id,
            authorized_capital=Decimal("200000.00"),
        )
        assert inc2.is_high_capital is True
        assert inc2.id == inc.id  # Same record updated via get_or_create

    def test_save_incorporation_data_fields(self, service_request):
        inc = save_incorporation_data(
            request_id=service_request.id,
            proposed_names=["Acme Corp", "Acme Holdings"],
            entity_type="corp",
            is_operative=True,
            economic_activities=["consulting", "trading"],
            directors=[{"name": "John Doe", "nationality": "US"}],
            shareholders=[{"name": "Jane Doe", "shares": 50}],
            resident_agent="Legal Agent S.A.",
        )
        assert inc.proposed_names == ["Acme Corp", "Acme Holdings"]
        assert inc.entity_type == "corp"
        assert inc.is_operative is True
        assert len(inc.directors) == 1
        assert inc.resident_agent == "Legal Agent S.A."

    def test_save_for_nonexistent_request(self):
        import uuid
        with pytest.raises(ApplicationError, match="Service request not found"):
            save_incorporation_data(
                request_id=uuid.uuid4(),
                proposed_names=["Ghost Corp"],
            )


# ---------------------------------------------------------------------------
# Deed assignment from pool
# ---------------------------------------------------------------------------


class TestDeedAssignment:
    def test_assign_available_deed(self, service_request):
        deed = NotaryDeedPoolFactory(status=DeedStatus.AVAILABLE)
        assigned = assign_deed(request_id=service_request.id)
        assigned.refresh_from_db()
        assert assigned.status == DeedStatus.ASSIGNED
        assert assigned.assigned_to_request == service_request
        assert assigned.assigned_at is not None

    def test_no_available_deeds_raises_error(self, service_request):
        # No deeds in pool
        with pytest.raises(ApplicationError, match="No available deeds"):
            assign_deed(request_id=service_request.id)

    def test_assigned_deed_not_reassigned(self, service_request):
        deed = NotaryDeedPoolFactory(status=DeedStatus.ASSIGNED)
        with pytest.raises(ApplicationError, match="No available deeds"):
            assign_deed(request_id=service_request.id)

    def test_jurisdiction_scoped_deed_assignment(self):
        from apps.compliance.tests.factories import JurisdictionRiskFactory

        jr = JurisdictionRiskFactory(country_code="BV", country_name="BVI", risk_weight=3)
        client = ClientFactory()
        user = UserFactory()
        sr = create_service_request(
            client_id=client.id,
            requested_by=user,
            jurisdiction_id=jr.id,
        )
        deed = NotaryDeedPoolFactory(
            status=DeedStatus.AVAILABLE,
            jurisdiction=jr,
        )

        assigned = assign_deed(request_id=sr.id)
        assert assigned.id == deed.id


# ---------------------------------------------------------------------------
# RPA job trigger chain
# ---------------------------------------------------------------------------


class TestRPAJobTriggerChain:
    def test_create_rpa_job(self, rpa_definition, user, entity):
        job = create_rpa_job(
            definition_id=rpa_definition.id,
            input_data={"entity_name": "New Corp", "jurisdiction": "BVI"},
            created_by=user,
            entity_id=entity.id,
        )
        assert job.status == RPAJobStatus.PENDING
        assert job.definition == rpa_definition
        assert job.entity == entity

    def test_steps_materialized_from_definition(self, rpa_definition, user):
        job = create_rpa_job(
            definition_id=rpa_definition.id,
            input_data={"entity_name": "Corp", "jurisdiction": "BVI"},
            created_by=user,
        )
        steps = list(job.steps.order_by("order_index"))
        assert len(steps) == 3
        assert steps[0].step_name == "Create Aderant Matter"
        assert steps[1].step_name == "Upload to SharePoint"
        assert steps[2].step_name == "Generate Documents"
        assert all(s.status == RPAStepStatus.PENDING for s in steps)

    def test_missing_required_input_fields(self, rpa_definition, user):
        with pytest.raises(ApplicationError, match="Missing required input fields"):
            create_rpa_job(
                definition_id=rpa_definition.id,
                input_data={"entity_name": "Corp"},  # missing "jurisdiction"
                created_by=user,
            )

    def test_inactive_definition_raises_error(self, rpa_definition, user):
        rpa_definition.is_active = False
        rpa_definition.save(update_fields=["is_active"])

        with pytest.raises(ApplicationError, match="not found or inactive"):
            create_rpa_job(
                definition_id=rpa_definition.id,
                input_data={"entity_name": "Corp", "jurisdiction": "BVI"},
                created_by=user,
            )

    @patch("apps.rpa.services.execute_rpa_job.delay")
    def test_start_rpa_job(self, mock_delay, rpa_definition, user):
        mock_delay.return_value.id = "celery-task-123"
        job = create_rpa_job(
            definition_id=rpa_definition.id,
            input_data={"entity_name": "Corp", "jurisdiction": "BVI"},
            created_by=user,
        )
        started = start_rpa_job(job_id=job.id)
        assert started.status == RPAJobStatus.RUNNING
        assert started.started_at is not None
        mock_delay.assert_called_once_with(str(job.id))

    @patch("apps.rpa.services.execute_rpa_job.delay")
    def test_pause_running_job(self, mock_delay, rpa_definition, user):
        mock_delay.return_value.id = "celery-task-456"
        job = create_rpa_job(
            definition_id=rpa_definition.id,
            input_data={"entity_name": "Corp", "jurisdiction": "BVI"},
            created_by=user,
        )
        start_rpa_job(job_id=job.id)
        paused = pause_rpa_job(job_id=job.id)
        assert paused.status == RPAJobStatus.PAUSED

    def test_cannot_pause_pending_job(self, rpa_definition, user):
        job = create_rpa_job(
            definition_id=rpa_definition.id,
            input_data={"entity_name": "Corp", "jurisdiction": "BVI"},
            created_by=user,
        )
        with pytest.raises(ApplicationError, match="Can only pause running"):
            pause_rpa_job(job_id=job.id)

    def test_cancel_pending_job(self, rpa_definition, user):
        job = create_rpa_job(
            definition_id=rpa_definition.id,
            input_data={"entity_name": "Corp", "jurisdiction": "BVI"},
            created_by=user,
        )
        cancelled = cancel_rpa_job(job_id=job.id)
        assert cancelled.status == RPAJobStatus.CANCELLED
        assert cancelled.completed_at is not None

        # Pending steps should be marked as skipped
        skipped = cancelled.steps.filter(status=RPAStepStatus.SKIPPED).count()
        assert skipped == 3

    def test_retry_failed_job(self, rpa_definition, user):
        job = create_rpa_job(
            definition_id=rpa_definition.id,
            input_data={"entity_name": "Corp", "jurisdiction": "BVI"},
            created_by=user,
        )
        # Manually set to failed state for retry test
        job.status = RPAJobStatus.FAILED
        job.error_message = "Connection timed out"
        job.save(update_fields=["status", "error_message"])

        # Fail one step
        first_step = job.steps.first()
        first_step.status = RPAStepStatus.FAILED
        first_step.save(update_fields=["status"])

        with patch("apps.rpa.services.execute_rpa_job.delay") as mock_delay:
            mock_delay.return_value.id = "retry-task-789"
            retried = retry_rpa_job(job_id=job.id)

        assert retried.status == RPAJobStatus.RUNNING
        assert retried.retry_count == 1

    def test_max_retries_exceeded(self, rpa_definition, user):
        job = create_rpa_job(
            definition_id=rpa_definition.id,
            input_data={"entity_name": "Corp", "jurisdiction": "BVI"},
            created_by=user,
        )
        job.status = RPAJobStatus.FAILED
        job.retry_count = 3  # max_retries is 3
        job.save(update_fields=["status", "retry_count"])

        with pytest.raises(ApplicationError, match="Maximum retries exceeded"):
            retry_rpa_job(job_id=job.id)
