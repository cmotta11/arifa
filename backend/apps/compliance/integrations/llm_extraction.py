"""LLM-based document data extraction integration.

Sends document images to an LLM API endpoint that returns structured
data extracted from identity documents, corporate registries, etc.

When LLM API credentials are not configured, returns realistic mock
extraction data and logs a warning to the user.
"""

import base64
import logging
import random
import uuid

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def _is_configured() -> bool:
    """Check whether LLM API credentials are present."""
    return bool(
        getattr(settings, "LLM_API_KEY", "")
        and getattr(settings, "LLM_API_URL", "")
    )


class LLMExtractionError(Exception):
    """Raised when the LLM extraction API call fails."""

    def __init__(self, message: str, status_code: int | None = None, response_body=None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.response_body = response_body


# ---------------------------------------------------------------------------
# Prompt templates per document type
# ---------------------------------------------------------------------------

_EXTRACTION_PROMPTS = {
    "passport": (
        "Extract the following fields from this passport image: "
        "full_name, date_of_birth, nationality, passport_number, "
        "expiry_date, issuing_country, gender, place_of_birth. "
        "Return the result as a JSON object. If a field is not "
        "visible or legible, set it to null."
    ),
    "cedula": (
        "Extract the following fields from this national ID card (cedula): "
        "full_name, date_of_birth, cedula_number, nationality, "
        "expiry_date, gender, address. "
        "Return the result as a JSON object."
    ),
    "utility_bill": (
        "Extract the following fields from this utility bill: "
        "account_holder_name, address, utility_provider, "
        "bill_date, amount_due, account_number. "
        "Return the result as a JSON object."
    ),
    "corporate_registry": (
        "Extract the following fields from this corporate registry document: "
        "company_name, registration_number, incorporation_date, "
        "jurisdiction, registered_address, directors (as a list of names), "
        "shareholders (as a list of names with ownership percentages), "
        "company_status. Return the result as a JSON object."
    ),
    "proof_of_address": (
        "Extract the following fields from this proof of address document: "
        "resident_name, address, document_type, document_date, "
        "issuing_entity. Return the result as a JSON object."
    ),
    "source_of_wealth": (
        "Extract the following fields from this source of wealth document: "
        "individual_name, declared_sources (list), estimated_amounts, "
        "supporting_details, document_date. "
        "Return the result as a JSON object."
    ),
    "other": (
        "Extract all visible text and data from this document image. "
        "Organize the extracted information as a structured JSON object "
        "with descriptive keys."
    ),
}

# ---------------------------------------------------------------------------
# Mock extraction data returned when LLM API is not configured
# ---------------------------------------------------------------------------

_MOCK_DATA = {
    "passport": {
        "full_name": "Maria Elena Rodriguez Garcia",
        "date_of_birth": "1985-03-15",
        "nationality": "Panamanian",
        "passport_number": "PE1234567",
        "expiry_date": "2029-03-14",
        "issuing_country": "Panama",
        "gender": "Female",
        "place_of_birth": "Panama City",
    },
    "cedula": {
        "full_name": "Carlos Alberto Mendez Ruiz",
        "date_of_birth": "1978-07-22",
        "cedula_number": "8-123-4567",
        "nationality": "Panamanian",
        "expiry_date": "2030-07-21",
        "gender": "Male",
        "address": "Calle 50, Edificio Global, Apto 12B, Panama City",
    },
    "utility_bill": {
        "account_holder_name": "Maria Elena Rodriguez Garcia",
        "address": "Calle 50, Edificio Global, Apto 12B, Panama City, Panama",
        "utility_provider": "Naturgy Panama",
        "bill_date": "2024-11-01",
        "amount_due": "45.80",
        "account_number": "UTL-2024-789012",
    },
    "corporate_registry": {
        "company_name": "Global Trade Holdings Ltd.",
        "registration_number": "BVI-2024-001234",
        "incorporation_date": "2024-01-15",
        "jurisdiction": "British Virgin Islands",
        "registered_address": "Craigmuir Chambers, Road Town, Tortola, BVI",
        "directors": ["Maria Elena Rodriguez Garcia", "Carlos Alberto Mendez Ruiz"],
        "shareholders": [
            {"name": "Maria Elena Rodriguez Garcia", "ownership_percentage": 60},
            {"name": "Carlos Alberto Mendez Ruiz", "ownership_percentage": 40},
        ],
        "company_status": "Active",
    },
    "proof_of_address": {
        "resident_name": "Maria Elena Rodriguez Garcia",
        "address": "Calle 50, Edificio Global, Apto 12B, Panama City, Panama",
        "document_type": "Bank Statement",
        "document_date": "2024-10-31",
        "issuing_entity": "Banco General Panama",
    },
    "source_of_wealth": {
        "individual_name": "Maria Elena Rodriguez Garcia",
        "declared_sources": ["Employment Income", "Investment Returns", "Real Estate Rental"],
        "estimated_amounts": {"annual_income": "250000", "net_worth": "1500000"},
        "supporting_details": "Senior executive at international trading company.",
        "document_date": "2024-09-15",
    },
    "other": {
        "document_title": "Sample Document",
        "content_summary": "This is mock extracted content.",
        "date_found": "2024-01-01",
        "entities_mentioned": ["Sample Corp", "John Doe"],
    },
}


class LLMExtractionClient:
    """Client for extracting structured data from document images via an LLM API.

    If LLM API credentials are not configured, returns realistic mock data
    and logs a warning.
    """

    def __init__(
        self,
        api_url: str | None = None,
        api_key: str | None = None,
    ):
        self.api_url = (api_url or getattr(settings, "LLM_API_URL", "")).rstrip("/")
        self.api_key = api_key or getattr(settings, "LLM_API_KEY", "")
        self._configured = bool(self.api_url and self.api_key)

        if not self._configured:
            logger.warning(
                "LLM API credentials are not configured. "
                "Document extraction will return mock data. "
                "Set LLM_API_KEY and LLM_API_URL in your .env file."
            )
        else:
            self.session = requests.Session()
            self.session.headers.update({
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            })

    def extract_from_image(
        self,
        image_bytes: bytes,
        document_type: str,
    ) -> dict:
        """Send a document image to the LLM API for structured data extraction.

        If not configured, returns mock data appropriate to the document type.
        """
        if not self._configured:
            return self._mock_extract(image_bytes, document_type)

        return self._real_extract(image_bytes, document_type)

    def _mock_extract(self, image_bytes: bytes, document_type: str) -> dict:
        """Return realistic mock extraction data."""
        base_data = _MOCK_DATA.get(document_type, _MOCK_DATA["other"]).copy()

        # Add slight randomization to make each call unique
        base_data["_extraction_id"] = str(uuid.uuid4())[:8]
        base_data["_confidence"] = round(random.uniform(0.85, 0.99), 2)
        base_data["_mock"] = True
        base_data["_warning"] = (
            f"LLM API is not configured. Returning mock {document_type} extraction data. "
            "Set LLM_API_KEY and LLM_API_URL in your .env for real extraction."
        )

        logger.warning(
            "LLM API NOT CONFIGURED - returning mock extraction for %s document (%d bytes)",
            document_type,
            len(image_bytes),
        )
        return base_data

    def _real_extract(self, image_bytes: bytes, document_type: str) -> dict:
        """Perform real LLM extraction."""
        prompt = _EXTRACTION_PROMPTS.get(
            document_type,
            _EXTRACTION_PROMPTS["other"],
        )

        image_b64 = base64.b64encode(image_bytes).decode("utf-8")

        payload = {
            "model": "gpt-4o",
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a document data extraction assistant. "
                        "You receive images of identity documents, corporate "
                        "registries, utility bills, and similar documents. "
                        "Your task is to extract structured data and return "
                        "it as a valid JSON object. Never fabricate data; "
                        "if a field is not visible, return null for that field."
                    ),
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_b64}",
                            },
                        },
                    ],
                },
            ],
            "response_format": {"type": "json_object"},
            "max_tokens": 2000,
            "temperature": 0.0,
        }

        logger.info(
            "Sending %s document (%d bytes) for LLM extraction",
            document_type,
            len(image_bytes),
        )

        try:
            response = self.session.post(
                f"{self.api_url}/chat/completions",
                json=payload,
                timeout=120,
            )
        except requests.exceptions.RequestException as exc:
            logger.error("LLM API request failed: %s", exc)
            raise LLMExtractionError(f"LLM API request failed: {exc}")

        if response.status_code >= 400:
            logger.error(
                "LLM API error: %d %s",
                response.status_code,
                response.text[:500],
            )
            raise LLMExtractionError(
                f"LLM API returned {response.status_code}",
                status_code=response.status_code,
                response_body=response.text,
            )

        try:
            api_response = response.json()
        except ValueError as exc:
            raise LLMExtractionError(f"Invalid JSON in LLM response: {exc}")

        try:
            content = api_response["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as exc:
            raise LLMExtractionError(
                f"Unexpected LLM response structure: {exc}",
                response_body=api_response,
            )

        import json

        try:
            extracted_data = json.loads(content)
        except json.JSONDecodeError as exc:
            logger.warning(
                "LLM returned non-JSON content for %s: %s",
                document_type,
                content[:200],
            )
            extracted_data = {"raw_text": content, "parse_error": str(exc)}

        logger.info(
            "LLM extraction completed for %s document: %d fields extracted",
            document_type,
            len(extracted_data),
        )
        return extracted_data
