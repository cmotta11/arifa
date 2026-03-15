from rest_framework.permissions import BasePermission

STAFF_ROLES = frozenset({"coordinator", "compliance_officer", "gestora", "director"})


class IsAdminOrReadOnly(BasePermission):
    """Allow full access to admin users; read-only access for everyone else."""

    def has_permission(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        return request.user and request.user.is_staff


class IsStaffRole(BasePermission):
    """Allow only staff roles (coordinator, compliance_officer, gestora, director)."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role in STAFF_ROLES


class IsStaffOrReadOnlyOwn(BasePermission):
    """Staff can do anything. Clients can only use safe methods (read only)."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role in STAFF_ROLES:
            return True
        return request.method in ("GET", "HEAD", "OPTIONS")


class CanManageClients(BasePermission):
    """Allow access only to authenticated users who can manage client records."""

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated


class CanManageEntities(BasePermission):
    """Allow access only to authenticated users who can manage entity records."""

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated
