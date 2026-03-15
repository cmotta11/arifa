"""
Phase 3.7.15 - Accounting Records Tests

Tests for:
- Upload method flow
- Seven steps method flow
- Exempted company support
- Balance sheet calculation
- Accounting record lifecycle (CRUD, draft, submit, approve, reject)
"""
import pytest
from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from apps.authentication.tests.factories import UserFactory
from apps.compliance.constants import (
    AccountingRecordFormType,
    AccountingRecordStatus,
    CompletionMethod,
)
from apps.compliance.models import AccountingRecord, AccountingRecordDocument
from apps.compliance.services import (
    approve_accounting_record,
    bulk_create_accounting_records,
    create_accounting_record,
    reject_accounting_record,
    save_accounting_record_draft,
    submit_accounting_record,
    upload_accounting_document,
)
from apps.core.tests.factories import ClientFactory, EntityFactory

from common.exceptions import ApplicationError


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


@pytest.fixture
def panama_entity():
    client = ClientFactory()
    return EntityFactory(
        client=client,
        jurisdiction="panama",
        name="Panama Corp",
    )


@pytest.fixture
def accounting_record(panama_entity):
    return create_accounting_record(entity_id=panama_entity.id, fiscal_year=2024)


# ---------------------------------------------------------------------------
# Accounting Record Creation
# ---------------------------------------------------------------------------


class TestAccountingRecordCreation:
    def test_create_record(self, panama_entity):
        record = create_accounting_record(
            entity_id=panama_entity.id, fiscal_year=2024,
        )
        assert record.entity == panama_entity
        assert record.fiscal_year == 2024
        assert record.status == AccountingRecordStatus.PENDING

    def test_default_fiscal_year(self, panama_entity):
        from datetime import date
        record = create_accounting_record(entity_id=panama_entity.id)
        assert record.fiscal_year == date.today().year - 1

    def test_unique_per_entity_year(self, panama_entity):
        create_accounting_record(entity_id=panama_entity.id, fiscal_year=2024)
        with pytest.raises(Exception):
            create_accounting_record(entity_id=panama_entity.id, fiscal_year=2024)

    def test_bulk_create_for_panama_entities(self, panama_entity):
        user = UserFactory()
        records = bulk_create_accounting_records(
            fiscal_year=2024, created_by=user,
        )
        assert len(records) >= 1
        assert all(r.fiscal_year == 2024 for r in records)

    def test_bulk_create_skips_existing(self, panama_entity):
        user = UserFactory()
        create_accounting_record(entity_id=panama_entity.id, fiscal_year=2024)
        records = bulk_create_accounting_records(
            fiscal_year=2024, created_by=user,
        )
        # Should not create a duplicate for panama_entity
        assert len(records) == 0


# ---------------------------------------------------------------------------
# Upload method flow
# ---------------------------------------------------------------------------


class TestUploadMethodFlow:
    def test_save_draft_with_upload_method(self, accounting_record):
        updated = save_accounting_record_draft(
            record_id=accounting_record.id,
            form_type=AccountingRecordFormType.BALANCE_GENERAL,
            form_data={"total_assets": "100000", "total_liabilities": "50000"},
        )
        assert updated.form_type == AccountingRecordFormType.BALANCE_GENERAL
        assert updated.status == AccountingRecordStatus.DRAFT

    def test_upload_document_for_record(self, accounting_record):
        file_obj = SimpleUploadedFile(
            name="balance_sheet.pdf",
            content=b"fake pdf content",
            content_type="application/pdf",
        )
        doc = upload_accounting_document(
            record_id=accounting_record.id,
            file_obj=file_obj,
            description="Balance sheet for FY2024",
        )
        assert doc.original_filename == "balance_sheet.pdf"
        assert doc.accounting_record == accounting_record
        assert doc.description == "Balance sheet for FY2024"

    def test_upload_rejected_for_approved_record(self, panama_entity):
        record = AccountingRecord.objects.create(
            entity=panama_entity,
            fiscal_year=2023,
            status=AccountingRecordStatus.APPROVED,
        )
        file_obj = SimpleUploadedFile(
            name="doc.pdf",
            content=b"content",
            content_type="application/pdf",
        )
        with pytest.raises(ApplicationError, match="Cannot upload documents for an approved record"):
            upload_accounting_document(
                record_id=record.id, file_obj=file_obj,
            )

    def test_upload_file_size_validation(self, accounting_record):
        # Create a file that exceeds the 10MB limit
        large_content = b"x" * (11 * 1024 * 1024)
        file_obj = SimpleUploadedFile(
            name="large.pdf",
            content=large_content,
            content_type="application/pdf",
        )
        with pytest.raises(ApplicationError, match="File size exceeds"):
            upload_accounting_document(
                record_id=accounting_record.id, file_obj=file_obj,
            )

    def test_upload_invalid_file_type(self, accounting_record):
        file_obj = SimpleUploadedFile(
            name="script.exe",
            content=b"executable content",
            content_type="application/x-executable",
        )
        with pytest.raises(ApplicationError, match="File type"):
            upload_accounting_document(
                record_id=accounting_record.id, file_obj=file_obj,
            )


