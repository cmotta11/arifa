"""Low-level SOAP client for Aderant Expert.

Uses zeep with NTLM authentication. This module is only imported when
SOAP credentials are configured — the harness handles fallback to mock.
"""

import logging
from typing import Any

from django.conf import settings

from .exceptions import AderantAuthError, AderantConnectionError, AderantSOAPError

logger = logging.getLogger(__name__)


class AderantSOAPClient:
    """Thin wrapper around zeep for Aderant WSDL communication."""

    def __init__(
        self,
        wsdl_url: str | None = None,
        username: str | None = None,
        password: str | None = None,
        domain: str | None = None,
    ):
        self.wsdl_url = wsdl_url or getattr(settings, "ADERANT_SOAP_WSDL_URL", "")
        self.username = username or getattr(settings, "ADERANT_SOAP_USERNAME", "")
        self.password = password or getattr(settings, "ADERANT_SOAP_PASSWORD", "")
        self.domain = domain or getattr(settings, "ADERANT_SOAP_DOMAIN", "")
        self._client = None

    def _get_client(self):
        """Lazily initialize the zeep SOAP client with NTLM auth."""
        if self._client is not None:
            return self._client

        try:
            from requests import Session
            from requests_ntlm import HttpNtlmAuth
            from zeep import Client
            from zeep.transports import Transport
        except ImportError as exc:
            raise AderantSOAPError(
                "zeep and requests-ntlm are required for SOAP integration. "
                "Install with: pip install zeep requests-ntlm"
            ) from exc

        session = Session()
        session.auth = HttpNtlmAuth(
            f"{self.domain}\\{self.username}" if self.domain else self.username,
            self.password,
        )
        transport = Transport(session=session, timeout=30, operation_timeout=30)

        try:
            self._client = Client(self.wsdl_url, transport=transport)
            logger.info("Aderant SOAP client connected to %s", self.wsdl_url)
        except Exception as exc:
            logger.error("Failed to connect to Aderant SOAP: %s", exc)
            raise AderantConnectionError(f"Failed to connect to Aderant SOAP: {exc}") from exc

        return self._client

    def call(self, service_name: str, operation: str, **kwargs) -> Any:
        """Invoke a SOAP operation.

        Args:
            service_name: The WSDL service name (e.g., "ClientService").
            operation: The operation/method name (e.g., "CreateClient").
            **kwargs: Arguments passed to the SOAP operation.

        Returns:
            The deserialized SOAP response.
        """
        client = self._get_client()
        try:
            service = getattr(client.service, operation, None)
            if service is None:
                raise AderantSOAPError(
                    f"Operation '{operation}' not found in WSDL service"
                )
            logger.debug("SOAP call: %s.%s(%s)", service_name, operation, list(kwargs.keys()))
            result = service(**kwargs)
            return result
        except AderantSOAPError:
            raise
        except Exception as exc:
            fault_code = getattr(exc, "code", None)
            detail = str(exc)
            if "401" in detail or "403" in detail or "Unauthorized" in detail:
                raise AderantAuthError(
                    f"Authentication failed for {operation}: {exc}",
                    fault_code=fault_code,
                ) from exc
            logger.error("SOAP call %s failed: %s", operation, exc)
            raise AderantSOAPError(
                f"SOAP operation '{operation}' failed: {exc}",
                fault_code=fault_code,
                detail=detail,
            ) from exc
