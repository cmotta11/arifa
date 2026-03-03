from django.urls import path

from .views import DocumentTemplateViewSet, GeneratedDocumentViewSet

# Template endpoints
template_list = DocumentTemplateViewSet.as_view({"get": "list", "post": "create"})
template_detail = DocumentTemplateViewSet.as_view({"get": "retrieve"})
template_toggle_active = DocumentTemplateViewSet.as_view({"post": "toggle_active"})

# Generated document endpoints
generated_create = GeneratedDocumentViewSet.as_view({"post": "create"})
generated_list = GeneratedDocumentViewSet.as_view({"get": "list"})
generated_detail = GeneratedDocumentViewSet.as_view({"get": "retrieve"})
generated_convert_pdf = GeneratedDocumentViewSet.as_view({"post": "convert_pdf"})
generated_download = GeneratedDocumentViewSet.as_view({"get": "download"})

urlpatterns = [
    # Templates
    path("templates/", template_list, name="template-list"),
    path("templates/<uuid:pk>/", template_detail, name="template-detail"),
    path(
        "templates/<uuid:pk>/toggle-active/",
        template_toggle_active,
        name="template-toggle-active",
    ),
    # Generate
    path("generate/", generated_create, name="document-generate"),
    # Generated documents
    path("generated/", generated_list, name="generated-list"),
    path("generated/<uuid:pk>/", generated_detail, name="generated-detail"),
    path(
        "generated/<uuid:pk>/convert-pdf/",
        generated_convert_pdf,
        name="generated-convert-pdf",
    ),
    path(
        "generated/<uuid:pk>/download/",
        generated_download,
        name="generated-download",
    ),
]
