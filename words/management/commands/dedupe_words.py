from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db.models import Count

from words.models import WordEntry


class Command(BaseCommand):
    help = "Remove duplicate words using normalized_text + word_type, keeping the oldest row."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report duplicates without deleting records.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        duplicate_groups = (
            WordEntry.objects.values("normalized_text", "word_type")
            .annotate(total=Count("id"))
            .filter(total__gt=1)
        )

        deleted = 0
        groups = 0
        for group in duplicate_groups:
            groups += 1
            rows = WordEntry.objects.filter(
                normalized_text=group["normalized_text"],
                word_type=group["word_type"],
            ).order_by("created_at", "id")
            keep = rows.first()
            remove_ids = list(rows.exclude(id=keep.id).values_list("id", flat=True))
            if not dry_run and remove_ids:
                deleted += WordEntry.objects.filter(id__in=remove_ids).delete()[0]

        if dry_run:
            self.stdout.write(self.style.WARNING(f"Found {groups} duplicate groups."))
        else:
            self.stdout.write(
                self.style.SUCCESS(f"Processed {groups} duplicate groups. Deleted {deleted} rows.")
            )
