from rest_framework.permissions import BasePermission


class IsAdminOrReadOnly(BasePermission):
    """
    Allow full access to admin users; read-only access for everyone else.
    """

    def has_permission(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        return request.user and request.user.is_staff


class CanManageClients(BasePermission):
    """
    Allow access only to authenticated users who can manage client records.
    """

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated


class CanManageEntities(BasePermission):
    """
    Allow access only to authenticated users who can manage entity records.
    """

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated
