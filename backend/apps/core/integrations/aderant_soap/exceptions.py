"""Aderant SOAP integration exceptions."""


class AderantSOAPError(Exception):
    """Base exception for Aderant SOAP operations."""

    def __init__(self, message: str, fault_code: str | None = None, detail: str | None = None):
        super().__init__(message)
        self.message = message
        self.fault_code = fault_code
        self.detail = detail


class AderantAuthError(AderantSOAPError):
    """Authentication or authorization failure."""


class AderantConnectionError(AderantSOAPError):
    """Network or connectivity failure."""


class AderantValidationError(AderantSOAPError):
    """Aderant rejected the request due to invalid data."""
