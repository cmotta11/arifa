"""AderantHarness — Unified facade for Aderant ERP integration.

Auto-detects whether SOAP credentials are configured and delegates
to either the real SOAP client or the in-memory mock backend.
"""

import logging

from django.conf import settings

from . import billing as billing_svc
from . import file_opening as file_opening_svc
from . import inquiries as inquiry_svc
from .exceptions import AderantSOAPError
from .mock_backend import MockAderantBackend
from .models import (
    AderantClientData,
    AderantMatterData,
    ClientBalance,
    FileOpeningRequest,
    FileOpeningResult,
    InvoiceData,
    MatterStatus,
    TimeEntry,
    TimeEntryResult,
)

logger = logging.getLogger(__name__)


def _is_soap_configured() -> bool:
    """Check whether Aderant SOAP credentials are present."""
    return bool(
        getattr(settings, "ADERANT_SOAP_WSDL_URL", "")
        and getattr(settings, "ADERANT_SOAP_USERNAME", "")
        and getattr(settings, "ADERANT_SOAP_PASSWORD", "")
    )


class AderantHarness:
    """Facade that transparently switches between SOAP and mock.

    Usage:
        harness = AderantHarness()
        result = harness.open_file(
            client_name="Acme Corp",
            matter_description="BVI Incorporation",
        )
    """

    def __init__(self):
        self._use_soap = _is_soap_configured()
        self._soap_client = None
        self._mock = None

        if self._use_soap:
            from .client import AderantSOAPClient

            self._soap_client = AderantSOAPClient()
            logger.info("AderantHarness: Using SOAP backend")
        else:
            self._mock = MockAderantBackend()
            logger.info("AderantHarness: Using mock backend (SOAP not configured)")

    @property
    def is_configured(self) -> bool:
        return self._use_soap

    @property
    def backend_name(self) -> str:
        return "soap" if self._use_soap else "mock"

    # ------------------------------------------------------------------
    # File Opening
    # ------------------------------------------------------------------

    def open_file(
        self,
        *,
        client_name: str,
        matter_description: str,
        client_type: str = "corporate",
        responsible_attorney: str = "",
        office: str = "Panama",
        matter_type: str = "incorporation",
        billing_method: str = "hourly",
    ) -> FileOpeningResult:
        """Open a new client/matter file in Aderant."""
        if self._use_soap:
            request = FileOpeningRequest(
                client_name=client_name,
                client_type=client_type,
                matter_description=matter_description,
                responsible_attorney=responsible_attorney,
                office=office,
                matter_type=matter_type,
                billing_method=billing_method,
            )
            return file_opening_svc.open_file(self._soap_client, request)

        return self._mock.open_file(
            client_name=client_name,
            client_type=client_type,
            matter_description=matter_description,
            responsible_attorney=responsible_attorney,
            office=office,
            matter_type=matter_type,
        )

    # ------------------------------------------------------------------
    # Client / Matter queries
    # ------------------------------------------------------------------

    def get_client(self, client_id: str) -> AderantClientData | None:
        if self._use_soap:
            result = self._soap_client.call("ClientService", "GetClient", ClientID=client_id)
            if not result:
                return None
            return AderantClientData(
                client_id=str(getattr(result, "ClientID", client_id)),
                name=str(getattr(result, "ClientName", "")),
                client_type=str(getattr(result, "ClientType", "corporate")),
                status=str(getattr(result, "Status", "active")),
            )
        return self._mock.get_client(client_id)

    def list_clients(self) -> list[AderantClientData]:
        if self._use_soap:
            result = self._soap_client.call("ClientService", "ListClients")
            items = getattr(result, "Client", []) if result else []
            if not isinstance(items, list):
                items = [items]
            return [
                AderantClientData(
                    client_id=str(getattr(item, "ClientID", "")),
                    name=str(getattr(item, "ClientName", "")),
                    client_type=str(getattr(item, "ClientType", "corporate")),
                )
                for item in items
            ]
        return self._mock.list_clients()

    def get_matter(self, matter_id: str) -> AderantMatterData | None:
        if self._use_soap:
            result = self._soap_client.call("MatterService", "GetMatter", MatterID=matter_id)
            if not result:
                return None
            return AderantMatterData(
                matter_id=str(getattr(result, "MatterID", matter_id)),
                client_id=str(getattr(result, "ClientID", "")),
                description=str(getattr(result, "Description", "")),
                status=str(getattr(result, "Status", "open")),
            )
        return self._mock.get_matter(matter_id)

    def list_matters(self, client_id: str | None = None) -> list[AderantMatterData]:
        if self._use_soap:
            kwargs = {}
            if client_id:
                kwargs["ClientID"] = client_id
            result = self._soap_client.call("MatterService", "ListMatters", **kwargs)
            items = getattr(result, "Matter", []) if result else []
            if not isinstance(items, list):
                items = [items]
            return [
                AderantMatterData(
                    matter_id=str(getattr(item, "MatterID", "")),
                    client_id=str(getattr(item, "ClientID", "")),
                    description=str(getattr(item, "Description", "")),
                    status=str(getattr(item, "Status", "open")),
                )
                for item in items
            ]
        return self._mock.list_matters(client_id)

    # ------------------------------------------------------------------
    # Billing
    # ------------------------------------------------------------------

    def post_time_entry(
        self,
        *,
        matter_id: str,
        attorney_id: str,
        hours: float,
        description: str,
        activity_code: str = "",
        entry_date=None,
    ) -> TimeEntryResult:
        if self._use_soap:
            entry = TimeEntry(
                matter_id=matter_id,
                attorney_id=attorney_id,
                hours=hours,
                description=description,
                activity_code=activity_code,
                entry_date=entry_date,
            )
            return billing_svc.post_time_entry(self._soap_client, entry)

        return self._mock.post_time_entry(
            matter_id=matter_id,
            attorney_id=attorney_id,
            hours=hours,
            description=description,
        )

    def get_invoices(self, client_id: str) -> list[InvoiceData]:
        if self._use_soap:
            return billing_svc.get_invoices(self._soap_client, client_id)
        return self._mock.get_invoices(client_id)

    # ------------------------------------------------------------------
    # Inquiries
    # ------------------------------------------------------------------

    def get_client_balance(self, client_id: str) -> ClientBalance:
        if self._use_soap:
            return inquiry_svc.get_client_balance(self._soap_client, client_id)
        return self._mock.get_client_balance(client_id)

    def get_matter_status(self, matter_id: str) -> MatterStatus | None:
        if self._use_soap:
            return inquiry_svc.get_matter_status(self._soap_client, matter_id)
        return self._mock.get_matter_status(matter_id)
