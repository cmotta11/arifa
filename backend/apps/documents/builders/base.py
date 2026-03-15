"""Base classes and registry for the Document Assembly Engine.

Every document builder extends ``BaseDocumentBuilder`` and is registered
with ``DocumentBuilderRegistry`` via the ``@register_builder`` decorator so
that the rest of the application can look up builders by name.
"""

from __future__ import annotations

import io
import logging
from abc import ABC, abstractmethod

from common.exceptions import ApplicationError

logger = logging.getLogger(__name__)


class BaseDocumentBuilder(ABC):
    """Abstract base class for all document builders.

    Subclasses must define ``builder_name`` (a unique registry key) and
    implement the four template methods below.
    """

    builder_name: str = ""

    # ------------------------------------------------------------------
    # Template methods
    # ------------------------------------------------------------------

    @abstractmethod
    def get_template_path(self) -> str:
        """Return the filesystem path to the DOCX template.

        If no physical template exists the builder should return an empty
        string and generate the document programmatically inside ``build()``.
        """

    @abstractmethod
    def get_variables(self, context: dict) -> dict:
        """Extract and transform variables for the template from *context*."""

    @abstractmethod
    def validate_context(self, context: dict) -> None:
        """Raise ``ApplicationError`` when *context* is missing required fields."""

    @abstractmethod
    def build(self, context: dict) -> bytes:
        """Build and return the assembled DOCX document as raw bytes."""

    # ------------------------------------------------------------------
    # Helpers available to all subclasses
    # ------------------------------------------------------------------

    def _require_fields(self, context: dict, required: list[str]) -> None:
        """Raise ``ApplicationError`` listing any missing fields."""
        missing = [f for f in required if not context.get(f)]
        if missing:
            raise ApplicationError(
                f"Missing required fields for {self.builder_name}: "
                f"{', '.join(missing)}"
            )

    @staticmethod
    def _save_docx_to_bytes(document) -> bytes:
        """Serialize a ``python-docx`` Document to bytes via BytesIO."""
        buf = io.BytesIO()
        document.save(buf)
        buf.seek(0)
        return buf.read()


class DocumentBuilderRegistry:
    """Global registry that maps builder names to builder classes."""

    _registry: dict[str, type[BaseDocumentBuilder]] = {}

    @classmethod
    def register(cls, name: str, builder_class: type[BaseDocumentBuilder]) -> None:
        if name in cls._registry:
            logger.warning(
                "Builder '%s' is being re-registered (was %s, now %s).",
                name,
                cls._registry[name].__name__,
                builder_class.__name__,
            )
        cls._registry[name] = builder_class

    @classmethod
    def get(cls, name: str) -> BaseDocumentBuilder:
        """Instantiate and return the builder registered under *name*."""
        builder_class = cls._registry.get(name)
        if builder_class is None:
            raise ApplicationError(
                f"No document builder registered with name '{name}'. "
                f"Available builders: {', '.join(cls.list_builders())}"
            )
        return builder_class()

    @classmethod
    def list_builders(cls) -> list[str]:
        return sorted(cls._registry.keys())


def register_builder(name: str):
    """Class decorator that registers a builder with the global registry.

    Usage::

        @register_builder("panama_pacto_social")
        class PactoSocialBuilder(BaseDocumentBuilder):
            ...
    """

    def wrapper(cls: type[BaseDocumentBuilder]):
        cls.builder_name = name
        DocumentBuilderRegistry.register(name, cls)
        return cls

    return wrapper
