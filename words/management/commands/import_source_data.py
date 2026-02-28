from __future__ import annotations

import csv
import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from words.models import Category, Collection, Difficulty, WordEntry, WordType
from words.services.normalization import sanitize_text

CSV_FILENAME = "words.csv"
JSON_FILENAME = "wordBank.json"

DIFFICULTY_MAP = {
    "easy": Difficulty.EASY,
    "medium": Difficulty.MEDIUM,
    "hard": Difficulty.HARD,
}


class Command(BaseCommand):
    help = "Import words from source_data CSV and JSON files."

    def add_arguments(self, parser):
        parser.add_argument(
            "--source-dir",
            default=str(settings.BASE_DIR / "source_data"),
            help="Directory containing words.csv and wordBank.json",
        )
        parser.add_argument(
            "--replace",
            action="store_true",
            help="Delete all existing words before import.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Read and validate data without writing changes.",
        )

    def handle(self, *args, **options):
        source_dir = Path(options["source_dir"])
        csv_path = source_dir / CSV_FILENAME
        json_path = source_dir / JSON_FILENAME

        if not source_dir.exists():
            raise CommandError(f"Source directory does not exist: {source_dir}")
        if not csv_path.exists():
            raise CommandError(f"Missing expected CSV file: {csv_path}")
        if not json_path.exists():
            raise CommandError(f"Missing expected JSON file: {json_path}")

        csv_rows = self._read_csv(csv_path)
        json_rows = self._read_json(json_path)

        if options["dry_run"]:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Dry run passed: {len(csv_rows)} CSV rows and {len(json_rows)} JSON rows parsed."
                )
            )
            return

        with transaction.atomic():
            base_collection = Collection.get_base()
            if options["replace"]:
                WordEntry.objects.all().delete()

            csv_stats = self._upsert_csv_rows(csv_rows, source=csv_path.name, collection=base_collection)
            json_stats = self._upsert_json_rows(json_rows, source=json_path.name, collection=base_collection)

        self.stdout.write(
            self.style.SUCCESS(
                "Import completed. "
                f"CSV created={csv_stats['created']} updated={csv_stats['updated']} skipped={csv_stats['skipped']}; "
                f"JSON created={json_stats['created']} updated={json_stats['updated']} skipped={json_stats['skipped']}."
            )
        )

    def _read_csv(self, path: Path) -> list[dict]:
        with path.open("r", encoding="utf-8-sig", newline="") as file_obj:
            reader = csv.DictReader(file_obj)
            return list(reader)

    def _read_json(self, path: Path) -> list[dict]:
        with path.open("r", encoding="utf-8") as file_obj:
            parsed = json.load(file_obj)
        if not isinstance(parsed, list):
            raise CommandError(f"JSON root must be a list in {path}")
        return parsed

    def _upsert_csv_rows(self, rows: list[dict], source: str, collection: Collection) -> dict:
        stats = {"created": 0, "updated": 0, "skipped": 0}
        for row in rows:
            raw_word = sanitize_text(row.get("Word", ""))
            if not raw_word:
                stats["skipped"] += 1
                continue

            category_name = sanitize_text(row.get("Category", ""))
            category = None
            if category_name:
                category, _ = Category.objects.get_or_create(name=category_name)

            defaults = {
                "text": raw_word,
                "category": category,
                "collection": collection,
                "hint": sanitize_text(row.get("Hint", "")),
                "source": source,
                "is_active": True,
            }
            _, created = WordEntry.objects.update_or_create(
                normalized_text=raw_word.casefold(),
                word_type=WordType.GUESSING,
                defaults=defaults,
            )
            if created:
                stats["created"] += 1
            else:
                stats["updated"] += 1
        return stats

    def _upsert_json_rows(self, rows: list[dict], source: str, collection: Collection) -> dict:
        stats = {"created": 0, "updated": 0, "skipped": 0}
        for row in rows:
            raw_word = sanitize_text(str(row.get("word", "")).strip())
            if not raw_word:
                stats["skipped"] += 1
                continue

            raw_difficulty = sanitize_text(str(row.get("difficulty", ""))).lower()
            difficulty = DIFFICULTY_MAP.get(raw_difficulty, "")

            defaults = {
                "text": raw_word,
                "collection": collection,
                "difficulty": difficulty,
                "source": source,
                "is_active": True,
            }
            _, created = WordEntry.objects.update_or_create(
                normalized_text=raw_word.casefold(),
                word_type=WordType.DESCRIBING,
                defaults=defaults,
            )
            if created:
                stats["created"] += 1
            else:
                stats["updated"] += 1
        return stats
