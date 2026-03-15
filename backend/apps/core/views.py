from django.db.models import Q

from drf_spectacular.utils import extend_schema, extend_schema_view, inline_serializer
from rest_framework import serializers as drf_serializers
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from common.pagination import StandardPagination

from . import selectors, services
from .permissions import STAFF_ROLES, IsStaffOrReadOnlyOwn
from .models import (
    ActivityCatalog,
    Client,
    ClientContact,
    Entity,
    EntityActivity,
    EntityOfficer,
    Matter,
    Person,
    SavedFilter,
    ShareClass,
    ShareIssuance,
    SourceOfFunds,
    SourceOfFundsCatalog,
    SourceOfWealth,
)
from .serializers import (
    ActivityCatalogOutputSerializer,
    ClientContactInputSerializer,
    ClientContactOutputSerializer,
    ClientInputSerializer,
    ClientOutputSerializer,
    EntityActivityInputSerializer,
    EntityActivityOutputSerializer,
    EntityAuditLogOutputSerializer,
    EntityInputSerializer,
    EntityOfficerInputSerializer,
    EntityOfficerOutputSerializer,
    EntityOutputSerializer,
    GlobalSearchResultSerializer,
    MatterInputSerializer,
    MatterOutputSerializer,
    PersonAuditLogOutputSerializer,
    PersonInputSerializer,
    PersonOutputSerializer,
    PersonSearchSerializer,
    SavedFilterInputSerializer,
    SavedFilterOutputSerializer,
    ShareClassInputSerializer,
    ShareClassOutputSerializer,
    ShareIssuanceInputSerializer,
    ShareIssuanceOutputSerializer,
    SourceOfFundsCatalogOutputSerializer,
    SourceOfFundsInputSerializer,
    SourceOfFundsOutputSerializer,
    SourceOfWealthInputSerializer,
    SourceOfWealthOutputSerializer,
)


