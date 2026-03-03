from rest_framework import serializers as drf_serializers
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from common.pagination import StandardPagination

from . import selectors, services
from .models import (
    ActivityCatalog,
    Client,
    ClientContact,
    Entity,
    EntityActivity,
    EntityOfficer,
    Matter,
    Person,
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
    EntityInputSerializer,
    EntityOfficerInputSerializer,
    EntityOfficerOutputSerializer,
    EntityOutputSerializer,
    MatterInputSerializer,
    MatterOutputSerializer,
    PersonInputSerializer,
    PersonOutputSerializer,
    PersonSearchSerializer,
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


class ClientViewSet(ModelViewSet):
    queryset = Client.objects.all()
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return ClientInputSerializer
        return ClientOutputSerializer

    def get_queryset(self):
        qs = super().get_queryset()
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
        for attr, value in serializer.validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        output = ClientOutputSerializer(instance)
        return Response(output.data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = ClientInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        for attr, value in serializer.validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        output = ClientOutputSerializer(instance)
        return Response(output.data)


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
        for attr, value in data.items():
            setattr(instance, attr, value)
        instance.save()
        output = ClientContactOutputSerializer(instance)
        return Response(output.data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = ClientContactInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        data.pop("client_id", None)
        for attr, value in data.items():
            setattr(instance, attr, value)
        instance.save()
        output = ClientContactOutputSerializer(instance)
        return Response(output.data)


class EntityViewSet(ModelViewSet):
    queryset = Entity.objects.select_related("client").all()
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return EntityInputSerializer
        if self.action == "audit_log":
            from .serializers import EntityAuditLogOutputSerializer
            return EntityAuditLogOutputSerializer
        return EntityOutputSerializer

    def get_queryset(self):
        qs = super().get_queryset()
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

    def _snapshot_entity(self, instance):
        return {
            "name": instance.name,
            "jurisdiction": instance.jurisdiction,
            "incorporation_date": str(instance.incorporation_date) if instance.incorporation_date else None,
            "status": instance.status,
        }

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        old_data = self._snapshot_entity(instance)
        serializer = EntityInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        client_id = data.pop("client_id", None)
        if client_id:
            instance.client_id = client_id
        for attr, value in data.items():
            setattr(instance, attr, value)
        instance.save()
        new_data = self._snapshot_entity(instance)
        services.log_entity_changes(
            entity=instance, model_name="entity", old_data=old_data,
            new_data=new_data, changed_by=request.user,
        )
        output = EntityOutputSerializer(instance)
        return Response(output.data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        old_data = self._snapshot_entity(instance)
        serializer = EntityInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        client_id = data.pop("client_id", None)
        if client_id:
            instance.client_id = client_id
        for attr, value in data.items():
            setattr(instance, attr, value)
        instance.save()
        new_data = self._snapshot_entity(instance)
        services.log_entity_changes(
            entity=instance, model_name="entity", old_data=old_data,
            new_data=new_data, changed_by=request.user,
        )
        output = EntityOutputSerializer(instance)
        return Response(output.data)

    @action(detail=True, methods=["get"], url_path="audit-log")
    def audit_log(self, request, pk=None):
        """Return paginated audit log entries for this entity."""
        from .models import EntityAuditLog
        from .serializers import EntityAuditLogOutputSerializer

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

    @action(detail=True, methods=["get"], url_path="ownership-tree")
    def ownership_tree(self, request, pk=None):
        entity = self.get_object()
        tree = services.get_ownership_tree(entity.id)
        ubos = services.compute_ubos(entity.id)

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


class MatterViewSet(ModelViewSet):
    queryset = Matter.objects.select_related("client", "entity").all()
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return MatterInputSerializer
        return MatterOutputSerializer

    def get_queryset(self):
        qs = super().get_queryset()
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
        data = serializer.validated_data
        client_id = data.pop("client_id", None)
        entity_id = data.pop("entity_id", None)
        if client_id:
            instance.client_id = client_id
        if entity_id is not None:
            instance.entity_id = entity_id
        for attr, value in data.items():
            setattr(instance, attr, value)
        instance.save()
        output = MatterOutputSerializer(instance)
        return Response(output.data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = MatterInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        client_id = data.pop("client_id", None)
        entity_id = data.pop("entity_id", None)
        if client_id:
            instance.client_id = client_id
        if entity_id is not None:
            instance.entity_id = entity_id
        for attr, value in data.items():
            setattr(instance, attr, value)
        instance.save()
        output = MatterOutputSerializer(instance)
        return Response(output.data)


class PersonViewSet(ModelViewSet):
    queryset = Person.objects.select_related(
        "client", "nationality", "country_of_residence"
    ).all()
    permission_classes = [IsAuthenticated]
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
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(full_name__icontains=search)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = PersonInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        person = services.create_person(**serializer.validated_data)
        output = PersonOutputSerializer(person)
        return Response(output.data, status=status.HTTP_201_CREATED)

    def _apply_person_fk_updates(self, instance, data):
        for key in ("client_id", "nationality_id", "country_of_residence_id"):
            val = data.pop(key, None)
            if val is not None:
                setattr(instance, key, val)
        for attr, value in data.items():
            setattr(instance, attr, value)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = PersonInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        self._apply_person_fk_updates(instance, data)
        instance.save()
        output = PersonOutputSerializer(instance)
        return Response(output.data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = PersonInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        self._apply_person_fk_updates(instance, data)
        instance.save()
        output = PersonOutputSerializer(instance)
        return Response(output.data)

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
        data = serializer.validated_data
        entity_id = data.pop("entity_id", None)
        if entity_id:
            instance.entity_id = entity_id
        for attr, value in data.items():
            setattr(instance, attr, value)
        instance.save()
        output = ShareClassOutputSerializer(instance)
        return Response(output.data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = ShareClassInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        entity_id = data.pop("entity_id", None)
        if entity_id:
            instance.entity_id = entity_id
        for attr, value in data.items():
            setattr(instance, attr, value)
        instance.save()
        output = ShareClassOutputSerializer(instance)
        return Response(output.data)


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
        data = serializer.validated_data
        for key in ("share_class_id", "shareholder_person_id", "shareholder_entity_id"):
            val = data.pop(key, None)
            if val is not None:
                setattr(instance, key, val)
        for attr, value in data.items():
            setattr(instance, attr, value)
        instance.save()
        output = ShareIssuanceOutputSerializer(instance)
        return Response(output.data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = ShareIssuanceInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        for key in ("share_class_id", "shareholder_person_id", "shareholder_entity_id"):
            val = data.pop(key, None)
            if val is not None:
                setattr(instance, key, val)
        for attr, value in data.items():
            setattr(instance, attr, value)
        instance.save()
        output = ShareIssuanceOutputSerializer(instance)
        return Response(output.data)


class ActivityCatalogViewSet(ModelViewSet):
    queryset = ActivityCatalog.objects.all()
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination
    http_method_names = ["get", "head", "options"]

    def get_serializer_class(self):
        return ActivityCatalogOutputSerializer


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
        from apps.compliance.models import JurisdictionRisk

        country_ids = data.pop("country_ids", None)
        for key in ("entity_id", "activity_id"):
            val = data.pop(key, None)
            if val:
                setattr(instance, key, val)
        for attr, value in data.items():
            setattr(instance, attr, value)
        instance.save()

        if country_ids is not None:
            jurisdictions = list(JurisdictionRisk.objects.filter(id__in=country_ids))
            instance.countries.set(jurisdictions)
            max_weight = max((j.risk_weight for j in jurisdictions), default=1)
            instance.country_risk_level = services._risk_weight_to_level(max_weight)
            instance.save(update_fields=["country_risk_level"])

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


class SourceOfFundsCatalogViewSet(ModelViewSet):
    queryset = SourceOfFundsCatalog.objects.all()
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination
    http_method_names = ["get", "head", "options"]

    def get_serializer_class(self):
        return SourceOfFundsCatalogOutputSerializer


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
        from apps.compliance.models import JurisdictionRisk

        country_ids = data.pop("country_ids", None)
        for key in ("entity_id", "source_id"):
            val = data.pop(key, None)
            if val:
                setattr(instance, key, val)
        for attr, value in data.items():
            setattr(instance, attr, value)
        instance.save()

        if country_ids is not None:
            jurisdictions = list(JurisdictionRisk.objects.filter(id__in=country_ids))
            instance.countries.set(jurisdictions)
            max_weight = max((j.risk_weight for j in jurisdictions), default=1)
            instance.country_risk_level = services._risk_weight_to_level(max_weight)
            instance.save(update_fields=["country_risk_level"])

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
        data = serializer.validated_data
        person_id = data.pop("person_id", None)
        if person_id:
            instance.person_id = person_id
        for attr, value in data.items():
            setattr(instance, attr, value)
        instance.save()
        output = SourceOfWealthOutputSerializer(instance)
        return Response(output.data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = SourceOfWealthInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        person_id = data.pop("person_id", None)
        if person_id:
            instance.person_id = person_id
        for attr, value in data.items():
            setattr(instance, attr, value)
        instance.save()
        output = SourceOfWealthOutputSerializer(instance)
        return Response(output.data)
