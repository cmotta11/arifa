from django.db import models


class DocumentFormat(models.TextChoices):
    DOCX = "docx", "DOCX"
    PDF = "pdf", "PDF"
