"""World-Check One API integration.

Uses HMAC authentication as required by the Refinitiv World-Check One API.
When credentials are not configured, returns mock screening data and logs a warning.
"""

import base64
import datetime
import hashlib
import hmac
import logging
import uuid

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Mock data returned when World-Check is not configured
# ---------------------------------------------------------------------------

_MOCK_SCREENING_CLEAR = {
    "caseSystemId": "mock-wc-{uid}",
    "results": [],
    "_mock": True,
    "_warning": (
        "World-Check API is not configured. Returning mock CLEAR result. "
        "Set WORLDCHECK_API_KEY, WORLDCHECK_API_SECRET, and WORLDCHECK_GROUP_ID "
        "in your .env to enable real screening."
    ),
}

_MOCK_SCREENING_MATCH = {
    "caseSystemId": "mock-wc-{uid}",
    "results": [
        {
            "referenceId": "mock-ref-001",
            "matchStrength": "EXACT",
            "matchedTerm": "SAMPLE MATCHED NAME",
            "submittedTerm": "",
            "matchedNameType": "PRIMARY",
            "primaryName": "SAMPLE MATCHED NAME",
            "category": "SANCTIONS",
            "categories": ["SANCTIONS", "PEP"],
            "events": [
                {
                    "type": "SANCTION",
                    "description": "Mock sanction entry - World-Check not configured",
                }
            ],
        }
    ],
    "_mock": True,
    "_warning": (
        "World-Check API is not configured. Returning mock MATCH result for "
        "demonstration purposes. Set WORLDCHECK_API_KEY, WORLDCHECK_API_SECRET, "
        "and WORLDCHECK_GROUP_ID in your .env to enable real screening."
    ),
}

_MOCK_CASE_DETAIL = {
    "caseId": "",
    "name": "MOCK CASE",
    "caseScreeningState": "INITIAL",
    "results": [],
    "_mock": True,
    "_warning": "World-Check API is not configured. Returning mock case detail.",
}


def _is_configured() -> bool:
    """Check whether World-Check API credentials are present."""
    return bool(
        getattr(settings, "WORLDCHECK_API_KEY", "")
        and getattr(settings, "WORLDCHECK_API_SECRET", "")
        and getattr(settings, "WORLDCHECK_GROUP_ID", "")
    )


