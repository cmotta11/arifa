"""SharePoint / Microsoft Graph API integration.

Uses MSAL (Microsoft Authentication Library) for client-credentials OAuth2
and the Microsoft Graph API for document management.

When SharePoint credentials are not configured, all operations use local
file storage as a fallback and log warnings to the user.
"""

import logging
import os
import uuid

from django.conf import settings

logger = logging.getLogger(__name__)


def _is_configured() -> bool:
    """Check whether SharePoint credentials are present."""
    return bool(
        getattr(settings, "SHAREPOINT_TENANT_ID", "")
        and getattr(settings, "SHAREPOINT_CLIENT_ID", "")
        and getattr(settings, "SHAREPOINT_CLIENT_SECRET", "")
        and getattr(settings, "SHAREPOINT_SITE_ID", "")
        and getattr(settings, "SHAREPOINT_DRIVE_ID", "")
    )


class SharePointError(Exception):
    """Raised when a SharePoint / Graph API call fails."""

    def __init__(self, message: str, status_code: int | None = None, response_body=None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.response_body = response_body


class SharePointClient:
    """Client for SharePoint document management via the Microsoft Graph API.

    Uses MSAL client-credentials flow for authentication.
    If credentials are missing, stores files locally in MEDIA_ROOT/sharepoint_mock/
    and returns mock metadata.
    """

    GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"

    def __init__(
        self,
        tenant_id: str | None = None,
        client_id: str | None = None,
        client_secret: str | None = None,
        site_id: str | None = None,
        drive_id: str | None = None,
        root_folder: str | None = None,
    ):
        self.tenant_id = tenant_id or getattr(settings, "SHAREPOINT_TENANT_ID", "")
        self.client_id = client_id or getattr(settings, "SHAREPOINT_CLIENT_ID", "")
        self.client_secret = client_secret or getattr(settings, "SHAREPOINT_CLIENT_SECRET", "")
        self.site_id = site_id or getattr(settings, "SHAREPOINT_SITE_ID", "")
        self.drive_id = drive_id or getattr(settings, "SHAREPOINT_DRIVE_ID", "")
        self.root_folder = root_folder or getattr(settings, "SHAREPOINT_ROOT_FOLDER", "ARIFA_Documents")

        self._configured = bool(
            self.tenant_id and self.client_id and self.client_secret
            and self.site_id and self.drive_id
        )

        self._access_token: str | None = None

        if not self._configured:
            logger.warning(
                "SharePoint credentials are not configured. "
                "Documents will be stored locally in MEDIA_ROOT/sharepoint_mock/. "
                "Set SHAREPOINT_TENANT_ID, SHAREPOINT_CLIENT_ID, SHAREPOINT_CLIENT_SECRET, "
                "SHAREPOINT_SITE_ID, and SHAREPOINT_DRIVE_ID in your .env file."
            )
            self._mock_root = os.path.join(
                str(getattr(settings, "MEDIA_ROOT", "/tmp")),
                "sharepoint_mock",
            )
            os.makedirs(self._mock_root, exist_ok=True)
        else:
            import msal

            self._msal_app = msal.ConfidentialClientApplication(
                client_id=self.client_id,
                client_credential=self.client_secret,
                authority=f"https://login.microsoftonline.com/{self.tenant_id}",
            )

    # ------------------------------------------------------------------
    # Auth
    # ------------------------------------------------------------------

    def _get_access_token(self) -> str:
        """Acquire an access token via client-credentials flow."""
        if self._access_token:
            return self._access_token

        result = self._msal_app.acquire_token_for_client(
            scopes=["https://graph.microsoft.com/.default"]
        )

        if "access_token" not in result:
            error_desc = result.get("error_description", "Unknown MSAL error")
            logger.error("MSAL token acquisition failed: %s", error_desc)
            raise SharePointError(f"Failed to acquire access token: {error_desc}")

        self._access_token = result["access_token"]
        return self._access_token

    def _get_headers(self) -> dict:
        """Return authorization headers for Graph API requests."""
        token = self._get_access_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    def _request(self, method: str, url: str, **kwargs) -> dict:
        """Make an authenticated request to the Graph API."""
        import requests

        headers = kwargs.pop("headers", None) or self._get_headers()
        kwargs["headers"] = headers
        kwargs.setdefault("timeout", 60)

        try:
            response = requests.request(method, url, **kwargs)
        except requests.exceptions.RequestException as exc:
            logger.error("Graph API request failed: %s", exc)
            raise SharePointError(f"Graph API request failed: {exc}")

        if response.status_code >= 400:
            logger.error(
                "Graph API error: %d %s",
                response.status_code,
                response.text[:500],
            )
            raise SharePointError(
                f"Graph API returned {response.status_code}",
                status_code=response.status_code,
                response_body=response.text,
            )

        if response.status_code == 204:
            return {}

        try:
            return response.json()
        except ValueError:
            return {"raw": response.text}

    def _drive_url(self) -> str:
        """Build the base URL for the configured drive."""
        return f"{self.GRAPH_BASE_URL}/sites/{self.site_id}/drives/{self.drive_id}"

    # ------------------------------------------------------------------
    # Mock helpers (local file storage fallback)
    # ------------------------------------------------------------------

    def _mock_upload(self, file_bytes: bytes, folder_path: str, filename: str) -> dict:
        """Store file locally and return mock SharePoint metadata."""
        target_dir = os.path.join(self._mock_root, folder_path.replace("/", os.sep))
        os.makedirs(target_dir, exist_ok=True)

        file_path = os.path.join(target_dir, filename)
        with open(file_path, "wb") as f:
            f.write(file_bytes)

        mock_id = f"mock-sp-{uuid.uuid4().hex[:12]}"
        logger.warning(
            "SharePoint NOT CONFIGURED - file stored locally at: %s", file_path
        )

        return {
            "id": mock_id,
            "webUrl": f"file://{file_path}",
            "driveItemId": mock_id,
            "name": filename,
            "_mock": True,
            "_warning": (
                "SharePoint is not configured. File was saved locally. "
                "Configure SharePoint credentials in .env for production use."
            ),
        }

    def _mock_download(self, drive_item_id: str) -> bytes:
        """Try to find a locally stored mock file."""
        # Walk the mock root to find any file with this ID pattern
        # Since we can't reverse the ID, return a placeholder
        logger.warning(
            "SharePoint NOT CONFIGURED - returning placeholder for download '%s'",
            drive_item_id,
        )
        return b"[Mock file content - SharePoint not configured]"

    # ------------------------------------------------------------------
    # Public methods
    # ------------------------------------------------------------------

    def upload_document(
        self,
        file_bytes: bytes,
        folder_path: str,
        filename: str,
    ) -> dict:
        """Upload a document to SharePoint (or local storage if not configured).

        Returns:
            Dict with keys: id, webUrl, driveItemId, name.
            If using mock storage, also includes _mock=True and _warning.
        """
        if not self._configured:
            return self._mock_upload(file_bytes, folder_path, filename)

        full_path = f"{self.root_folder}/{folder_path}/{filename}"
        upload_url = f"{self._drive_url()}/root:/{full_path}:/content"

        four_mb = 4 * 1024 * 1024

        if len(file_bytes) <= four_mb:
            headers = self._get_headers()
            headers["Content-Type"] = "application/octet-stream"
            result = self._request("PUT", upload_url, data=file_bytes, headers=headers)
        else:
            session_url = f"{self._drive_url()}/root:/{full_path}:/createUploadSession"
            session = self._request("POST", session_url, json={
                "item": {
                    "@microsoft.graph.conflictBehavior": "rename",
                    "name": filename,
                }
            })

            upload_endpoint = session.get("uploadUrl", "")
            if not upload_endpoint:
                raise SharePointError("Failed to create upload session")

            import requests

            chunk_size = 3200 * 1024
            file_size = len(file_bytes)
            result = {}

            for offset in range(0, file_size, chunk_size):
                chunk = file_bytes[offset:offset + chunk_size]
                end = offset + len(chunk) - 1
                chunk_headers = {
                    "Content-Length": str(len(chunk)),
                    "Content-Range": f"bytes {offset}-{end}/{file_size}",
                }
                response = requests.put(
                    upload_endpoint, data=chunk, headers=chunk_headers, timeout=120,
                )
                if response.status_code in (200, 201):
                    result = response.json()

        logger.info("Uploaded document to SharePoint: %s", full_path)
        return {
            "id": result.get("id", ""),
            "webUrl": result.get("webUrl", ""),
            "driveItemId": result.get("id", ""),
            "name": result.get("name", filename),
        }

    def get_preview_url(self, drive_item_id: str) -> str:
        """Get a preview URL for a document in SharePoint."""
        if not self._configured:
            logger.warning(
                "SharePoint NOT CONFIGURED - returning placeholder preview URL "
                "for '%s'", drive_item_id,
            )
            return f"#mock-preview-{drive_item_id}"

        url = f"{self._drive_url()}/items/{drive_item_id}/preview"
        result = self._request("POST", url)
        return result.get("getUrl", "")

    def download_document(self, drive_item_id: str) -> bytes:
        """Download a document from SharePoint."""
        if not self._configured:
            return self._mock_download(drive_item_id)

        import requests

        url = f"{self._drive_url()}/items/{drive_item_id}/content"
        token = self._get_access_token()
        headers = {"Authorization": f"Bearer {token}"}

        try:
            response = requests.get(url, headers=headers, timeout=120)
        except requests.exceptions.RequestException as exc:
            logger.error("SharePoint download failed: %s", exc)
            raise SharePointError(f"Download failed: {exc}")

        if response.status_code >= 400:
            raise SharePointError(
                f"Download returned {response.status_code}",
                status_code=response.status_code,
                response_body=response.text,
            )

        return response.content

    def create_folder(self, folder_path: str) -> dict:
        """Create a folder in SharePoint (or locally if not configured)."""
        if not self._configured:
            target_dir = os.path.join(
                self._mock_root, folder_path.replace("/", os.sep)
            )
            os.makedirs(target_dir, exist_ok=True)
            logger.warning(
                "SharePoint NOT CONFIGURED - mock folder created at: %s", target_dir
            )
            return {
                "id": f"mock-folder-{uuid.uuid4().hex[:8]}",
                "name": folder_path.split("/")[-1] if folder_path else "root",
                "_mock": True,
                "_warning": "SharePoint is not configured. Folder created locally.",
            }

        import requests  # noqa: F811

        full_path = f"{self.root_folder}/{folder_path}"
        parts = full_path.strip("/").split("/")
        current_path = ""
        result = {}

        for part in parts:
            url = (
                f"{self._drive_url()}/{current_path}:/children"
                if current_path
                else f"{self._drive_url()}/root/children"
            )

            payload = {
                "name": part,
                "folder": {},
                "@microsoft.graph.conflictBehavior": "fail",
            }

            try:
                result = self._request("POST", url, json=payload)
            except SharePointError as exc:
                if exc.status_code == 409:
                    pass
                else:
                    raise

            current_path = f"{current_path}/{part}" if current_path else part

        logger.info("Created folder in SharePoint: %s", full_path)
        return result
