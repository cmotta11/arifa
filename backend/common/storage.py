"""File storage abstraction layer.

Provides a unified interface for file operations, with backends for
local filesystem storage and SharePoint (via Microsoft Graph API).
The active backend is auto-detected based on environment configuration.
"""

import logging
import os
import uuid
from abc import ABC, abstractmethod

from django.conf import settings

logger = logging.getLogger(__name__)


class FileStorageBackend(ABC):
    """Abstract base class for file storage backends."""

    @abstractmethod
    def upload(self, *, file_bytes: bytes, folder_path: str, filename: str) -> dict:
        """Upload a file and return metadata.

        Returns:
            Dict with keys: id, web_url, name, backend.
        """

    @abstractmethod
    def download(self, *, file_id: str) -> bytes:
        """Download a file by its storage ID and return raw bytes."""

    @abstractmethod
    def get_preview_url(self, *, file_id: str) -> str:
        """Return a preview/view URL for the given file."""

    @abstractmethod
    def delete(self, *, file_id: str) -> bool:
        """Delete a file by its storage ID. Returns True if deleted."""

    @abstractmethod
    def create_folder(self, *, folder_path: str) -> dict:
        """Create a folder structure. Returns metadata about the folder."""


class LocalFileStorage(FileStorageBackend):
    """Stores files on the local filesystem under MEDIA_ROOT/storage/."""

    def __init__(self):
        self.root = os.path.join(
            str(getattr(settings, "MEDIA_ROOT", "/tmp")),
            "storage",
        )
        os.makedirs(self.root, exist_ok=True)

    def _resolve_path(self, folder_path: str, filename: str) -> str:
        target_dir = os.path.join(self.root, folder_path.replace("/", os.sep))
        os.makedirs(target_dir, exist_ok=True)
        return os.path.join(target_dir, filename)

    def upload(self, *, file_bytes: bytes, folder_path: str, filename: str) -> dict:
        file_id = f"local-{uuid.uuid4().hex[:12]}"
        # Prefix filename with ID to ensure uniqueness and enable retrieval
        stored_name = f"{file_id}_{filename}"
        file_path = self._resolve_path(folder_path, stored_name)

        with open(file_path, "wb") as f:
            f.write(file_bytes)

        logger.info("Stored file locally: %s", file_path)
        return {
            "id": file_id,
            "web_url": f"file://{file_path}",
            "name": filename,
            "backend": "local",
            "_stored_path": file_path,
        }

    def download(self, *, file_id: str) -> bytes:
        # Walk storage root to find the file by ID prefix
        for dirpath, _dirnames, filenames in os.walk(self.root):
            for fname in filenames:
                if fname.startswith(file_id):
                    path = os.path.join(dirpath, fname)
                    with open(path, "rb") as f:
                        return f.read()
        raise FileNotFoundError(f"File not found in local storage: {file_id}")

    def get_preview_url(self, *, file_id: str) -> str:
        for dirpath, _dirnames, filenames in os.walk(self.root):
            for fname in filenames:
                if fname.startswith(file_id):
                    return f"file://{os.path.join(dirpath, fname)}"
        return ""

    def delete(self, *, file_id: str) -> bool:
        for dirpath, _dirnames, filenames in os.walk(self.root):
            for fname in filenames:
                if fname.startswith(file_id):
                    os.remove(os.path.join(dirpath, fname))
                    logger.info("Deleted local file: %s", file_id)
                    return True
        return False

    def create_folder(self, *, folder_path: str) -> dict:
        target_dir = os.path.join(self.root, folder_path.replace("/", os.sep))
        os.makedirs(target_dir, exist_ok=True)
        return {
            "id": f"local-folder-{uuid.uuid4().hex[:8]}",
            "name": folder_path.split("/")[-1] if folder_path else "root",
            "backend": "local",
        }


class SharePointFileStorage(FileStorageBackend):
    """Delegates file operations to the SharePoint Graph API integration."""

    def __init__(self):
        from apps.compliance.integrations.sharepoint import SharePointClient

        self._client = SharePointClient()

    def upload(self, *, file_bytes: bytes, folder_path: str, filename: str) -> dict:
        result = self._client.upload_document(
            file_bytes=file_bytes,
            folder_path=folder_path,
            filename=filename,
        )
        return {
            "id": result.get("id", ""),
            "web_url": result.get("webUrl", ""),
            "drive_item_id": result.get("driveItemId", ""),
            "name": result.get("name", filename),
            "backend": "sharepoint",
        }

    def download(self, *, file_id: str) -> bytes:
        return self._client.download_document(drive_item_id=file_id)

    def get_preview_url(self, *, file_id: str) -> str:
        return self._client.get_preview_url(drive_item_id=file_id)

    def delete(self, *, file_id: str) -> bool:
        from apps.compliance.integrations.sharepoint import SharePointError

        try:
            url = f"{self._client._drive_url()}/items/{file_id}"
            self._client._request("DELETE", url)
            logger.info("Deleted SharePoint item: %s", file_id)
            return True
        except SharePointError:
            logger.exception("Failed to delete SharePoint item: %s", file_id)
            return False

    def create_folder(self, *, folder_path: str) -> dict:
        result = self._client.create_folder(folder_path=folder_path)
        return {
            "id": result.get("id", ""),
            "name": result.get("name", ""),
            "backend": "sharepoint",
        }


def get_storage_backend() -> FileStorageBackend:
    """Return the appropriate storage backend based on environment config.

    Uses SharePoint when all required credentials are set, otherwise
    falls back to local file storage.
    """
    sharepoint_configured = bool(
        getattr(settings, "SHAREPOINT_TENANT_ID", "")
        and getattr(settings, "SHAREPOINT_CLIENT_ID", "")
        and getattr(settings, "SHAREPOINT_CLIENT_SECRET", "")
        and getattr(settings, "SHAREPOINT_SITE_ID", "")
        and getattr(settings, "SHAREPOINT_DRIVE_ID", "")
    )

    if sharepoint_configured:
        logger.debug("Using SharePoint file storage backend")
        return SharePointFileStorage()

    logger.debug("Using local file storage backend")
    return LocalFileStorage()
