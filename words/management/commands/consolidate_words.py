from __future__ import annotations

from django.core.management.base import BaseCommand

from words.services.maintenance import dedupe_word_entries


class Command(BaseCommand):
    help = (
        "Consolidate WordEntry rows into one definitive record per normalized word, "
        "preferring describing data when duplicates exist."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report duplicate groups without deleting records.",
        )

    def handle(self, *args, **options):
        report = dedupe_word_entries(dry_run=options["dry_run"])
        if options["dry_run"]:
            self.stdout.write(
                self.style.WARNING(
                    f"Found {report['groups']} duplicate groups ({report['duplicate_rows']} duplicate rows)."
                )
            )
            return
        self.stdout.write(
            self.style.SUCCESS(
                f"Consolidated {report['groups']} duplicate groups. "
                f"Deleted {report['deleted_rows']} rows."
            )
        )
