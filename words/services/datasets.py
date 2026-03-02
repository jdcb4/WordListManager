"""Dataset publishing helpers."""

from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path

from django.conf import settings
from django.db import transaction

from words.models import DatasetVersion, ExportArtifact, ExportFormat, WordEntry


def _word_to_dict(word: WordEntry) -> dict:
    word_types = []
    if word.is_guessing:
        word_types.append("guessing")
    if word.is_describing:
        word_types.append("describing")
    if not word_types:
        word_types.append(word.word_type)
    return {
        "id": word.id,
        "word": word.sanitized_text,
        "wordType": word.word_type,
        "wordTypes": word_types,
        "category": word.category.name if word.category else None,
        "collection": word.collection.name if word.collection else None,
        "subcategory": word.subcategory or None,
        "hint": word.hint or None,
        "difficulty": word.difficulty or None,
        "source": word.source or None,
        "updatedAt": word.updated_at.isoformat(),
    }


def build_dataset_payload() -> list[dict]:
    queryset = (
        WordEntry.objects.filter(is_active=True)
        .select_related("category", "collection")
        .order_by("normalized_text", "id")
    )
    return [_word_to_dict(word) for word in queryset]


def payload_checksum(payload: list[dict]) -> str:
    canonical = json.dumps(payload, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file_obj:
        for chunk in iter(lambda: file_obj.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _write_json(path: Path, payload: list[dict]) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as file_obj:
        json.dump(payload, file_obj, indent=2, ensure_ascii=False)
        file_obj.write("\n")


def _write_csv(path: Path, payload: list[dict]) -> None:
    fieldnames = [
        "id",
        "word",
        "wordType",
        "wordTypes",
        "category",
        "collection",
        "subcategory",
        "hint",
        "difficulty",
        "source",
        "updatedAt",
    ]
    with path.open("w", encoding="utf-8", newline="") as file_obj:
        writer = csv.DictWriter(file_obj, fieldnames=fieldnames)
        writer.writeheader()
        rows = []
        for item in payload:
            row = dict(item)
            row["wordTypes"] = json.dumps(row.get("wordTypes", []), ensure_ascii=False)
            rows.append(row)
        writer.writerows(rows)


def publish_dataset(force: bool = False) -> tuple[DatasetVersion, bool]:
    payload = build_dataset_payload()
    checksum = payload_checksum(payload)
    latest = DatasetVersion.latest()
    if latest and latest.checksum_sha256 == checksum and not force:
        return latest, False

    version_number = DatasetVersion.next_version_number()
    prefix = f"wordlist_v{version_number}"
    json_path = settings.EXPORTS_DIR / f"{prefix}.json"
    csv_path = settings.EXPORTS_DIR / f"{prefix}.csv"

    _write_json(json_path, payload)
    _write_csv(csv_path, payload)

    with transaction.atomic():
        dataset_version = DatasetVersion.objects.create(
            version_number=version_number,
            checksum_sha256=checksum,
            active_word_count=len(payload),
        )
        ExportArtifact.objects.create(
            dataset_version=dataset_version,
            export_format=ExportFormat.JSON,
            file_path=str(json_path),
            file_size_bytes=json_path.stat().st_size,
            checksum_sha256=_hash_file(json_path),
        )
        ExportArtifact.objects.create(
            dataset_version=dataset_version,
            export_format=ExportFormat.CSV,
            file_path=str(csv_path),
            file_size_bytes=csv_path.stat().st_size,
            checksum_sha256=_hash_file(csv_path),
        )
    return dataset_version, True
