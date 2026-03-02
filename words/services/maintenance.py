"""Maintenance utilities for canonical word data."""

from __future__ import annotations

from django.db import transaction
from django.db.models import Count

from words.models import WordEntry, WordFeedback, WordType, StagedWord


def dedupe_word_entries(*, dry_run: bool = False) -> dict:
    """Remove duplicates by normalized_text, preferring describing rows when available."""
    duplicate_groups = (
        WordEntry.objects.values("normalized_text")
        .annotate(total=Count("id"))
        .filter(total__gt=1)
    )

    deleted = 0
    groups = 0
    duplicate_rows = 0
    merged_guessing = 0
    merged_describing = 0
    for group in duplicate_groups:
        groups += 1
        rows = WordEntry.objects.filter(
            normalized_text=group["normalized_text"],
        ).order_by("created_at", "id")
        keep = rows.filter(is_describing=True).first() or rows.filter(word_type=WordType.DESCRIBING).first() or rows.first()
        remove_ids = list(rows.exclude(id=keep.id).values_list("id", flat=True))
        duplicate_rows += len(remove_ids)
        has_guessing = rows.filter(is_guessing=True).exists() or rows.filter(word_type=WordType.GUESSING).exists()
        has_describing = rows.filter(is_describing=True).exists() or rows.filter(word_type=WordType.DESCRIBING).exists()
        if not has_guessing and not has_describing:
            has_guessing = True

        if keep.is_guessing != has_guessing:
            merged_guessing += 1
            keep.is_guessing = has_guessing
        if keep.is_describing != has_describing:
            merged_describing += 1
            keep.is_describing = has_describing
        keep.word_type = WordType.DESCRIBING if keep.is_describing else WordType.GUESSING

        if not dry_run and remove_ids:
            with transaction.atomic():
                WordFeedback.objects.filter(word_id__in=remove_ids).update(word_id=keep.id)
                StagedWord.objects.filter(resulting_word_id__in=remove_ids).update(resulting_word_id=keep.id)
                keep.save(update_fields=["is_guessing", "is_describing", "word_type", "updated_at"])
                deleted += WordEntry.objects.filter(id__in=remove_ids).delete()[0]
        elif not dry_run:
            keep.save(update_fields=["is_guessing", "is_describing", "word_type", "updated_at"])

    return {
        "groups": groups,
        "duplicate_rows": duplicate_rows,
        "deleted_rows": deleted,
        "merged_guessing_flags": merged_guessing,
        "merged_describing_flags": merged_describing,
        "dry_run": dry_run,
    }
