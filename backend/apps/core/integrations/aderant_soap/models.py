"""Pydantic models for Aderant SOAP request/response data.

These models are used for serialization between our Django models
and the SOAP API payloads. No Django ORM references allowed here.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Client / Matter
# ---------------------------------------------------------------------------


class AderantClientData(BaseModel):
    client_id: str = Field(description="Aderant client number")
    name: str
    client_type: str = "corporate"
    category: str = "silver"
    status: str = "active"
    responsible_attorney: Optional[str] = None
    office: Optional[str] = None


class AderantMatterData(BaseModel):
    matter_id: str = Field(description="Aderant matter number")
    client_id: str
    description: str
    status: str = "open"
    opened_date: Optional[date] = None
    responsible_attorney: Optional[str] = None
    matter_type: Optional[str] = None
    office: Optional[str] = None


class FileOpeningRequest(BaseModel):
    """Data required to open a new client/matter file in Aderant."""

    client_name: str
    client_type: str = "corporate"
    matter_description: str
    responsible_attorney: str = ""
    office: str = "Panama"
    matter_type: str = "incorporation"
    billing_method: str = "hourly"


class FileOpeningResult(BaseModel):
    client_id: str
    matter_id: str
    client_name: str
    matter_description: str
    is_mock: bool = False


# ---------------------------------------------------------------------------
# Billing
# ---------------------------------------------------------------------------


class TimeEntry(BaseModel):
    matter_id: str
    attorney_id: str
    hours: float
    description: str
    activity_code: str = ""
    entry_date: Optional[date] = None
    rate: Optional[float] = None


class TimeEntryResult(BaseModel):
    entry_id: str
    matter_id: str
    hours: float
    status: str = "posted"
    is_mock: bool = False


class InvoiceData(BaseModel):
    invoice_id: str
    matter_id: str
    client_id: str
    amount: float
    currency: str = "USD"
    status: str = "draft"
    issued_date: Optional[date] = None
    due_date: Optional[date] = None


# ---------------------------------------------------------------------------
# Inquiry
# ---------------------------------------------------------------------------


class ClientBalance(BaseModel):
    client_id: str
    trust_balance: float = 0.0
    operating_balance: float = 0.0
    unbilled_wip: float = 0.0
    outstanding_ar: float = 0.0
    currency: str = "USD"


class MatterStatus(BaseModel):
    matter_id: str
    client_id: str
    description: str
    status: str
    total_fees: float = 0.0
    total_costs: float = 0.0
    unbilled_wip: float = 0.0
    last_billing_date: Optional[date] = None
