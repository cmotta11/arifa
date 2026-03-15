import logging

from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsStaffRole

from .serializers import (
    AIChatInputSerializer,
    AIChatOutputSerializer,
    AIExplainRiskInputSerializer,
    AIExplainRiskOutputSerializer,
    AIReviewDocInputSerializer,
    AIReviewDocOutputSerializer,
    AISuggestInputSerializer,
    AISuggestOutputSerializer,
)
from .services import AIAssistant
from .throttles import AIRateThrottle

logger = logging.getLogger(__name__)


class AIChatView(APIView):
    """Conversational AI chat endpoint."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [AIRateThrottle]

    @extend_schema(
        request=AIChatInputSerializer,
        responses={200: AIChatOutputSerializer},
        summary="Chat with AI assistant",
        description="Send a message to the ARIFA AI assistant and receive a context-aware response.",
        tags=["AI Assistant"],
    )
    def post(self, request):
        serializer = AIChatInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        assistant = AIAssistant()
        response_text = assistant.chat(
            user=request.user,
            message=data["message"],
            context=data.get("context", {}),
        )

        # Generate suggested follow-up questions based on context
        suggestions = _get_suggested_questions(data.get("context", {}))

        output = AIChatOutputSerializer({"response": response_text, "suggestions": suggestions})
        return Response(output.data)


class AISuggestView(APIView):
    """AI field suggestion endpoint."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [AIRateThrottle]

    @extend_schema(
        request=AISuggestInputSerializer,
        responses={200: AISuggestOutputSerializer},
        summary="Get AI field suggestions",
        description="Get AI-powered field value suggestions for a specific form section.",
        tags=["AI Assistant"],
    )
    def post(self, request):
        serializer = AISuggestInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        assistant = AIAssistant()
        suggestions = assistant.suggest_fields(
            entity_type=data["entity_type"],
            jurisdiction=data["jurisdiction"],
            form_section=data["form_section"],
        )

        output = AISuggestOutputSerializer({"suggestions": suggestions})
        return Response(output.data)


class AIExplainRiskView(APIView):
    """AI risk explanation endpoint."""

    permission_classes = [IsAuthenticated, IsStaffRole]
    throttle_classes = [AIRateThrottle]

    @extend_schema(
        request=AIExplainRiskInputSerializer,
        responses={200: AIExplainRiskOutputSerializer},
        summary="Explain risk assessment",
        description="Get a natural-language explanation of an entity's risk assessment.",
        tags=["AI Assistant"],
    )
    def post(self, request):
        serializer = AIExplainRiskInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        assistant = AIAssistant()
        result = assistant.explain_risk(
            entity_id=str(data["entity_id"]),
            risk_assessment_id=str(data["risk_assessment_id"]),
        )

        output = AIExplainRiskOutputSerializer(result)
        return Response(output.data)


class AIReviewDocView(APIView):
    """AI document review endpoint."""

    permission_classes = [IsAuthenticated, IsStaffRole]
    throttle_classes = [AIRateThrottle]

    @extend_schema(
        request=AIReviewDocInputSerializer,
        responses={200: AIReviewDocOutputSerializer},
        summary="Review document for completeness",
        description="Get an AI-powered review of a document's completeness with identified issues.",
        tags=["AI Assistant"],
    )
    def post(self, request):
        serializer = AIReviewDocInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        assistant = AIAssistant()
        result = assistant.review_document(
            document_id=str(data["document_id"]),
        )

        output = AIReviewDocOutputSerializer(result)
        return Response(output.data)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_suggested_questions(context: dict) -> list[str]:
    """Generate suggested follow-up questions based on the current context."""
    page = context.get("page", "")
    language = context.get("language", "en")

    if language == "es":
        questions = {
            "kyc": [
                "Que documentos necesito para completar el KYC?",
                "Como agrego un beneficiario final?",
                "Que significa el estado PEP?",
            ],
            "compliance": [
                "Como se calcula el puntaje de riesgo?",
                "Que hago si un World-Check tiene coincidencia?",
                "Como genero un snapshot de cumplimiento?",
            ],
            "entities": [
                "Como creo una nueva entidad?",
                "Que es la estructura corporativa?",
                "Como veo el historial de riesgo?",
            ],
            "default": [
                "Que puedo hacer en esta plataforma?",
                "Como inicio un proceso de KYC?",
                "Explicame las evaluaciones de riesgo.",
            ],
        }
    else:
        questions = {
            "kyc": [
                "What documents are needed for KYC?",
                "How do I add a beneficial owner?",
                "What does PEP status mean?",
            ],
            "compliance": [
                "How is the risk score calculated?",
                "What do I do if World-Check returns a match?",
                "How do I generate a compliance snapshot?",
            ],
            "entities": [
                "How do I create a new entity?",
                "What is the corporate structure view?",
                "How do I view risk history?",
            ],
            "default": [
                "What can I do on this platform?",
                "How do I start a KYC process?",
                "Explain risk assessments to me.",
            ],
        }

    for key in questions:
        if key != "default" and key in page.lower():
            return questions[key]

    return questions["default"]