@extend_schema_view(
    list=extend_schema(summary="List clients"),
    retrieve=extend_schema(summary="Retrieve a client"),
    create=extend_schema(summary="Create a client"),
    update=extend_schema(summary="Update a client"),
    partial_update=extend_schema(summary="Partially update a client"),
    destroy=extend_schema(summary="Delete a client"),
)
class ClientViewSet(ModelViewSet):
    queryset = Client.objects.all()
    permission_classes = [IsAuthenticated, IsStaffOrReadOnlyOwn]
    pagination_class = StandardPagination

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return ClientInputSerializer
        return ClientOutputSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        # Client-role users can only see their own client record
        user = self.request.user
        if user.role not in STAFF_ROLES and hasattr(user, "client") and user.client:
            qs = qs.filter(id=user.client_id)
        client_type = self.request.query_params.get("client_type")
        if client_type:
            qs = selectors.get_clients_by_type(client_type=client_type)
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(name__icontains=search)
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = ClientInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        client = services.create_client(**serializer.validated_data)
        output = ClientOutputSerializer(client)
        return Response(output.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = ClientInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        client = services.update_client(client_id=instance.id, **serializer.validated_data)
        return Response(ClientOutputSerializer(client).data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = ClientInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        client = services.update_client(client_id=instance.id, **serializer.validated_data)
        return Response(ClientOutputSerializer(client).data)


@extend_schema_view(
    list=extend_schema(summary="List client contacts"),
    retrieve=extend_schema(summary="Retrieve a client contact"),
    create=extend_schema(summary="Create a client contact"),
    update=extend_schema(summary="Update a client contact"),
    partial_update=extend_schema(summary="Partially update a client contact"),
    destroy=extend_schema(summary="Delete a client contact"),
)
class ClientContactViewSet(ModelViewSet):
    queryset = ClientContact.objects.select_related("user").all()
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return ClientContactInputSerializer
        return ClientContactOutputSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        client_id = self.request.query_params.get("client_id")
        if client_id:
            qs = qs.filter(client_id=client_id)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = ClientContactInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        contact = services.create_client_contact(**serializer.validated_data)
        output = ClientContactOutputSerializer(contact)
        return Response(output.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = ClientContactInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        data.pop("client_id", None)
        contact = services.update_client_contact(contact_id=instance.id, **data)
        return Response(ClientContactOutputSerializer(contact).data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = ClientContactInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        data.pop("client_id", None)
        contact = services.update_client_contact(contact_id=instance.id, **data)
        return Response(ClientContactOutputSerializer(contact).data)


@extend_schema_view(
    list=extend_schema(summary="List entities"),
    retrieve=extend_schema(summary="Retrieve an entity"),
    create=extend_schema(summary="Create an entity"),
    update=extend_schema(summary="Update an entity"),
    partial_update=extend_schema(summary="Partially update an entity"),
    destroy=extend_schema(summary="Delete an entity"),
)
class EntityViewSet(ModelViewSet):
    queryset = Entity.objects.select_related("client").all()
    permission_classes = [IsAuthenticated, IsStaffOrReadOnlyOwn]
    pagination_class = StandardPagination

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return EntityInputSerializer
        if self.action == "audit_log":
            return EntityAuditLogOutputSerializer
        return EntityOutputSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        # Client-role users can only see their own client's entities
        user = self.request.user
        if user.role not in STAFF_ROLES and hasattr(user, "client") and user.client:
            qs = qs.filter(client_id=user.client_id)
        jurisdiction = self.request.query_params.get("jurisdiction")
        client_id = self.request.query_params.get("client_id")
        if jurisdiction:
            qs = qs.filter(jurisdiction=jurisdiction)
        if client_id:
            qs = qs.filter(client_id=client_id)
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(name__icontains=search)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = EntityInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entity = services.create_entity(**serializer.validated_data)
        output = EntityOutputSerializer(entity)
        return Response(output.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = EntityInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entity = services.update_entity(
            entity_id=instance.id, changed_by=request.user, **serializer.validated_data
        )
        return Response(EntityOutputSerializer(entity).data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = EntityInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        entity = services.update_entity(
            entity_id=instance.id, changed_by=request.user, **serializer.validated_data
        )
        return Response(EntityOutputSerializer(entity).data)

    @extend_schema(
        summary="List audit log entries for an entity",
        request=None,
        responses={200: EntityAuditLogOutputSerializer(many=True)},
    )
    @action(detail=True, methods=["get"], url_path="audit-log")
    def audit_log(self, request, pk=None):
        """Return paginated audit log entries for this entity."""
        from .models import EntityAuditLog

        entity = self.get_object()
        qs = EntityAuditLog.objects.filter(entity=entity).select_related(
            "changed_by"
        ).order_by("-created_at")

        model_name = request.query_params.get("model_name")
        if model_name:
            qs = qs.filter(model_name=model_name)
        source = request.query_params.get("source")
        if source:
            qs = qs.filter(source=source)

        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = EntityAuditLogOutputSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = EntityAuditLogOutputSerializer(qs, many=True)
        return Response(serializer.data)

    @extend_schema(
        summary="Get ownership tree and UBOs for an entity",
        request=None,
        responses={200: inline_serializer(
            name="OwnershipTreeResponse",
            fields={
                "tree": drf_serializers.ListField(child=drf_serializers.DictField()),
                "ubos": drf_serializers.ListField(child=drf_serializers.DictField()),
            },
        )},
    )
    @action(detail=True, methods=["get"], url_path="ownership-tree")
    def ownership_tree(self, request, pk=None):
        entity = self.get_object()
        tree = services.get_ownership_tree(entity_id=entity.id)
        ubos = services.compute_ubos(entity_id=entity.id)

        person_serializer = PersonOutputSerializer

        def _serialize_node(node):
            result = {
                "type": node["type"],
                "id": node["id"],
                "name": node["name"],
                "pct": node["pct"],
                "children": [_serialize_node(c) for c in node["children"]],
            }
            if node["person"]:
                result["person"] = person_serializer(node["person"]).data
            return result

        return Response(
            {
                "tree": [_serialize_node(n) for n in tree],
                "ubos": [
                    {
                        "person": person_serializer(u["person"]).data,
                        "effective_pct": round(u["effective_pct"], 2),
                        "via": u["via"],
                    }
                    for u in ubos
                ],
            }
        )


@extend_schema_view(
    list=extend_schema(summary="List matters"),
    retrieve=extend_schema(summary="Retrieve a matter"),
    create=extend_schema(summary="Create a matter"),
    update=extend_schema(summary="Update a matter"),
    partial_update=extend_schema(summary="Partially update a matter"),
    destroy=extend_schema(summary="Delete a matter"),
)
class MatterViewSet(ModelViewSet):
    queryset = Matter.objects.select_related("client", "entity").all()
    permission_classes = [IsAuthenticated, IsStaffOrReadOnlyOwn]
    pagination_class = StandardPagination

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return MatterInputSerializer
        return MatterOutputSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role not in STAFF_ROLES and hasattr(user, "client") and user.client:
            qs = qs.filter(client_id=user.client_id)
        client_id = self.request.query_params.get("client_id")
        if client_id:
            qs = qs.filter(client_id=client_id)
        entity_id = self.request.query_params.get("entity_id")
        if entity_id:
            qs = qs.filter(entity_id=entity_id)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = MatterInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        matter = services.create_matter(**serializer.validated_data)
        output = MatterOutputSerializer(matter)
        return Response(output.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = MatterInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        matter = services.update_matter(matter_id=instance.id, **serializer.validated_data)
        return Response(MatterOutputSerializer(matter).data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = MatterInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        matter = services.update_matter(matter_id=instance.id, **serializer.validated_data)
        return Response(MatterOutputSerializer(matter).data)


@extend_schema_view(
    list=extend_schema(summary="List persons"),
    retrieve=extend_schema(summary="Retrieve a person"),
    create=extend_schema(summary="Create a person"),
    update=extend_schema(summary="Update a person"),
    partial_update=extend_schema(summary="Partially update a person"),
    destroy=extend_schema(summary="Delete a person"),
)
class PersonViewSet(ModelViewSet):
    queryset = Person.objects.select_related(
        "client", "nationality", "country_of_residence"
    ).all()
    permission_classes = [IsAuthenticated, IsStaffOrReadOnlyOwn]
    pagination_class = StandardPagination

    def get_serializer_class(self):
        if self.action == "search":
            return PersonSearchSerializer
        if self.action in ("create", "update", "partial_update"):
            return PersonInputSerializer
        return PersonOutputSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        client_id = self.request.query_params.get("client_id")
        if client_id:
            qs = qs.filter(client_id=client_id)
        person_type = self.request.query_params.get("person_type")
        if person_type:
            qs = qs.filter(person_type=person_type)
        pep_status = self.request.query_params.get("pep_status")
        if pep_status is not None and pep_status != "":
            qs = qs.filter(pep_status=pep_status.lower() == "true")
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(Q(full_name__icontains=search) | Q(last_name__icontains=search))
        return qs

    def create(self, request, *args, **kwargs):
        serializer = PersonInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        person = services.create_person(**serializer.validated_data)
        services.log_person_creation(
            person=person,
            changed_by=request.user,
        )
        output = PersonOutputSerializer(person)
        return Response(output.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = PersonInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        person = services.update_person(
            person_id=instance.id, changed_by=request.user, **serializer.validated_data
        )
        return Response(PersonOutputSerializer(person).data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = PersonInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        person = services.update_person(
            person_id=instance.id, changed_by=request.user, **serializer.validated_data
        )
        return Response(PersonOutputSerializer(person).data)

    @extend_schema(
        summary="List audit log entries for a person",
        request=None,
        responses={200: PersonAuditLogOutputSerializer(many=True)},
    )
    @action(detail=True, methods=["get"], url_path="audit-log")
    def audit_log(self, request, pk=None):
        """Return paginated audit log entries for this person."""
        from .models import PersonAuditLog

        person = self.get_object()
        qs = PersonAuditLog.objects.filter(person=person).select_related(
            "changed_by"
        ).order_by("-created_at")

        source = request.query_params.get("source")
        if source:
            qs = qs.filter(source=source)

        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = PersonAuditLogOutputSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = PersonAuditLogOutputSerializer(qs, many=True)
        return Response(serializer.data)

    @extend_schema(
        summary="Search persons by name",
        request=None,
        responses={200: PersonOutputSerializer(many=True)},
    )
    @action(detail=False, methods=["get"])
    def search(self, request):
        query = request.query_params.get("q", "")
        if not query:
            raise drf_serializers.ValidationError(
                {"q": "This query parameter is required."}
            )
        persons = services.search_persons(query=query)
        page = self.paginate_queryset(persons)
        if page is not None:
            serializer = PersonOutputSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = PersonOutputSerializer(persons, many=True)
        return Response(serializer.data)


@extend_schema_view(
    list=extend_schema(summary="List entity officers"),
    retrieve=extend_schema(summary="Retrieve an entity officer"),
    create=extend_schema(summary="Create an entity officer"),
    update=extend_schema(summary="Update an entity officer"),
    partial_update=extend_schema(summary="Partially update an entity officer"),
    destroy=extend_schema(summary="Delete an entity officer"),
)
class EntityOfficerViewSet(ModelViewSet):
    queryset = EntityOfficer.objects.select_related(
        "entity",
        "officer_person__client",
        "officer_person__nationality",
        "officer_person__country_of_residence",
        "officer_entity",
    ).all()
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return EntityOfficerInputSerializer
        return EntityOfficerOutputSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        entity_id = self.request.query_params.get("entity_id")
        if entity_id:
            qs = qs.filter(entity_id=entity_id)
        officer_person_id = self.request.query_params.get("officer_person_id")
        if officer_person_id:
            qs = qs.filter(officer_person_id=officer_person_id)
        officer_entity_id = self.request.query_params.get("officer_entity_id")
        if officer_entity_id:
            qs = qs.filter(officer_entity_id=officer_entity_id)
        is_active = self.request.query_params.get("is_active")
        if is_active is not None and is_active != "":
            qs = qs.filter(is_active=is_active.lower() == "true")
        return qs

    def create(self, request, *args, **kwargs):
        serializer = EntityOfficerInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        officer = services.create_entity_officer(**serializer.validated_data)
        output = EntityOfficerOutputSerializer(officer)
        return Response(output.data, status=status.HTTP_201_CREATED)

    def _apply_fk_updates(self, instance, data):
        for key in ("entity_id", "officer_person_id", "officer_entity_id"):
            val = data.pop(key, None)
            if val is not None:
                setattr(instance, key, val)
        # When switching holder type, clear the other FK
        if "officer_person_id" in data or instance.officer_person_id:
            if data.get("officer_entity_id") or (
                "officer_entity_id" not in data and instance.officer_entity_id
                and instance.officer_person_id
            ):
                pass  # XOR constraint will catch invalid combos
        for attr, value in data.items():
            setattr(instance, attr, value)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = EntityOfficerInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        self._apply_fk_updates(instance, data)
        instance.save()
        output = EntityOfficerOutputSerializer(instance)
        return Response(output.data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = EntityOfficerInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        self._apply_fk_updates(instance, data)
        instance.save()
        output = EntityOfficerOutputSerializer(instance)
        return Response(output.data)


@extend_schema_view(
    list=extend_schema(summary="List share classes"),
    retrieve=extend_schema(summary="Retrieve a share class"),
    create=extend_schema(summary="Create a share class"),
    update=extend_schema(summary="Update a share class"),
    partial_update=extend_schema(summary="Partially update a share class"),
    destroy=extend_schema(summary="Delete a share class"),
)
class ShareClassViewSet(ModelViewSet):
    queryset = ShareClass.objects.prefetch_related(
        "issuances__shareholder_person__client",
        "issuances__shareholder_person__nationality",
        "issuances__shareholder_person__country_of_residence",
        "issuances__shareholder_entity",
    ).all()
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return ShareClassInputSerializer
        return ShareClassOutputSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        entity_id = self.request.query_params.get("entity_id")
        if entity_id:
            qs = qs.filter(entity_id=entity_id)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = ShareClassInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        share_class = services.create_share_class(**serializer.validated_data)
        output = ShareClassOutputSerializer(share_class)
        return Response(output.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = ShareClassInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sc = services.update_share_class(share_class_id=instance.id, **serializer.validated_data)
        return Response(ShareClassOutputSerializer(sc).data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = ShareClassInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        sc = services.update_share_class(share_class_id=instance.id, **serializer.validated_data)
        return Response(ShareClassOutputSerializer(sc).data)


@extend_schema_view(
    list=extend_schema(summary="List share issuances"),
    retrieve=extend_schema(summary="Retrieve a share issuance"),
    create=extend_schema(summary="Create a share issuance"),
    update=extend_schema(summary="Update a share issuance"),
    partial_update=extend_schema(summary="Partially update a share issuance"),
    destroy=extend_schema(summary="Delete a share issuance"),
)
class ShareIssuanceViewSet(ModelViewSet):
    queryset = ShareIssuance.objects.select_related(
        "share_class",
        "shareholder_person__client",
        "shareholder_person__nationality",
        "shareholder_person__country_of_residence",
        "shareholder_entity",
    ).all()
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return ShareIssuanceInputSerializer
        return ShareIssuanceOutputSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        share_class_id = self.request.query_params.get("share_class_id")
        if share_class_id:
            qs = qs.filter(share_class_id=share_class_id)
        entity_id = self.request.query_params.get("entity_id")
        if entity_id:
            qs = qs.filter(share_class__entity_id=entity_id)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = ShareIssuanceInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        issuance = services.create_share_issuance(**serializer.validated_data)
        output = ShareIssuanceOutputSerializer(issuance)
        return Response(output.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = ShareIssuanceInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        issuance = services.update_share_issuance(
            share_issuance_id=instance.id, **serializer.validated_data
        )
        return Response(ShareIssuanceOutputSerializer(issuance).data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = ShareIssuanceInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        issuance = services.update_share_issuance(
            share_issuance_id=instance.id, **serializer.validated_data
        )
        return Response(ShareIssuanceOutputSerializer(issuance).data)


@extend_schema_view(
    list=extend_schema(summary="List activity catalog entries"),
    retrieve=extend_schema(summary="Retrieve an activity catalog entry"),
)
class ActivityCatalogViewSet(ModelViewSet):
    queryset = ActivityCatalog.objects.all()
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination
    http_method_names = ["get", "head", "options"]

    def get_serializer_class(self):
        return ActivityCatalogOutputSerializer


@extend_schema_view(
    list=extend_schema(summary="List entity activities"),
    retrieve=extend_schema(summary="Retrieve an entity activity"),
    create=extend_schema(summary="Create an entity activity"),
    update=extend_schema(summary="Update an entity activity"),
    partial_update=extend_schema(summary="Partially update an entity activity"),
    destroy=extend_schema(summary="Delete an entity activity"),
)
class EntityActivityViewSet(ModelViewSet):
    queryset = EntityActivity.objects.select_related("activity").prefetch_related("countries").all()
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return EntityActivityInputSerializer
        return EntityActivityOutputSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        entity_id = self.request.query_params.get("entity_id")
        if entity_id:
            qs = qs.filter(entity_id=entity_id)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = EntityActivityInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        activity = services.create_entity_activity(**serializer.validated_data)
        output = EntityActivityOutputSerializer(activity)
        return Response(output.data, status=status.HTTP_201_CREATED)

    def _apply_update(self, instance, data):
        country_ids = data.pop("country_ids", None)
        for key in ("entity_id", "activity_id"):
            val = data.pop(key, None)
            if val:
                setattr(instance, key, val)
        for attr, value in data.items():
            setattr(instance, attr, value)
        instance.save()

        if country_ids is not None:
            services.update_record_country_risk(
                instance=instance, country_ids=country_ids,
            )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = EntityActivityInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self._apply_update(instance, serializer.validated_data)
        output = EntityActivityOutputSerializer(instance)
        return Response(output.data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = EntityActivityInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        self._apply_update(instance, serializer.validated_data)
        output = EntityActivityOutputSerializer(instance)
        return Response(output.data)


@extend_schema_view(
    list=extend_schema(summary="List source of funds catalog entries"),
    retrieve=extend_schema(summary="Retrieve a source of funds catalog entry"),
)
class SourceOfFundsCatalogViewSet(ModelViewSet):
    queryset = SourceOfFundsCatalog.objects.all()
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination
    http_method_names = ["get", "head", "options"]

    def get_serializer_class(self):
        return SourceOfFundsCatalogOutputSerializer


@extend_schema_view(
    list=extend_schema(summary="List sources of funds"),
    retrieve=extend_schema(summary="Retrieve a source of funds"),
    create=extend_schema(summary="Create a source of funds"),
    update=extend_schema(summary="Update a source of funds"),
    partial_update=extend_schema(summary="Partially update a source of funds"),
    destroy=extend_schema(summary="Delete a source of funds"),
)
class SourceOfFundsViewSet(ModelViewSet):
    queryset = SourceOfFunds.objects.select_related("source").prefetch_related("countries").all()
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return SourceOfFundsInputSerializer
        return SourceOfFundsOutputSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        entity_id = self.request.query_params.get("entity_id")
        if entity_id:
            qs = qs.filter(entity_id=entity_id)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = SourceOfFundsInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sof = services.create_source_of_funds(**serializer.validated_data)
        output = SourceOfFundsOutputSerializer(sof)
        return Response(output.data, status=status.HTTP_201_CREATED)

    def _apply_update(self, instance, data):
        country_ids = data.pop("country_ids", None)
        for key in ("entity_id", "source_id"):
            val = data.pop(key, None)
            if val:
                setattr(instance, key, val)
        for attr, value in data.items():
            setattr(instance, attr, value)
        instance.save()

        if country_ids is not None:
            services.update_record_country_risk(
                instance=instance, country_ids=country_ids,
            )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = SourceOfFundsInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self._apply_update(instance, serializer.validated_data)
        output = SourceOfFundsOutputSerializer(instance)
        return Response(output.data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = SourceOfFundsInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        self._apply_update(instance, serializer.validated_data)
        output = SourceOfFundsOutputSerializer(instance)
        return Response(output.data)


@extend_schema_view(
    list=extend_schema(summary="List sources of wealth"),
    retrieve=extend_schema(summary="Retrieve a source of wealth"),
    create=extend_schema(summary="Create a source of wealth"),
    update=extend_schema(summary="Update a source of wealth"),
    partial_update=extend_schema(summary="Partially update a source of wealth"),
    destroy=extend_schema(summary="Delete a source of wealth"),
)
class SourceOfWealthViewSet(ModelViewSet):
    queryset = SourceOfWealth.objects.all()
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return SourceOfWealthInputSerializer
        return SourceOfWealthOutputSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        person_id = self.request.query_params.get("person_id")
        if person_id:
            qs = qs.filter(person_id=person_id)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = SourceOfWealthInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sow = services.create_source_of_wealth(**serializer.validated_data)
        output = SourceOfWealthOutputSerializer(sow)
        return Response(output.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = SourceOfWealthInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sow = services.update_source_of_wealth(
            source_of_wealth_id=instance.id, **serializer.validated_data
        )
        return Response(SourceOfWealthOutputSerializer(sow).data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = SourceOfWealthInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        sow = services.update_source_of_wealth(
            source_of_wealth_id=instance.id, **serializer.validated_data
        )
        return Response(SourceOfWealthOutputSerializer(sow).data)


# ---------------------------------------------------------------------------
# Global Search
# ---------------------------------------------------------------------------


class GlobalSearchView(APIView):
    """Cross-module search across entities, people, clients, and tickets."""

    permission_classes = [IsAuthenticated]

    RESULT_LIMIT = 5

    @extend_schema(
        summary="Global search across modules",
        parameters=[
            {
                "name": "q",
                "in": "query",
                "required": True,
                "schema": {"type": "string"},
                "description": "Search query (min 2 characters)",
            }
        ],
        responses={200: GlobalSearchResultSerializer(many=True)},
    )
    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if len(query) < 2:
            return Response({"results": []})

        results = []

        # Search entities by name
        entities = Entity.objects.filter(
            name__icontains=query,
        ).select_related("client")[:self.RESULT_LIMIT]
        for entity in entities:
            results.append({
                "id": str(entity.id),
                "type": "entity",
                "title": entity.name,
                "subtitle": f"Entity - {entity.get_jurisdiction_display()}",
                "url": f"/entities/{entity.id}",
            })

        # Search people by full_name, last_name
        persons = Person.objects.filter(
            Q(full_name__icontains=query) | Q(last_name__icontains=query),
        )[:self.RESULT_LIMIT]
        for person in persons:
            results.append({
                "id": str(person.id),
                "type": "person",
                "title": person.display_name,
                "subtitle": f"Person - {person.get_person_type_display()}",
                "url": f"/people/{person.id}",
            })

        # Search clients by name
        clients = Client.objects.filter(
            name__icontains=query,
        )[:self.RESULT_LIMIT]
        for client in clients:
            results.append({
                "id": str(client.id),
                "type": "client",
                "title": client.name,
                "subtitle": f"Client - {client.get_client_type_display()}",
                "url": f"/clients/{client.id}",
            })

        # Search tickets by title
        from apps.workflow.models import Ticket

        tickets = Ticket.objects.filter(
            title__icontains=query,
        ).select_related("current_state")[:self.RESULT_LIMIT]
        for ticket in tickets:
            results.append({
                "id": str(ticket.id),
                "type": "ticket",
                "title": ticket.title,
                "subtitle": f"Ticket - {ticket.current_state.name}",
                "url": f"/tickets/{ticket.id}",
            })

        return Response({"results": results})


# ---------------------------------------------------------------------------
# Saved Filters
# ---------------------------------------------------------------------------


@extend_schema_view(
    list=extend_schema(summary="List saved filters for the current user"),
    retrieve=extend_schema(summary="Retrieve a saved filter"),
    create=extend_schema(summary="Create a saved filter"),
    update=extend_schema(summary="Update a saved filter"),
    partial_update=extend_schema(summary="Partially update a saved filter"),
    destroy=extend_schema(summary="Delete a saved filter"),
)
class SavedFilterViewSet(ModelViewSet):
    """CRUD for user-scoped saved filters."""

    queryset = SavedFilter.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return SavedFilterInputSerializer
        return SavedFilterOutputSerializer

    def get_queryset(self):
        qs = SavedFilter.objects.filter(user=self.request.user)
        module = self.request.query_params.get("module")
        if module:
            qs = qs.filter(module=module)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = SavedFilterInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # If this filter is set as default, clear other defaults in same module
        if data.get("is_default"):
            SavedFilter.objects.filter(
                user=request.user, module=data["module"], is_default=True,
            ).update(is_default=False)

        saved_filter = SavedFilter.objects.create(user=request.user, **data)
        return Response(
            SavedFilterOutputSerializer(saved_filter).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = SavedFilterInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if data.get("is_default"):
            SavedFilter.objects.filter(
                user=request.user, module=data["module"], is_default=True,
            ).exclude(id=instance.id).update(is_default=False)

        for attr, value in data.items():
            setattr(instance, attr, value)
        instance.save()
        return Response(SavedFilterOutputSerializer(instance).data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = SavedFilterInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if data.get("is_default"):
            SavedFilter.objects.filter(
                user=request.user, module=instance.module, is_default=True,
            ).exclude(id=instance.id).update(is_default=False)

        for attr, value in data.items():
            setattr(instance, attr, value)
        instance.save()
        return Response(SavedFilterOutputSerializer(instance).data)
