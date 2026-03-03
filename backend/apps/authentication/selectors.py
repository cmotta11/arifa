from django.db.models import QuerySet

from .models import GuestLink, User


def get_user_by_email(*, email: str) -> User | None:
    """Return a User matching the given email, or None if not found."""
    return User.objects.filter(email=email).first()


def get_active_guest_links(*, created_by: User) -> QuerySet[GuestLink]:
    """Return all active, non-expired guest links created by the given user."""
    return GuestLink.objects.filter(
        created_by=created_by,
        is_active=True,
    ).select_related("created_by", "ticket", "kyc_submission")