class WorldCheckError(Exception):
    """Raised when a World-Check API call fails."""

    def __init__(self, message: str, status_code: int | None = None, response_body=None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.response_body = response_body


class WorldCheckClient:
    """Client for the Refinitiv World-Check One API v2.

    Authentication is performed via HMAC-SHA256 signatures on each request.
    If credentials are missing, all methods return mock data and log warnings.
    """

    def __init__(
        self,
        api_url: str | None = None,
        api_key: str | None = None,
        api_secret: str | None = None,
        group_id: str | None = None,
    ):
        self.api_url = (api_url or getattr(settings, "WORLDCHECK_API_URL", "")).rstrip("/")
        self.api_key = api_key or getattr(settings, "WORLDCHECK_API_KEY", "")
        self.api_secret = api_secret or getattr(settings, "WORLDCHECK_API_SECRET", "")
        self.group_id = group_id or getattr(settings, "WORLDCHECK_GROUP_ID", "")
        self._configured = bool(self.api_key and self.api_secret and self.group_id)

        if not self._configured:
            logger.warning(
                "World-Check API credentials are not configured. "
                "All screening requests will return mock data. "
                "Set WORLDCHECK_API_KEY, WORLDCHECK_API_SECRET, and "
                "WORLDCHECK_GROUP_ID in your .env file."
            )

        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json",
            "Accept": "application/json",
        })

    # ------------------------------------------------------------------
    # Auth helpers
    # ------------------------------------------------------------------

    def _generate_auth_headers(self, method: str, path: str, body: str = "") -> dict:
        """Generate HMAC-SHA256 authorization headers for a request."""
        timestamp = datetime.datetime.now(datetime.timezone.utc).strftime(
            "%a, %d %b %Y %H:%M:%S GMT"
        )

        data_to_sign = f"(request-target): {method.lower()} {path}\n"
        data_to_sign += f"host: {self._extract_host()}\n"
        data_to_sign += f"date: {timestamp}"

        if body:
            content_hash = base64.b64encode(
                hashlib.sha256(body.encode("utf-8")).digest()
            ).decode("utf-8")
            data_to_sign += f"\ncontent-type: application/json\n"
            data_to_sign += f"content-length: {len(body)}\n"
            data_to_sign += f"x-content-sha256: {content_hash}"

        hmac_signature = base64.b64encode(
            hmac.new(
                self.api_secret.encode("utf-8"),
                data_to_sign.encode("utf-8"),
                hashlib.sha256,
            ).digest()
        ).decode("utf-8")

        headers_list = "(request-target) host date"
        if body:
            headers_list += " content-type content-length x-content-sha256"

        auth_header = (
            f'Signature keyId="{self.api_key}",'
            f'algorithm="hmac-sha256",'
            f'headers="{headers_list}",'
            f'signature="{hmac_signature}"'
        )

        result = {
            "Authorization": auth_header,
            "Date": timestamp,
        }
        if body:
            result["x-content-sha256"] = base64.b64encode(
                hashlib.sha256(body.encode("utf-8")).digest()
            ).decode("utf-8")

        return result

    def _extract_host(self) -> str:
        """Extract hostname from the API URL."""
        from urllib.parse import urlparse

        parsed = urlparse(self.api_url)
        return parsed.hostname or ""

    def _request(self, method: str, path: str, json_body: dict | None = None) -> dict:
        """Make an authenticated request to the World-Check API."""
        import json as json_lib

        body_str = json_lib.dumps(json_body) if json_body else ""
        auth_headers = self._generate_auth_headers(method, path, body_str)

        url = f"{self.api_url}{path}"

        try:
            response = self.session.request(
                method=method.upper(),
                url=url,
                data=body_str if body_str else None,
                headers=auth_headers,
                timeout=30,
            )
        except requests.exceptions.RequestException as exc:
            logger.error("World-Check API request failed: %s", exc)
            raise WorldCheckError(f"Request to World-Check API failed: {exc}")

        if response.status_code >= 400:
            logger.error(
                "World-Check API error: %d %s",
                response.status_code,
                response.text[:500],
            )
            raise WorldCheckError(
                f"World-Check API returned {response.status_code}",
                status_code=response.status_code,
                response_body=response.text,
            )

        if response.status_code == 204:
            return {}

        try:
            return response.json()
        except ValueError:
            return {"raw": response.text}

    # ------------------------------------------------------------------
    # Public API methods
    # ------------------------------------------------------------------

    def screen_entity(
        self,
        name: str,
        entity_type: str = "INDIVIDUAL",
        **kwargs,
    ) -> dict:
        """Screen an entity against World-Check.

        If not configured, returns mock data (clear for most names,
        match if name contains 'SANCTION' or 'PEP' for testing).
        """
        if not self._configured:
            uid = str(uuid.uuid4())[:8]
            # For testing: names containing certain keywords trigger mock matches
            test_name = name.upper()
            if any(kw in test_name for kw in ("SANCTION", "PEP", "RISK", "MATCH")):
                mock = {**_MOCK_SCREENING_MATCH}
                mock["caseSystemId"] = f"mock-wc-{uid}"
                mock["results"][0]["submittedTerm"] = name
                logger.warning(
                    "World-Check NOT CONFIGURED - returning mock MATCH for '%s'", name
                )
                return mock
            else:
                mock = {**_MOCK_SCREENING_CLEAR}
                mock["caseSystemId"] = f"mock-wc-{uid}"
                logger.warning(
                    "World-Check NOT CONFIGURED - returning mock CLEAR for '%s'", name
                )
                return mock

        payload = {
            "groupId": self.group_id,
            "entityType": entity_type,
            "caseScreeningState": {"INITIAL"},
            "name": name,
            "providerTypes": ["WATCHLIST"],
        }

        secondary_fields = []
        if kwargs.get("date_of_birth"):
            secondary_fields.append({
                "typeId": "SFCT_1",
                "value": kwargs["date_of_birth"],
            })
        if kwargs.get("nationality"):
            secondary_fields.append({
                "typeId": "SFCT_5",
                "value": kwargs["nationality"],
            })
        if kwargs.get("country_of_residence"):
            secondary_fields.append({
                "typeId": "SFCT_6",
                "value": kwargs["country_of_residence"],
            })

        if secondary_fields:
            payload["secondaryFields"] = secondary_fields

        logger.info("Screening entity: name=%s type=%s", name, entity_type)
        result = self._request("POST", "/cases/screeningRequest", json_body=payload)
        return result

    def get_case(self, case_id: str) -> dict:
        """Retrieve details for an existing World-Check case."""
        if not self._configured:
            logger.warning("World-Check NOT CONFIGURED - returning mock case for '%s'", case_id)
            return {**_MOCK_CASE_DETAIL, "caseId": case_id}

        return self._request("GET", f"/cases/{case_id}")

    def resolve_case(self, case_id: str, resolution: str) -> dict:
        """Resolve a World-Check case with the given resolution status."""
        if not self._configured:
            logger.warning(
                "World-Check NOT CONFIGURED - mock resolving case '%s' as '%s'",
                case_id, resolution,
            )
            return {
                "caseId": case_id,
                "status": {"type": "RESOLVED", "reasonId": resolution},
                "_mock": True,
                "_warning": "World-Check API is not configured. Resolution was not sent.",
            }

        payload = {
            "status": {
                "type": "RESOLVED",
                "reasonId": resolution,
            }
        }

        logger.info("Resolving World-Check case %s as %s", case_id, resolution)
        return self._request("PUT", f"/cases/{case_id}", json_body=payload)
