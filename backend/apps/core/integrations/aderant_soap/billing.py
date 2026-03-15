"""Billing service for Aderant SOAP."""

import logging

from .client import AderantSOAPClient
from .models import InvoiceData, TimeEntry, TimeEntryResult

logger = logging.getLogger(__name__)


def post_time_entry(soap_client: AderantSOAPClient, entry: TimeEntry) -> TimeEntryResult:
    """Post a time entry to Aderant via SOAP."""
    result = soap_client.call(
        "BillingService",
        "PostTimeEntry",
        MatterID=entry.matter_id,
        AttorneyID=entry.attorney_id,
        Hours=entry.hours,
        Description=entry.description,
        ActivityCode=entry.activity_code,
        EntryDate=str(entry.entry_date) if entry.entry_date else None,
    )
    entry_id = str(getattr(result, "EntryID", result))

    logger.info("Time entry posted: %s for matter %s (%.1fh)", entry_id, entry.matter_id, entry.hours)

    return TimeEntryResult(
        entry_id=entry_id,
        matter_id=entry.matter_id,
        hours=entry.hours,
        status="posted",
        is_mock=False,
    )


def get_invoices(soap_client: AderantSOAPClient, client_id: str) -> list[InvoiceData]:
    """Retrieve invoices for a client from Aderant."""
    result = soap_client.call(
        "BillingService",
        "GetInvoices",
        ClientID=client_id,
    )
    invoices = []
    items = getattr(result, "Invoice", []) if result else []
    if not isinstance(items, list):
        items = [items]

    for item in items:
        invoices.append(InvoiceData(
            invoice_id=str(getattr(item, "InvoiceID", "")),
            matter_id=str(getattr(item, "MatterID", "")),
            client_id=client_id,
            amount=float(getattr(item, "Amount", 0)),
            currency=str(getattr(item, "Currency", "USD")),
            status=str(getattr(item, "Status", "draft")),
        ))

    return invoices
