import base64
import logging

from celery.result import AsyncResult
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from common.pagination import StandardPagination

from apps.authentication.permissions import IsClient, IsDirector

from . import selectors, services
from .models import (
    AutomaticTriggerRule,
    ComplianceSnapshot,
    DocumentUpload,
    JurisdictionRisk,
    KYCSubmission,
    Party,
    RFI,
    RiskAssessment,
    RiskFactor,
    RiskMatrixConfig,
)
from .permissions import CanManageKYC, CanManageRFI, CanReviewKYC, CanScreenParties
from .serializers import (
    ApproveWithChangesInputSerializer,
    AutomaticTriggerRuleInputSerializer,
    AutomaticTriggerRuleOutputSerializer,
    CalculateRiskInputSerializer,
    ComplianceSnapshotInputSerializer,
    ComplianceSnapshotOutputSerializer,
    DocumentUploadInputSerializer,
    DocumentUploadOutputSerializer,
    EntitySnapshotOutputSerializer,
    ExtractDocumentInputSerializer,
    JurisdictionRiskInputSerializer,
    JurisdictionRiskOutputSerializer,
    KYCSubmissionInputSerializer,
    KYCSubmissionOutputSerializer,
    LinkPersonInputSerializer,
    OnboardingInputSerializer,
    OnboardingOutputSerializer,
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
    SendBackInputSerializer,
    WorldCheckCaseOutputSerializer,
    WorldCheckResolveInputSerializer,
)


class OnboardingRateThrottle(AnonRateThrottle):
    rate = "10/hour"

logger = logging.getLogger(__name__)


