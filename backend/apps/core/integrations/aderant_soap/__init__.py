"""Aderant SOAP adapter for ERP integration.

Provides SOAP-based communication with Aderant Expert for:
- Client/Matter file opening
- Billing and time entry
- General inquiries

When SOAP credentials are not configured, all methods fall back to mock
data via the AderantHarness facade.
"""

from .harness import AderantHarness
from .exceptions import AderantSOAPError

__all__ = ["AderantHarness", "AderantSOAPError"]
