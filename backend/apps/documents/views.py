from django.http import FileResponse
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ViewSet

from common.pagination import StandardPagination

from . import selectors, services
from .models import DocumentTemplate, GeneratedDocument
from .serializers import (
    ConvertPDFInputSerializer,
    DocumentTemplateCreateInputSerializer,
    DocumentTemplateOutputSerializer,
    GenerateDocumentInputSerializer,
    GeneratedDocumentOutputSerializer,
)
from .tasks import convert_to_pdf_async


class DocumentTemplateViewSet(ModelViewSet):
    queryset = DocumentTemplate.objects.all()
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination
    http_method_names = ["get", "post", "head", "options"]

    def get_serializer_class(self):
        if self.action == "create":
            return DocumentTemplateCreateInputSerializer
        return DocumentTemplateOutputSerializer

    def get_queryset(self):
        qs = super().get_queryset()

        entity_type = self.request.query_params.get("entity_type")
        jurisdiction = self.request.query_params.get("jurisdiction")
        is_active = self.request.query_params.get("is_active")

        if is_active is not None:
            is_active_bool = is_active.lower() in ("true", "1", "yes")
            qs = qs.filter(is_active=is_active_bool)

        if entity_type:
            qs = qs.filter(entity_type=entity_type)

        if jurisdiction:
            qs = qs.filter(jurisdiction=jurisdiction)

        return qs

    def create(self, request, *args, **kwargs):
        serializer = DocumentTemplateCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        template = services.create_template(**serializer.validated_data)
        output = DocumentTemplateOutputSerializer(template)
        return Response(output.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="toggle-active")
    def toggle_active(self, request, pk=None):
        """POST /templates/<id>/toggle-active/ - Activate or deactivate a template."""
        try:
            template = DocumentTemplate.objects.get(id=pk)
        except DocumentTemplate.DoesNotExist:
            return Response(
                {"detail": "Template not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        template.is_active = not template.is_active
        template.save(update_fields=["is_active", "updated_at"])
        output = DocumentTemplateOutputSerializer(template)
        return Response(output.data)


class GeneratedDocumentViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "create":
            return GenerateDocumentInputSerializer
        if self.action == "convert_pdf":
            return ConvertPDFInputSerializer
        return GeneratedDocumentOutputSerializer

    def create(self, request):
        """POST /generate/ - Dispatch document generation."""
        serializer = GenerateDocumentInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        document = services.generate_document(
            ticket_id=serializer.validated_data["ticket_id"],
            template_id=serializer.validated_data["template_id"],
            generated_by=request.user,
            context_data=serializer.validated_data.get("context_data"),
        )
        output = GeneratedDocumentOutputSerializer(document)
        return Response(output.data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, pk=None):
        """GET /generated/<id>/ - Retrieve a generated document."""
        try:
            document = GeneratedDocument.objects.select_related(
                "template", "generated_by"
            ).get(id=pk)
        except GeneratedDocument.DoesNotExist:
            return Response(
                {"detail": "Generated document not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        output = GeneratedDocumentOutputSerializer(document)
        return Response(output.data)

    def list(self, request):
        """GET /generated/ - List generated documents, filtered by ticket."""
        ticket_id = request.query_params.get("ticket_id")
        if ticket_id:
            documents = selectors.get_documents_for_ticket(ticket_id=ticket_id)
        else:
            documents = GeneratedDocument.objects.select_related(
                "template", "generated_by"
            ).all()

        paginator = StandardPagination()
        page = paginator.paginate_queryset(documents, request)
        if page is not None:
            serializer = GeneratedDocumentOutputSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = GeneratedDocumentOutputSerializer(documents, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="convert-pdf")
    def convert_pdf(self, request, pk=None):
        """POST /generated/<id>/convert-pdf/ - Dispatch Celery task for Gotenberg conversion."""
        try:
            document = GeneratedDocument.objects.get(id=pk)
        except GeneratedDocument.DoesNotExist:
            return Response(
                {"detail": "Generated document not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        convert_to_pdf_async.delay(str(document.id))
        return Response(
            {"detail": "PDF conversion has been queued.", "document_id": str(document.id)},
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        """GET /generated/<id>/download/ - Return the file as a download response."""
        try:
            document = GeneratedDocument.objects.get(id=pk)
        except GeneratedDocument.DoesNotExist:
            return Response(
                {"detail": "Generated document not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        file = document.generated_file
        response = FileResponse(
            file.open("rb"),
            content_type="application/octet-stream",
        )
        response["Content-Disposition"] = (
            f'attachment; filename="{file.name.split("/")[-1]}"'
        )
        return response
