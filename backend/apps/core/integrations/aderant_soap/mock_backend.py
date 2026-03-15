"""Mock backend for Aderant SOAP operations.

Provides realistic mock data when SOAP credentials are not configured.
All methods match the interface of the real SOAP service modules.
"""

import logging
import uuid
from datetime import date, timedelta

from .models import (
    AderantClientData,
    AderantMatterData,
    ClientBalance,
    FileOpeningResult,
    InvoiceData,
    MatterStatus,
    TimeEntryResult,
)

logger = logging.getLogger(__name__)

_MOCK_CLIENTS = {
    "ADR-C-001": AderantClientData(
        client_id="ADR-C-001",
        name="Global Trade Holdings Ltd.",
        client_type="corporate",
        category="gold",
        responsible_attorney="JPV",
        office="Panama",
    ),
    "ADR-C-002": AderantClientData(
        client_id="ADR-C-002",
        name="Maria Elena Rodriguez Garcia",
        client_type="natural",
        category="silver",
        responsible_attorney="RMG",
        office="Panama",
    ),
    "ADR-C-003": AderantClientData(
        client_id="ADR-C-003",
        name="Caribbean Investments Corp.",
        client_type="corporate",
        category="platinum",
        responsible_attorney="JPV",
        office="BVI",
    ),
}

_MOCK_MATTERS = {
    "ADR-M-001": AderantMatterData(
        matter_id="ADR-M-001",
        client_id="ADR-C-001",
        description="Incorporation - BVI Company",
        status="open",
        opened_date=date(2024, 1, 15),
        responsible_attorney="JPV",
        matter_type="incorporation",
    ),
    "ADR-M-002": AderantMatterData(
        matter_id="ADR-M-002",
        client_id="ADR-C-001",
        description="Annual Compliance Review 2024",
        status="open",
        opened_date=date(2024, 6, 1),
        responsible_attorney="RMG",
        matter_type="compliance",
    ),
    "ADR-M-003": AderantMatterData(
        matter_id="ADR-M-003",
        client_id="ADR-C-002",
        description="Incorporation - Panama Foundation",
        status="open",
        opened_date=date(2024, 3, 10),
        responsible_attorney="JPV",
        matter_type="incorporation",
    ),
}


class MockAderantBackend:
    """In-memory mock for all Aderant SOAP operations."""

    def __init__(self):
        self._clients = dict(_MOCK_CLIENTS)
        self._matters = dict(_MOCK_MATTERS)
        logger.info("Aderant mock backend initialized with %d clients, %d matters",
                     len(self._clients), len(self._matters))

    # --- File Opening ---

    def open_file(
        self,
        *,
        client_name: str,
        client_type: str = "corporate",
        matter_description: str,
        responsible_attorney: str = "",
        office: str = "Panama",
        matter_type: str = "incorporation",
        **kwargs,
    ) -> FileOpeningResult:
        client_id = f"ADR-C-{uuid.uuid4().hex[:6].upper()}"
        matter_id = f"ADR-M-{uuid.uuid4().hex[:6].upper()}"

        self._clients[client_id] = AderantClientData(
            client_id=client_id,
            name=client_name,
            client_type=client_type,
            responsible_attorney=responsible_attorney,
            office=office,
        )
        self._matters[matter_id] = AderantMatterData(
            matter_id=matter_id,
            client_id=client_id,
            description=matter_description,
            status="open",
            opened_date=date.today(),
            responsible_attorney=responsible_attorney,
            matter_type=matter_type,
        )

        logger.warning("MOCK: Opened file - client=%s matter=%s", client_id, matter_id)
        return FileOpeningResult(
            client_id=client_id,
            matter_id=matter_id,
            client_name=client_name,
            matter_description=matter_description,
            is_mock=True,
        )

    # --- Client/Matter queries ---

    def get_client(self, client_id: str) -> AderantClientData | None:
        return self._clients.get(client_id)

    def list_clients(self) -> list[AderantClientData]:
        return list(self._clients.values())

    def get_matter(self, matter_id: str) -> AderantMatterData | None:
        return self._matters.get(matter_id)

    def list_matters(self, client_id: str | None = None) -> list[AderantMatterData]:
        matters = list(self._matters.values())
        if client_id:
            matters = [m for m in matters if m.client_id == client_id]
        return matters

    # --- Billing ---

    def post_time_entry(
        self,
        *,
        matter_id: str,
        attorney_id: str,
        hours: float,
        description: str,
        **kwargs,
    ) -> TimeEntryResult:
        entry_id = f"ADR-TE-{uuid.uuid4().hex[:6].upper()}"
        logger.warning("MOCK: Posted time entry %s for matter %s", entry_id, matter_id)
        return TimeEntryResult(
            entry_id=entry_id,
            matter_id=matter_id,
            hours=hours,
            status="posted",
            is_mock=True,
        )

    def get_invoices(self, client_id: str) -> list[InvoiceData]:
        return [
            InvoiceData(
                invoice_id=f"ADR-INV-{uuid.uuid4().hex[:4].upper()}",
                matter_id="ADR-M-001",
                client_id=client_id,
                amount=5000.00,
                currency="USD",
                status="paid",
                issued_date=date.today() - timedelta(days=30),
                due_date=date.today(),
            ),
        ]

    # --- Inquiries ---

    def get_client_balance(self, client_id: str) -> ClientBalance:
        return ClientBalance(
            client_id=client_id,
            trust_balance=25000.00,
            operating_balance=0.0,
            unbilled_wip=3500.00,
            outstanding_ar=1200.00,
        )

    def get_matter_status(self, matter_id: str) -> MatterStatus | None:
        matter = self._matters.get(matter_id)
        if not matter:
            return None
        return MatterStatus(
            matter_id=matter.matter_id,
            client_id=matter.client_id,
            description=matter.description,
            status=matter.status,
            total_fees=12500.00,
            total_costs=850.00,
            unbilled_wip=3500.00,
            last_billing_date=date.today() - timedelta(days=15),
        )
