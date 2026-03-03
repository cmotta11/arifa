from rest_framework.permissions import BasePermission

from apps.authentication.constants import (
    COMPLIANCE_OFFICER,
    COORDINATOR,
    DIRECTOR,
)


class CanManageKYC(BasePermission):
    """Allow coordinators, compliance officers, and directors to manage KYC."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return request.user.role in {COORDINATOR, COMPLIANCE_OFFICER, DIRECTOR}


class CanReviewKYC(BasePermission):
    """Only compliance officers and directors can approve/reject KYC."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return request.user.role in {COMPLIANCE_OFFICER, DIRECTOR}


class CanManageRFI(BasePermission):
    """Compliance officers and directors can create and manage RFIs."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return request.user.role in {COMPLIANCE_OFFICER, DIRECTOR}


class CanScreenParties(BasePermission):
    """Only compliance officers can initiate World-Check screening."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return request.user.role == COMPLIANCE_OFFICER
