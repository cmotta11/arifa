"""File opening service for Aderant SOAP."""

import logging

from .client import AderantSOAPClient
from .models import FileOpeningRequest, FileOpeningResult

logger = logging.getLogger(__name__)


def open_file(soap_client: AderantSOAPClient, request: FileOpeningRequest) -> FileOpeningResult:
    """Open a new client/matter file via SOAP.

    Creates both a client record and matter record in Aderant Expert,
    returning the generated IDs for linking back to ARIFA.
    """
    # Step 1: Create client
    client_result = soap_client.call(
        "ClientService",
        "CreateClient",
        ClientName=request.client_name,
        ClientType=request.client_type,
        ResponsibleAttorney=request.responsible_attorney,
        Office=request.office,
    )
    client_id = str(getattr(client_result, "ClientID", client_result))

    # Step 2: Create matter
    matter_result = soap_client.call(
        "MatterService",
        "CreateMatter",
        ClientID=client_id,
        Description=request.matter_description,
        MatterType=request.matter_type,
        BillingMethod=request.billing_method,
        ResponsibleAttorney=request.responsible_attorney,
    )
    matter_id = str(getattr(matter_result, "MatterID", matter_result))

    logger.info("Aderant file opened: client=%s matter=%s", client_id, matter_id)

    return FileOpeningResult(
        client_id=client_id,
        matter_id=matter_id,
        client_name=request.client_name,
        matter_description=request.matter_description,
        is_mock=False,
    )
