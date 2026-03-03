from rest_framework.permissions import BasePermission

from .constants import (
    CLIENT,
    COMPLIANCE_OFFICER,
    COORDINATOR,
    DIRECTOR,
    GESTORA,
)
from .services import validate_guest_link


class IsCoordinator(BasePermission):
    """Allow access only to users with the 'coordinator' role."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == COORDINATOR
        )


class IsComplianceOfficer(BasePermission):
    """Allow access only to users with the 'compliance_officer' role."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == COMPLIANCE_OFFICER
        )


class IsGestora(BasePermission):
    """Allow access only to users with the 'gestora' role."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == GESTORA
        )


class IsDirector(BasePermission):
    """Allow access only to users with the 'director' role."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == DIRECTOR
        )


class IsClient(BasePermission):
    """Allow access only to users with the 'client' role."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == CLIENT
        )


class IsInternalUser(BasePermission):
    """Allow access only to authenticated users who are NOT clients."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role != CLIENT
        )


class IsGuestLinkValid(BasePermission):
    """Allow access when a valid guest link token is provided.

    The token can be supplied via:
    - ``X-Guest-Token`` request header
    - ``guest_token`` query parameter
    """

    def has_permission(self, request, view):
        token = request.headers.get("X-Guest-Token") or request.query_params.get(
            "guest_token"
        )
        if not token:
            return False

        try:
            guest_link = validate_guest_link(token=token)
            # Attach the validated guest link to the request for downstream use.
            request.guest_link = guest_link
            return True
        except Exception:
            return False
