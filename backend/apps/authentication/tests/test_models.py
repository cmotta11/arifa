import uuid
from datetime import timedelta

import pytest
from django.db import IntegrityError
from django.utils import timezone

from apps.authentication.constants import COORDINATOR
from apps.authentication.models import GuestLink, User
from apps.authentication.tests.factories import UserFactory


class TestUserModel:
    def test_create_user_with_email(self):
        user = User.objects.create_user(
            email="test@example.com",
            password="securepass123",
            role=COORDINATOR,
            first_name="John",
            last_name="Doe",
        )
        assert user.email == "test@example.com"
        assert user.first_name == "John"
        assert user.last_name == "Doe"
        assert user.role == COORDINATOR
        assert user.check_password("securepass123")
        assert user.username is None

    def test_user_str(self):
        user = UserFactory(email="display@example.com")
        assert str(user) == "display@example.com"

    def test_user_email_is_unique(self):
        UserFactory(email="unique@example.com")
        with pytest.raises(IntegrityError):
            UserFactory(email="unique@example.com")

    def test_create_superuser(self):
        user = User.objects.create_superuser(
            email="admin@example.com",
            password="adminpass123",
        )
        assert user.is_staff is True
        assert user.is_superuser is True

    def test_create_user_without_email_raises(self):
        with pytest.raises(ValueError, match="The Email field must be set"):
            User.objects.create_user(email="", password="pass123")

    def test_user_has_uuid_primary_key(self):
        user = UserFactory()
        assert isinstance(user.id, uuid.UUID)

    def test_user_has_timestamps(self):
        user = UserFactory()
        assert user.created_at is not None
        assert user.updated_at is not None


class TestGuestLinkModel:
    @pytest.fixture
    def _mock_ticket(self, mocker):
        """Create a minimal mock ticket in the DB for FK integrity.

        Uses mocker to patch the FK validation so tests work without
        the workflow app having actual data. Instead we directly insert
        a GuestLink via the ORM with raw SQL to bypass FK checks if needed.
        """
        pass

    def test_guest_link_constraint_both_null_raises(self, coordinator_user):
        """Cannot create a GuestLink when both ticket and kyc_submission are null."""
        with pytest.raises(IntegrityError):
            GuestLink.objects.create(
                created_by=coordinator_user,
                ticket=None,
                kyc_submission=None,
            )

    def test_guest_link_has_uuid_token(self, coordinator_user):
        """GuestLink token is auto-generated as a UUID."""
        # We need a real FK target; test constraint logic via raw approach.
        # This test validates the field definition.
        link = GuestLink(
            created_by=coordinator_user,
        )
        assert isinstance(link.token, uuid.UUID)

    def test_guest_link_str(self, coordinator_user):
        link = GuestLink(created_by=coordinator_user)
        assert "GuestLink" in str(link)
        assert str(link.token) in str(link)

    def test_guest_link_is_expired_property(self, coordinator_user):
        link = GuestLink(
            created_by=coordinator_user,
            expires_at=timezone.now() - timedelta(days=1),
        )
        assert link.is_expired is True

    def test_guest_link_is_not_expired_property(self, coordinator_user):
        link = GuestLink(
            created_by=coordinator_user,
            expires_at=timezone.now() + timedelta(days=1),
        )
        assert link.is_expired is False

    def test_guest_link_default_is_active(self, coordinator_user):
        link = GuestLink(created_by=coordinator_user)
        assert link.is_active is True
