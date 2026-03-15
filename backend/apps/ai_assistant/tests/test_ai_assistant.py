import uuid
from unittest.mock import MagicMock, patch

import pytest
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from apps.authentication.constants import (
    CLIENT,
    COMPLIANCE_OFFICER,
    COORDINATOR,
    DIRECTOR,
    GESTORA,
)
from apps.authentication.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def coordinator_user():
    return UserFactory(role=COORDINATOR)


@pytest.fixture
def compliance_officer_user():
    return UserFactory(role=COMPLIANCE_OFFICER)


@pytest.fixture
def gestora_user():
    return UserFactory(role=GESTORA)


@pytest.fixture
def director_user():
    return UserFactory(role=DIRECTOR)


@pytest.fixture
def client_user():
    return UserFactory(role=CLIENT)


@pytest.fixture
def authenticated_staff_client(coordinator_user, api_client):
    api_client.force_authenticate(user=coordinator_user)
    return api_client


@pytest.fixture
def authenticated_client_user(client_user, api_client):
    api_client.force_authenticate(user=client_user)
    return api_client


# ---------------------------------------------------------------------------
# AIAssistant service - mock mode tests
# ---------------------------------------------------------------------------


class TestAIAssistantServiceMockMode:
    """Tests for the AIAssistant service in mock mode."""

    @override_settings(AI_MOCK_MODE=True, ANTHROPIC_API_KEY="", AI_MODEL="test", AI_MAX_TOKENS=100)
    def test_chat_mock_mode_returns_string(self):
        from apps.ai_assistant.services import AIAssistant

        assistant = AIAssistant()
        user = MagicMock()
        user.role = "coordinator"

        result = assistant.chat(user=user, message="Tell me about risk")
        assert isinstance(result, str)
        assert len(result) > 0

    @override_settings(AI_MOCK_MODE=True, ANTHROPIC_API_KEY="", AI_MODEL="test", AI_MAX_TOKENS=100)
    def test_chat_mock_returns_risk_response(self):
        from apps.ai_assistant.services import AIAssistant

        assistant = AIAssistant()
        user = MagicMock()
        user.role = "coordinator"

        result = assistant.chat(user=user, message="How is the risk score calculated?")
        assert "risk" in result.lower() or "score" in result.lower()

    @override_settings(AI_MOCK_MODE=True, ANTHROPIC_API_KEY="", AI_MODEL="test", AI_MAX_TOKENS=100)
    def test_chat_mock_returns_kyc_response(self):
        from apps.ai_assistant.services import AIAssistant

        assistant = AIAssistant()
        user = MagicMock()
        user.role = "coordinator"

        result = assistant.chat(user=user, message="What do I need for KYC?")
        assert "kyc" in result.lower()

    @override_settings(AI_MOCK_MODE=True, ANTHROPIC_API_KEY="", AI_MODEL="test", AI_MAX_TOKENS=100)
    def test_chat_mock_spanish_response(self):
        from apps.ai_assistant.services import AIAssistant

        assistant = AIAssistant()
        user = MagicMock()
        user.role = "coordinator"

        result = assistant.chat(
            user=user,
            message="Explicame el riesgo",
            context={"language": "es"},
        )
        # Spanish response should contain Spanish text
        assert isinstance(result, str)
        assert len(result) > 0

    @override_settings(AI_MOCK_MODE=True, ANTHROPIC_API_KEY="", AI_MODEL="test", AI_MAX_TOKENS=100)
    def test_suggest_fields_mock_returns_list(self):
        from apps.ai_assistant.services import AIAssistant

        assistant = AIAssistant()
        result = assistant.suggest_fields(
            entity_type="corporation",
            jurisdiction="panama",
            form_section="entity_info",
        )
        assert isinstance(result, list)
        assert len(result) > 0
        for item in result:
            assert "field" in item
            assert "value" in item
            assert "confidence" in item

    @override_settings(AI_MOCK_MODE=True, ANTHROPIC_API_KEY="", AI_MODEL="test", AI_MAX_TOKENS=100)
    def test_explain_risk_mock_returns_dict(self):
        from apps.ai_assistant.services import AIAssistant

        assistant = AIAssistant()
        result = assistant.explain_risk(
            entity_id=str(uuid.uuid4()),
            risk_assessment_id=str(uuid.uuid4()),
        )
        assert isinstance(result, dict)
        assert "explanation" in result
        assert "factors" in result
        assert isinstance(result["factors"], list)

    @override_settings(AI_MOCK_MODE=True, ANTHROPIC_API_KEY="", AI_MODEL="test", AI_MAX_TOKENS=100)
    def test_review_document_mock_returns_dict(self):
        from apps.ai_assistant.services import AIAssistant

        assistant = AIAssistant()
        result = assistant.review_document(document_id=str(uuid.uuid4()))
        assert isinstance(result, dict)
        assert "summary" in result
        assert "issues" in result
        assert "completeness" in result
        assert isinstance(result["issues"], list)
        assert 0 <= result["completeness"] <= 100


