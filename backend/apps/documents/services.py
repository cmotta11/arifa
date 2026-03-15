import io
import logging

from django.core.files.base import ContentFile
from django.db import transaction

from common.exceptions import ApplicationError

from .constants import DocumentFormat
from .models import DocumentTemplate, GeneratedDocument

logger = logging.getLogger(__name__)


@transaction.atomic
def create_template(
    *,
    name: str,
    file,
    entity_type: str = "",
    jurisdiction: str = "",
) -> DocumentTemplate:
    """Create a new document template."""
    template = DocumentTemplate.objects.create(
        name=name,
        file=file,
        entity_type=entity_type,
        jurisdiction=jurisdiction,
    )
    return template


@transaction.atomic
def generate_document(
    *,
    ticket_id,
    template_id,
    generated_by,
    context_data: dict | None = None,
) -> GeneratedDocument:
    """Generate a document from a template for the given ticket.

    Uses docxtpl to render the template with context_data if the library is
    available and context_data is provided. Otherwise, copies the template
    file as-is.
    """
    try:
        template = DocumentTemplate.objects.get(id=template_id)
    except DocumentTemplate.DoesNotExist:
        raise ApplicationError("Document template not found.")

    if not template.is_active:
        raise ApplicationError("Document template is not active.")

    # Try to render with docxtpl if context data is provided
    if context_data:
        try:
            from docxtpl import DocxTemplate

            template.file.seek(0)
            doc = DocxTemplate(template.file)
            doc.render(context_data)

            output_buffer = io.BytesIO()
            doc.save(output_buffer)
            output_buffer.seek(0)
            file_content = ContentFile(
                output_buffer.read(),
                name=f"{template.name}_{ticket_id}.docx",
            )
        except ImportError:
            logger.warning(
                "docxtpl not installed. Copying template file without rendering."
            )
            template.file.seek(0)
            file_content = ContentFile(
                template.file.read(),
                name=f"{template.name}_{ticket_id}.docx",
            )
    else:
        # No context data: copy the template file as-is
        template.file.seek(0)
        file_content = ContentFile(
            template.file.read(),
            name=f"{template.name}_{ticket_id}.docx",
        )

    document = GeneratedDocument.objects.create(
        ticket_id=ticket_id,
        template=template,
        generated_file=file_content,
        format=DocumentFormat.DOCX,
        generated_by=generated_by,
    )
    return document


@transaction.atomic
def assemble_document(
    *,
    ticket_id,
    builder_name: str,
    context_data: dict,
    generated_by,
) -> GeneratedDocument:
    """Use a registered builder to assemble a document.

    1. Look up the builder in the registry by *builder_name*.
    2. Validate the supplied *context_data*.
    3. Build the DOCX bytes.
    4. Persist the result as a :class:`GeneratedDocument`.
    """
    from .builders import DocumentBuilderRegistry

    builder = DocumentBuilderRegistry.get(builder_name)
    builder.validate_context(context_data)
    docx_bytes = builder.build(context_data)

    entity_name = context_data.get("entity_name", "document")
    # Sanitise the entity name for use in filenames
    safe_entity = "".join(
        c if c.isalnum() or c in (" ", "-", "_") else "_" for c in entity_name
    ).strip()
    filename = f"{safe_entity}_{builder_name}_{ticket_id}.docx"

    file_content = ContentFile(docx_bytes, name=filename)

    document = GeneratedDocument.objects.create(
        ticket_id=ticket_id,
        template=None,  # assembled documents do not use a stored template
        generated_file=file_content,
        format=DocumentFormat.DOCX,
        generated_by=generated_by,
    )

    logger.info(
        "Assembled document '%s' (builder=%s) for ticket %s -> doc %s",
        filename,
        builder_name,
        ticket_id,
        document.id,
    )
    return document


def get_document_download_url(*, document_id) -> str:
    """Return the URL for downloading a generated document."""
    try:
        document = GeneratedDocument.objects.get(id=document_id)
    except GeneratedDocument.DoesNotExist:
        raise ApplicationError("Generated document not found.")

    return document.generated_file.url