# ---------------------------------------------------------------------------
# Seven steps method flow
# ---------------------------------------------------------------------------


class TestSevenStepsMethodFlow:
    def test_save_no_operations_form(self, accounting_record):
        updated = save_accounting_record_draft(
            record_id=accounting_record.id,
            form_type=AccountingRecordFormType.NO_OPERATIONS,
            form_data={"has_operations": False, "statement": "No operations performed"},
            signer_name="John Doe",
            signer_identification="PA-123456",
        )
        assert updated.form_type == AccountingRecordFormType.NO_OPERATIONS
        assert updated.form_data["has_operations"] is False

    def test_save_panama_assets_form(self, accounting_record):
        updated = save_accounting_record_draft(
            record_id=accounting_record.id,
            form_type=AccountingRecordFormType.PANAMA_ASSETS,
            form_data={
                "assets": [
                    {"type": "real_estate", "description": "Panama City Apt", "value": "250000"},
                ],
            },
        )
        assert updated.form_type == AccountingRecordFormType.PANAMA_ASSETS
        assert len(updated.form_data["assets"]) == 1

    def test_save_exempt_license_form(self, accounting_record):
        updated = save_accounting_record_draft(
            record_id=accounting_record.id,
            form_type=AccountingRecordFormType.EXEMPT_LICENSE,
            form_data={"license_number": "EX-2024-001"},
        )
        assert updated.form_type == AccountingRecordFormType.EXEMPT_LICENSE


# ---------------------------------------------------------------------------
# Balance sheet calculation
# ---------------------------------------------------------------------------


class TestBalanceSheetCalculation:
    def test_balance_general_form_data(self, accounting_record):
        form_data = {
            "total_assets": "500000.00",
            "current_assets": "200000.00",
            "non_current_assets": "300000.00",
            "total_liabilities": "150000.00",
            "current_liabilities": "50000.00",
            "non_current_liabilities": "100000.00",
            "equity": "350000.00",
        }
        updated = save_accounting_record_draft(
            record_id=accounting_record.id,
            form_type=AccountingRecordFormType.BALANCE_GENERAL,
            form_data=form_data,
        )
        assert Decimal(updated.form_data["total_assets"]) == Decimal("500000.00")
        # Verify balance: assets = liabilities + equity
        total_assets = Decimal(updated.form_data["total_assets"])
        total_liabilities = Decimal(updated.form_data["total_liabilities"])
        equity = Decimal(updated.form_data["equity"])
        assert total_assets == total_liabilities + equity


# ---------------------------------------------------------------------------
# Exempted company support
# ---------------------------------------------------------------------------


class TestExemptedCompanySupport:
    def test_exempt_license_form_type(self, accounting_record):
        updated = save_accounting_record_draft(
            record_id=accounting_record.id,
            form_type=AccountingRecordFormType.EXEMPT_LICENSE,
            form_data={"license_number": "EXEMPT-2024", "reason": "Licensed exemption"},
        )
        assert updated.form_type == AccountingRecordFormType.EXEMPT_LICENSE

    def test_exempt_with_no_balance_data(self, accounting_record):
        """Exempt entities don't need detailed balance sheet."""
        updated = save_accounting_record_draft(
            record_id=accounting_record.id,
            form_type=AccountingRecordFormType.EXEMPT_LICENSE,
            form_data={"license_number": "EX-001"},
            signer_name="Legal Rep",
            signature_data="base64encodeddata",
        )
        assert updated.form_data.get("total_assets") is None


