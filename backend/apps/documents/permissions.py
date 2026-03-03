from rest_framework.permissions import IsAuthenticated


class CanManageDocuments(IsAuthenticated):
    """Allow access only to authenticated users for document operations."""

    pass