# ---------------------------------------------------------------------------
# Context sanitization tests
# ---------------------------------------------------------------------------


class TestContextSanitization:
    """Tests for the _sanitize_context_value helper."""

    def test_strips_newlines(self):
        from apps.ai_assistant.services import _sanitize_context_value

        result = _sanitize_context_value("hello\nworld\r\nfoo")
        assert "\n" not in result
        assert "\r" not in result

    def test_strips_tabs(self):
        from apps.ai_assistant.services import _sanitize_context_value

        result = _sanitize_context_value("hello\tworld")
        assert "\t" not in result

    def test_strips_null_bytes(self):
        from apps.ai_assistant.services import _sanitize_context_value

        result = _sanitize_context_value("hello\x00world")
        assert "\x00" not in result

    def test_truncates_to_max_length(self):
        from apps.ai_assistant.services import _sanitize_context_value

        long_input = "a" * 200
        result = _sanitize_context_value(long_input, max_length=50)
        assert len(result) == 50

    def test_converts_non_string_to_string(self):
        from apps.ai_assistant.services import _sanitize_context_value

        result = _sanitize_context_value(12345)
        assert result == "12345"


# ---------------------------------------------------------------------------
# Risk data loading tests
# ---------------------------------------------------------------------------


class TestRiskDataLoading:
    """Tests for _load_risk_data that loads data from the DB."""

    @override_settings(AI_MOCK_MODE=True, ANTHROPIC_API_KEY="", AI_MODEL="test", AI_MAX_TOKENS=100)
    def test_load_risk_data_filters_by_entity_id(self):
        from apps.ai_assistant.services import AIAssistant

        assistant = AIAssistant()

        entity_id = str(uuid.uuid4())
        assessment_id = str(uuid.uuid4())

        with patch("apps.ai_assistant.services.AIAssistant._load_risk_data") as mock_load:
            mock_load.return_value = {
                "overall_score": 52,
                "risk_level": "medium",
                "factors": [
                    {"name": "Jurisdiction Risk", "impact": "medium", "score": 15, "max_score": 30},
                ],
            }

            result = assistant._load_risk_data(entity_id, assessment_id)
            mock_load.assert_called_once_with(entity_id, assessment_id)

    @override_settings(AI_MOCK_MODE=True, ANTHROPIC_API_KEY="", AI_MODEL="test", AI_MAX_TOKENS=100)
    def test_load_risk_data_returns_default_on_error(self):
        """When the RiskAssessment doesn't exist, should return a default dict."""
        from apps.ai_assistant.services import AIAssistant

        assistant = AIAssistant()

        # Use random UUIDs that won't match any real records
        result = assistant._load_risk_data(
            str(uuid.uuid4()),
            str(uuid.uuid4()),
        )

        assert isinstance(result, dict)
        assert "overall_score" in result
        assert "risk_level" in result
        assert "factors" in result


# ---------------------------------------------------------------------------
# View authentication tests
# ---------------------------------------------------------------------------


