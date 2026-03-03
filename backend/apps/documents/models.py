from django.conf import settings
from django.db import models

from common.base_model import TimeStampedModel

from .constants import DocumentFormat


class DocumentTemplate(TimeStampedModel):
    name = models.CharField(max_length=255)
    file = models.FileField(upload_to="templates/")
    entity_type = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="E.g. 'corporation', 'trust', 'foundation'",
    )
    jurisdiction = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="E.g. 'bvi', 'panama'",
    )
    is_active = models.BooleanField(default=True)

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Document Template"
        verbose_name_plural = "Document Templates"

    def __str__(self):
        return self.name


class GeneratedDocument(TimeStampedModel):
    ticket = models.ForeignKey(
        "workflow.Ticket",
        on_delete=models.CASCADE,
        related_name="generated_documents",
    )
    template = models.ForeignKey(
        DocumentTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generated_documents",
    )
    generated_file = models.FileField(upload_to="generated/")
    format = models.CharField(
        max_length=10,
        choices=DocumentFormat.choices,
        default=DocumentFormat.DOCX,
    )
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="generated_documents",
    )
    sharepoint_file_id = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="SharePoint file ID for PDF archival",
    )

    class Meta(TimeStampedModel.Meta):
        verbose_name = "Generated Document"
        verbose_name_plural = "Generated Documents"

    def __str__(self):
        template_name = self.template.name if self.template else "No template"
        return f"Document ({template_name}) for Ticket {self.ticket_id}"
