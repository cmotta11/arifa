import logging

from celery.result import AsyncResult
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from common.pagination import StandardPagination

from rest_framework.throttling import AnonRateThrottle

from apps.authentication.permissions import IsClient, IsDirector

from . import selectors, services
from .models import DocumentUpload, JurisdictionRisk, KYCSubmission, Party, RFI
from .permissions import CanManageKYC, CanManageRFI, CanReviewKYC, CanScreenParties
from .serializers import (
    ApproveWithChangesInputSerializer,
    CalculateRiskInputSerializer,
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
                link = GuestLink.objects.get(
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
            return KYCSubmission.objects.get(id=kyc_id)
        else:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Authentication required.")

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

    @action(detail=True, methods=["get"], url_path="documents", url_name="documents-list")
    def documents_list(self, request, pk=None):
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


class ExtractDocumentView(APIView):
    """POST: Accept a file and dispatch LLM extraction as a Celery task."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ExtractDocumentInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uploaded_file = serializer.validated_data["file"]
        document_type = serializer.validated_data["document_type"]

        # Create a DocumentUpload record for tracking
        file_data = {
            "original_filename": uploaded_file.name,
            "file_size": uploaded_file.size,
            "mime_type": uploaded_file.content_type or "",
        }
        doc = services.upload_kyc_document(
            document_type=document_type,
            file_data=file_data,
            uploaded_by=request.user,
        )

        # Dispatch extraction task
        from .tasks import extract_document_data

        task = extract_document_data.delay(str(doc.id))

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


class TaskStatusView(APIView):
    """GET: Check the status of a Celery task by task_id."""

    permission_classes = [IsAuthenticated]

    def get(self, request, task_id):
        result = AsyncResult(task_id)

        response_data = {
            "task_id": task_id,
            "status": result.status,
        }

        if result.ready():
            if result.successful():
                response_data["result"] = result.result
            else:
                # Task failed
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
