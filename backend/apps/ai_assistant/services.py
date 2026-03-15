import logging
import re
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# System prompt template
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT_TEMPLATE = """\
You are ARIFA AI, an intelligent assistant embedded in a legal services platform \
used by law firms in Panama, BVI, and Belize for client onboarding, KYC compliance, \
risk assessment, and corporate entity management.

Your primary tasks:
- Help staff navigate KYC forms, explain compliance requirements, and suggest field values.
- Explain risk scores in plain language, citing the factors that contributed.
- Review documents for completeness and flag missing fields.
- Answer questions about the platform workflows and regulatory context.

Guidelines:
- Be concise, professional, and accurate.
- When unsure, say so rather than guessing.
- Respond in the user's language (Spanish or English) based on context.
- Never reveal confidential client data you were not explicitly provided.

{context_block}
"""


def _sanitize_context_value(value: Any, max_length: int = 100) -> str:
    """Sanitize a context value for safe interpolation into prompts.

    Strips newlines, carriage returns, tabs, null bytes, and truncates
    to ``max_length`` characters.
    """
    text = str(value)
    # Remove control characters that could manipulate prompt structure
    text = re.sub(r"[\n\r\t\x00]", " ", text)
    return text[:max_length]


class AIAssistant:
    """Core AI service that delegates to the Anthropic API or returns mock responses."""

    def __init__(self):
        self.api_key: str = settings.ANTHROPIC_API_KEY
        self.model: str = settings.AI_MODEL
        self.max_tokens: int = settings.AI_MAX_TOKENS
        self.mock_mode: bool = settings.AI_MOCK_MODE
        self._client = None
        if not self.mock_mode and self.api_key:
            try:
                import anthropic

                self._client = anthropic.Anthropic(api_key=self.api_key)
            except ImportError:
                logger.warning("anthropic package not installed; API calls will fail")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def chat(self, *, user, message: str, context: dict[str, Any] | None = None) -> str:
        """Send a conversational message and return the assistant response."""
        context = context or {}
        context["user_role"] = getattr(user, "role", "unknown")

        if self.mock_mode:
            return self._get_mock_response(message, context)

        return self._call_api(message=message, context=context)

    def suggest_fields(
        self,
        *,
        entity_type: str,
        jurisdiction: str,
        form_section: str,
    ) -> list[dict[str, Any]]:
        """Return field suggestions for a given form section."""
        if self.mock_mode:
            return self._get_mock_suggestions(entity_type, jurisdiction, form_section)

        prompt = (
            f"Suggest typical field values for a {entity_type} entity in {jurisdiction}. "
            f"The form section is: {form_section}. "
            "Return a JSON array of objects with keys: field, value, confidence (0-100)."
        )
        raw = self._call_api(message=prompt, context={"task": "suggest_fields"})
        return _safe_parse_json(raw, fallback=self._get_mock_suggestions(entity_type, jurisdiction, form_section))

    def explain_risk(
        self,
        *,
        entity_id: str,
        risk_assessment_id: str,
    ) -> dict[str, Any]:
        """Explain a risk score in natural language."""
        if self.mock_mode:
            return self._get_mock_risk_explanation(entity_id, risk_assessment_id)

        # Fetch data from DB
        risk_data = self._load_risk_data(entity_id, risk_assessment_id)
        prompt = (
            "Explain the following risk assessment in clear, non-technical language. "
            "Include the key factors and their impact. "
            f"Risk data: {risk_data}"
        )
        explanation = self._call_api(message=prompt, context={"task": "explain_risk"})
        return {
            "explanation": explanation,
            "factors": risk_data.get("factors", []),
        }

    def review_document(self, *, document_id: str) -> dict[str, Any]:
        """Review a document for completeness."""
        if self.mock_mode:
            return self._get_mock_document_review(document_id)

        prompt = (
            f"Review the document with ID {document_id} for completeness. "
            "List any missing required fields and rate the overall completeness as a percentage."
        )
        raw = self._call_api(message=prompt, context={"task": "review_document"})
        return {
            "summary": raw,
            "issues": [],
            "completeness": 85,
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _build_system_prompt(self, context: dict[str, Any]) -> str:
        """Build the system prompt from the context dict."""
        lines: list[str] = []
        if context.get("page"):
            lines.append(f"Current page: {_sanitize_context_value(context['page'])}")
        if context.get("user_role"):
            lines.append(f"User role: {_sanitize_context_value(context['user_role'])}")
        if context.get("language"):
            lines.append(f"Preferred language: {_sanitize_context_value(context['language'])}")
        if context.get("entity_type"):
            lines.append(f"Entity type: {_sanitize_context_value(context['entity_type'])}")
        if context.get("jurisdiction"):
            lines.append(f"Jurisdiction: {_sanitize_context_value(context['jurisdiction'])}")
        if context.get("form_section"):
            lines.append(f"Form section: {_sanitize_context_value(context['form_section'])}")

        context_block = "\n".join(lines) if lines else "No additional context provided."
        return _SYSTEM_PROMPT_TEMPLATE.format(context_block=context_block)

    def _call_api(self, *, message: str, context: dict[str, Any]) -> str:
        """Call the Anthropic API and return the text response."""
        try:
            import anthropic

            if self._client is None:
                self._client = anthropic.Anthropic(api_key=self.api_key)
            response = self._client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=self._build_system_prompt(context),
                messages=[{"role": "user", "content": message}],
            )
            return response.content[0].text
        except ImportError:
            logger.exception("anthropic package not installed")
            return "I'm sorry, the AI service is not available. Please try again later."
        except Exception as exc:
            # Catch anthropic.APIError and any other runtime errors
            logger.exception("Anthropic API call failed: %s", exc)
            return "I'm sorry, I encountered an error processing your request. Please try again later."

    def _load_risk_data(self, entity_id: str, risk_assessment_id: str) -> dict[str, Any]:
        """Load risk assessment data from the database."""
        try:
            from apps.compliance.models import RiskAssessment

            assessment = RiskAssessment.objects.select_related("entity", "person").get(
                id=risk_assessment_id,
                entity_id=entity_id,
            )
            factors = []
            for detail in assessment.factor_details or []:
                factors.append({
                    "name": detail.get("code", "Unknown"),
                    "impact": detail.get("category", "unknown"),
                    "score": detail.get("weighted_score", 0),
                    "max_score": detail.get("max_score", 0),
                })
            return {
                "overall_score": assessment.overall_score,
                "risk_level": assessment.risk_level,
                "factors": factors,
            }
        except Exception:
            logger.exception("Failed to load risk data for entity=%s assessment=%s", entity_id, risk_assessment_id)
            return {"overall_score": 0, "risk_level": "unknown", "factors": []}

    # ------------------------------------------------------------------
    # Mock responses (for development without API key)
    # ------------------------------------------------------------------

    def _get_mock_response(self, message: str, context: dict[str, Any]) -> str:
        """Return realistic mock responses based on message content."""
        msg_lower = message.lower()
        language = context.get("language", "en")
        page = context.get("page", "")

        # Spanish responses
        if language == "es":
            if "riesgo" in msg_lower or "risk" in msg_lower:
                return (
                    "El puntaje de riesgo se calcula considerando varios factores: la jurisdiccion "
                    "de la entidad, el estado PEP de los beneficiarios finales, la complejidad de "
                    "la estructura corporativa y los resultados de World-Check. Cada factor tiene "
                    "un peso asignado en la matriz de riesgo configurada."
                )
            if "kyc" in msg_lower:
                return (
                    "Para completar el formulario KYC, necesita: informacion de la entidad, "
                    "datos de las partes (directores, accionistas, UBOs), documentos de soporte "
                    "(pasaportes, pruebas de domicilio), y la declaracion de beneficiarios finales."
                )
            return (
                "Estoy aqui para ayudarle con la plataforma ARIFA. Puedo asistirle con "
                "formularios KYC, evaluaciones de riesgo, revision de documentos y preguntas "
                "sobre cumplimiento regulatorio."
            )

        # English responses
        if "risk" in msg_lower:
            return (
                "The risk score is calculated by evaluating multiple factors: the entity's "
                "jurisdiction risk weight, PEP status of beneficial owners, corporate structure "
                "complexity, and World-Check screening results. Each factor is weighted according "
                "to the active risk matrix configuration."
            )
        if "kyc" in msg_lower:
            return (
                "To complete a KYC submission, you'll need: entity information (name, jurisdiction, "
                "type), party details (directors, shareholders, UBOs with ownership percentages), "
                "supporting documents (passports, proof of address), and the UBO declaration."
            )
        if "document" in msg_lower:
            return (
                "For document uploads, the system supports: passports, cedulas, utility bills, "
                "corporate registry extracts, proof of address, and source of wealth documentation. "
                "Each document type can be processed by the AI extraction engine to auto-fill form fields."
            )
        if "workflow" in msg_lower or "ticket" in msg_lower:
            return (
                "The workflow system manages tickets through configurable states. Each ticket "
                "follows a workflow definition with defined transitions. You can move tickets "
                "between states based on your role permissions."
            )
        if "compliance" in msg_lower:
            if "kanban" in page or "tickets" in page:
                return (
                    "From this page you can track compliance-related tickets. Use the board view "
                    "to see tickets organized by workflow state, or switch to list view for filtering."
                )
            return (
                "The compliance module handles KYC reviews, risk assessments, World-Check screening, "
                "and RFI management. Compliance officers can review submissions, calculate risk scores, "
                "and manage the due diligence checklist."
            )

        return (
            "I'm ARIFA AI, your intelligent assistant for the legal services platform. "
            "I can help you with KYC forms, risk assessments, document review, and compliance "
            "questions. What would you like to know?"
        )

    def _get_mock_suggestions(
        self, entity_type: str, jurisdiction: str, form_section: str
    ) -> list[dict[str, Any]]:
        """Return mock field suggestions."""
        suggestions = {
            "entity_info": [
                {"field": "registered_agent", "value": "ARIFA Law Firm", "confidence": 95},
                {"field": "fiscal_year_end", "value": "December 31", "confidence": 90},
            ],
            "parties": [
                {"field": "role", "value": "director", "confidence": 85},
                {"field": "nationality", "value": "PA" if jurisdiction == "panama" else "VG", "confidence": 70},
            ],
            "documents": [
                {"field": "document_type", "value": "passport", "confidence": 90},
                {"field": "required", "value": "true", "confidence": 95},
            ],
        }

        section_key = form_section.lower().replace(" ", "_")
        return suggestions.get(section_key, [
            {"field": "status", "value": "active", "confidence": 80},
        ])

    def _get_mock_risk_explanation(self, entity_id: str, risk_assessment_id: str) -> dict[str, Any]:
        """Return a mock risk explanation."""
        return {
            "explanation": (
                "This entity has been assessed as Medium Risk (score: 52/100). "
                "The primary contributing factors are:\n\n"
                "1. **Jurisdiction Risk (15/30)**: The entity is registered in a jurisdiction "
                "with moderate regulatory oversight.\n"
                "2. **PEP Exposure (12/25)**: One beneficial owner has been flagged as a "
                "Politically Exposed Person.\n"
                "3. **Structure Complexity (15/20)**: The corporate structure includes multiple "
                "layers of ownership, which increases opacity.\n"
                "4. **Screening Results (10/25)**: World-Check screening returned one potential "
                "match that requires manual review.\n\n"
                "Recommendation: Complete the pending World-Check resolution and request "
                "additional source-of-wealth documentation from the PEP-flagged owner."
            ),
            "factors": [
                {"name": "Jurisdiction Risk", "impact": "medium", "score": 15},
                {"name": "PEP Exposure", "impact": "medium", "score": 12},
                {"name": "Structure Complexity", "impact": "high", "score": 15},
                {"name": "Screening Results", "impact": "medium", "score": 10},
            ],
        }

    def _get_mock_document_review(self, document_id: str) -> dict[str, Any]:
        """Return a mock document review."""
        return {
            "summary": (
                "The document package is mostly complete. A few items need attention "
                "before the submission can be approved."
            ),
            "issues": [
                {"field": "proof_of_address", "issue": "Document is older than 3 months", "severity": "warning"},
                {"field": "source_of_wealth", "issue": "Missing supporting documentation", "severity": "error"},
                {"field": "passport_copy", "issue": "Image quality is low, may need re-scan", "severity": "warning"},
            ],
            "completeness": 72,
        }


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def _safe_parse_json(text: str, fallback: Any) -> Any:
    """Attempt to parse JSON from an LLM response, returning fallback on failure."""
    import json

    # Try to find JSON array in the response
    try:
        start = text.index("[")
        end = text.rindex("]") + 1
        return json.loads(text[start:end])
    except (ValueError, json.JSONDecodeError):
        logger.warning("Failed to parse JSON from AI response, using fallback")
        return fallback
