import base64
import hashlib
import hmac
import logging

from celery.result import AsyncResult
from django.conf import settings as django_settings
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, extend_schema_view, inline_serializer
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework import serializers
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from common.pagination import StandardPagination

from apps.authentication.permissions import IsClient, IsDirector

from . import selectors, services
from .models import (
    AccountingRecord,
    AccountingRecordDocument,
    AutomaticTriggerRule,
    ComplianceDelegation,
    ComplianceSnapshot,
    DocumentUpload,
    DueDiligenceChecklist,
    EconomicSubstanceSubmission,
    JurisdictionConfig,
    JurisdictionRisk,
    KYCSubmission,
    OwnershipSnapshot,
    Party,
    RFI,
    RiskAssessment,
    RiskFactor,
    RiskMatrixConfig,
)
from .permissions import CanManageKYC, CanManageRFI, CanReviewKYC, CanScreenParties
from .serializers import (
    AccountingRecordDocumentOutputSerializer,
    AccountingRecordDocumentUploadInputSerializer,
    AccountingRecordListOutputSerializer,
    AccountingRecordOutputSerializer,
    AccountingRecordReviewInputSerializer,
    AccountingRecordSaveDraftInputSerializer,
    AccountingRecordSummaryOutputSerializer,
    ApproveWithChangesInputSerializer,
    AutomaticTriggerRuleInputSerializer,
    AutomaticTriggerRuleOutputSerializer,
    BulkCreateAccountingRecordsInputSerializer,
    CalculateRiskInputSerializer,
    ComplianceDelegationCreateInputSerializer,
    ComplianceDelegationOutputSerializer,
    ComplianceSnapshotInputSerializer,
    ComplianceSnapshotOutputSerializer,
    CreateForEntityInputSerializer,
    DocumentUploadInputSerializer,
    DocumentUploadOutputSerializer,
    DueDiligenceChecklistInputSerializer,
    DueDiligenceChecklistOutputSerializer,
    EconomicSubstanceCreateInputSerializer,
    EconomicSubstanceListOutputSerializer,
    EconomicSubstanceOutputSerializer,
    EconomicSubstanceSaveDraftInputSerializer,
    ESAdvanceStepInputSerializer,
    ESBulkCreateInputSerializer,
    ESRejectInputSerializer,
    EntitySnapshotOutputSerializer,
    ExtractDocumentInputSerializer,
    FieldCommentInputSerializer,
    HelpRequestInputSerializer,
    JurisdictionConfigInputSerializer,
    JurisdictionConfigOutputSerializer,
    JurisdictionRiskInputSerializer,
    JurisdictionRiskOutputSerializer,
    KYCSubmissionInputSerializer,
    KYCSubmissionOutputSerializer,
    LinkPersonInputSerializer,
    OnboardingInputSerializer,
    OnboardingOutputSerializer,
    OwnershipSnapshotOutputSerializer,
    PartyInputSerializer,
    PartyOutputSerializer,
    ProposeChangesInputSerializer,
    RFIInputSerializer,
    RFIOutputSerializer,
    RFIRespondInputSerializer,
    RiskAssessmentOutputSerializer,
    RiskFactorInputSerializer,
    RiskFactorOutputSerializer,
    RiskMatrixConfigInputSerializer,
    RiskMatrixConfigOutputSerializer,
    SaveOwnershipTreeInputSerializer,
    SendBackInputSerializer,
    WorldCheckCaseOutputSerializer,
)


class OnboardingRateThrottle(AnonRateThrottle):
    rate = "10/hour"

logger = logging.getLogger(__name__)


# ===========================================================================
# KYCSubmission ViewSet
# ===========================================================================


