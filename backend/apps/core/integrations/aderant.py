"""Aderant ERP integration stub.

Provides client/matter synchronization with the Aderant practice
management system. When Aderant API credentials are not configured,
all methods return mock data and log warnings.

To enable real integration, set the following in your .env:
  ADERANT_API_URL=https://your-aderant-instance/api
  ADERANT_API_KEY=your-api-key
  ADERANT_API_SECRET=your-api-secret
"""

import logging
import uuid

from django.conf import settings

logger = logging.getLogger(__name__)


def _is_configured() -> bool:
    """Check whether Aderant ERP credentials are present."""
    return bool(
        getattr(settings, "ADERANT_API_URL", "")
        and getattr(settings, "ADERANT_API_KEY", "")
    )


# ---------------------------------------------------------------------------
# Mock data
# ---------------------------------------------------------------------------

_MOCK_CLIENTS = [
    {
        "aderant_client_id": "ADR-C-001",
        "name": "Global Trade Holdings Ltd.",
        "client_type": "corporate",
        "category": "gold",
        "status": "active",
    },
    {
        "aderant_client_id": "ADR-C-002",
        "name": "Maria Elena Rodriguez Garcia",
        "client_type": "natural",
        "category": "silver",
        "status": "active",
    },
    {
        "aderant_client_id": "ADR-C-003",
        "name": "Caribbean Investments Corp.",
        "client_type": "corporate",
        "category": "platinum",
        "status": "active",
    },
]

_MOCK_MATTERS = [
    {
        "aderant_matter_id": "ADR-M-001",
        "client_aderant_id": "ADR-C-001",
        "description": "Incorporation - BVI Company",
        "status": "open",
        "opened_date": "2024-01-15",
    },
    {
        "aderant_matter_id": "ADR-M-002",
        "client_aderant_id": "ADR-C-001",
        "description": "Annual Compliance Review 2024",
        "status": "open",
        "opened_date": "2024-06-01",
    },
    {
        "aderant_matter_id": "ADR-M-003",
        "client_aderant_id": "ADR-C-002",
        "description": "Incorporation - Panama Foundation",
        "status": "open",
        "opened_date": "2024-03-10",
    },
]


