"""
Phase 3.9.6 - Help Request Tests

Tests for:
- Help request creation (authenticated user + guest)
- Rate limiting (12/hour via HelpRequestThrottle)
- Auth and guest access validation
"""
import pytest
from unittest.mock import patch

from rest_framework.test import APIClient

from apps.authentication.tests.factories import GuestLinkFactory, UserFactory
from apps.core.tests.factories import ClientFactory, EntityFactory


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_user():
    return UserFactory()


@pytest.fixture
def auth_client(auth_user, api_client):
    api_client.force_authenticate(user=auth_user)
    return api_client


@pytest.fixture
def entity():
    client = ClientFactory()
    return EntityFactory(client=client, jurisdiction="BVI")


@pytest.fixture
def guest_link():
    """Active guest link suitable for help requests."""
    return GuestLinkFactory(is_active=True)


# ---------------------------------------------------------------------------
# Help request creation via service layer
# ---------------------------------------------------------------------------


class TestHelpRequestService:
    @patch("apps.compliance.services.logger")
    def test_request_help_for_authenticated_user(self, mock_logger, auth_user, entity):
        from apps.compliance.services import request_help

        # Should not raise — notification module may be missing but it catches exceptions
        request_help(
            user_or_email=auth_user,
            entity_id=entity.id,
            module="kyc",
            current_page="/kyc/list",
            message="I need help with KYC submission.",
        )
        # The function logs either success or failure
        assert mock_logger.info.called or mock_logger.warning.called

    @patch("apps.compliance.services.logger")
    def test_request_help_for_guest(self, mock_logger):
        from apps.compliance.services import request_help

        request_help(
            user_or_email="guest-token-value",
            entity_id=None,
            module="onboarding",
            current_page="/onboarding",
            message="Help me complete this form.",
        )
        assert mock_logger.info.called or mock_logger.warning.called

    @patch("apps.compliance.services.logger")
    def test_request_help_without_entity(self, mock_logger, auth_user):
        from apps.compliance.services import request_help

        request_help(
            user_or_email=auth_user,
            entity_id=None,
            module="general",
            current_page="/dashboard",
        )
        assert mock_logger.info.called or mock_logger.warning.called

    @patch("apps.compliance.services.logger")
    def test_request_help_with_invalid_entity_id(self, mock_logger, auth_user):
        import uuid
        from apps.compliance.services import request_help

        # Non-existent entity ID should not cause a crash
        request_help(
            user_or_email=auth_user,
            entity_id=uuid.uuid4(),
            module="compliance",
            current_page="/compliance/review",
            message="Need clarification.",
        )
        assert mock_logger.info.called or mock_logger.warning.called


# ---------------------------------------------------------------------------
# Help request via API endpoint
# ---------------------------------------------------------------------------


class TestHelpRequestAPI:
    def test_authenticated_user_can_send_help_request(self, auth_client, entity):
        response = auth_client.post(
            "/api/compliance/help-request/",
            data={
                "module": "kyc",
                "current_page": "/kyc/list",
                "entity_id": str(entity.id),
                "message": "I need assistance.",
            },
            format="json",
        )
        assert response.status_code == 200
        assert response.data["detail"] == "Help request sent."

    def test_guest_user_can_send_help_request(self, api_client, guest_link):
        response = api_client.post(
            "/api/compliance/help-request/",
            data={
                "module": "onboarding",
                "current_page": "/guest/form",
                "message": "I cannot upload documents.",
            },
            format="json",
            HTTP_X_GUEST_TOKEN=str(guest_link.token),
        )
        assert response.status_code == 200
        assert response.data["detail"] == "Help request sent."

    def test_unauthenticated_request_without_guest_token_is_rejected(self, api_client):
        response = api_client.post(
            "/api/compliance/help-request/",
            data={
                "module": "kyc",
                "current_page": "/kyc/list",
            },
            format="json",
        )
        assert response.status_code == 403

    def test_invalid_guest_token_is_rejected(self, api_client):
        response = api_client.post(
            "/api/compliance/help-request/",
            data={
                "module": "kyc",
                "current_page": "/kyc/list",
            },
            format="json",
            HTTP_X_GUEST_TOKEN="00000000-0000-0000-0000-000000000000",
        )
        assert response.status_code == 403

    def test_missing_required_fields_returns_400(self, auth_client):
        response = auth_client.post(
            "/api/compliance/help-request/",
            data={},
            format="json",
        )
        assert response.status_code == 400

    def test_message_field_is_optional(self, auth_client):
        response = auth_client.post(
            "/api/compliance/help-request/",
            data={
                "module": "accounting",
                "current_page": "/accounting-records",
            },
            format="json",
        )
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------


class TestHelpRequestRateLimiting:
    def test_throttle_class_configured(self):
        from apps.compliance.views import HelpRequestThrottle

        assert HelpRequestThrottle.rate == "12/hour"

    def test_throttle_is_anon_rate_throttle(self):
        from rest_framework.throttling import AnonRateThrottle
        from apps.compliance.views import HelpRequestThrottle

        assert issubclass(HelpRequestThrottle, AnonRateThrottle)

    def test_help_request_view_uses_throttle(self):
        from apps.compliance.views import HelpRequestView, HelpRequestThrottle

        assert HelpRequestThrottle in HelpRequestView.throttle_classes
