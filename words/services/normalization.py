"""Normalization helpers for word ingestion and deduplication."""

from __future__ import annotations

import re
import unicodedata

_WHITESPACE_RE = re.compile(r"\s+")


def sanitize_text(value: str) -> str:
    """Normalize Unicode and strip non-printable/control characters."""
    if value is None:
        return ""
    normalized = unicodedata.normalize("NFKC", value)
    cleaned = "".join(ch for ch in normalized if ch.isprintable() or ch.isspace())
    collapsed = _WHITESPACE_RE.sub(" ", cleaned)
    return collapsed.strip()


def normalized_key(value: str) -> str:
    """Canonical key used for duplicate detection."""
    return sanitize_text(value).casefold()
