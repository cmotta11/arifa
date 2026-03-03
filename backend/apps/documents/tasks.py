import logging

from celery import shared_task
from django.core.files.base import ContentFile

from .constants import DocumentFormat

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def generate_document_async(self, ticket_id, template_id, user_id):
    """Asynchronously generate a document from a template.

    Calls the generate_document service and returns the document ID.
    """
    from django.apps import apps
    from django.conf import settings

    from .services import generate_document

    UserModel = apps.get_model(settings.AUTH_USER_MODEL)

    try:
        user = UserModel.objects.get(id=user_id)
    except UserModel.DoesNotExist:
        logger.error("User %s not found for document generation.", user_id)
        raise

    try:
        document = generate_document(
            ticket_id=ticket_id,
            template_id=template_id,
            generated_by=user,
        )
        logger.info("Document %s generated successfully.", document.id)
        return str(document.id)
    except Exception as exc:
        logger.error(
            "Document generation failed for ticket %s: %s", ticket_id, exc
        )
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def convert_to_pdf_async(self, document_id):
    """Convert a DOCX document to PDF using Gotenberg.

    Reads the generated DOCX file, sends it to the Gotenberg service,
    and stores the resulting PDF as a new GeneratedDocument or updates
    the existing one.
    """
    from .integrations.gotenberg import GotenbergClient
    from .models import GeneratedDocument

    try:
        document = GeneratedDocument.objects.select_related("template").get(
            id=document_id
        )
    except GeneratedDocument.DoesNotExist:
        logger.error("Document %s not found for PDF conversion.", document_id)
        raise

    if document.format == DocumentFormat.PDF:
        logger.info("Document %s is already PDF. Skipping conversion.", document_id)
        return str(document.id)

    try:
        client = GotenbergClient()
        document.generated_file.seek(0)
        docx_bytes = document.generated_file.read()

        pdf_bytes = client.convert_docx_to_pdf(docx_bytes)

        # Determine the PDF filename
        original_name = document.generated_file.name.split("/")[-1]
        pdf_name = original_name.rsplit(".", 1)[0] + ".pdf"

        # Create a new GeneratedDocument for the PDF
        pdf_document = GeneratedDocument.objects.create(
            ticket=document.ticket,
            template=document.template,
            generated_file=ContentFile(pdf_bytes, name=pdf_name),
            format=DocumentFormat.PDF,
            generated_by=document.generated_by,
        )
        logger.info(
            "PDF document %s created from DOCX document %s.",
            pdf_document.id,
            document_id,
        )
        return str(pdf_document.id)
    except Exception as exc:
        logger.error(
            "PDF conversion failed for document %s: %s", document_id, exc
        )
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def upload_to_sharepoint(self, document_id):
    """Upload a generated document to SharePoint for archival.

    Uses the Microsoft Graph API to upload the file to the configured
    SharePoint drive and stores the resulting file ID on the document.
    """
    import requests
    from django.conf import settings

    from .models import GeneratedDocument

    try:
        document = GeneratedDocument.objects.get(id=document_id)
    except GeneratedDocument.DoesNotExist:
        logger.error("Document %s not found for SharePoint upload.", document_id)
        raise

    # Obtain an access token using client credentials
    token_url = (
        f"https://login.microsoftonline.com/"
        f"{settings.SHAREPOINT_TENANT_ID}/oauth2/v2.0/token"
    )
    token_data = {
        "grant_type": "client_credentials",
        "client_id": settings.SHAREPOINT_CLIENT_ID,
        "client_secret": settings.SHAREPOINT_CLIENT_SECRET,
        "scope": "https://graph.microsoft.com/.default",
    }

    try:
        token_response = requests.post(token_url, data=token_data, timeout=30)
        token_response.raise_for_status()
        access_token = token_response.json()["access_token"]
    except requests.RequestException as exc:
        logger.error("Failed to obtain SharePoint access token: %s", exc)
        raise self.retry(exc=exc)

    # Upload the file
    filename = document.generated_file.name.split("/")[-1]
    upload_url = (
        f"https://graph.microsoft.com/v1.0/drives/"
        f"{settings.SHAREPOINT_DRIVE_ID}/root:/"
        f"{settings.SHAREPOINT_ROOT_FOLDER}/{filename}:/content"
    )
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/octet-stream",
    }

    try:
        document.generated_file.seek(0)
        file_bytes = document.generated_file.read()

        upload_response = requests.put(
            upload_url,
            headers=headers,
            data=file_bytes,
            timeout=120,
        )
        upload_response.raise_for_status()

        sharepoint_file_id = upload_response.json().get("id", "")
        document.sharepoint_file_id = sharepoint_file_id
        document.save(update_fields=["sharepoint_file_id", "updated_at"])

        logger.info(
            "Document %s uploaded to SharePoint with file ID %s.",
            document_id,
            sharepoint_file_id,
        )
        return sharepoint_file_id
    except requests.RequestException as exc:
        logger.error(
            "SharePoint upload failed for document %s: %s", document_id, exc
        )
        raise self.retry(exc=exc)