@extend_schema_view(
    list=extend_schema(summary="List KYC submissions"),
    retrieve=extend_schema(summary="Retrieve a KYC submission"),
    create=extend_schema(summary="Create a KYC submission"),
    update=extend_schema(summary="Update a KYC submission"),
    partial_update=extend_schema(summary="Partially update a KYC submission"),
    destroy=extend_schema(summary="Delete a KYC submission"),
)
class KYCSubmissionViewSet(ModelViewSet):
    queryset = KYCSubmission.objects.select_related("ticket", "reviewed_by").all()
    permission_classes = [IsAuthenticated, CanManageKYC]
    pagination_class = StandardPagination

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return KYCSubmissionInputSerializer
        return KYCSubmissionOutputSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        client_id = self.request.query_params.get("client_id")
        if client_id:
            qs = qs.filter(ticket__client_id=client_id)
        entity_id = self.request.query_params.get("entity_id")
        if entity_id:
            qs = qs.filter(ticket__entity_id=entity_id)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = KYCSubmissionInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        kyc = services.create_kyc_submission(
            ticket_id=serializer.validated_data["ticket_id"],
        )
        output = KYCSubmissionOutputSerializer(kyc)
        return Response(output.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = KYCSubmissionInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = services.update_kyc_submission(
            submission_id=instance.id,
            ticket_id=serializer.validated_data["ticket_id"],
        )
        output = KYCSubmissionOutputSerializer(instance)
        return Response(output.data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = KYCSubmissionInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        instance = services.update_kyc_submission(
            submission_id=instance.id,
            **serializer.validated_data,
        )
        output = KYCSubmissionOutputSerializer(instance)
        return Response(output.data)

    # ---- Lifecycle actions ----

    @extend_schema(
        summary="Submit a KYC submission for review",
        request=None,
        responses={200: KYCSubmissionOutputSerializer},
    )
    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, pk=None):
        kyc = services.submit_kyc(kyc_id=pk, submitted_by=request.user)
        return Response(KYCSubmissionOutputSerializer(kyc).data)

    # ---- Guest-facing entity actions ----

    @extend_schema(
        summary="Get entity data snapshot for the guest form",
        responses={200: EntitySnapshotOutputSerializer},
    )
    @action(
        detail=True,
        methods=["get"],
        url_path="entity-snapshot",
        permission_classes=[AllowAny],
    )
    def entity_snapshot(self, request, pk=None):
        """Return entity data snapshot for the guest form."""
        kyc = self._validate_guest_or_auth(request, pk)
        entity = kyc.ticket.entity
        if not entity:
            return Response(
                {"detail": "No entity linked to this KYC."},
                status=status.HTTP_404_NOT_FOUND,
            )
        snapshot = services.build_entity_snapshot(entity=entity)
        snapshot["field_comments"] = kyc.field_comments or {}
        snapshot["kyc_status"] = kyc.status
        snapshot["proposed_entity_data"] = kyc.proposed_entity_data or {}
        return Response(EntitySnapshotOutputSerializer(snapshot).data)

    @extend_schema(
        summary="Save proposed entity changes from the guest form",
        request=ProposeChangesInputSerializer,
        responses={200: KYCSubmissionOutputSerializer},
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="propose-changes",
        permission_classes=[AllowAny],
    )
    def propose_changes(self, request, pk=None):
        """Save proposed entity changes from the guest form."""
        kyc = self._validate_guest_or_auth(request, pk)
        serializer = ProposeChangesInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        kyc.proposed_entity_data = serializer.validated_data["proposed_entity_data"]
        kyc.save(update_fields=["proposed_entity_data", "updated_at"])
        return Response(KYCSubmissionOutputSerializer(kyc).data)

    @extend_schema(
        summary="Send back KYC to guest with field-level comments",
        request=SendBackInputSerializer,
        responses={200: KYCSubmissionOutputSerializer},
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="send-back",
        permission_classes=[IsAuthenticated, CanReviewKYC],
    )
    def send_back(self, request, pk=None):
        """Send back KYC to guest with field-level comments."""
        serializer = SendBackInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        kyc = services.send_back_kyc(
            kyc_id=pk,
            reviewed_by=request.user,
            field_comments=serializer.validated_data["field_comments"],
        )
        return Response(KYCSubmissionOutputSerializer(kyc).data)

    def _validate_guest_or_auth(self, request, kyc_id):
        """Validate either authenticated user or guest token."""
        from apps.authentication.models import GuestLink

        guest_token = request.headers.get("X-Guest-Token")
        if guest_token:
            try:
                link = GuestLink.objects.select_related(
                    "kyc_submission__ticket__entity"
                ).get(
                    token=guest_token, is_active=True, kyc_submission_id=kyc_id
                )
                if link.is_expired:
                    raise PermissionDenied("Guest link has expired.")
                return link.kyc_submission
            except GuestLink.DoesNotExist:
                raise PermissionDenied("Invalid guest token.")
        elif request.user and request.user.is_authenticated:
            return KYCSubmission.objects.select_related(
                "ticket__entity"
            ).get(id=kyc_id)
        else:
            raise PermissionDenied("Authentication required.")

    # ---- Guest person creation ----

    @extend_schema(
        summary="Create a new person and link as EntityOfficer from the guest form",
        request=inline_serializer(
            name="CreatePersonGuestInput",
            fields={
                "first_name": serializers.CharField(),
                "last_name": serializers.CharField(),
                "email": serializers.EmailField(required=False),
                "positions": serializers.ListField(child=serializers.CharField(), required=False),
            },
        ),
        responses={201: inline_serializer(
            name="PersonOutputInline",
            fields={
                "id": serializers.UUIDField(),
                "first_name": serializers.CharField(),
                "last_name": serializers.CharField(),
                "email": serializers.EmailField(),
            },
        )},
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="create-person",
        permission_classes=[AllowAny],
    )
    def create_person(self, request, pk=None):
        """Create a new person and link as EntityOfficer from the guest form."""
        from django.db import transaction
        from apps.core.serializers import PersonInputSerializer, PersonOutputSerializer
        from apps.core import services as core_services

        kyc = self._validate_guest_or_auth(request, pk)
        entity = kyc.ticket.entity
        if not entity:
            return Response(
                {"detail": "No entity linked to this KYC."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = PersonInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data
        validated.pop("client_id", None)

        # Validate positions through a dedicated serializer
        VALID_POSITIONS = [
            "director", "officer", "secretary", "president",
            "treasurer", "registered_agent", "authorized_signatory",
            "nominee_director", "protector", "enforcer",
        ]
        positions_serializer = inline_serializer(
            name="PositionsInput",
            fields={
                "positions": serializers.ListField(
                    child=serializers.ChoiceField(choices=[(p, p) for p in VALID_POSITIONS]),
                    default=["director"],
                ),
            },
        )(data=request.data)
        positions_serializer.is_valid(raise_exception=True)
        positions = positions_serializer.validated_data["positions"]

        with transaction.atomic():
            person = core_services.create_person(**validated)
            core_services.create_entity_officer(
                entity_id=entity.id,
                officer_person_id=person.id,
                positions=positions,
            )
            from apps.core.constants import AuditSource
            core_services.log_person_creation(
                person=person,
                changed_by=request.user if request.user.is_authenticated else None,
                source=AuditSource.GUEST_SUBMISSION,
            )

        return Response(
            PersonOutputSerializer(person).data,
            status=status.HTTP_201_CREATED,
        )

    # ---- Approval/rejection actions ----

    @extend_schema(
        summary="Approve a KYC submission with optional entity data modifications",
        request=ApproveWithChangesInputSerializer,
        responses={200: KYCSubmissionOutputSerializer},
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="approve",
        permission_classes=[IsAuthenticated, CanReviewKYC],
    )
    def approve(self, request, pk=None):
        serializer = ApproveWithChangesInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        modified = serializer.validated_data.get("modified_data")
        kyc = services.approve_kyc_with_entity_changes(
            kyc_id=pk, reviewed_by=request.user, modified_data=modified
        )
        return Response(KYCSubmissionOutputSerializer(kyc).data)

    @extend_schema(
        summary="Reject a KYC submission",
        request=None,
        responses={200: KYCSubmissionOutputSerializer},
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="reject",
        permission_classes=[IsAuthenticated, CanReviewKYC],
    )
    def reject(self, request, pk=None):
        kyc = services.reject_kyc(kyc_id=pk, reviewed_by=request.user)
        return Response(KYCSubmissionOutputSerializer(kyc).data)

    @extend_schema(
        summary="Escalate a KYC submission to a higher authority",
        request=None,
        responses={200: KYCSubmissionOutputSerializer},
    )
    @action(detail=True, methods=["post"], url_path="escalate")
    def escalate(self, request, pk=None):
        kyc = services.escalate_kyc(kyc_id=pk, escalated_by=request.user)
        return Response(KYCSubmissionOutputSerializer(kyc).data)

    # ---- Risk actions ----

    @extend_schema(
        summary="Calculate risk score for a KYC submission",
        request=CalculateRiskInputSerializer,
        responses={200: RiskAssessmentOutputSerializer},
    )
    @action(detail=True, methods=["post"], url_path="calculate-risk")
    def calculate_risk(self, request, pk=None):
        serializer = CalculateRiskInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assessment = services.calculate_risk_score(
            kyc_id=pk,
            trigger=serializer.validated_data.get("trigger", "manual"),
        )
        return Response(RiskAssessmentOutputSerializer(assessment).data)

    @extend_schema(
        summary="Get the current risk assessment for a KYC submission",
        responses={200: RiskAssessmentOutputSerializer},
    )
    @action(detail=True, methods=["get"], url_path="risk-assessment")
    def risk_assessment(self, request, pk=None):
        assessment = selectors.get_current_risk_assessment(kyc_id=pk)
        if assessment is None:
            return Response(
                {"message": "No risk assessment found for this KYC submission."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(RiskAssessmentOutputSerializer(assessment).data)

    @extend_schema(
        summary="Get the risk assessment history for a KYC submission",
        responses={200: RiskAssessmentOutputSerializer(many=True)},
    )
    @action(detail=True, methods=["get"], url_path="risk-history")
    def risk_history(self, request, pk=None):
        history = selectors.get_risk_history(kyc_id=pk)
        page = self.paginate_queryset(history)
        if page is not None:
            serializer = RiskAssessmentOutputSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = RiskAssessmentOutputSerializer(history, many=True)
        return Response(serializer.data)

    # ---- Document actions ----

    @extend_schema(
        summary="Upload a document for a KYC submission",
        request=DocumentUploadInputSerializer,
        responses={201: DocumentUploadOutputSerializer},
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="documents/upload",
        url_name="documents-upload",
    )
    def documents_upload(self, request, pk=None):
        serializer = DocumentUploadInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uploaded_file = serializer.validated_data["file"]
        file_data = {
            "original_filename": uploaded_file.name,
            "file_size": uploaded_file.size,
            "mime_type": uploaded_file.content_type or "",
            "file_bytes_b64": base64.b64encode(uploaded_file.read()).decode("utf-8"),
        }

        doc = services.upload_kyc_document(
            kyc_id=pk,
            party_id=serializer.validated_data.get("party_id"),
            document_type=serializer.validated_data["document_type"],
            file_data=file_data,
            uploaded_by=request.user,
        )
        return Response(
            DocumentUploadOutputSerializer(doc).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        summary="List documents for a KYC submission",
        responses={200: DocumentUploadOutputSerializer(many=True)},
    )
    @action(
        detail=True,
        methods=["get"],
        url_path="documents",
        url_name="documents-list",
        permission_classes=[AllowAny],
    )
    def documents_list(self, request, pk=None):
        self._validate_guest_or_auth(request, pk)
        documents = DocumentUpload.objects.filter(kyc_submission_id=pk).order_by(
            "-created_at"
        )
        page = self.paginate_queryset(documents)
        if page is not None:
            serializer = DocumentUploadOutputSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = DocumentUploadOutputSerializer(documents, many=True)
        return Response(serializer.data)

    # ---- Nested RFIs (list + create) ----

    @extend_schema(
        summary="List or create RFIs for a KYC submission",
        request=RFIInputSerializer,
        responses={200: RFIOutputSerializer(many=True), 201: RFIOutputSerializer},
    )
    @action(
        detail=True,
        methods=["get", "post"],
        url_path="rfis",
        url_name="rfis",
        permission_classes=[IsAuthenticated, CanManageRFI],
    )
    def rfis(self, request, pk=None):
        if request.method == "GET":
            rfis = RFI.objects.filter(kyc_submission_id=pk).order_by("-created_at")
            page = self.paginate_queryset(rfis)
            if page is not None:
                serializer = RFIOutputSerializer(page, many=True)
                return self.get_paginated_response(serializer.data)
            return Response(RFIOutputSerializer(rfis, many=True).data)

        # POST - create RFI
        serializer = RFIInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rfi = services.create_rfi(
            kyc_id=pk,
            requested_by=request.user,
            requested_fields=serializer.validated_data["requested_fields"],
            notes=serializer.validated_data.get("notes", ""),
        )
        return Response(
            RFIOutputSerializer(rfi).data, status=status.HTTP_201_CREATED
        )

    # ---- Nested parties (list + create) ----

    @extend_schema(
        summary="List or create parties for a KYC submission",
        request=PartyInputSerializer,
        responses={200: PartyOutputSerializer(many=True), 201: PartyOutputSerializer},
    )
    @action(detail=True, methods=["get", "post"], url_path="parties", url_name="parties")
    def parties(self, request, pk=None):
        if request.method == "GET":
            parties = selectors.get_parties_for_kyc(kyc_id=pk)
            page = self.paginate_queryset(parties)
            if page is not None:
                serializer = PartyOutputSerializer(page, many=True)
                return self.get_paginated_response(serializer.data)
            return Response(PartyOutputSerializer(parties, many=True).data)

        # POST - create party
        serializer = PartyInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data.copy()
        person_id = data.pop("person_id", None)
        party = services.add_party_to_kyc(kyc_id=pk, party_data=data)
        if person_id:
            party = services.link_existing_person_to_party(
                party_id=party.id, person_id=person_id
            )
        return Response(
            PartyOutputSerializer(party).data, status=status.HTTP_201_CREATED
        )


# ===========================================================================
# Party ViewSet (standalone for single-party operations)
# ===========================================================================


@extend_schema_view(
    list=extend_schema(summary="List parties"),
    retrieve=extend_schema(summary="Retrieve a party"),
    create=extend_schema(summary="Create a party"),
    update=extend_schema(summary="Update a party"),
    partial_update=extend_schema(summary="Partially update a party"),
    destroy=extend_schema(summary="Delete a party"),
)
class PartyViewSet(ModelViewSet):
    queryset = Party.objects.select_related("kyc_submission", "person").all()
    permission_classes = [IsAuthenticated, CanManageKYC]
    pagination_class = StandardPagination

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return PartyInputSerializer
        return PartyOutputSerializer

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = PartyInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data.copy()
        person_id = data.pop("person_id", None)
        party = services.update_party(
            party_id=instance.id, person_id=person_id, **data
        )
        return Response(PartyOutputSerializer(party).data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = PartyInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data.copy()
        person_id = data.pop("person_id", None)
        party = services.update_party(
            party_id=instance.id, person_id=person_id, **data
        )
        return Response(PartyOutputSerializer(party).data)

    @extend_schema(
        summary="Dispatch a World-Check screening task for this party",
        request=None,
        responses={202: inline_serializer(
            name="ScreenPartyResponse",
            fields={
                "task_id": serializers.CharField(),
                "party_id": serializers.UUIDField(),
                "status": serializers.CharField(),
            },
        )},
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="screen",
        permission_classes=[IsAuthenticated, CanScreenParties],
    )
    def screen(self, request, pk=None):
        """Dispatch a World-Check screening task for this party."""
        from .tasks import screen_party_worldcheck

        party = self.get_object()
        task = screen_party_worldcheck.delay(str(party.id))

        # Register task ownership for TaskStatusView validation
        from django.core.cache import cache

        cache.set(f"celery_task_owner:{task.id}", str(request.user.id), timeout=3600)

        return Response(
            {"task_id": task.id, "party_id": str(party.id), "status": "dispatched"},
            status=status.HTTP_202_ACCEPTED,
        )

    @extend_schema(
        summary="Get World-Check screening results for this party",
        responses={200: WorldCheckCaseOutputSerializer(many=True)},
    )
    @action(detail=True, methods=["get"], url_path="worldcheck")
    def worldcheck(self, request, pk=None):
        """Return World-Check screening results for this party."""
        cases = selectors.get_worldcheck_results(party_id=pk)
        page = self.paginate_queryset(cases)
        if page is not None:
            serializer = WorldCheckCaseOutputSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        return Response(WorldCheckCaseOutputSerializer(cases, many=True).data)

    @extend_schema(
        summary="Link an existing Person to this party",
        request=LinkPersonInputSerializer,
        responses={200: PartyOutputSerializer},
    )
    @action(detail=True, methods=["post"], url_path="link-person")
    def link_person(self, request, pk=None):
        """Link an existing core.Person to this party."""
        serializer = LinkPersonInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        party = services.link_existing_person_to_party(
            party_id=pk, person_id=serializer.validated_data["person_id"]
        )
        return Response(PartyOutputSerializer(party).data)


# ===========================================================================
# RFI ViewSet
# ===========================================================================


@extend_schema_view(
    list=extend_schema(summary="List RFIs"),
    retrieve=extend_schema(summary="Retrieve an RFI"),
    create=extend_schema(summary="Create an RFI"),
    update=extend_schema(summary="Update an RFI"),
    partial_update=extend_schema(summary="Partially update an RFI"),
    destroy=extend_schema(summary="Delete an RFI"),
)
class RFIViewSet(ModelViewSet):
    queryset = RFI.objects.select_related(
        "kyc_submission", "requested_by"
    ).all()
    permission_classes = [IsAuthenticated, CanManageRFI]
    pagination_class = StandardPagination

    def get_serializer_class(self):
        if self.action in ("create",):
            return RFIInputSerializer
        return RFIOutputSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        kyc_id = self.request.query_params.get("kyc_id")
        if kyc_id:
            qs = qs.filter(kyc_submission_id=kyc_id)
        return qs

    @extend_schema(
        summary="Respond to an RFI",
        request=RFIRespondInputSerializer,
        responses={200: RFIOutputSerializer},
    )
    @action(detail=True, methods=["post"], url_path="respond")
    def respond(self, request, pk=None):
        serializer = RFIRespondInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rfi = services.respond_to_rfi(
            rfi_id=pk,
            response_text=serializer.validated_data["response_text"],
        )
        return Response(RFIOutputSerializer(rfi).data)


# ===========================================================================
# JurisdictionRisk ViewSet
# ===========================================================================


@extend_schema_view(
    list=extend_schema(summary="List jurisdiction risks"),
    retrieve=extend_schema(summary="Retrieve a jurisdiction risk"),
    create=extend_schema(summary="Create a jurisdiction risk"),
    update=extend_schema(summary="Update a jurisdiction risk"),
    partial_update=extend_schema(summary="Partially update a jurisdiction risk"),
    destroy=extend_schema(summary="Delete a jurisdiction risk"),
)
class JurisdictionRiskViewSet(ModelViewSet):
    queryset = JurisdictionRisk.objects.all()
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination

    def get_permissions(self):
        if self.action in ("create", "partial_update", "update", "destroy"):
            return [IsAuthenticated(), IsDirector()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action in ("create", "partial_update", "update"):
            return JurisdictionRiskInputSerializer
        return JurisdictionRiskOutputSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        ordering = self.request.query_params.get("ordering")
        if ordering in ("risk_weight", "-risk_weight", "country_name", "-country_name"):
            qs = qs.order_by(ordering)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = JurisdictionRiskInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        jurisdiction_risk = JurisdictionRisk.objects.create(
            **serializer.validated_data
        )
        return Response(
            JurisdictionRiskOutputSerializer(jurisdiction_risk).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = JurisdictionRiskInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        jr = services.update_jurisdiction_risk(
            jurisdiction_risk_id=instance.id, **serializer.validated_data
        )
        return Response(JurisdictionRiskOutputSerializer(jr).data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = JurisdictionRiskInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        jr = services.update_jurisdiction_risk(
            jurisdiction_risk_id=instance.id, **serializer.validated_data
        )
        return Response(JurisdictionRiskOutputSerializer(jr).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ===========================================================================
# Standalone API Views
# ===========================================================================


class GuestOrAuthMixin:
    """Mixin that validates either authenticated user or guest token."""

    def _validate_guest_or_auth(self, request):
        """Return the user if authenticated, or validate guest token."""
        from apps.authentication.models import GuestLink

        guest_token = request.headers.get("X-Guest-Token")
        if guest_token:
            try:
                link = GuestLink.objects.get(token=guest_token, is_active=True)
                if link.is_expired:
                    raise PermissionDenied("Guest link has expired.")
                return None  # Guest user — no Django user
            except GuestLink.DoesNotExist:
                raise PermissionDenied("Invalid guest token.")
        elif request.user and request.user.is_authenticated:
            return request.user
        else:
            raise PermissionDenied("Authentication required.")

    def _get_uploader(self, request):
        """Return the user for document upload, or system user for guests."""
        user = self._validate_guest_or_auth(request)
        if user is None:
            return services._get_system_user()
        return user


class ExtractDocumentView(GuestOrAuthMixin, APIView):
    """POST: Accept a file and dispatch LLM extraction as a Celery task."""

    permission_classes = [AllowAny]

    @extend_schema(
        summary="Upload a document and dispatch LLM extraction",
        request=ExtractDocumentInputSerializer,
        responses={202: inline_serializer(
            name="ExtractDocumentResponse",
            fields={
                "task_id": serializers.CharField(),
                "document_upload_id": serializers.UUIDField(),
                "status": serializers.CharField(),
            },
        )},
    )
    def post(self, request):
        uploader = self._get_uploader(request)

        serializer = ExtractDocumentInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uploaded_file = serializer.validated_data["file"]
        document_type = serializer.validated_data["document_type"]

        # Read file bytes for LLM extraction
        file_b64 = base64.b64encode(uploaded_file.read()).decode("utf-8")

        # Create a DocumentUpload record for tracking (no KYC/party required for standalone extraction)
        doc = DocumentUpload.objects.create(
            document_type=document_type,
            original_filename=uploaded_file.name,
            file_size=uploaded_file.size,
            mime_type=uploaded_file.content_type or "",
            uploaded_by=uploader,
        )

        # Dispatch extraction task with file bytes
        from .tasks import extract_document_data

        task = extract_document_data.delay(str(doc.id), file_b64)

        # Register task ownership for TaskStatusView validation
        from django.core.cache import cache

        guest_token = request.headers.get("X-Guest-Token", "")
        caller_id = guest_token if guest_token else str(getattr(request.user, "id", ""))
        cache.set(f"celery_task_owner:{task.id}", caller_id, timeout=3600)

        return Response(
            {
                "task_id": task.id,
                "document_upload_id": str(doc.id),
                "status": "processing",
            },
            status=status.HTTP_202_ACCEPTED,
        )


class WorldCheckWebhookView(APIView):
    """Receive World-Check webhook notifications.

    This endpoint is unauthenticated since it is called by the
    World-Check One platform.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        summary="Receive World-Check webhook notification",
        request=inline_serializer(
            name="WorldCheckWebhookInput",
            fields={
                "event": serializers.CharField(required=False),
                "data": serializers.DictField(required=False),
            },
        ),
        responses={202: inline_serializer(
            name="WorldCheckWebhookResponse",
            fields={
                "message": serializers.CharField(),
                "task_id": serializers.CharField(),
            },
        )},
    )
    def post(self, request):
        # HMAC signature verification
        webhook_secret = getattr(django_settings, "WORLDCHECK_WEBHOOK_SECRET", "")
        if webhook_secret:
            signature = request.headers.get("X-Signature", "")
            expected = hmac.new(
                webhook_secret.encode(),
                request.body,
                hashlib.sha256,
            ).hexdigest()
            if not hmac.compare_digest(signature, expected):
                return Response(
                    {"message": "Invalid webhook signature."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        else:
            if not django_settings.DEBUG:
                return Response(
                    {"message": "Webhook secret not configured"},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            logger.warning(
                "WORLDCHECK_WEBHOOK_SECRET not configured — "
                "accepting in DEBUG mode"
            )

        payload = request.data

        if not payload:
            return Response(
                {"message": "Empty payload received."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Dispatch processing asynchronously
        from .tasks import process_worldcheck_webhook

        task = process_worldcheck_webhook.delay(payload)

        logger.info("World-Check webhook received, dispatched task %s", task.id)
        return Response(
            {"message": "Webhook received.", "task_id": task.id},
            status=status.HTTP_202_ACCEPTED,
        )


class TaskStatusView(GuestOrAuthMixin, APIView):
    """GET: Check the status of a Celery task by task_id."""

    permission_classes = [AllowAny]

    # Map Celery states to frontend-expected statuses
    _STATUS_MAP = {
        "PENDING": "pending",
        "STARTED": "running",
        "SUCCESS": "completed",
        "FAILURE": "failed",
        "RETRY": "running",
    }

    @extend_schema(
        summary="Check the status of a Celery task",
        responses={200: inline_serializer(
            name="TaskStatusResponse",
            fields={
                "task_id": serializers.CharField(),
                "status": serializers.ChoiceField(choices=["pending", "running", "completed", "failed"]),
                "data": serializers.DictField(required=False),
                "error": serializers.CharField(required=False),
            },
        )},
    )
    def get(self, request, task_id):
        self._validate_guest_or_auth(request)

        # Validate task ownership: only the session that dispatched the task can poll it
        from django.core.cache import cache

        owner_key = f"celery_task_owner:{task_id}"
        expected_owner = cache.get(owner_key)
        if expected_owner is not None:
            guest_token = request.headers.get("X-Guest-Token", "")
            caller_id = guest_token if guest_token else str(getattr(request.user, "id", ""))
            if caller_id != expected_owner:
                raise PermissionDenied("You do not have access to this task.")

        result = AsyncResult(task_id)
        mapped_status = self._STATUS_MAP.get(result.status, "pending")

        response_data = {
            "task_id": task_id,
            "status": mapped_status,
        }

        if result.ready():
            if result.successful():
                task_result = result.result or {}
                # Return extraction data under "data" key for useTaskPolling
                response_data["data"] = task_result.get("data", task_result)
            else:
                response_data["error"] = str(result.result)

        return Response(response_data)


# ===========================================================================
# Client Portal ViewSet
# ===========================================================================


@extend_schema_view(
    list=extend_schema(summary="List client portal KYC submissions"),
    retrieve=extend_schema(summary="Retrieve a client portal KYC submission"),
)
class ClientPortalViewSet(ModelViewSet):
    """Portal endpoints for client users to view their own KYC submissions."""

    permission_classes = [IsAuthenticated, IsClient]
    pagination_class = StandardPagination
    http_method_names = ["get", "post", "head", "options"]

    def get_serializer_class(self):
        return KYCSubmissionOutputSerializer

    def get_queryset(self):
        user = self.request.user
        if not user.client_id:
            return KYCSubmission.objects.none()
        return (
            KYCSubmission.objects.filter(ticket__client=user.client)
            .select_related("ticket", "reviewed_by")
            .order_by("-created_at")
        )

    @extend_schema(
        summary="List parties for a client's KYC submission",
        responses={200: PartyOutputSerializer(many=True)},
    )
    @action(detail=True, methods=["get"], url_path="parties", url_name="parties")
    def parties(self, request, pk=None):
        kyc = self.get_object()
        parties = kyc.parties.all().order_by("created_at")
        page = self.paginate_queryset(parties)
        if page is not None:
            serializer = PartyOutputSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        return Response(PartyOutputSerializer(parties, many=True).data)

    @extend_schema(
        summary="List RFIs for a client's KYC submission",
        responses={200: RFIOutputSerializer(many=True)},
    )
    @action(detail=True, methods=["get"], url_path="rfis", url_name="rfis")
    def rfis(self, request, pk=None):
        kyc = self.get_object()
        rfis = RFI.objects.filter(kyc_submission=kyc).order_by("-created_at")
        page = self.paginate_queryset(rfis)
        if page is not None:
            serializer = RFIOutputSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        return Response(RFIOutputSerializer(rfis, many=True).data)

    @extend_schema(
        summary="Respond to an RFI as a client",
        request=RFIRespondInputSerializer,
        responses={200: RFIOutputSerializer},
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="rfis/(?P<rfi_id>[^/.]+)/respond",
        url_name="rfi-respond",
    )
    def rfi_respond(self, request, pk=None, rfi_id=None):
        kyc = self.get_object()
        # Verify RFI belongs to this KYC
        rfi = RFI.objects.filter(kyc_submission=kyc, id=rfi_id).first()
        if not rfi:
            return Response(
                {"detail": "RFI not found."}, status=status.HTTP_404_NOT_FOUND
            )
        serializer = RFIRespondInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rfi = services.respond_to_rfi(
            rfi_id=rfi_id,
            response_text=serializer.validated_data["response_text"],
        )
        return Response(RFIOutputSerializer(rfi).data)

    @extend_schema(
        summary="List documents for a client's KYC submission",
        responses={200: DocumentUploadOutputSerializer(many=True)},
    )
    @action(detail=True, methods=["get"], url_path="documents", url_name="documents")
    def documents(self, request, pk=None):
        kyc = self.get_object()
        documents = DocumentUpload.objects.filter(kyc_submission=kyc).order_by(
            "-created_at"
        )
        page = self.paginate_queryset(documents)
        if page is not None:
            serializer = DocumentUploadOutputSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        return Response(DocumentUploadOutputSerializer(documents, many=True).data)

    @extend_schema(
        summary="Upload a document for a client's KYC submission",
        request=DocumentUploadInputSerializer,
        responses={201: DocumentUploadOutputSerializer},
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="documents/upload",
        url_name="documents-upload",
    )
    def documents_upload(self, request, pk=None):
        kyc = self.get_object()
        serializer = DocumentUploadInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uploaded_file = serializer.validated_data["file"]
        file_data = {
            "original_filename": uploaded_file.name,
            "file_size": uploaded_file.size,
            "mime_type": uploaded_file.content_type or "",
            "file_bytes_b64": base64.b64encode(uploaded_file.read()).decode("utf-8"),
        }

        doc = services.upload_kyc_document(
            kyc_id=str(kyc.id),
            party_id=serializer.validated_data.get("party_id"),
            document_type=serializer.validated_data["document_type"],
            file_data=file_data,
            uploaded_by=request.user,
        )
        return Response(
            DocumentUploadOutputSerializer(doc).data,
            status=status.HTTP_201_CREATED,
        )


# ===========================================================================
# Self-Service Onboarding
# ===========================================================================


class SelfServiceOnboardingView(APIView):
    """Public endpoint for external clients to initiate a KYC onboarding.

    Creates Client + Entity + Ticket + KYC + GuestLink and returns
    the guest link token for redirect.
    """

    permission_classes = [AllowAny]
    throttle_classes = [OnboardingRateThrottle]

    @extend_schema(
        summary="Initiate a self-service KYC onboarding",
        request=OnboardingInputSerializer,
        responses={201: OnboardingOutputSerializer},
    )
    def post(self, request):
        serializer = OnboardingInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = services.create_self_service_onboarding(
            **serializer.validated_data
        )

        output = OnboardingOutputSerializer({
            "guest_link_token": result["guest_link"].token,
            "kyc_id": result["kyc_submission"].id,
            "client_id": result["client"].id,
            "entity_id": result["entity"].id,
            "expires_at": result["guest_link"].expires_at,
        })
        return Response(output.data, status=status.HTTP_201_CREATED)


# ===========================================================================
# Risk Matrix Config ViewSet
# ===========================================================================


@extend_schema_view(
    list=extend_schema(summary="List risk matrix configs"),
    retrieve=extend_schema(summary="Retrieve a risk matrix config"),
    create=extend_schema(summary="Create a risk matrix config"),
    update=extend_schema(summary="Update a risk matrix config"),
    partial_update=extend_schema(summary="Partially update a risk matrix config"),
    destroy=extend_schema(summary="Delete a risk matrix config"),
)
class RiskMatrixConfigViewSet(ModelViewSet):
    queryset = RiskMatrixConfig.objects.prefetch_related("factors", "trigger_rules").all()
    permission_classes = [IsAuthenticated, CanReviewKYC]
    pagination_class = StandardPagination

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return RiskMatrixConfigInputSerializer
        return RiskMatrixConfigOutputSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        is_active = self.request.query_params.get("is_active")
        if is_active is not None and is_active != "":
            qs = qs.filter(is_active=is_active.lower() == "true")
        jurisdiction = self.request.query_params.get("jurisdiction")
        if jurisdiction:
            qs = qs.filter(jurisdiction=jurisdiction)
        return qs.order_by("-version")

    def create(self, request, *args, **kwargs):
        serializer = RiskMatrixConfigInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        config = RiskMatrixConfig.objects.create(
            **serializer.validated_data, created_by=request.user
        )
        output = RiskMatrixConfigOutputSerializer(config)
        return Response(output.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = RiskMatrixConfigInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        config = services.update_risk_matrix_config(
            config_id=instance.id, **serializer.validated_data
        )
        return Response(RiskMatrixConfigOutputSerializer(config).data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = RiskMatrixConfigInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        config = services.update_risk_matrix_config(
            config_id=instance.id, **serializer.validated_data
        )
        return Response(RiskMatrixConfigOutputSerializer(config).data)

    @extend_schema(
        summary="Duplicate a risk matrix config with a new version",
        request=None,
        responses={201: RiskMatrixConfigOutputSerializer},
    )
    @action(detail=True, methods=["post"], url_path="duplicate")
    def duplicate(self, request, pk=None):
        """Clone this config with a new version number."""
        config = self.get_object()
        new_config = services.duplicate_risk_matrix_config(
            config_id=config.id, performed_by=request.user,
        )
        return Response(
            RiskMatrixConfigOutputSerializer(new_config).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        summary="Activate this risk matrix config and deactivate others in same scope",
        request=None,
        responses={200: RiskMatrixConfigOutputSerializer},
    )
    @action(detail=True, methods=["post"], url_path="activate")
    def activate(self, request, pk=None):
        """Activate this config (deactivate others with same scope)."""
        config = self.get_object()
        config = services.activate_risk_matrix_config(config_id=config.id)

        # Dispatch batch recalculation for entities in this scope
        recalc_warning = None
        try:
            services.batch_recalculate_on_config_change(config_id=config.id)
        except Exception as exc:
            logger.warning(
                "Failed to dispatch batch recalculation for config %s: %s",
                config.id, exc, exc_info=True,
            )
            recalc_warning = (
                f"Config activated successfully, but batch recalculation "
                f"dispatch failed: {exc}"
            )

        data = RiskMatrixConfigOutputSerializer(config).data
        if recalc_warning:
            data["warning"] = recalc_warning
        return Response(data)

    # ---- Nested factors CRUD ----

    @extend_schema(
        summary="List or create risk factors for a matrix config",
        request=RiskFactorInputSerializer,
        responses={200: RiskFactorOutputSerializer(many=True), 201: RiskFactorOutputSerializer},
    )
    @action(detail=True, methods=["get", "post"], url_path="factors")
    def factors(self, request, pk=None):
        config = self.get_object()
        if request.method == "GET":
            factors = config.factors.all().order_by("category", "code")
            return Response(RiskFactorOutputSerializer(factors, many=True).data)

        serializer = RiskFactorInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        factor = RiskFactor.objects.create(
            matrix_config=config, **serializer.validated_data
        )
        return Response(
            RiskFactorOutputSerializer(factor).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        summary="Update or delete a specific risk factor",
        request=RiskFactorInputSerializer,
        responses={200: RiskFactorOutputSerializer, 204: None},
    )
    @action(detail=True, methods=["put", "delete"], url_path="factors/(?P<factor_id>[^/.]+)")
    def factor_detail(self, request, pk=None, factor_id=None):
        config = self.get_object()
        factor = get_object_or_404(RiskFactor, id=factor_id, matrix_config=config)

        if request.method == "DELETE":
            factor.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        serializer = RiskFactorInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        for attr, value in serializer.validated_data.items():
            setattr(factor, attr, value)
        factor.save()
        return Response(RiskFactorOutputSerializer(factor).data)

    # ---- Nested trigger rules CRUD ----

    @extend_schema(
        summary="List or create automatic trigger rules for a matrix config",
        request=AutomaticTriggerRuleInputSerializer,
        responses={200: AutomaticTriggerRuleOutputSerializer(many=True), 201: AutomaticTriggerRuleOutputSerializer},
    )
    @action(detail=True, methods=["get", "post"], url_path="trigger-rules")
    def trigger_rules(self, request, pk=None):
        config = self.get_object()
        if request.method == "GET":
            rules = config.trigger_rules.all()
            return Response(AutomaticTriggerRuleOutputSerializer(rules, many=True).data)

        serializer = AutomaticTriggerRuleInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rule = AutomaticTriggerRule.objects.create(
            matrix_config=config, **serializer.validated_data
        )
        return Response(
            AutomaticTriggerRuleOutputSerializer(rule).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        summary="Update or delete a specific trigger rule",
        request=AutomaticTriggerRuleInputSerializer,
        responses={200: AutomaticTriggerRuleOutputSerializer, 204: None},
    )
    @action(detail=True, methods=["put", "delete"], url_path="trigger-rules/(?P<rule_id>[^/.]+)")
    def trigger_rule_detail(self, request, pk=None, rule_id=None):
        config = self.get_object()
        rule = get_object_or_404(AutomaticTriggerRule, id=rule_id, matrix_config=config)

        if request.method == "DELETE":
            rule.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        serializer = AutomaticTriggerRuleInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        for attr, value in serializer.validated_data.items():
            setattr(rule, attr, value)
        rule.save()
        return Response(AutomaticTriggerRuleOutputSerializer(rule).data)


# ===========================================================================
# Risk Stats
# ===========================================================================


class RiskStatsView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get aggregated risk statistics",
        responses={200: inline_serializer(
            name="RiskStatsResponse",
            fields={
                "total_assessments": serializers.IntegerField(),
                "high_risk_count": serializers.IntegerField(),
                "medium_risk_count": serializers.IntegerField(),
                "low_risk_count": serializers.IntegerField(),
                "average_score": serializers.FloatField(),
            },
        )},
    )
    def get(self, request):
        stats = selectors.get_risk_stats()
        return Response(stats)


# ===========================================================================
# Entity/Person Risk Views
# ===========================================================================


class EntityRiskView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get the current risk assessment for an entity",
        responses={200: RiskAssessmentOutputSerializer},
    )
    def get(self, request, entity_id):
        assessment = selectors.get_current_entity_risk(entity_id=entity_id)
        if assessment is None:
            return Response(
                {"message": "No risk assessment found for this entity."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(RiskAssessmentOutputSerializer(assessment).data)


class EntityRiskHistoryView(APIView):
    permission_classes = [IsAuthenticated, CanReviewKYC]
    pagination_class = StandardPagination

    @extend_schema(
        summary="Get the risk assessment history for an entity",
        responses={200: RiskAssessmentOutputSerializer(many=True)},
    )
    def get(self, request, entity_id):
        history = selectors.get_entity_risk_history(entity_id=entity_id)
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(history, request)
        if page is not None:
            serializer = RiskAssessmentOutputSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)
        return Response(RiskAssessmentOutputSerializer(history, many=True).data)


class EntityCalculateRiskView(APIView):
    permission_classes = [IsAuthenticated, CanReviewKYC]

    @extend_schema(
        summary="Calculate risk score for an entity",
        request=CalculateRiskInputSerializer,
        responses={200: RiskAssessmentOutputSerializer},
    )
    def post(self, request, entity_id):
        serializer = CalculateRiskInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assessment = services.calculate_entity_risk(
            entity_id=entity_id,
            trigger=serializer.validated_data.get("trigger", "manual"),
            assessed_by=request.user,
        )
        return Response(RiskAssessmentOutputSerializer(assessment).data)


class PersonRiskView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get the current risk assessment for a person",
        responses={200: RiskAssessmentOutputSerializer},
    )
    def get(self, request, person_id):
        assessment = selectors.get_current_person_risk(person_id=person_id)
        if assessment is None:
            return Response(
                {"message": "No risk assessment found for this person."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(RiskAssessmentOutputSerializer(assessment).data)


class PersonRiskHistoryView(APIView):
    permission_classes = [IsAuthenticated, CanReviewKYC]
    pagination_class = StandardPagination

    @extend_schema(
        summary="Get the risk assessment history for a person",
        responses={200: RiskAssessmentOutputSerializer(many=True)},
    )
    def get(self, request, person_id):
        history = selectors.get_person_risk_history(person_id=person_id)
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(history, request)
        if page is not None:
            serializer = RiskAssessmentOutputSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)
        return Response(RiskAssessmentOutputSerializer(history, many=True).data)


class PersonCalculateRiskView(APIView):
    permission_classes = [IsAuthenticated, CanReviewKYC]

    @extend_schema(
        summary="Calculate risk score for a person",
        request=CalculateRiskInputSerializer,
        responses={200: RiskAssessmentOutputSerializer},
    )
    def post(self, request, person_id):
        serializer = CalculateRiskInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assessment = services.calculate_person_risk(
            person_id=person_id,
            trigger=serializer.validated_data.get("trigger", "manual"),
            assessed_by=request.user,
        )
        return Response(RiskAssessmentOutputSerializer(assessment).data)


# ===========================================================================
# Compliance Snapshot ViewSet
# ===========================================================================


@extend_schema_view(
    list=extend_schema(summary="List compliance snapshots"),
    retrieve=extend_schema(summary="Retrieve a compliance snapshot"),
    create=extend_schema(summary="Create a compliance snapshot"),
)
class ComplianceSnapshotViewSet(ModelViewSet):
    queryset = ComplianceSnapshot.objects.all().order_by("-snapshot_date")
    permission_classes = [IsAuthenticated, CanReviewKYC]
    pagination_class = StandardPagination
    http_method_names = ["get", "post", "head", "options"]

    def get_serializer_class(self):
        if self.action == "create":
            return ComplianceSnapshotInputSerializer
        return ComplianceSnapshotOutputSerializer

    def create(self, request, *args, **kwargs):
        serializer = ComplianceSnapshotInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        snapshot = services.create_compliance_snapshot(
            name=serializer.validated_data["name"],
            notes=serializer.validated_data.get("notes", ""),
            created_by=request.user,
        )
        return Response(
            ComplianceSnapshotOutputSerializer(snapshot).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        summary="List risk assessments for a compliance snapshot",
        responses={200: RiskAssessmentOutputSerializer(many=True)},
    )
    @action(detail=True, methods=["get"], url_path="assessments")
    def assessments(self, request, pk=None):
        assessments = selectors.get_snapshot_assessments(snapshot_id=pk)
        risk_level = request.query_params.get("risk_level")
        if risk_level:
            assessments = assessments.filter(risk_level=risk_level)
        return Response(RiskAssessmentOutputSerializer(assessments, many=True).data)

    @extend_schema(
        summary="Export a compliance snapshot as PDF",
        responses={(200, "application/pdf"): bytes},
    )
    @action(detail=True, methods=["get"], url_path="export-pdf")
    def export_pdf(self, request, pk=None):
        try:
            pdf_bytes = services.generate_snapshot_pdf(snapshot_id=pk)
            response = HttpResponse(pdf_bytes, content_type="application/pdf")
            response["Content-Disposition"] = f'attachment; filename="snapshot_{pk}.pdf"'
            return response
        except Exception as exc:
            return Response(
                {"detail": f"PDF generation failed: {str(exc)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# ===========================================================================
# PDF Export
# ===========================================================================


class RiskAssessmentExportPDFView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Export a risk assessment as PDF",
        responses={(200, "application/pdf"): bytes},
    )
    def get(self, request, assessment_id):
        try:
            pdf_bytes = services.generate_risk_pdf(assessment_id=assessment_id)
            response = HttpResponse(pdf_bytes, content_type="application/pdf")
            response["Content-Disposition"] = f'attachment; filename="risk_assessment_{assessment_id}.pdf"'
            return response
        except RiskAssessment.DoesNotExist:
            return Response(
                {"detail": "Risk assessment not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as exc:
            return Response(
                {"detail": f"PDF generation failed: {str(exc)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# ===========================================================================
# Accounting Records ViewSet (staff)
# ===========================================================================


@extend_schema_view(
    list=extend_schema(summary="List accounting records"),
    retrieve=extend_schema(summary="Retrieve an accounting record"),
)
class AccountingRecordViewSet(ModelViewSet):
    queryset = AccountingRecord.objects.select_related(
        "entity__client", "reviewed_by"
    ).prefetch_related("guest_links").all()
    permission_classes = [IsAuthenticated, CanManageKYC]
    pagination_class = StandardPagination
    http_method_names = ["get", "post", "head", "options"]

    def get_serializer_class(self):
        if self.action == "list":
            return AccountingRecordListOutputSerializer
        return AccountingRecordOutputSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        fiscal_year = self.request.query_params.get("fiscal_year")
        if fiscal_year:
            qs = qs.filter(fiscal_year=fiscal_year)
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs.order_by("-created_at")

    @extend_schema(
        summary="Bulk create accounting records for all active entities",
        request=BulkCreateAccountingRecordsInputSerializer,
        responses={201: AccountingRecordListOutputSerializer(many=True)},
    )
    @action(detail=False, methods=["post"], url_path="bulk-create")
    def bulk_create(self, request):
        serializer = BulkCreateAccountingRecordsInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        records = services.bulk_create_accounting_records(
            fiscal_year=serializer.validated_data["fiscal_year"],
            created_by=request.user,
        )
        output = AccountingRecordListOutputSerializer(records, many=True, context={"request": request})
        return Response(output.data, status=status.HTTP_201_CREATED)

    @extend_schema(
        summary="Create a single accounting record with guest link for a specific entity",
        request=CreateForEntityInputSerializer,
        responses={201: AccountingRecordOutputSerializer},
    )
    @action(detail=False, methods=["post"], url_path="create-for-entity")
    def create_for_entity(self, request):
        """Create a single accounting record + guest link for a specific entity."""
        from django.db import IntegrityError
        from apps.authentication.services import create_guest_link

        serializer = CreateForEntityInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        entity_id = serializer.validated_data["entity_id"]
        fiscal_year = serializer.validated_data["fiscal_year"]

        try:
            record = services.create_accounting_record(
                entity_id=entity_id, fiscal_year=fiscal_year,
            )
        except IntegrityError:
            return Response(
                {"detail": "An accounting record already exists for this entity and fiscal year."},
                status=status.HTTP_409_CONFLICT,
            )

        create_guest_link(created_by=request.user, accounting_record=record)
        record.refresh_from_db()
        output = AccountingRecordOutputSerializer(record, context={"request": request})
        return Response(output.data, status=status.HTTP_201_CREATED)

    @extend_schema(
        summary="Get accounting records summary for a fiscal year",
        responses={200: AccountingRecordSummaryOutputSerializer},
    )
    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        fiscal_year = int(request.query_params.get(
            "fiscal_year", __import__("datetime").date.today().year - 1,
        ))
        data = selectors.get_accounting_records_summary(fiscal_year=fiscal_year)
        return Response(AccountingRecordSummaryOutputSerializer(data).data)

    @extend_schema(
        summary="Approve an accounting record",
        request=AccountingRecordReviewInputSerializer,
        responses={200: AccountingRecordOutputSerializer},
    )
    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        serializer = AccountingRecordReviewInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        record = services.approve_accounting_record(
            record_id=pk,
            reviewed_by=request.user,
            review_notes=serializer.validated_data.get("review_notes", ""),
        )
        return Response(AccountingRecordOutputSerializer(record, context={"request": request}).data)

    @extend_schema(
        summary="Reject an accounting record",
        request=AccountingRecordReviewInputSerializer,
        responses={200: AccountingRecordOutputSerializer},
    )
    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        serializer = AccountingRecordReviewInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        record = services.reject_accounting_record(
            record_id=pk,
            reviewed_by=request.user,
            review_notes=serializer.validated_data.get("review_notes", ""),
        )
        return Response(AccountingRecordOutputSerializer(record, context={"request": request}).data)

    @extend_schema(
        summary="List documents for an accounting record",
        responses={200: AccountingRecordDocumentOutputSerializer(many=True)},
    )
    @action(detail=True, methods=["get"], url_path="documents")
    def documents(self, request, pk=None):
        docs = AccountingRecordDocument.objects.filter(
            accounting_record_id=pk
        ).order_by("-created_at")
        return Response(
            AccountingRecordDocumentOutputSerializer(docs, many=True, context={"request": request}).data
        )


# ===========================================================================
# Accounting Records Guest Views
# ===========================================================================


class AccountingRecordGuestMixin:
    """Validate guest token for accounting record access."""

    def _validate_guest_accounting(self, request, record_id):
        from apps.authentication.models import GuestLink

        guest_token = request.headers.get("X-Guest-Token")
        if guest_token:
            try:
                link = GuestLink.objects.select_related(
                    "accounting_record__entity__client"
                ).get(
                    token=guest_token, is_active=True, accounting_record_id=record_id
                )
                if link.is_expired:
                    raise PermissionDenied("Guest link has expired.")
                return link.accounting_record
            except GuestLink.DoesNotExist:
                raise PermissionDenied("Invalid guest token.")
        elif request.user and request.user.is_authenticated:
            return AccountingRecord.objects.select_related(
                "entity__client"
            ).get(id=record_id)
        else:
            raise PermissionDenied("Authentication required.")


class AccountingRecordGuestThrottle(AnonRateThrottle):
    rate = "60/minute"


class AccountingRecordGuestView(AccountingRecordGuestMixin, APIView):
    """GET: Get record data for form. PATCH: Auto-save draft."""

    permission_classes = [AllowAny]
    throttle_classes = [AccountingRecordGuestThrottle]

    @extend_schema(
        summary="Get accounting record data for guest form",
        responses={200: AccountingRecordOutputSerializer},
    )
    def get(self, request, pk):
        record = self._validate_guest_accounting(request, pk)
        return Response(AccountingRecordOutputSerializer(record, context={"request": request}).data)

    @extend_schema(
        summary="Auto-save draft data for an accounting record",
        request=AccountingRecordSaveDraftInputSerializer,
        responses={200: AccountingRecordOutputSerializer},
    )
    def patch(self, request, pk):
        record = self._validate_guest_accounting(request, pk)
        serializer = AccountingRecordSaveDraftInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        record = services.save_accounting_record_draft(
            record_id=pk,
            **serializer.validated_data,
        )
        return Response(AccountingRecordOutputSerializer(record, context={"request": request}).data)


class AccountingRecordGuestSubmitView(AccountingRecordGuestMixin, APIView):
    """POST: Submit with signature."""

    permission_classes = [AllowAny]
    throttle_classes = [AccountingRecordGuestThrottle]

    @extend_schema(
        summary="Submit an accounting record with signature",
        request=None,
        responses={200: AccountingRecordOutputSerializer},
    )
    def post(self, request, pk):
        self._validate_guest_accounting(request, pk)
        record = services.submit_accounting_record(record_id=pk)
        return Response(AccountingRecordOutputSerializer(record, context={"request": request}).data)


class AccountingRecordGuestDocumentView(AccountingRecordGuestMixin, APIView):
    """GET: List uploaded docs. POST: Upload supporting doc."""

    permission_classes = [AllowAny]
    throttle_classes = [AccountingRecordGuestThrottle]

    @extend_schema(
        summary="List uploaded documents for an accounting record",
        responses={200: AccountingRecordDocumentOutputSerializer(many=True)},
    )
    def get(self, request, pk):
        self._validate_guest_accounting(request, pk)
        docs = AccountingRecordDocument.objects.filter(
            accounting_record_id=pk
        ).order_by("-created_at")
        return Response(
            AccountingRecordDocumentOutputSerializer(docs, many=True, context={"request": request}).data
        )

    @extend_schema(
        summary="Upload a supporting document for an accounting record",
        request=AccountingRecordDocumentUploadInputSerializer,
        responses={201: AccountingRecordDocumentOutputSerializer},
    )
    def post(self, request, pk):
        self._validate_guest_accounting(request, pk)
        serializer = AccountingRecordDocumentUploadInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        doc = services.upload_accounting_document(
            record_id=pk,
            file_obj=serializer.validated_data["file"],
            description=serializer.validated_data.get("description", ""),
        )
        return Response(
            AccountingRecordDocumentOutputSerializer(doc, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


# ===========================================================================
# Jurisdiction Configuration ViewSet
# ===========================================================================


@extend_schema_view(
    list=extend_schema(summary="List jurisdiction configurations"),
    retrieve=extend_schema(summary="Retrieve a jurisdiction configuration"),
    create=extend_schema(summary="Create a jurisdiction configuration"),
    update=extend_schema(summary="Update a jurisdiction configuration"),
    partial_update=extend_schema(summary="Partially update a jurisdiction configuration"),
    destroy=extend_schema(summary="Delete a jurisdiction configuration"),
)
class JurisdictionConfigViewSet(ModelViewSet):
    queryset = JurisdictionConfig.objects.select_related(
        "jurisdiction", "default_risk_matrix",
    ).all()
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_permissions(self):
        if self.action in ("create", "partial_update", "update", "destroy"):
            return [IsAuthenticated(), IsDirector()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action in ("create", "partial_update", "update"):
            return JurisdictionConfigInputSerializer
        return JurisdictionConfigOutputSerializer

    def create(self, request, *args, **kwargs):
        serializer = JurisdictionConfigInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        jurisdiction_id = data.pop("jurisdiction_id")
        default_risk_matrix_id = data.pop("default_risk_matrix_id", None)
        config = JurisdictionConfig.objects.create(
            jurisdiction_id=jurisdiction_id,
            default_risk_matrix_id=default_risk_matrix_id,
            **data,
        )
        return Response(
            JurisdictionConfigOutputSerializer(config).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = JurisdictionConfigInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        jurisdiction_id = data.pop("jurisdiction_id")
        default_risk_matrix_id = data.pop("default_risk_matrix_id", None)
        instance.jurisdiction_id = jurisdiction_id
        instance.default_risk_matrix_id = default_risk_matrix_id
        for attr, value in data.items():
            setattr(instance, attr, value)
        instance.save()
        return Response(JurisdictionConfigOutputSerializer(instance).data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = JurisdictionConfigInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        jurisdiction_id = data.pop("jurisdiction_id", None)
        if jurisdiction_id:
            instance.jurisdiction_id = jurisdiction_id
        default_risk_matrix_id = data.pop("default_risk_matrix_id", None)
        if default_risk_matrix_id is not None:
            instance.default_risk_matrix_id = default_risk_matrix_id
        for attr, value in data.items():
            setattr(instance, attr, value)
        instance.save()
        return Response(JurisdictionConfigOutputSerializer(instance).data)


# ===========================================================================
# Compliance Delegation ViewSet
# ===========================================================================


@extend_schema_view(
    list=extend_schema(summary="List compliance delegations"),
    retrieve=extend_schema(summary="Retrieve a compliance delegation"),
)
class ComplianceDelegationViewSet(ModelViewSet):
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination
    http_method_names = ["get", "post", "head", "options"]

    def get_serializer_class(self):
        if self.action == "create":
            return ComplianceDelegationCreateInputSerializer
        return ComplianceDelegationOutputSerializer

    def get_queryset(self):
        from django.db.models import Q

        qs = ComplianceDelegation.objects.select_related(
            "entity", "delegated_by", "delegate_user",
        ).order_by("-created_at")
        # Scope: directors see all; others only see delegations they created or received
        user = self.request.user
        if getattr(user, "role", None) != "director":
            qs = qs.filter(
                Q(delegated_by=user) | Q(delegate_email__iexact=user.email)
            )
        entity_id = self.request.query_params.get("entity")
        if entity_id:
            qs = qs.filter(entity_id=entity_id)
        module = self.request.query_params.get("module")
        if module:
            qs = qs.filter(module=module)
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = ComplianceDelegationCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        delegation = services.delegate_entity(
            entity_id=serializer.validated_data["entity_id"],
            module=serializer.validated_data["module"],
            fiscal_year=serializer.validated_data["fiscal_year"],
            delegate_email=serializer.validated_data["delegate_email"],
            delegated_by=request.user,
        )
        return Response(
            ComplianceDelegationOutputSerializer(delegation).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(summary="Revoke a delegation")
    @action(detail=True, methods=["post"])
    def revoke(self, request, pk=None):
        delegation = services.revoke_delegation(
            delegation_id=pk, revoked_by=request.user,
        )
        return Response(ComplianceDelegationOutputSerializer(delegation).data)

    @extend_schema(summary="Accept a pending delegation")
    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        delegation = services.accept_delegation(
            delegation_id=pk, user=request.user,
        )
        return Response(ComplianceDelegationOutputSerializer(delegation).data)


# ===========================================================================
# Due Diligence Checklist endpoints
# ===========================================================================


class DueDiligenceChecklistView(APIView):
    """GET: List checklists for a KYC. POST: Create/update a checklist."""

    permission_classes = [IsAuthenticated, CanReviewKYC]

    @extend_schema(
        summary="List due diligence checklists for a KYC submission",
        responses={200: DueDiligenceChecklistOutputSerializer(many=True)},
    )
    def get(self, request, kyc_id):
        checklists = DueDiligenceChecklist.objects.filter(
            kyc_submission_id=kyc_id
        ).select_related("completed_by").order_by("section")
        return Response(DueDiligenceChecklistOutputSerializer(checklists, many=True).data)

    @extend_schema(
        summary="Create or update a due diligence checklist",
        request=DueDiligenceChecklistInputSerializer,
        responses={200: DueDiligenceChecklistOutputSerializer},
    )
    def post(self, request, kyc_id):
        serializer = DueDiligenceChecklistInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        checklist = services.create_or_update_checklist(
            kyc_id=kyc_id,
            section=serializer.validated_data["section"],
            items=serializer.validated_data["items"],
        )
        return Response(DueDiligenceChecklistOutputSerializer(checklist).data)


class DueDiligenceChecklistCompleteView(APIView):
    """POST: Mark a checklist as complete."""

    permission_classes = [IsAuthenticated, CanReviewKYC]

    @extend_schema(
        summary="Mark a due diligence checklist as complete",
        request=None,
        responses={200: DueDiligenceChecklistOutputSerializer},
    )
    def post(self, request, checklist_id):
        checklist = services.complete_checklist(
            checklist_id=checklist_id,
            completed_by=request.user,
        )
        return Response(DueDiligenceChecklistOutputSerializer(checklist).data)


# ===========================================================================
# Field Comments endpoints
# ===========================================================================


class FieldCommentView(APIView):
    """POST: Add a field comment to a KYC submission."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Add a field-level comment to a KYC submission",
        request=FieldCommentInputSerializer,
        responses={201: serializers.DictField()},
    )
    def post(self, request, kyc_id):
        serializer = FieldCommentInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = services.add_field_comment(
            kyc_id=kyc_id,
            field_name=serializer.validated_data["field_name"],
            text=serializer.validated_data["text"],
            author=request.user,
            parent_id=serializer.validated_data.get("parent_id"),
        )
        return Response(comment, status=status.HTTP_201_CREATED)


class FieldCommentResolveView(APIView):
    """POST: Resolve all comments for a field."""

    permission_classes = [IsAuthenticated, CanReviewKYC]

    @extend_schema(
        summary="Resolve all comments for a field on a KYC submission",
        request=None,
        responses={200: inline_serializer(
            name="FieldCommentResolveResponse",
            fields={"detail": serializers.CharField()},
        )},
    )
    def post(self, request, kyc_id, field_name):
        services.resolve_field_comments(
            kyc_id=kyc_id,
            field_name=field_name,
            resolved_by=request.user,
        )
        return Response({"detail": "Comments resolved."})


# ===========================================================================
# Economic Substance ViewSet
# ===========================================================================


@extend_schema_view(
    list=extend_schema(summary="List Economic Substance submissions"),
    retrieve=extend_schema(summary="Retrieve an ES submission"),
)
class EconomicSubstanceViewSet(ModelViewSet):
    queryset = EconomicSubstanceSubmission.objects.select_related(
        "entity__client", "reviewed_by",
    ).all()
    permission_classes = [IsAuthenticated, CanManageKYC]
    pagination_class = StandardPagination
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_serializer_class(self):
        if self.action == "list":
            return EconomicSubstanceListOutputSerializer
        if self.action in ("create",):
            return EconomicSubstanceCreateInputSerializer
        if self.action in ("partial_update",):
            return EconomicSubstanceSaveDraftInputSerializer
        return EconomicSubstanceOutputSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        fiscal_year = self.request.query_params.get("fiscal_year")
        if fiscal_year:
            qs = qs.filter(fiscal_year=fiscal_year)
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        entity_id = self.request.query_params.get("entity_id")
        if entity_id:
            qs = qs.filter(entity_id=entity_id)
        return qs.order_by("-created_at")

    def create(self, request, *args, **kwargs):
        serializer = EconomicSubstanceCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sub = services.create_es_submission(
            entity_id=serializer.validated_data["entity_id"],
            fiscal_year=serializer.validated_data["fiscal_year"],
        )
        return Response(
            EconomicSubstanceOutputSerializer(sub).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = EconomicSubstanceSaveDraftInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sub = services.save_es_draft(
            submission_id=instance.id,
            **serializer.validated_data,
        )
        return Response(EconomicSubstanceOutputSerializer(sub).data)

    @extend_schema(
        summary="Advance the ES flow by one step",
        request=ESAdvanceStepInputSerializer,
        responses={200: inline_serializer(
            name="ESAdvanceStepResponse",
            fields={
                "next_step": serializers.CharField(allow_null=True),
                "terminal": serializers.BooleanField(),
                "result": serializers.CharField(),
                "reason": serializers.CharField(),
            },
        )},
    )
    @action(detail=True, methods=["post"], url_path="advance-step")
    def advance_step(self, request, pk=None):
        serializer = ESAdvanceStepInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = services.advance_es_step(
            submission_id=pk,
            step_key=serializer.validated_data["step_key"],
            answer=serializer.validated_data["answer"],
        )
        return Response(result)

    @extend_schema(
        summary="Submit an ES submission for review",
        request=None,
        responses={200: EconomicSubstanceOutputSerializer},
    )
    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, pk=None):
        sub = services.submit_es(submission_id=pk)
        return Response(EconomicSubstanceOutputSerializer(sub).data)

    @extend_schema(
        summary="Approve an ES submission",
        request=None,
        responses={200: EconomicSubstanceOutputSerializer},
    )
    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        sub = services.approve_es(submission_id=pk, reviewed_by=request.user)
        return Response(EconomicSubstanceOutputSerializer(sub).data)

    @extend_schema(
        summary="Reject an ES submission",
        request=ESRejectInputSerializer,
        responses={200: EconomicSubstanceOutputSerializer},
    )
    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        serializer = ESRejectInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sub = services.reject_es(
            submission_id=pk,
            reviewed_by=request.user,
            field_comments=serializer.validated_data.get("field_comments"),
        )
        return Response(EconomicSubstanceOutputSerializer(sub).data)

    @extend_schema(
        summary="Bulk create ES submissions for a fiscal year",
        request=ESBulkCreateInputSerializer,
        responses={201: EconomicSubstanceListOutputSerializer(many=True)},
    )
    @action(detail=False, methods=["post"], url_path="bulk-create")
    def bulk_create(self, request):
        serializer = ESBulkCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        submissions = services.bulk_create_es_submissions(
            fiscal_year=serializer.validated_data["fiscal_year"],
            created_by=request.user,
        )
        return Response(
            EconomicSubstanceListOutputSerializer(submissions, many=True).data,
            status=status.HTTP_201_CREATED,
        )


# ===========================================================================
# ES Guest Views
# ===========================================================================


class ESGuestMixin:
    """Validate guest token for ES submission access."""

    def _validate_guest_es(self, request, submission_id):
        from apps.authentication.models import GuestLink

        guest_token = request.headers.get("X-Guest-Token")
        if guest_token:
            try:
                link = GuestLink.objects.get(
                    token=guest_token, is_active=True,
                    es_submission_id=submission_id,
                )
                if link.is_expired:
                    raise PermissionDenied("Guest link has expired.")
                return link.es_submission
            except GuestLink.DoesNotExist:
                raise PermissionDenied("Invalid guest token.")
        elif request.user and request.user.is_authenticated:
            return EconomicSubstanceSubmission.objects.select_related(
                "entity__client"
            ).get(id=submission_id)
        else:
            raise PermissionDenied("Authentication required.")


class ESGuestView(ESGuestMixin, APIView):
    """GET: Get ES data for form. PATCH: Auto-save draft."""

    permission_classes = [AllowAny]

    def get(self, request, pk):
        sub = self._validate_guest_es(request, pk)
        return Response(EconomicSubstanceOutputSerializer(sub).data)

    def patch(self, request, pk):
        self._validate_guest_es(request, pk)
        serializer = EconomicSubstanceSaveDraftInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sub = services.save_es_draft(submission_id=pk, **serializer.validated_data)
        return Response(EconomicSubstanceOutputSerializer(sub).data)


class ESGuestSubmitView(ESGuestMixin, APIView):
    """POST: Submit ES from guest form."""

    permission_classes = [AllowAny]

    def post(self, request, pk):
        self._validate_guest_es(request, pk)
        sub = services.submit_es(submission_id=pk)
        return Response(EconomicSubstanceOutputSerializer(sub).data)


# ===========================================================================
# Help Request
# ===========================================================================


class HelpRequestThrottle(AnonRateThrottle):
    rate = "12/hour"


class HelpRequestView(GuestOrAuthMixin, APIView):
    """POST: Send a help request to the compliance team."""

    permission_classes = [AllowAny]
    throttle_classes = [HelpRequestThrottle]

    @extend_schema(
        summary="Send a help request to the compliance team",
        request=HelpRequestInputSerializer,
        responses={200: inline_serializer(
            name="HelpRequestResponse",
            fields={"detail": serializers.CharField()},
        )},
    )
    def post(self, request):
        user = self._validate_guest_or_auth(request)
        serializer = HelpRequestInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user_or_email = user if user else request.headers.get("X-Guest-Token", "guest")
        services.request_help(
            user_or_email=user_or_email,
            entity_id=serializer.validated_data.get("entity_id"),
            module=serializer.validated_data["module"],
            current_page=serializer.validated_data["current_page"],
            message=serializer.validated_data.get("message", ""),
        )
        return Response({"detail": "Help request sent."})


# ===========================================================================
# Ownership Tree endpoints
# ===========================================================================


class OwnershipTreeView(APIView):
    """GET: Calculate and return the ownership tree for an entity."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Calculate UBO ownership tree for an entity",
        responses={200: inline_serializer(
            name="OwnershipTreeResponse",
            fields={
                "nodes": serializers.ListField(),
                "edges": serializers.ListField(),
                "reportable_ubos": serializers.ListField(),
                "warnings": serializers.ListField(),
                "threshold": serializers.CharField(),
            },
        )},
    )
    def get(self, request, entity_id):
        jurisdiction_code = request.query_params.get("jurisdiction")
        tree = services.calculate_ubo_tree(
            entity_id=entity_id,
            jurisdiction_code=jurisdiction_code,
        )
        return Response(tree)


class OwnershipTreeSaveView(APIView):
    """POST: Save an ownership tree snapshot."""

    permission_classes = [IsAuthenticated, CanReviewKYC]

    @extend_schema(
        summary="Save an ownership tree snapshot for audit",
        request=SaveOwnershipTreeInputSerializer,
        responses={201: OwnershipSnapshotOutputSerializer},
    )
    def post(self, request, entity_id):
        serializer = SaveOwnershipTreeInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        snapshot = services.save_ownership_tree(
            entity_id=entity_id,
            nodes=serializer.validated_data["nodes"],
            edges=serializer.validated_data["edges"],
            saved_by=request.user,
        )
        return Response(
            OwnershipSnapshotOutputSerializer(snapshot).data,
            status=status.HTTP_201_CREATED,
        )


class OwnershipTreeAuditView(APIView):
    """GET: Get ownership tree audit log."""

    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination

    @extend_schema(
        summary="Get ownership tree audit log for an entity",
        responses={200: OwnershipSnapshotOutputSerializer(many=True)},
    )
    def get(self, request, entity_id):
        snapshots = OwnershipSnapshot.objects.filter(
            entity_id=entity_id
        ).select_related("saved_by").order_by("-created_at")
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(snapshots, request)
        if page is not None:
            serializer = OwnershipSnapshotOutputSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)
        return Response(OwnershipSnapshotOutputSerializer(snapshots, many=True).data)
