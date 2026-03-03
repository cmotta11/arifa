import uuid
from unittest.mock import MagicMock

import pytest
from django.urls import reverse

from apps.authentication.constants import COORDINATOR
from apps.authentication.models import User
from apps.authentication.tests.factories import UserFactory


class TestRegisterView:
    def test_register_success(self, api_client):
        url = reverse("authentication:register")
        payload = {
            "email": "newuser@example.com",
            "password": "securepass123",
            "role": "coordinator",
            "first_name": "Alice",
            "last_name": "Wonder",
        }
        response = api_client.post(url, payload, format="json")
        assert response.status_code == 201
        assert response.data["email"] == "newuser@example.com"
        assert response.data["first_name"] == "Alice"
        assert response.data["role"] == "coordinator"
        assert "password" not in response.data

    def test_register_duplicate_email(self, api_client):
        UserFactory(email="existing@example.com")
        url = reverse("authentication:register")
        payload = {
            "email": "existing@example.com",
            "password": "securepass123",
            "role": "coordinator",
        }
        response = api_client.post(url, payload, format="json")
        assert response.status_code == 400

    def test_register_invalid_role(self, api_client):
        url = reverse("authentication:register")
        payload = {
            "email": "bad@example.com",
            "password": "securepass123",
            "role": "invalid_role",
        }
        response = api_client.post(url, payload, format="json")
        assert response.status_code == 400

    def test_register_missing_password(self, api_client):
        url = reverse("authentication:register")
        payload = {
            "email": "nopass@example.com",
            "role": "coordinator",
        }
        response = api_client.post(url, payload, format="json")
        assert response.status_code == 400


class TestLoginView:
    def test_login_success(self, api_client):
        UserFactory(email="login@example.com", password="mypass123")
        url = reverse("authentication:login")
        payload = {"email": "login@example.com", "password": "mypass123"}
        response = api_client.post(url, payload, format="json")
        assert response.status_code == 200
        assert response.data["email"] == "login@example.com"

    def test_login_invalid_credentials(self, api_client):
        UserFactory(email="login@example.com", password="mypass123")
        url = reverse("authentication:login")
        payload = {"email": "login@example.com", "password": "wrongpass"}
        response = api_client.post(url, payload, format="json")
        assert response.status_code == 401

    def test_login_nonexistent_user(self, api_client):
        url = reverse("authentication:login")
        payload = {"email": "nobody@example.com", "password": "pass123"}
        response = api_client.post(url, payload, format="json")
        assert response.status_code == 401


class TestLogoutView:
    def test_logout_success(self, authenticated_client):
        url = reverse("authentication:logout")
        response = authenticated_client.post(url)
        assert response.status_code == 200
        assert "logged out" in response.data["message"].lower()

    def test_logout_unauthenticated(self, api_client):
        url = reverse("authentication:logout")
        response = api_client.post(url)
        assert response.status_code == 403


class TestMeView:
    def test_me_authenticated(self, authenticated_client, coordinator_user):
        url = reverse("authentication:me")
        response = authenticated_client.get(url)
        assert response.status_code == 200
        assert response.data["email"] == coordinator_user.email
        assert response.data["role"] == COORDINATOR

    def test_me_unauthenticated(self, api_client):
        url = reverse("authentication:me")
        response = api_client.get(url)
        assert response.status_code == 403


class TestGuestLinkCreateView:
    def test_create_guest_link_unauthenticated(self, api_client):
        url = reverse("authentication:guest-link-create")
        response = api_client.post(url, {}, format="json")
        assert response.status_code == 403

    def test_create_guest_link_neither_target_raises(self, authenticated_client):
        url = reverse("authentication:guest-link-create")
        payload = {}
        response = authenticated_client.post(url, payload, format="json")
        # Both default to None, so the service should raise ApplicationError
        assert response.status_code == 400


class TestGuestLinkValidateView:
    def test_validate_nonexistent_token(self, api_client):
        token = uuid.uuid4()
        url = reverse("authentication:guest-link-validate", kwargs={"token": token})
        response = api_client.get(url)
        assert response.status_code == 400
        assert "not found" in response.data["message"].lower()

    def test_validate_link_allows_anonymous(self, api_client):
        """Validate endpoint should be accessible without authentication."""
        token = uuid.uuid4()
        url = reverse("authentication:guest-link-validate", kwargs={"token": token})
        response = api_client.get(url)
        # Should be 400 (not found), not 403 (forbidden)
        assert response.status_code == 400