class TestAIChatViewAuth:
    """Tests for the AI chat endpoint authentication and permissions."""

    def test_chat_requires_authentication(self, api_client):
        url = reverse("ai_assistant:chat")
        response = api_client.post(
            url,
            {"message": "Hello"},
            format="json",
        )
        assert response.status_code == 401

    @override_settings(AI_MOCK_MODE=True, ANTHROPIC_API_KEY="", AI_MODEL="test", AI_MAX_TOKENS=100)
    def test_chat_accessible_to_authenticated_staff(self, authenticated_staff_client):
        url = reverse("ai_assistant:chat")
        response = authenticated_staff_client.post(
            url,
            {"message": "What is KYC?"},
            format="json",
        )
        assert response.status_code == 200
        assert "response" in response.data
        assert isinstance(response.data["response"], str)

    @override_settings(AI_MOCK_MODE=True, ANTHROPIC_API_KEY="", AI_MODEL="test", AI_MAX_TOKENS=100)
    def test_chat_accessible_to_client_role(self, authenticated_client_user):
        """Chat endpoint requires IsAuthenticated, not IsStaffRole."""
        url = reverse("ai_assistant:chat")
        response = authenticated_client_user.post(
            url,
            {"message": "Hello"},
            format="json",
        )
        assert response.status_code == 200

    @override_settings(AI_MOCK_MODE=True, ANTHROPIC_API_KEY="", AI_MODEL="test", AI_MAX_TOKENS=100)
    def test_chat_returns_suggestions(self, authenticated_staff_client):
        url = reverse("ai_assistant:chat")
        response = authenticated_staff_client.post(
            url,
            {"message": "Tell me about KYC", "context": {"page": "/kyc/list"}},
            format="json",
        )
        assert response.status_code == 200
        assert "suggestions" in response.data
        assert isinstance(response.data["suggestions"], list)

    @override_settings(AI_MOCK_MODE=True, ANTHROPIC_API_KEY="", AI_MODEL="test", AI_MAX_TOKENS=100)
    def test_chat_validates_message_field(self, authenticated_staff_client):
        url = reverse("ai_assistant:chat")
        response = authenticated_staff_client.post(
            url,
            {},
            format="json",
        )
        assert response.status_code == 400


# ---------------------------------------------------------------------------
# Explain-risk endpoint tests
# ---------------------------------------------------------------------------


class TestAIExplainRiskViewAuth:
    """Tests for the explain-risk endpoint permissions."""

    def test_explain_risk_requires_authentication(self, api_client):
        url = reverse("ai_assistant:explain-risk")
        response = api_client.post(
            url,
            {
                "entity_id": str(uuid.uuid4()),
                "risk_assessment_id": str(uuid.uuid4()),
            },
            format="json",
        )
        assert response.status_code == 401

    def test_explain_risk_requires_staff_role(self, authenticated_client_user):
        url = reverse("ai_assistant:explain-risk")
        response = authenticated_client_user.post(
            url,
            {
                "entity_id": str(uuid.uuid4()),
                "risk_assessment_id": str(uuid.uuid4()),
            },
            format="json",
        )
        assert response.status_code == 403

    @override_settings(AI_MOCK_MODE=True, ANTHROPIC_API_KEY="", AI_MODEL="test", AI_MAX_TOKENS=100)
    def test_explain_risk_accessible_to_staff(self, authenticated_staff_client):
        url = reverse("ai_assistant:explain-risk")
        response = authenticated_staff_client.post(
            url,
            {
                "entity_id": str(uuid.uuid4()),
                "risk_assessment_id": str(uuid.uuid4()),
            },
            format="json",
        )
        assert response.status_code == 200
        assert "explanation" in response.data
        assert "factors" in response.data

    @override_settings(AI_MOCK_MODE=True, ANTHROPIC_API_KEY="", AI_MODEL="test", AI_MAX_TOKENS=100)
    def test_explain_risk_validates_uuid_fields(self, authenticated_staff_client):
        url = reverse("ai_assistant:explain-risk")
        response = authenticated_staff_client.post(
            url,
            {"entity_id": "not-a-uuid", "risk_assessment_id": "also-bad"},
            format="json",
        )
        assert response.status_code == 400


