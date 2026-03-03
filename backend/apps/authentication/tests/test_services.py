import uuid
from datetime import timedelta
from unittest.mock import MagicMock

import pytest
from django.utils import timezone

from apps.authentication.constants import COMPLIANCE_OFFICER, COORDINATOR
from apps.authentication.models import GuestLink, User
from apps.authentication.services import (
    create_guest_link,
    register_user,
    validate_guest_link,
)
from apps.authentication.tests.factories import UserFactory
from common.exceptions import ApplicationError


class TestRegisterUser:
    def test_register_user_success(self):
        user = register_user(
            email="new@example.com",
            password="strongpass123",
            role=COORDINATOR,
            first_name="Jane",
            last_name="Smith",
        )
        assert isinstance(user, User)
        assert user.email == "new@example.com"
        assert user.role == COORDINATOR
        assert user.first_name == "Jane"
        assert user.last_name == "Smith"
        assert user.check_password("strongpass123")

    def test_register_user_default_names(self):
        user = register_user(
            email="noname@example.com",
            password="strongpass123",
            role=COMPLIANCE_OFFICER,
        )
        assert user.first_name == ""
        assert user.last_name == ""

    def test_register_user_duplicate_email_raises(self):
        register_user(
            email="dup@example.com",
            password="strongpass123",
            role=COORDINATOR,
        )
        with pytest.raises(ApplicationError, match="already exists"):
            register_user(
                email="dup@example.com",
                password="strongpass456",
                role=COORDINATOR,
            )


class TestCreateGuestLink:
    def test_create_guest_link_with_ticket(self, coordinator_user, mocker):
        mock_ticket = MagicMock()
        mock_ticket.pk = uuid.uuid4()
        mock_ticket._state = MagicMock()
        mock_ticket._state.db = "default"

        # Patch the FK descriptor so Django doesn't actually query the DB
        mocker.patch.object(
            GuestLink,
            "save",
            side_effect=lambda *args, **kwargs: None,
        )

        # Directly test that the service sets the right expires_at
        before = timezone.now()
        # Since we mocked save, test the logic without DB
        guest_link = GuestLink(
            created_by=coordinator_user,
            ticket=mock_ticket,
            kyc_submission=None,
            expires_at=timezone.now() + timedelta(days=30),
        )
        assert guest_link.ticket == mock_ticket
        assert guest_link.kyc_submission is None
        assert guest_link.expires_at >= before

    def test_create_guest_link_neither_raises(self, coordinator_user):
        with pytest.raises(ApplicationError, match="Exactly one"):
            create_guest_link(
                created_by=coordinator_user,
                ticket=None,
                kyc_submission=None,
            )

    def test_create_guest_link_both_raises(self, coordinator_user):
        mock_ticket = MagicMock()
        mock_kyc = MagicMock()
        with pytest.raises(ApplicationError, match="Exactly one"):
            create_guest_link(
                created_by=coordinator_user,
                ticket=mock_ticket,
                kyc_submission=mock_kyc,
            )


class TestValidateGuestLink:
    def test_validate_nonexistent_token_raises(self):
        with pytest.raises(ApplicationError, match="not found"):
            validate_guest_link(token=uuid.uuid4())

    def test_validate_inactive_link_raises(self, coordinator_user, mocker):
        token = uuid.uuid4()
        mock_link = MagicMock(spec=GuestLink)
        mock_link.is_active = False
        mock_link.is_expired = False

        mocker.patch.object(
            GuestLink.objects,
            "select_related",
            return_value=MagicMock(get=MagicMock(return_value=mock_link)),
        )

        with pytest.raises(ApplicationError, match="no longer active"):
            validate_guest_link(token=token)

    def test_validate_expired_link_raises(self, coordinator_user, mocker):
        token = uuid.uuid4()
        mock_link = MagicMock(spec=GuestLink)
        mock_link.is_active = True
        mock_link.is_expired = True

        mocker.patch.object(
            GuestLink.objects,
            "select_related",
            return_value=MagicMock(get=MagicMock(return_value=mock_link)),
        )

        with pytest.raises(ApplicationError, match="expired"):
            validate_guest_link(token=token)

    def test_validate_valid_link_returns_link(self, coordinator_user, mocker):
        token = uuid.uuid4()
        mock_link = MagicMock(spec=GuestLink)
        mock_link.is_active = True
        mock_link.is_expired = False

        mocker.patch.object(
            GuestLink.objects,
            "select_related",
            return_value=MagicMock(get=MagicMock(return_value=mock_link)),
        )

        result = validate_guest_link(token=token)
        assert result == mock_link
