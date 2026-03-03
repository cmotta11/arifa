from django.contrib import admin

from .models import DocumentTemplate, GeneratedDocument


@admin.register(DocumentTemplate)
class DocumentTemplateAdmin(admin.ModelAdmin):
    list_display = ["name", "entity_type", "jurisdiction", "is_active", "created_at"]
    list_filter = ["is_active", "entity_type", "jurisdiction"]
    search_fields = ["name"]
    readonly_fields = ["id", "created_at", "updated_at"]


@admin.register(GeneratedDocument)
class GeneratedDocumentAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "ticket",
        "template",
        "format",
        "generated_by",
        "sharepoint_file_id",
        "created_at",
    ]
    list_filter = ["format"]
    search_fields = ["ticket__title", "template__name"]
    readonly_fields = ["id", "created_at", "updated_at"]
    raw_id_fields = ["ticket", "template", "generated_by"]
