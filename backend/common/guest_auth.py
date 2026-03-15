"""Shared guest-token validation helpers.

Centralises the X-Guest-Token header validation pattern used across
KYCSubmission, AccountingRecord, and generic guest endpoints.
"""

from rest_framework.exceptions import PermissionDenied


def validate_guest_or_auth(request, *, kyc_submission_id=None, accounting_record_id=None):
    """Validate either an authenticated user or a guest token.

    Returns a dict with keys:
        - ``guest_link``: the :class:`GuestLink` instance (or ``None`` if
          the caller is authenticated).
        - ``user``: the Django user (or ``None`` for guest access).
        - ``resource``: the related model instance reached through the
          guest link (e.g. a KYCSubmission or AccountingRecord), or
          ``None`` when no resource filter was requested.

    Parameters
    ----------
    request:
        The DRF request object.
    kyc_submission_id:
        If provided, the guest token must be associated with this KYC
        submission.  On success the linked ``KYCSubmission`` is returned
        as ``resource``.
    accounting_record_id:
        If provided, the guest token must be associated with this
        accounting record.  On success the linked ``AccountingRecord``
        is returned as ``resource``.
    """
    from apps.authentication.models import GuestLink

    guest_token = request.headers.get("X-Guest-Token")

    if guest_token:
        filters = {"token": guest_token, "is_active": True}
        select_related = []

        if kyc_submission_id is not None:
            filters["kyc_submission_id"] = kyc_submission_id
            select_related.append("kyc_submission__ticket__entity")
        elif accounting_record_id is not None:
            filters["accounting_record_id"] = accounting_record_id
            select_related.append("accounting_record__entity__client")

        try:
            qs = GuestLink.objects.all()
            if select_related:
                qs = qs.select_related(*select_related)
            link = qs.get(**filters)
        except GuestLink.DoesNotExist:
            raise PermissionDenied("Invalid guest token.")

        if link.is_expired:
            raise PermissionDenied("Guest link has expired.")

        # Determine the related resource
        resource = None
        if kyc_submission_id is not None:
            resource = link.kyc_submission
        elif accounting_record_id is not None:
            resource = link.accounting_record

        return {"guest_link": link, "user": None, "resource": resource}

    if request.user and request.user.is_authenticated:
        # Authenticated user -- optionally fetch the resource directly.
        resource = None
        if kyc_submission_id is not None:
            from apps.compliance.models import KYCSubmission

            resource = KYCSubmission.objects.select_related(
                "ticket__entity"
            ).get(id=kyc_submission_id)
        elif accounting_record_id is not None:
            from apps.compliance.models import AccountingRecord

            resource = AccountingRecord.objects.select_related(
                "entity__client"
            ).get(id=accounting_record_id)

        return {"guest_link": None, "user": request.user, "resource": resource}

    raise PermissionDenied("Authentication required.")
