from rest_framework.permissions import BasePermission

from apps.authentication.constants import CLIENT


class CanManageTickets(BasePermission):
    """Allow access to any authenticated user who is not a client."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role != CLIENT
        )


class CanViewTickets(BasePermission):
    """Allow any authenticated user to view tickets."""

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated


class IsTicketCreatorOrAssignee(BasePermission):
    """Object-level permission: the user is either the ticket creator
    or the current assignee."""

    def has_object_permission(self, request, view, obj):
        return (
            obj.created_by == request.user
            or obj.assigned_to == request.user
        )
