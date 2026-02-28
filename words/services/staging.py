"""Staging upload and review helpers."""

from __future__ import annotations

import csv
import io
import json
from pathlib import Path

from django.db import transaction
from django.utils import timezone

from words.models import (
    Category,
    Collection,
    Difficulty,
    ImportBatch,
    ImportBatchStatus,
    StagedWord,
    StagedWordStatus,
    WordEntry,
    WordType,
)
from words.services.normalization import normalized_key, sanitize_text

DIFFICULTY_MAP = {
    "easy": Difficulty.EASY,
    "medium": Difficulty.MEDIUM,
    "hard": Difficulty.HARD,
}


def _pick(row: dict, *keys: str) -> str:
    for key in keys:
        if key in row and row[key] is not None:
            return str(row[key])
    return ""


def _parse_word_type(value: str) -> str:
    parsed = sanitize_text(value).lower()
    if parsed in {"guessing", "guess"}:
        return WordType.GUESSING
    if parsed in {"describing", "describe", "drawing", "draw"}:
        return WordType.DESCRIBING
    return WordType.GUESSING


def _create_batch(*, file_name: str, created_by=None, note: str = "") -> ImportBatch:
    batch = ImportBatch.objects.create(
        source_filename=sanitize_text(file_name) or "upload",
        created_by=created_by,
        note=sanitize_text(note),
        status=ImportBatchStatus.PENDING,
    )
    return batch


def _create_staged_rows(*, batch: ImportBatch, rows: list[dict]) -> int:
    rows_created = 0
    staged_rows = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        word = sanitize_text(_pick(row, "word", "Word"))
        if not word:
            continue
        sanitized_word = sanitize_text(word)
        difficulty = DIFFICULTY_MAP.get(sanitize_text(_pick(row, "difficulty", "Difficulty")).lower(), "")
        staged_rows.append(
            StagedWord(
                batch=batch,
                text=word,
                sanitized_text=sanitized_word,
                normalized_text=normalized_key(sanitized_word),
                word_type=_parse_word_type(_pick(row, "word_type", "WordType", "type", "Type")),
                category_name=sanitize_text(_pick(row, "category", "Category")),
                collection_name=sanitize_text(_pick(row, "collection", "Collection")) or "Base",
                subcategory=sanitize_text(_pick(row, "subcategory", "Subcategory")),
                hint=sanitize_text(_pick(row, "hint", "Hint")),
                difficulty=difficulty,
            )
        )
    if staged_rows:
        StagedWord.objects.bulk_create(staged_rows, batch_size=500)
        rows_created = len(staged_rows)
    return rows_created


def _finalize_batch(*, batch: ImportBatch, rows_created: int) -> ImportBatch:
    batch.total_rows = rows_created
    batch.status = ImportBatchStatus.IN_REVIEW if rows_created > 0 else ImportBatchStatus.COMPLETED
    batch.save(update_fields=["total_rows", "status", "updated_at"])
    return batch


def create_batch_from_csv(*, file_name: str, file_bytes: bytes, created_by=None, note: str = "") -> ImportBatch:
    text_stream = io.StringIO(file_bytes.decode("utf-8-sig"))
    reader = csv.DictReader(text_stream)
    batch = _create_batch(file_name=file_name, created_by=created_by, note=note)
    rows_created = _create_staged_rows(batch=batch, rows=list(reader))
    return _finalize_batch(batch=batch, rows_created=rows_created)


def create_batch_from_json(*, file_name: str, file_bytes: bytes, created_by=None, note: str = "") -> ImportBatch:
    parsed = json.loads(file_bytes.decode("utf-8-sig"))
    if isinstance(parsed, dict):
        rows = parsed.get("words", [])
    elif isinstance(parsed, list):
        rows = parsed
    else:
        rows = []
    batch = _create_batch(file_name=file_name, created_by=created_by, note=note)
    rows_created = _create_staged_rows(batch=batch, rows=rows)
    return _finalize_batch(batch=batch, rows_created=rows_created)


def create_batch_from_upload(*, file_name: str, file_bytes: bytes, created_by=None, note: str = "") -> ImportBatch:
    suffix = Path(file_name).suffix.lower()
    if suffix == ".json":
        return create_batch_from_json(
            file_name=file_name,
            file_bytes=file_bytes,
            created_by=created_by,
            note=note,
        )
    return create_batch_from_csv(
        file_name=file_name,
        file_bytes=file_bytes,
        created_by=created_by,
        note=note,
    )


def create_batch_from_rows(*, rows: list[dict], source_name: str, created_by=None, note: str = "") -> ImportBatch:
    batch = _create_batch(file_name=source_name, created_by=created_by, note=note)
    rows_created = _create_staged_rows(batch=batch, rows=rows)
    return _finalize_batch(batch=batch, rows_created=rows_created)


@transaction.atomic
def review_staged_word(*, staged_word: StagedWord, reviewer, approve: bool, note: str = "") -> StagedWord:
    if staged_word.status != StagedWordStatus.PENDING:
        return staged_word

    if approve:
        category = None
        if staged_word.word_type == WordType.GUESSING and staged_word.category_name:
            category, _ = Category.objects.get_or_create(name=staged_word.category_name)
        collection_name = staged_word.collection_name or "Base"
        collection, _ = Collection.objects.get_or_create(name=collection_name, defaults={"is_active": True})
        cleaned_text = staged_word.sanitized_text or sanitize_text(staged_word.text)
        cleaned_normalized = staged_word.normalized_text or normalized_key(cleaned_text)
        defaults = {
            "text": cleaned_text,
            "category": category,
            "collection": collection,
            "subcategory": staged_word.subcategory,
            "hint": staged_word.hint,
            "difficulty": staged_word.difficulty,
            "is_active": True,
            "source": f"staging_batch_{staged_word.batch_id}",
        }
        word, _ = WordEntry.objects.update_or_create(
            normalized_text=cleaned_normalized,
            word_type=staged_word.word_type,
            defaults=defaults,
        )
        staged_word.status = StagedWordStatus.APPROVED
        staged_word.resulting_word = word
    else:
        staged_word.status = StagedWordStatus.REJECTED

    staged_word.review_note = sanitize_text(note)
    staged_word.reviewed_by = reviewer
    staged_word.reviewed_at = timezone.now()
    staged_word.save(
        update_fields=[
            "status",
            "resulting_word",
            "review_note",
            "reviewed_by",
            "reviewed_at",
            "updated_at",
        ]
    )

    if not staged_word.batch.staged_words.filter(status=StagedWordStatus.PENDING).exists():
        staged_word.batch.status = ImportBatchStatus.COMPLETED
        staged_word.batch.save(update_fields=["status", "updated_at"])

    return staged_word