class AderantError(Exception):
    """Raised when an Aderant API call fails."""

    def __init__(self, message: str, status_code: int | None = None, response_body=None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.response_body = response_body


class AderantClient:
    """Client for the Aderant ERP practice management system.

    If credentials are not configured, all methods return mock data
    and log warnings so the platform can function standalone.
    """

    def __init__(
        self,
        api_url: str | None = None,
        api_key: str | None = None,
        api_secret: str | None = None,
    ):
        self.api_url = (api_url or getattr(settings, "ADERANT_API_URL", "")).rstrip("/")
        self.api_key = api_key or getattr(settings, "ADERANT_API_KEY", "")
        self.api_secret = api_secret or getattr(settings, "ADERANT_API_SECRET", "")
        self._configured = bool(self.api_url and self.api_key)

        if not self._configured:
            logger.warning(
                "Aderant ERP credentials are not configured. "
                "Client/matter sync will use mock data. "
                "Set ADERANT_API_URL and ADERANT_API_KEY in your .env file."
            )

    def _request(self, method: str, path: str, **kwargs) -> dict:
        """Make an authenticated request to the Aderant API."""
        import requests

        url = f"{self.api_url}{path}"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        try:
            response = requests.request(
                method, url, headers=headers, timeout=30, **kwargs,
            )
        except requests.exceptions.RequestException as exc:
            logger.error("Aderant API request failed: %s", exc)
            raise AderantError(f"Aderant API request failed: {exc}")

        if response.status_code >= 400:
            logger.error(
                "Aderant API error: %d %s",
                response.status_code,
                response.text[:500],
            )
            raise AderantError(
                f"Aderant API returned {response.status_code}",
                status_code=response.status_code,
                response_body=response.text,
            )

        return response.json() if response.content else {}

    # ------------------------------------------------------------------
    # Client operations
    # ------------------------------------------------------------------

    def get_clients(self) -> list[dict]:
        """Fetch all clients from Aderant.

        Returns list of dicts with: aderant_client_id, name, client_type,
        category, status.
        """
        if not self._configured:
            logger.warning(
                "Aderant NOT CONFIGURED - returning %d mock clients",
                len(_MOCK_CLIENTS),
            )
            return [
                {**c, "_mock": True, "_warning": "Aderant ERP is not configured."}
                for c in _MOCK_CLIENTS
            ]

        result = self._request("GET", "/clients")
        return result.get("data", [])

    def get_client(self, aderant_client_id: str) -> dict | None:
        """Fetch a single client by Aderant ID."""
        if not self._configured:
            for c in _MOCK_CLIENTS:
                if c["aderant_client_id"] == aderant_client_id:
                    logger.warning(
                        "Aderant NOT CONFIGURED - returning mock client '%s'",
                        aderant_client_id,
                    )
                    return {**c, "_mock": True}
            return None

        result = self._request("GET", f"/clients/{aderant_client_id}")
        return result.get("data")

    def create_client(self, client_data: dict) -> dict:
        """Create a new client in Aderant."""
        if not self._configured:
            mock_id = f"ADR-C-{uuid.uuid4().hex[:6].upper()}"
            logger.warning(
                "Aderant NOT CONFIGURED - mock creating client with ID '%s'",
                mock_id,
            )
            return {
                "aderant_client_id": mock_id,
                **client_data,
                "_mock": True,
                "_warning": "Aderant ERP is not configured. Client was not synced.",
            }

        result = self._request("POST", "/clients", json=client_data)
        return result.get("data", {})

    # ------------------------------------------------------------------
    # Matter operations
    # ------------------------------------------------------------------

    def get_matters(self, aderant_client_id: str | None = None) -> list[dict]:
        """Fetch matters from Aderant, optionally filtered by client."""
        if not self._configured:
            matters = _MOCK_MATTERS
            if aderant_client_id:
                matters = [
                    m for m in matters
                    if m["client_aderant_id"] == aderant_client_id
                ]
            logger.warning(
                "Aderant NOT CONFIGURED - returning %d mock matters",
                len(matters),
            )
            return [
                {**m, "_mock": True, "_warning": "Aderant ERP is not configured."}
                for m in matters
            ]

        params = {}
        if aderant_client_id:
            params["client_id"] = aderant_client_id
        result = self._request("GET", "/matters", params=params)
        return result.get("data", [])

    def get_matter(self, aderant_matter_id: str) -> dict | None:
        """Fetch a single matter by Aderant ID."""
        if not self._configured:
            for m in _MOCK_MATTERS:
                if m["aderant_matter_id"] == aderant_matter_id:
                    logger.warning(
                        "Aderant NOT CONFIGURED - returning mock matter '%s'",
                        aderant_matter_id,
                    )
                    return {**m, "_mock": True}
            return None

        result = self._request("GET", f"/matters/{aderant_matter_id}")
        return result.get("data")

    def create_matter(self, matter_data: dict) -> dict:
        """Create a new matter in Aderant."""
        if not self._configured:
            mock_id = f"ADR-M-{uuid.uuid4().hex[:6].upper()}"
            logger.warning(
                "Aderant NOT CONFIGURED - mock creating matter with ID '%s'",
                mock_id,
            )
            return {
                "aderant_matter_id": mock_id,
                **matter_data,
                "_mock": True,
                "_warning": "Aderant ERP is not configured. Matter was not synced.",
            }

        result = self._request("POST", "/matters", json=matter_data)
        return result.get("data", {})

    # ------------------------------------------------------------------
    # Sync operations
    # ------------------------------------------------------------------

    def sync_client_to_arifa(self, aderant_client_id: str) -> dict:
        """Fetch a client from Aderant and return data ready for ARIFA import.

        Returns a dict compatible with core.services.create_client().
        """
        client_data = self.get_client(aderant_client_id)
        if not client_data:
            raise AderantError(f"Client '{aderant_client_id}' not found in Aderant.")

        return {
            "aderant_client_id": client_data.get("aderant_client_id", aderant_client_id),
            "name": client_data.get("name", ""),
            "client_type": client_data.get("client_type", "corporate"),
            "category": client_data.get("category", "silver"),
        }

    def sync_matter_to_arifa(self, aderant_matter_id: str) -> dict:
        """Fetch a matter from Aderant and return data ready for ARIFA import.

        Returns a dict compatible with core.services.create_matter().
        """
        matter_data = self.get_matter(aderant_matter_id)
        if not matter_data:
            raise AderantError(f"Matter '{aderant_matter_id}' not found in Aderant.")

        return {
            "aderant_matter_id": matter_data.get("aderant_matter_id", aderant_matter_id),
            "description": matter_data.get("description", ""),
        }
