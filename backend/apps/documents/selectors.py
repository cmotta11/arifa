from django.db.models import QuerySet

from .models import DocumentTemplate, GeneratedDocument


def get_active_templates(
    *,
    entity_type: str | None = None,
    jurisdiction: str | None = None,
) -> QuerySet[DocumentTemplate]:
    """Return active templates, optionally filtered by entity_type and jurisdiction."""
    qs = DocumentTemplate.objects.filter(is_active=True)

    if entity_type:
        qs = qs.filter(entity_type=entity_type)

    if jurisdiction:
        qs = qs.filter(jurisdiction=jurisdiction)

    return qs


def get_documents_for_ticket(*, ticket_id) -> QuerySet[GeneratedDocument]:
    """Return all generated documents for a given ticket with related data."""
    return (
        GeneratedDocument.objects.filter(ticket_id=ticket_id)
        .select_related("template", "generated_by")
    )


def get_template_by_id(*, template_id) -> DocumentTemplate:
    """Return a single template by its ID.

    Raises DocumentTemplate.DoesNotExist if not found.
    """
    return DocumentTemplate.objects.get(id=template_id)
