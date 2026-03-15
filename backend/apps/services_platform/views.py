import logging

from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.authentication.permissions import IsDirector, IsInternalUser
from common.pagination import StandardPagination

from . import services
from .constants import DeedStatus
from .models import (
    ExpenseRecord,
    IncorporationData,
    NotaryDeedPool,
    Quotation,
    ServiceCatalog,
    ServiceRequest,
)
from .serializers import (
    ExpenseMarkPaidInputSerializer,
    ExpenseRecordInputSerializer,
    ExpenseRecordOutputSerializer,
    IncorporationDataInputSerializer,
    IncorporationDataOutputSerializer,
    NotaryDeedAssignInputSerializer,
    NotaryDeedBulkCreateInputSerializer,
    NotaryDeedPoolOutputSerializer,
    QuotationOutputSerializer,
    QuotationRejectInputSerializer,
    ServiceCatalogInputSerializer,
    ServiceCatalogOutputSerializer,
    ServiceRequestAddItemInputSerializer,
    ServiceRequestCreateInputSerializer,
    ServiceRequestItemOutputSerializer,
    ServiceRequestOutputSerializer,
    ServiceRequestRemoveItemInputSerializer,
)

logger = logging.getLogger(__name__)


# ===========================================================================
# ServiceCatalog ViewSet
# ===========================================================================


