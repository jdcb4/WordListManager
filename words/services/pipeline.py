"""Publish pipeline orchestration."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from django.conf import settings

from words.models import DatasetVersion
from words.services.datasets import publish_dataset
from words.services.maintenance import dedupe_word_entries
from words.services.quality import validate_wordlist


def run_publish_pipeline(
    *,
    force: bool = False,
    run_dedupe: bool = True,
    run_validation: bool = True,
    allow_validation_errors: bool = False,
    report_path: str | None = None,
) -> dict:
    dedupe_report = dedupe_word_entries(dry_run=False) if run_dedupe else None
    validation_report = validate_wordlist() if run_validation else None

    if (
        run_validation
        and validation_report is not None
        and validation_report["error_count"] > 0
        and not allow_validation_errors
    ):
        report = {
            "timestamp_utc": datetime.now(tz=timezone.utc).isoformat(),
            "published": False,
            "blocked_by_validation": True,
            "dedupe": dedupe_report,
            "validation": validation_report,
            "dataset_version": DatasetVersion.latest().version_number if DatasetVersion.latest() else None,
        }
        _write_report(report, report_path)
        return report

    version, created = publish_dataset(force=force)
    report = {
        "timestamp_utc": datetime.now(tz=timezone.utc).isoformat(),
        "published": created,
        "blocked_by_validation": False,
        "dedupe": dedupe_report,
        "validation": validation_report,
        "dataset_version": version.version_number,
        "active_word_count": version.active_word_count,
        "checksum_sha256": version.checksum_sha256,
    }
    _write_report(report, report_path)
    return report


def _write_report(report: dict, report_path: str | None) -> None:
    if report_path:
        path = Path(report_path)
    else:
        path = settings.EXPORTS_DIR / "publish_report_latest.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as file_obj:
        json.dump(report, file_obj, indent=2, ensure_ascii=False)
        file_obj.write("\n")
