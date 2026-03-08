"""Dataset publishing helpers."""

from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path

from django.conf import settings
from django.db import transaction

from words.models import DatasetVersion, ExportArtifact, ExportFormat, WordEntry

LATEST_EXPORT_BASENAME = "latest"


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


def latest_export_path(export_format: str) -> Path:
    if export_format not in {ExportFormat.CSV, ExportFormat.JSON}:
        raise ValueError(f"Unsupported export format: {export_format}")
    return settings.EXPORTS_DIR / f"{LATEST_EXPORT_BASENAME}.{export_format}"


def _rows_with_version(payload: list[dict], version_number: int) -> list[dict]:
    return [{**item, "versionNumber": version_number} for item in payload]


def _write_json(path: Path, payload: list[dict], version_number: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    rows = _rows_with_version(payload, version_number)
    with path.open("w", encoding="utf-8", newline="\n") as file_obj:
        json.dump(rows, file_obj, indent=2, ensure_ascii=False)
        file_obj.write("\n")


def _write_csv(path: Path, payload: list[dict], version_number: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "id",
        "versionNumber",
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
            row["versionNumber"] = version_number
            row["wordTypes"] = json.dumps(row.get("wordTypes", []), ensure_ascii=False)
            rows.append(row)
        writer.writerows(rows)


def _write_export_files(payload: list[dict], version_number: int) -> dict[str, Path]:
    prefix = f"wordlist_v{version_number}"
    paths = {
        ExportFormat.JSON: settings.EXPORTS_DIR / f"{prefix}.json",
        ExportFormat.CSV: settings.EXPORTS_DIR / f"{prefix}.csv",
    }
    _write_json(paths[ExportFormat.JSON], payload, version_number)
    _write_csv(paths[ExportFormat.CSV], payload, version_number)
    _write_json(latest_export_path(ExportFormat.JSON), payload, version_number)
    _write_csv(latest_export_path(ExportFormat.CSV), payload, version_number)
    return paths


def _upsert_artifact(dataset_version: DatasetVersion, export_format: str, path: Path) -> None:
    ExportArtifact.objects.update_or_create(
        dataset_version=dataset_version,
        export_format=export_format,
        defaults={
            "file_path": str(path),
            "file_size_bytes": path.stat().st_size,
            "checksum_sha256": _hash_file(path),
        },
    )


def publish_dataset(force: bool = False) -> tuple[DatasetVersion, bool]:
    payload = build_dataset_payload()
    checksum = payload_checksum(payload)
    latest = DatasetVersion.latest()
    if latest and latest.checksum_sha256 == checksum and not force:
        export_paths = _write_export_files(payload, latest.version_number)
        with transaction.atomic():
            _upsert_artifact(latest, ExportFormat.JSON, export_paths[ExportFormat.JSON])
            _upsert_artifact(latest, ExportFormat.CSV, export_paths[ExportFormat.CSV])
        return latest, False

    version_number = DatasetVersion.next_version_number()
    export_paths = _write_export_files(payload, version_number)

    with transaction.atomic():
        dataset_version = DatasetVersion.objects.create(
            version_number=version_number,
            checksum_sha256=checksum,
            active_word_count=len(payload),
        )
        _upsert_artifact(dataset_version, ExportFormat.JSON, export_paths[ExportFormat.JSON])
        _upsert_artifact(dataset_version, ExportFormat.CSV, export_paths[ExportFormat.CSV])
    return dataset_version, True