# ===========================================================================
# KYCSubmission ViewSet
# ===========================================================================


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
        instance.ticket_id = serializer.validated_data["ticket_id"]
        instance.save(update_fields=["ticket_id", "updated_at"])
        output = KYCSubmissionOutputSerializer(instance)
        return Response(output.data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = KYCSubmissionInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if "ticket_id" in serializer.validated_data:
            instance.ticket_id = serializer.validated_data["ticket_id"]
            instance.save(update_fields=["ticket_id", "updated_at"])
        output = KYCSubmissionOutputSerializer(instance)
        return Response(output.data)

    # ---- Lifecycle actions ----

    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, pk=None):
        kyc = services.submit_kyc(kyc_id=pk, submitted_by=request.user)
        return Response(KYCSubmissionOutputSerializer(kyc).data)

    # ---- Guest-facing entity actions ----

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
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("Guest link has expired.")
                return link.kyc_submission
            except GuestLink.DoesNotExist:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Invalid guest token.")
        elif request.user and request.user.is_authenticated:
            return KYCSubmission.objects.select_related(
                "ticket__entity"
            ).get(id=kyc_id)
        else:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Authentication required.")

    # ---- Guest person creation ----

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

        positions = request.data.get("positions", ["director"])

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

    @action(
        detail=True,
        methods=["post"],
        url_path="reject",
        permission_classes=[IsAuthenticated, CanReviewKYC],
    )
    def reject(self, request, pk=None):
        kyc = services.reject_kyc(kyc_id=pk, reviewed_by=request.user)
        return Response(KYCSubmissionOutputSerializer(kyc).data)

    @action(detail=True, methods=["post"], url_path="escalate")
    def escalate(self, request, pk=None):
        kyc = services.escalate_kyc(kyc_id=pk, escalated_by=request.user)
        return Response(KYCSubmissionOutputSerializer(kyc).data)

    # ---- Risk actions ----

    @action(detail=True, methods=["post"], url_path="calculate-risk")
    def calculate_risk(self, request, pk=None):
        serializer = CalculateRiskInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assessment = services.calculate_risk_score(
            kyc_id=pk,
            trigger=serializer.validated_data.get("trigger", "manual"),
        )
        return Response(RiskAssessmentOutputSerializer(assessment).data)

    @action(detail=True, methods=["get"], url_path="risk-assessment")
    def risk_assessment(self, request, pk=None):
        assessment = selectors.get_current_risk_assessment(kyc_id=pk)
        if assessment is None:
            return Response(
                {"message": "No risk assessment found for this KYC submission."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(RiskAssessmentOutputSerializer(assessment).data)

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
        for attr, value in data.items():
            setattr(instance, attr, value)
        instance.save()
        if person_id:
            instance = services.link_existing_person_to_party(
                party_id=instance.id, person_id=person_id
            )
        return Response(PartyOutputSerializer(instance).data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = PartyInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data.copy()
        person_id = data.pop("person_id", None)
        for attr, value in data.items():
            setattr(instance, attr, value)
        instance.save()
        if person_id:
            instance = services.link_existing_person_to_party(
                party_id=instance.id, person_id=person_id
            )
        return Response(PartyOutputSerializer(instance).data)

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
        return Response(
            {"task_id": task.id, "party_id": str(party.id), "status": "dispatched"},
            status=status.HTTP_202_ACCEPTED,
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

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = JurisdictionRiskInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        for attr, value in serializer.validated_data.items():
            setattr(instance, attr, value)

        update_fields = list(serializer.validated_data.keys())
        if update_fields:
            update_fields.append("updated_at")
            instance.save(update_fields=update_fields)

        return Response(JurisdictionRiskOutputSerializer(instance).data)

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

    def post(self, request):
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

    def get(self, request, task_id):
        self._validate_guest_or_auth(request)

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

    @action(detail=True, methods=["get"], url_path="parties", url_name="parties")
    def parties(self, request, pk=None):
        kyc = self.get_object()
        parties = kyc.parties.all().order_by("created_at")
        page = self.paginate_queryset(parties)
        if page is not None:
            serializer = PartyOutputSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        return Response(PartyOutputSerializer(parties, many=True).data)

    @action(detail=True, methods=["get"], url_path="rfis", url_name="rfis")
    def rfis(self, request, pk=None):
        kyc = self.get_object()
        rfis = RFI.objects.filter(kyc_submission=kyc).order_by("-created_at")
        page = self.paginate_queryset(rfis)
        if page is not None:
            serializer = RFIOutputSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        return Response(RFIOutputSerializer(rfis, many=True).data)

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
        for attr, value in serializer.validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return Response(RiskMatrixConfigOutputSerializer(instance).data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = RiskMatrixConfigInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        for attr, value in serializer.validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return Response(RiskMatrixConfigOutputSerializer(instance).data)

    @action(detail=True, methods=["post"], url_path="duplicate")
    def duplicate(self, request, pk=None):
        """Clone this config with a new version number."""
        config = self.get_object()
        new_version = config.version + 1
        new_config = RiskMatrixConfig.objects.create(
            name=config.name,
            jurisdiction=config.jurisdiction,
            entity_type=config.entity_type,
            version=new_version,
            is_active=False,
            high_risk_threshold=config.high_risk_threshold,
            medium_risk_threshold=config.medium_risk_threshold,
            created_by=request.user,
            notes=f"Duplicated from v{config.version}",
        )
        for factor in config.factors.all():
            RiskFactor.objects.create(
                matrix_config=new_config,
                code=factor.code,
                category=factor.category,
                max_score=factor.max_score,
                description=factor.description,
                scoring_rules_json=factor.scoring_rules_json,
            )
        for rule in config.trigger_rules.all():
            AutomaticTriggerRule.objects.create(
                matrix_config=new_config,
                condition=rule.condition,
                forced_risk_level=rule.forced_risk_level,
                is_active=rule.is_active,
                description=rule.description,
            )
        return Response(
            RiskMatrixConfigOutputSerializer(new_config).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="activate")
    def activate(self, request, pk=None):
        """Activate this config (deactivate others with same scope)."""
        config = self.get_object()
        RiskMatrixConfig.objects.filter(
            jurisdiction=config.jurisdiction,
            entity_type=config.entity_type,
            is_active=True,
        ).exclude(id=config.id).update(is_active=False)
        config.is_active = True
        config.save(update_fields=["is_active", "updated_at"])
        return Response(RiskMatrixConfigOutputSerializer(config).data)

    # ---- Nested factors CRUD ----

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

    def get(self, request):
        stats = selectors.get_risk_stats()
        return Response(stats)


# ===========================================================================
# Entity/Person Risk Views
# ===========================================================================


class EntityRiskView(APIView):
    permission_classes = [IsAuthenticated]

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

    def get(self, request, entity_id):
        history = selectors.get_entity_risk_history(entity_id=entity_id)
        return Response(RiskAssessmentOutputSerializer(history, many=True).data)


class EntityCalculateRiskView(APIView):
    permission_classes = [IsAuthenticated, CanReviewKYC]

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

    def get(self, request, person_id):
        history = selectors.get_person_risk_history(person_id=person_id)
        return Response(RiskAssessmentOutputSerializer(history, many=True).data)


class PersonCalculateRiskView(APIView):
    permission_classes = [IsAuthenticated, CanReviewKYC]

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

    @action(detail=True, methods=["get"], url_path="assessments")
    def assessments(self, request, pk=None):
        assessments = selectors.get_snapshot_assessments(snapshot_id=pk)
        risk_level = request.query_params.get("risk_level")
        if risk_level:
            assessments = assessments.filter(risk_level=risk_level)
        return Response(RiskAssessmentOutputSerializer(assessments, many=True).data)

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
