import uuid
from datetime import timedelta

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils import timezone

from common.base_model import TimeStampedModel

from .constants import GUEST_LINK_EXPIRY_DAYS, ROLE_CHOICES


class UserManager(BaseUserManager):
    """Custom manager for User model where email is the unique identifier."""

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("The Email field must be set")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(email, password, **extra_fields)


class User(TimeStampedModel, AbstractUser):
    username = None
    email = models.EmailField("email address", unique=True)
    role = models.CharField(max_length=30, choices=ROLE_CHOICES)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    client = models.ForeignKey(
        "core.Client",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users",
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta(TimeStampedModel.Meta):
        verbose_name = "user"
        verbose_name_plural = "users"

    def __str__(self):
        return self.email


def _default_guest_link_expiry():
    return timezone.now() + timedelta(days=GUEST_LINK_EXPIRY_DAYS)


class GuestLink(TimeStampedModel):
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="guest_links",
    )
    ticket = models.ForeignKey(
        "workflow.Ticket",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="guest_links",
    )
    kyc_submission = models.ForeignKey(
        "compliance.KYCSubmission",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="guest_links",
    )
    accounting_record = models.ForeignKey(
        "compliance.AccountingRecord",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="guest_links",
    )
    es_submission = models.ForeignKey(
        "compliance.EconomicSubstanceSubmission",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="guest_links",
    )
    expires_at = models.DateTimeField(default=_default_guest_link_expiry)
    is_active = models.BooleanField(default=True)

    class Meta(TimeStampedModel.Meta):
        verbose_name = "guest link"
        verbose_name_plural = "guest links"
        constraints = [
            models.CheckConstraint(
                name="guest_link_exactly_one_target",
                check=(
                    models.Q(
                        ticket__isnull=False,
                        kyc_submission__isnull=True,
                        accounting_record__isnull=True,
                        es_submission__isnull=True,
                    )
                    | models.Q(
                        ticket__isnull=True,
                        kyc_submission__isnull=False,
                        accounting_record__isnull=True,
                        es_submission__isnull=True,
                    )
                    | models.Q(
                        ticket__isnull=True,
                        kyc_submission__isnull=True,
                        accounting_record__isnull=False,
                        es_submission__isnull=True,
                    )
                    | models.Q(
                        ticket__isnull=True,
                        kyc_submission__isnull=True,
                        accounting_record__isnull=True,
                        es_submission__isnull=False,
                    )
                ),
            ),
        ]

    def __str__(self):
        return f"GuestLink {self.token} by {self.created_by}"

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at


class MagicLoginToken(TimeStampedModel):
    """Short-lived token for passwordless client authentication."""

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="magic_tokens",
    )
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    class Meta(TimeStampedModel.Meta):
        verbose_name = "magic login token"
        verbose_name_plural = "magic login tokens"

    def __str__(self):
        return f"MagicLoginToken {self.token} for {self.user}"