# ---------------------------------------------------------------------------
# Accounting record lifecycle (submit, approve, reject)
# ---------------------------------------------------------------------------


class TestAccountingRecordLifecycle:
    def test_pending_to_draft_on_first_save(self, accounting_record):
        assert accounting_record.status == AccountingRecordStatus.PENDING
        updated = save_accounting_record_draft(
            record_id=accounting_record.id,
            form_type=AccountingRecordFormType.NO_OPERATIONS,
        )
        assert updated.status == AccountingRecordStatus.DRAFT

    def test_submit_draft_record(self, accounting_record):
        save_accounting_record_draft(
            record_id=accounting_record.id,
            form_type=AccountingRecordFormType.NO_OPERATIONS,
            signature_data="sig_data",
            signer_name="John Doe",
        )
        submitted = submit_accounting_record(record_id=accounting_record.id)
        assert submitted.status == AccountingRecordStatus.SUBMITTED
        assert submitted.submitted_at is not None

    def test_cannot_submit_without_form_type(self, accounting_record):
        save_accounting_record_draft(
            record_id=accounting_record.id,
            signature_data="sig_data",
            signer_name="John",
        )
        with pytest.raises(ApplicationError, match="Form type is required"):
            submit_accounting_record(record_id=accounting_record.id)

    def test_cannot_submit_without_signature(self, accounting_record):
        save_accounting_record_draft(
            record_id=accounting_record.id,
            form_type=AccountingRecordFormType.NO_OPERATIONS,
            signer_name="John",
        )
        with pytest.raises(ApplicationError, match="Signature is required"):
            submit_accounting_record(record_id=accounting_record.id)

    def test_cannot_submit_without_signer_name(self, accounting_record):
        save_accounting_record_draft(
            record_id=accounting_record.id,
            form_type=AccountingRecordFormType.NO_OPERATIONS,
            signature_data="sig_data",
        )
        with pytest.raises(ApplicationError, match="Signer name is required"):
            submit_accounting_record(record_id=accounting_record.id)

    def test_approve_submitted_record(self, accounting_record):
        save_accounting_record_draft(
            record_id=accounting_record.id,
            form_type=AccountingRecordFormType.NO_OPERATIONS,
            signature_data="sig",
            signer_name="John",
        )
        submit_accounting_record(record_id=accounting_record.id)
        user = UserFactory()
        approved = approve_accounting_record(
            record_id=accounting_record.id,
            reviewed_by=user,
            review_notes="Looks good.",
        )
        assert approved.status == AccountingRecordStatus.APPROVED
        assert approved.reviewed_by == user
        assert approved.review_notes == "Looks good."

    def test_reject_submitted_record(self, accounting_record):
        save_accounting_record_draft(
            record_id=accounting_record.id,
            form_type=AccountingRecordFormType.NO_OPERATIONS,
            signature_data="sig",
            signer_name="John",
        )
        submit_accounting_record(record_id=accounting_record.id)
        user = UserFactory()
        rejected = reject_accounting_record(
            record_id=accounting_record.id,
            reviewed_by=user,
            review_notes="Missing documentation.",
        )
        assert rejected.status == AccountingRecordStatus.REJECTED
        assert rejected.review_notes == "Missing documentation."

    def test_cannot_approve_non_submitted(self, accounting_record):
        user = UserFactory()
        with pytest.raises(ApplicationError, match="Cannot approve"):
            approve_accounting_record(
                record_id=accounting_record.id,
                reviewed_by=user,
            )

    def test_rejected_record_can_be_re_edited(self, accounting_record):
        save_accounting_record_draft(
            record_id=accounting_record.id,
            form_type=AccountingRecordFormType.NO_OPERATIONS,
            signature_data="sig",
            signer_name="John",
        )
        submit_accounting_record(record_id=accounting_record.id)
        user = UserFactory()
        reject_accounting_record(
            record_id=accounting_record.id,
            reviewed_by=user,
            review_notes="Needs fixes",
        )

        # Re-edit after rejection
        updated = save_accounting_record_draft(
            record_id=accounting_record.id,
            form_data={"corrected": True},
        )
        assert updated.status == AccountingRecordStatus.DRAFT
        assert updated.reviewed_by is None
        assert updated.review_notes == ""
