from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from common.exceptions import ApplicationError

from .constants import GUEST_LINK_EXPIRY_DAYS, MAGIC_LINK_EXPIRY_MINUTES
from .models import GuestLink, MagicLoginToken, User


def register_user(
    *,
    email: str,
    password: str | None = None,
    role: str,
    first_name: str = "",
    last_name: str = "",
    client_id=None,
) -> User:
    """Create and return a new User with the given credentials and role.

    If ``password`` is None or empty, the user is created with an unusable
    password (suitable for magic-link-only client accounts).
    """
    if User.objects.filter(email=email).exists():
        raise ApplicationError("A user with this email already exists.")

    if password:
        user = User.objects.create_user(
            email=email,
            password=password,
            role=role,
            first_name=first_name,
            last_name=last_name,
            client_id=client_id,
        )
    else:
        user = User(
            email=User.objects.normalize_email(email),
            role=role,
            first_name=first_name,
            last_name=last_name,
            client_id=client_id,
        )
        user.set_unusable_password()
        user.save()

    return user


def create_guest_link(
    *,
    created_by: User,
    ticket=None,
    kyc_submission=None,
    accounting_record=None,
) -> GuestLink:
    """Create a guest link that expires in 30 days.

    Exactly one of ``ticket``, ``kyc_submission``, or ``accounting_record``
    must be provided.
    """
    targets = [ticket, kyc_submission, accounting_record]
    provided = sum(1 for t in targets if t is not None)
    if provided != 1:
        raise ApplicationError(
            "Exactly one of 'ticket', 'kyc_submission', or 'accounting_record' must be provided."
        )

    guest_link = GuestLink.objects.create(
        created_by=created_by,
        ticket=ticket,
        kyc_submission=kyc_submission,
        accounting_record=accounting_record,
        expires_at=timezone.now() + timedelta(days=GUEST_LINK_EXPIRY_DAYS),
    )
    return guest_link


def list_users(*, role=None):
    """Return a queryset of all users, optionally filtered by role."""
    qs = User.objects.all()
    if role:
        qs = qs.filter(role=role)
    return qs


def get_user(*, user_id) -> User:
    """Return a single user by ID. Raises ApplicationError if not found."""
    try:
        return User.objects.get(id=user_id)
    except User.DoesNotExist:
        raise ApplicationError("User not found.")


@transaction.atomic
def update_user(*, user_id, **data) -> User:
    """Update user fields (first_name, last_name, role, is_active).

    Returns the updated user instance.
    """
    user = get_user(user_id=user_id)

    allowed_fields = {"first_name", "last_name", "role", "is_active", "client_id"}
    update_fields = []

    for field, value in data.items():
        if field in allowed_fields:
            setattr(user, field, value)
            update_fields.append(field)

    if update_fields:
        update_fields.append("updated_at")
        user.save(update_fields=update_fields)

    return user


@transaction.atomic
def deactivate_user(*, user_id) -> User:
    """Soft-delete a user by setting is_active=False."""
    user = get_user(user_id=user_id)
    user.is_active = False
    user.save(update_fields=["is_active", "updated_at"])
    return user


def validate_guest_link(*, token) -> GuestLink:
    """Return the GuestLink for ``token`` if it is active and not expired.

    Raises ``ApplicationError`` when the link does not exist, is inactive,
    or has expired.
    """
    try:
        guest_link = GuestLink.objects.select_related(
            "created_by", "ticket", "kyc_submission",
            "accounting_record__entity__client",
        ).get(token=token)
    except GuestLink.DoesNotExist:
        raise ApplicationError("Guest link not found.")

    if not guest_link.is_active:
        raise ApplicationError("Guest link is no longer active.")

    if guest_link.is_expired:
        raise ApplicationError("Guest link has expired.")

    return guest_link


# ===========================================================================
# Magic Login Token services
# ===========================================================================


def create_magic_login_token(*, user: User) -> MagicLoginToken:
    """Create a short-lived magic login token for a user."""
    token = MagicLoginToken.objects.create(
        user=user,
        expires_at=timezone.now() + timedelta(minutes=MAGIC_LINK_EXPIRY_MINUTES),
    )
    return token


def validate_magic_login_token(*, token: str) -> User:
    """Validate a magic token and return the user. Marks token as used."""
    try:
        magic_token = MagicLoginToken.objects.select_related("user").get(
            token=token
        )
    except MagicLoginToken.DoesNotExist:
        raise ApplicationError("Invalid magic link.")

    if magic_token.is_used:
        raise ApplicationError("This magic link has already been used.")
    if timezone.now() > magic_token.expires_at:
        raise ApplicationError("This magic link has expired.")

    magic_token.is_used = True
    magic_token.save(update_fields=["is_used", "updated_at"])
    return magic_token.user


def request_magic_link_for_email(*, email: str) -> None:
    """Self-service: find contact with portal access, create user if needed, send magic link."""
    from apps.core.models import ClientContact

    contact = ClientContact.objects.filter(
        email__iexact=email, has_portal_access=True
    ).select_related("user", "client").first()

    if not contact:
        return  # Silent — no email enumeration

    # Lazy user creation
    if not contact.user:
        user = register_user(
            email=contact.email,
            role="client",
            first_name=contact.first_name,
            last_name=contact.last_name,
            client_id=contact.client_id,
        )
        contact.user = user
        contact.save(update_fields=["user", "updated_at"])

    token = create_magic_login_token(user=contact.user)
    send_magic_link_email(user=contact.user, token=token)


def send_magic_link_email(*, user: User, token: MagicLoginToken):
    """Send magic link email to user."""
    from django.conf import settings
    from django.core.mail import send_mail

    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
    link = f"{frontend_url}/auth/magic/{token.token}"

    send_mail(
        subject="ARIFA - Your Login Link",
        message=f"Click here to log in: {link}\n\nThis link expires in {MAGIC_LINK_EXPIRY_MINUTES} minutes.",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )
