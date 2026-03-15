"""Inquiry service for Aderant SOAP."""

import logging

from .client import AderantSOAPClient
from .models import ClientBalance, MatterStatus

logger = logging.getLogger(__name__)


def get_client_balance(soap_client: AderantSOAPClient, client_id: str) -> ClientBalance:
    """Get client trust/operating balances from Aderant."""
    result = soap_client.call(
        "InquiryService",
        "GetClientBalance",
        ClientID=client_id,
    )
    return ClientBalance(
        client_id=client_id,
        trust_balance=float(getattr(result, "TrustBalance", 0)),
        operating_balance=float(getattr(result, "OperatingBalance", 0)),
        unbilled_wip=float(getattr(result, "UnbilledWIP", 0)),
        outstanding_ar=float(getattr(result, "OutstandingAR", 0)),
        currency=str(getattr(result, "Currency", "USD")),
    )


def get_matter_status(soap_client: AderantSOAPClient, matter_id: str) -> MatterStatus:
    """Get matter financial status from Aderant."""
    result = soap_client.call(
        "InquiryService",
        "GetMatterStatus",
        MatterID=matter_id,
    )
    return MatterStatus(
        matter_id=matter_id,
        client_id=str(getattr(result, "ClientID", "")),
        description=str(getattr(result, "Description", "")),
        status=str(getattr(result, "Status", "open")),
        total_fees=float(getattr(result, "TotalFees", 0)),
        total_costs=float(getattr(result, "TotalCosts", 0)),
        unbilled_wip=float(getattr(result, "UnbilledWIP", 0)),
    )