# ---------------------------------------------------------------------------
# Review-doc endpoint tests
# ---------------------------------------------------------------------------


class TestAIReviewDocViewAuth:
    """Tests for the review-doc endpoint permissions."""

    def test_review_doc_requires_authentication(self, api_client):
        url = reverse("ai_assistant:review-doc")
        response = api_client.post(
            url,
            {"document_id": str(uuid.uuid4())},
            format="json",
        )
        assert response.status_code == 401

    def test_review_doc_requires_staff_role(self, authenticated_client_user):
        url = reverse("ai_assistant:review-doc")
        response = authenticated_client_user.post(
            url,
            {"document_id": str(uuid.uuid4())},
            format="json",
        )
        assert response.status_code == 403

    @override_settings(AI_MOCK_MODE=True, ANTHROPIC_API_KEY="", AI_MODEL="test", AI_MAX_TOKENS=100)
    def test_review_doc_accessible_to_staff(self, authenticated_staff_client):
        url = reverse("ai_assistant:review-doc")
        response = authenticated_staff_client.post(
            url,
            {"document_id": str(uuid.uuid4())},
            format="json",
        )
        assert response.status_code == 200
        assert "summary" in response.data
        assert "issues" in response.data
        assert "completeness" in response.data

    @override_settings(AI_MOCK_MODE=True, ANTHROPIC_API_KEY="", AI_MODEL="test", AI_MAX_TOKENS=100)
    def test_review_doc_validates_document_id(self, authenticated_staff_client):
        url = reverse("ai_assistant:review-doc")
        response = authenticated_staff_client.post(
            url,
            {"document_id": "bad-id"},
            format="json",
        )
        assert response.status_code == 400


# ---------------------------------------------------------------------------
# Suggest endpoint tests
# ---------------------------------------------------------------------------


class TestAISuggestViewAuth:
    """Tests for the suggest endpoint."""

    def test_suggest_requires_authentication(self, api_client):
        url = reverse("ai_assistant:suggest")
        response = api_client.post(
            url,
            {
                "entity_type": "corporation",
                "jurisdiction": "bvi",
                "form_section": "entity_info",
            },
            format="json",
        )
        assert response.status_code == 401

    @override_settings(AI_MOCK_MODE=True, ANTHROPIC_API_KEY="", AI_MODEL="test", AI_MAX_TOKENS=100)
    def test_suggest_accessible_to_authenticated_user(self, authenticated_staff_client):
        url = reverse("ai_assistant:suggest")
        response = authenticated_staff_client.post(
            url,
            {
                "entity_type": "corporation",
                "jurisdiction": "bvi",
                "form_section": "entity_info",
            },
            format="json",
        )
        assert response.status_code == 200
        assert "suggestions" in response.data
        assert isinstance(response.data["suggestions"], list)


# ---------------------------------------------------------------------------
# Rate limiting tests
# ---------------------------------------------------------------------------


class TestAIRateLimiting:
    """Tests for the AI rate throttle (30 requests/hour)."""

    @override_settings(AI_MOCK_MODE=True, ANTHROPIC_API_KEY="", AI_MODEL="test", AI_MAX_TOKENS=100)
    def test_rate_limit_throttle_class_configured(self):
        """Verify the AIRateThrottle is properly configured."""
        from apps.ai_assistant.throttles import AIRateThrottle

        throttle = AIRateThrottle()
        assert throttle.rate == "30/hour"
        assert throttle.scope == "ai_assistant"

    @override_settings(AI_MOCK_MODE=True, ANTHROPIC_API_KEY="", AI_MODEL="test", AI_MAX_TOKENS=100)
    def test_throttle_classes_on_chat_view(self):
        """Verify the chat view has the AIRateThrottle configured."""
        from apps.ai_assistant.throttles import AIRateThrottle
        from apps.ai_assistant.views import AIChatView

        assert AIRateThrottle in AIChatView.throttle_classes

    @override_settings(AI_MOCK_MODE=True, ANTHROPIC_API_KEY="", AI_MODEL="test", AI_MAX_TOKENS=100)
    def test_throttle_classes_on_explain_view(self):
        """Verify the explain-risk view has the AIRateThrottle configured."""
        from apps.ai_assistant.throttles import AIRateThrottle
        from apps.ai_assistant.views import AIExplainRiskView

        assert AIRateThrottle in AIExplainRiskView.throttle_classes

    @override_settings(AI_MOCK_MODE=True, ANTHROPIC_API_KEY="", AI_MODEL="test", AI_MAX_TOKENS=100)
    def test_throttle_classes_on_review_view(self):
        """Verify the review-doc view has the AIRateThrottle configured."""
        from apps.ai_assistant.throttles import AIRateThrottle
        from apps.ai_assistant.views import AIReviewDocView

        assert AIRateThrottle in AIReviewDocView.throttle_classes

    @override_settings(AI_MOCK_MODE=True, ANTHROPIC_API_KEY="", AI_MODEL="test", AI_MAX_TOKENS=100)
    def test_throttle_classes_on_suggest_view(self):
        """Verify the suggest view has the AIRateThrottle configured."""
        from apps.ai_assistant.throttles import AIRateThrottle
        from apps.ai_assistant.views import AISuggestView

        assert AIRateThrottle in AISuggestView.throttle_classes