@extend_schema_view(
    list=extend_schema(summary="List service catalog items"),
    retrieve=extend_schema(summary="Retrieve a service catalog item"),
    create=extend_schema(summary="Create a service catalog item"),
)
class ServiceCatalogViewSet(ModelViewSet):
    queryset = ServiceCatalog.objects.select_related("jurisdiction").all()
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_permissions(self):
        if self.action in ("create", "partial_update"):
            return [IsAuthenticated(), IsDirector()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action in ("create", "partial_update"):
            return ServiceCatalogInputSerializer
        return ServiceCatalogOutputSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        jurisdiction_id = self.request.query_params.get("jurisdiction_id")
        if jurisdiction_id:
            qs = qs.filter(jurisdiction_id=jurisdiction_id)
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == "true")
        return qs

    def create(self, request, *args, **kwargs):
        serializer = ServiceCatalogInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        jurisdiction_id = data.pop("jurisdiction_id", None)
        catalog_item = ServiceCatalog.objects.create(
            jurisdiction_id=jurisdiction_id,
            **data,
        )
        output = ServiceCatalogOutputSerializer(catalog_item)
        return Response(output.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = ServiceCatalogInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        jurisdiction_id = data.pop("jurisdiction_id", None)
        for attr, value in data.items():
            setattr(instance, attr, value)
        if jurisdiction_id is not None:
            instance.jurisdiction_id = jurisdiction_id
        instance.save()
        output = ServiceCatalogOutputSerializer(instance)
        return Response(output.data)


# ===========================================================================
# ServiceRequest ViewSet
# ===========================================================================


@extend_schema_view(
    list=extend_schema(summary="List service requests"),
    retrieve=extend_schema(summary="Retrieve a service request"),
    create=extend_schema(summary="Create a service request"),
    destroy=extend_schema(summary="Delete a service request"),
)
class ServiceRequestViewSet(ModelViewSet):
    queryset = ServiceRequest.objects.select_related(
        "client", "entity", "ticket", "requested_by", "jurisdiction",
    ).prefetch_related("items__service").all()
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination

    def get_permissions(self):
        if self.action in ("create", "destroy", "submit", "add_item", "remove_item"):
            return [IsAuthenticated(), IsInternalUser()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == "create":
            return ServiceRequestCreateInputSerializer
        if self.action == "add_item":
            return ServiceRequestAddItemInputSerializer
        if self.action == "remove_item":
            return ServiceRequestRemoveItemInputSerializer
        return ServiceRequestOutputSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        client_id = self.request.query_params.get("client_id")
        if client_id:
            qs = qs.filter(client_id=client_id)
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        entity_id = self.request.query_params.get("entity_id")
        if entity_id:
            qs = qs.filter(entity_id=entity_id)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = ServiceRequestCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        service_request = services.create_service_request(
            client_id=serializer.validated_data["client_id"],
            requested_by=request.user,
            jurisdiction_id=serializer.validated_data.get("jurisdiction_id"),
            entity_id=serializer.validated_data.get("entity_id"),
            notes=serializer.validated_data.get("notes", ""),
            metadata=serializer.validated_data.get("metadata"),
        )
        output = ServiceRequestOutputSerializer(service_request)
        return Response(output.data, status=status.HTTP_201_CREATED)

    @extend_schema(
        summary="Submit a service request for quotation",
        request=None,
        responses={200: ServiceRequestOutputSerializer},
    )
    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, pk=None):
        service_request = services.submit_service_request(request_id=pk)
        return Response(ServiceRequestOutputSerializer(service_request).data)

    @extend_schema(
        summary="Add a service item to the request",
        request=ServiceRequestAddItemInputSerializer,
        responses={201: ServiceRequestItemOutputSerializer},
    )
    @action(detail=True, methods=["post"], url_path="add-item")
    def add_item(self, request, pk=None):
        serializer = ServiceRequestAddItemInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = services.add_service_to_request(
            request_id=pk,
            service_id=serializer.validated_data["service_id"],
            quantity=serializer.validated_data.get("quantity", 1),
        )
        return Response(
            ServiceRequestItemOutputSerializer(item).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        summary="Remove a service item from the request",
        request=ServiceRequestRemoveItemInputSerializer,
        responses={204: None},
    )
    @action(detail=True, methods=["post"], url_path="remove-item")
    def remove_item(self, request, pk=None):
        serializer = ServiceRequestRemoveItemInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.remove_service_from_request(
            request_id=pk,
            item_id=serializer.validated_data["item_id"],
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


# ===========================================================================
# Quotation ViewSet
# ===========================================================================


@extend_schema_view(
    list=extend_schema(summary="List quotations"),
    retrieve=extend_schema(summary="Retrieve a quotation"),
)
class QuotationViewSet(ModelViewSet):
    queryset = Quotation.objects.select_related("service_request__client").all()
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination
    http_method_names = ["get", "head", "options", "post"]

    def get_permissions(self):
        if self.action in ("generate", "accept", "reject"):
            return [IsAuthenticated(), IsInternalUser()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == "reject":
            return QuotationRejectInputSerializer
        return QuotationOutputSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        service_request_id = self.request.query_params.get("service_request_id")
        if service_request_id:
            qs = qs.filter(service_request_id=service_request_id)
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    @extend_schema(
        summary="Generate a quotation from a service request",
        request=None,
        responses={201: QuotationOutputSerializer},
    )
    @action(detail=False, methods=["post"], url_path="generate/(?P<request_id>[^/.]+)")
    def generate(self, request, request_id=None):
        quotation = services.generate_quotation(request_id=request_id)
        return Response(
            QuotationOutputSerializer(quotation).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        summary="Accept a quotation",
        request=None,
        responses={200: QuotationOutputSerializer},
    )
    @action(detail=True, methods=["post"], url_path="accept")
    def accept(self, request, pk=None):
        quotation = services.accept_quotation(quotation_id=pk)
        return Response(QuotationOutputSerializer(quotation).data)

    @extend_schema(
        summary="Reject a quotation",
        request=QuotationRejectInputSerializer,
        responses={200: QuotationOutputSerializer},
    )
    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        serializer = QuotationRejectInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        quotation = services.reject_quotation(
            quotation_id=pk,
            notes=serializer.validated_data.get("notes", ""),
        )
        return Response(QuotationOutputSerializer(quotation).data)


# ===========================================================================
# IncorporationData ViewSet
# ===========================================================================


@extend_schema_view(
    list=extend_schema(summary="List incorporation data records"),
    retrieve=extend_schema(summary="Retrieve incorporation data"),
)
class IncorporationDataViewSet(ModelViewSet):
    queryset = IncorporationData.objects.select_related("service_request").all()
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination
    http_method_names = ["get", "head", "options", "post"]

    def get_permissions(self):
        if self.action in ("save_data",):
            return [IsAuthenticated(), IsInternalUser()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == "save_data":
            return IncorporationDataInputSerializer
        return IncorporationDataOutputSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        service_request_id = self.request.query_params.get("service_request_id")
        if service_request_id:
            qs = qs.filter(service_request_id=service_request_id)
        return qs

    @extend_schema(
        summary="Save incorporation data for a service request",
        request=IncorporationDataInputSerializer,
        responses={200: IncorporationDataOutputSerializer},
    )
    @action(detail=False, methods=["post"], url_path="save/(?P<request_id>[^/.]+)")
    def save_data(self, request, request_id=None):
        serializer = IncorporationDataInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        inc_data = services.save_incorporation_data(
            request_id=request_id,
            **serializer.validated_data,
        )
        return Response(IncorporationDataOutputSerializer(inc_data).data)


# ===========================================================================
# NotaryDeedPool ViewSet
# ===========================================================================


@extend_schema_view(
    list=extend_schema(summary="List notary deeds"),
    retrieve=extend_schema(summary="Retrieve a notary deed"),
)
class NotaryDeedPoolViewSet(ModelViewSet):
    queryset = NotaryDeedPool.objects.select_related(
        "jurisdiction", "assigned_to_request",
    ).all()
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination
    http_method_names = ["get", "post", "head", "options"]

    def get_permissions(self):
        if self.action in ("bulk_create", "assign"):
            return [IsAuthenticated(), IsInternalUser()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == "bulk_create":
            return NotaryDeedBulkCreateInputSerializer
        if self.action == "assign":
            return NotaryDeedAssignInputSerializer
        return NotaryDeedPoolOutputSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        jurisdiction_id = self.request.query_params.get("jurisdiction_id")
        if jurisdiction_id:
            qs = qs.filter(jurisdiction_id=jurisdiction_id)
        deed_status = self.request.query_params.get("status")
        if deed_status:
            qs = qs.filter(status=deed_status)
        return qs

    @extend_schema(
        summary="Bulk create notary deeds",
        request=NotaryDeedBulkCreateInputSerializer,
        responses={201: NotaryDeedPoolOutputSerializer(many=True)},
    )
    @action(detail=False, methods=["post"], url_path="bulk-create")
    def bulk_create(self, request):
        serializer = NotaryDeedBulkCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        created_deeds = []
        for deed_data in serializer.validated_data["deeds"]:
            deed = NotaryDeedPool.objects.create(
                deed_number=deed_data.get("deed_number", ""),
                jurisdiction_id=deed_data.get("jurisdiction_id"),
                notary_name=deed_data.get("notary_name", ""),
                status=DeedStatus.AVAILABLE,
                notes=deed_data.get("notes", ""),
            )
            created_deeds.append(deed)
        return Response(
            NotaryDeedPoolOutputSerializer(created_deeds, many=True).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        summary="Assign a deed to a service request",
        request=NotaryDeedAssignInputSerializer,
        responses={200: NotaryDeedPoolOutputSerializer},
    )
    @action(detail=False, methods=["post"], url_path="assign")
    def assign(self, request):
        serializer = NotaryDeedAssignInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        deed = services.assign_deed(
            request_id=serializer.validated_data["request_id"],
            jurisdiction_id=serializer.validated_data.get("jurisdiction_id"),
        )
        return Response(NotaryDeedPoolOutputSerializer(deed).data)


# ===========================================================================
# ExpenseRecord ViewSet
# ===========================================================================


@extend_schema_view(
    list=extend_schema(summary="List expense records"),
    retrieve=extend_schema(summary="Retrieve an expense record"),
    create=extend_schema(summary="Create an expense record"),
    destroy=extend_schema(summary="Delete an expense record"),
)
class ExpenseRecordViewSet(ModelViewSet):
    queryset = ExpenseRecord.objects.select_related(
        "service_request", "entity", "ticket", "recorded_by",
    ).all()
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination

    def get_permissions(self):
        if self.action in ("create", "destroy", "mark_paid"):
            return [IsAuthenticated(), IsInternalUser()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == "create":
            return ExpenseRecordInputSerializer
        if self.action == "mark_paid":
            return ExpenseMarkPaidInputSerializer
        return ExpenseRecordOutputSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        service_request_id = self.request.query_params.get("service_request_id")
        if service_request_id:
            qs = qs.filter(service_request_id=service_request_id)
        entity_id = self.request.query_params.get("entity_id")
        if entity_id:
            qs = qs.filter(entity_id=entity_id)
        ticket_id = self.request.query_params.get("ticket_id")
        if ticket_id:
            qs = qs.filter(ticket_id=ticket_id)
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)
        payment_status_filter = self.request.query_params.get("payment_status")
        if payment_status_filter:
            qs = qs.filter(payment_status=payment_status_filter)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = ExpenseRecordInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        expense = services.record_expense(
            service_request_id=serializer.validated_data.get("service_request_id"),
            entity_id=serializer.validated_data.get("entity_id"),
            ticket_id=serializer.validated_data.get("ticket_id"),
            category=serializer.validated_data["category"],
            description=serializer.validated_data["description"],
            amount=serializer.validated_data["amount"],
            currency=serializer.validated_data.get("currency", "USD"),
            recorded_by=request.user,
        )
        output = ExpenseRecordOutputSerializer(expense)
        return Response(output.data, status=status.HTTP_201_CREATED)

    @extend_schema(
        summary="Mark an expense as paid",
        request=ExpenseMarkPaidInputSerializer,
        responses={200: ExpenseRecordOutputSerializer},
    )
    @action(detail=True, methods=["post"], url_path="mark-paid")
    def mark_paid(self, request, pk=None):
        serializer = ExpenseMarkPaidInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        expense = services.mark_expense_paid(
            expense_id=pk,
            payment_method=serializer.validated_data.get("payment_method", ""),
            payment_reference=serializer.validated_data.get("payment_reference", ""),
        )
        return Response(ExpenseRecordOutputSerializer(expense).data)
