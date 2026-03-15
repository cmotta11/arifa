"""Utility to report integration configuration status.

Provides a single function that checks all external integrations
and returns their status (configured vs mock data).
"""

from django.conf import settings


def get_integration_status() -> dict:
    """Return configuration status for all external integrations.

    Each integration reports:
      - configured (bool): Whether valid credentials are set
      - message (str): User-facing status message
    """
    return {
        "worldcheck": _check_worldcheck(),
        "sharepoint": _check_sharepoint(),
        "llm_extraction": _check_llm(),
        "aderant_erp": _check_aderant(),
        "aderant_soap": _check_aderant_soap(),
        "gotenberg": _check_gotenberg(),
        "microsoft_sso": _check_microsoft_sso(),
    }


def _check_worldcheck() -> dict:
    configured = bool(
        getattr(settings, "WORLDCHECK_API_KEY", "")
        and getattr(settings, "WORLDCHECK_API_SECRET", "")
        and getattr(settings, "WORLDCHECK_GROUP_ID", "")
    )
    if configured:
        return {
            "configured": True,
            "message": "World-Check One API is configured and active.",
        }
    return {
        "configured": False,
        "message": (
            "World-Check One API is not configured. "
            "Screening requests will return mock data. "
            "Set WORLDCHECK_API_KEY, WORLDCHECK_API_SECRET, and "
            "WORLDCHECK_GROUP_ID in .env to enable."
        ),
    }


def _check_sharepoint() -> dict:
    configured = bool(
        getattr(settings, "SHAREPOINT_TENANT_ID", "")
        and getattr(settings, "SHAREPOINT_CLIENT_ID", "")
        and getattr(settings, "SHAREPOINT_CLIENT_SECRET", "")
        and getattr(settings, "SHAREPOINT_SITE_ID", "")
        and getattr(settings, "SHAREPOINT_DRIVE_ID", "")
    )
    if configured:
        return {
            "configured": True,
            "message": "SharePoint document storage is configured and active.",
        }
    return {
        "configured": False,
        "message": (
            "SharePoint is not configured. Documents will be stored locally. "
            "Set SHAREPOINT_TENANT_ID, SHAREPOINT_CLIENT_ID, SHAREPOINT_CLIENT_SECRET, "
            "SHAREPOINT_SITE_ID, and SHAREPOINT_DRIVE_ID in .env to enable."
        ),
    }


def _check_llm() -> dict:
    configured = bool(
        getattr(settings, "LLM_API_KEY", "")
        and getattr(settings, "LLM_API_URL", "")
    )
    if configured:
        return {
            "configured": True,
            "message": "LLM document extraction API is configured and active.",
        }
    return {
        "configured": False,
        "message": (
            "LLM extraction API is not configured. "
            "Document extraction will return mock data. "
            "Set LLM_API_KEY and LLM_API_URL in .env to enable."
        ),
    }


def _check_aderant() -> dict:
    configured = bool(
        getattr(settings, "ADERANT_API_URL", "")
        and getattr(settings, "ADERANT_API_KEY", "")
    )
    if configured:
        return {
            "configured": True,
            "message": "Aderant ERP integration is configured and active.",
        }
    return {
        "configured": False,
        "message": (
            "Aderant ERP is not configured. "
            "Client/matter sync will use mock data. "
            "Set ADERANT_API_URL and ADERANT_API_KEY in .env to enable."
        ),
    }


def _check_aderant_soap() -> dict:
    configured = bool(
        getattr(settings, "ADERANT_SOAP_WSDL_URL", "")
        and getattr(settings, "ADERANT_SOAP_USERNAME", "")
        and getattr(settings, "ADERANT_SOAP_PASSWORD", "")
    )
    if configured:
        return {
            "configured": True,
            "message": "Aderant SOAP integration is configured and active.",
        }
    return {
        "configured": False,
        "message": (
            "Aderant SOAP is not configured. "
            "File opening and billing will use mock data. "
            "Set ADERANT_SOAP_WSDL_URL, ADERANT_SOAP_USERNAME, "
            "and ADERANT_SOAP_PASSWORD in .env to enable."
        ),
    }


def _check_gotenberg() -> dict:
    url = getattr(settings, "GOTENBERG_URL", "")
    # In dev, the default URL points to Docker service which may not be running
    configured = bool(url)
    if configured:
        return {
            "configured": True,
            "message": (
                "Gotenberg PDF conversion is configured. "
                "Ensure the gotenberg service is running in docker-compose."
            ),
        }
    return {
        "configured": False,
        "message": (
            "Gotenberg URL is not configured. "
            "PDF conversion will return placeholder files. "
            "Set GOTENBERG_URL in .env and enable the gotenberg service."
        ),
    }


def _check_microsoft_sso() -> dict:
    configured = bool(
        getattr(settings, "MICROSOFT_CLIENT_ID", "")
        and getattr(settings, "MICROSOFT_CLIENT_SECRET", "")
    )
    if configured:
        return {
            "configured": True,
            "message": "Microsoft SSO is configured and active.",
        }
    return {
        "configured": False,
        "message": (
            "Microsoft SSO is not configured. "
            "Only email/password login is available. "
            "Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET in .env to enable."
        ),
    }
