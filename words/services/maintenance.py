"""Maintenance utilities for canonical word data."""

from __future__ import annotations

from django.db.models import Count

from words.models import WordEntry


def dedupe_word_entries(*, dry_run: bool = False) -> dict:
    """Remove duplicates by (normalized_text, word_type), keeping the oldest row."""
    duplicate_groups = (
        WordEntry.objects.values("normalized_text", "word_type")
        .annotate(total=Count("id"))
        .filter(total__gt=1)
    )

    deleted = 0
    groups = 0
    duplicate_rows = 0
    for group in duplicate_groups:
        groups += 1
        rows = WordEntry.objects.filter(
            normalized_text=group["normalized_text"],
            word_type=group["word_type"],
        ).order_by("created_at", "id")
        keep = rows.first()
        remove_ids = list(rows.exclude(id=keep.id).values_list("id", flat=True))
        duplicate_rows += len(remove_ids)
        if not dry_run and remove_ids:
            deleted += WordEntry.objects.filter(id__in=remove_ids).delete()[0]

    return {
        "groups": groups,
        "duplicate_rows": duplicate_rows,
        "deleted_rows": deleted,
        "dry_run": dry_run,
    }
