from django.http import FileResponse
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers as drf_serializers
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ViewSet

from common.pagination import StandardPagination

from . import selectors, services
from .models import DocumentTemplate, GeneratedDocument
from .builders import DocumentBuilderRegistry
from .serializers import (
    AssembleDocumentInputSerializer,
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

    @extend_schema(
        summary="Toggle template active status",
        request=None,
        responses={200: DocumentTemplateOutputSerializer},
    )
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

    @extend_schema(
        summary="Generate a document from a template",
        request=GenerateDocumentInputSerializer,
        responses={201: GeneratedDocumentOutputSerializer},
    )
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

    @extend_schema(
        summary="Retrieve a generated document",
        responses={200: GeneratedDocumentOutputSerializer},
    )
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

    @extend_schema(
        summary="List generated documents",
        responses={200: GeneratedDocumentOutputSerializer(many=True)},
    )
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

    @extend_schema(
        summary="Convert a generated document to PDF",
        request=ConvertPDFInputSerializer,
        responses={
            202: inline_serializer(
                name="ConvertPDFResponse",
                fields={
                    "detail": drf_serializers.CharField(),
                    "document_id": drf_serializers.CharField(),
                },
            ),
        },
    )
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

    @extend_schema(
        summary="Download a generated document file",
        responses={(200, "application/octet-stream"): bytes},
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


class AssembleDocumentViewSet(ViewSet):
    """Endpoints for the Document Assembly Engine.

    POST /documents/assemble/          - assemble a document using a registered builder
    GET  /documents/assemble/builders/  - list available builder names
    """

    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "create":
            return AssembleDocumentInputSerializer
        return GeneratedDocumentOutputSerializer

    @extend_schema(
        summary="Assemble a document using a registered builder",
        request=AssembleDocumentInputSerializer,
        responses={201: GeneratedDocumentOutputSerializer},
    )
    def create(self, request):
        """POST /documents/assemble/ - Build and persist a DOCX document."""
        serializer = AssembleDocumentInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        document = services.assemble_document(
            ticket_id=serializer.validated_data["ticket_id"],
            builder_name=serializer.validated_data["builder_name"],
            context_data=serializer.validated_data["context_data"],
            generated_by=request.user,
        )
        output = GeneratedDocumentOutputSerializer(document)
        return Response(output.data, status=status.HTTP_201_CREATED)

    @extend_schema(
        summary="List available document builders",
        responses={
            200: inline_serializer(
                name="BuilderListResponse",
                fields={
                    "builders": drf_serializers.ListField(
                        child=drf_serializers.CharField()
                    ),
                },
            ),
        },
    )
    @action(detail=False, methods=["get"])
    def builders(self, request):
        """GET /documents/assemble/builders/ - Return names of all registered builders."""
        return Response(
            {"builders": DocumentBuilderRegistry.list_builders()},
            status=status.HTTP_200_OK,
        )