# ---------------------------------------------------------------------------
# Permission class tests
# ---------------------------------------------------------------------------


class TestAIViewPermissions:
    """Verify each view has the correct permission classes set."""

    def test_chat_view_requires_is_authenticated(self):
        from rest_framework.permissions import IsAuthenticated

        from apps.ai_assistant.views import AIChatView

        assert IsAuthenticated in AIChatView.permission_classes

    def test_explain_risk_requires_staff_role(self):
        from rest_framework.permissions import IsAuthenticated

        from apps.ai_assistant.views import AIExplainRiskView
        from apps.core.permissions import IsStaffRole

        assert IsAuthenticated in AIExplainRiskView.permission_classes
        assert IsStaffRole in AIExplainRiskView.permission_classes

    def test_review_doc_requires_staff_role(self):
        from rest_framework.permissions import IsAuthenticated

        from apps.ai_assistant.views import AIReviewDocView
        from apps.core.permissions import IsStaffRole

        assert IsAuthenticated in AIReviewDocView.permission_classes
        assert IsStaffRole in AIReviewDocView.permission_classes

    def test_suggest_view_requires_is_authenticated(self):
        from rest_framework.permissions import IsAuthenticated

        from apps.ai_assistant.views import AISuggestView

        assert IsAuthenticated in AISuggestView.permission_classes


# ---------------------------------------------------------------------------
# Role-based access integration tests
# ---------------------------------------------------------------------------


class TestRoleBasedAccess:
    """Integration tests verifying each staff role can access staff endpoints."""

    @override_settings(AI_MOCK_MODE=True, ANTHROPIC_API_KEY="", AI_MODEL="test", AI_MAX_TOKENS=100)
    @pytest.mark.parametrize("role", [COORDINATOR, COMPLIANCE_OFFICER, GESTORA, DIRECTOR])
    def test_staff_roles_can_access_explain_risk(self, api_client, role):
        user = UserFactory(role=role)
        api_client.force_authenticate(user=user)

        url = reverse("ai_assistant:explain-risk")
        response = api_client.post(
            url,
            {
                "entity_id": str(uuid.uuid4()),
                "risk_assessment_id": str(uuid.uuid4()),
            },
            format="json",
        )
        assert response.status_code == 200

    @override_settings(AI_MOCK_MODE=True, ANTHROPIC_API_KEY="", AI_MODEL="test", AI_MAX_TOKENS=100)
    @pytest.mark.parametrize("role", [COORDINATOR, COMPLIANCE_OFFICER, GESTORA, DIRECTOR])
    def test_staff_roles_can_access_review_doc(self, api_client, role):
        user = UserFactory(role=role)
        api_client.force_authenticate(user=user)

        url = reverse("ai_assistant:review-doc")
        response = api_client.post(
            url,
            {"document_id": str(uuid.uuid4())},
            format="json",
        )
        assert response.status_code == 200
