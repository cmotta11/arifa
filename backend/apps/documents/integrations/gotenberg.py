"""Gotenberg document conversion API integration.

Gotenberg is a Docker-based API for converting documents to PDF.
When Gotenberg is not running or not configured, returns a placeholder
PDF and logs a warning.
"""

import logging

from django.conf import settings

logger = logging.getLogger(__name__)

# Minimal valid PDF for mock responses (single blank page)
_MOCK_PDF = (
    b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R"
    b"/Resources<<>>>>endobj\n"
    b"xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n"
    b"0000000058 00000 n \n0000000115 00000 n \n"
    b"trailer<</Size 4/Root 1 0 R>>\nstartxref\n206\n%%EOF\n"
)


def _is_configured() -> bool:
    """Check whether Gotenberg URL is configured and reachable."""
    url = getattr(settings, "GOTENBERG_URL", "")
    return bool(url) and url != "http://gotenberg:3000"


class GotenbergClient:
    """Client for the Gotenberg document conversion API.

    If Gotenberg is not available, returns a placeholder PDF and logs a warning.
    """

    def __init__(self, base_url: str | None = None):
        self.base_url = (base_url or getattr(settings, "GOTENBERG_URL", "")).rstrip("/")
        self._configured = bool(self.base_url)

    def convert_docx_to_pdf(self, file_bytes: bytes) -> bytes:
        """Convert a DOCX file to PDF using Gotenberg's LibreOffice route.

        If Gotenberg is not available, returns a minimal placeholder PDF.
        """
        if not self._configured:
            logger.warning(
                "Gotenberg URL is not configured. "
                "Returning placeholder PDF. "
                "Set GOTENBERG_URL in your .env and enable the gotenberg "
                "service in docker-compose.yml."
            )
            return _MOCK_PDF

        import requests

        url = f"{self.base_url}/forms/libreoffice/convert"
        files = {
            "files": (
                "document.docx",
                file_bytes,
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ),
        }

        logger.info("Sending DOCX to Gotenberg for conversion at %s", url)

        try:
            response = requests.post(url, files=files, timeout=120)
            response.raise_for_status()
        except requests.exceptions.ConnectionError:
            logger.warning(
                "Gotenberg service is not reachable at %s. "
                "Returning placeholder PDF. Make sure the gotenberg "
                "service is running in docker-compose.",
                self.base_url,
            )
            return _MOCK_PDF
        except requests.exceptions.RequestException as exc:
            logger.error("Gotenberg conversion failed: %s", exc)
            raise

        logger.info(
            "Gotenberg conversion successful. Received %d bytes.",
            len(response.content),
        )
        return response.content
