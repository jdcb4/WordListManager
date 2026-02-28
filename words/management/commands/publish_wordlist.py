from __future__ import annotations

from django.core.management.base import BaseCommand

from words.services.datasets import publish_dataset


class Command(BaseCommand):
    help = "Generate CSV/JSON exports and create a new dataset version when content changes."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Create a new version even if checksum is unchanged.",
        )

    def handle(self, *args, **options):
        version, created = publish_dataset(force=options["force"])
        if created:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Published version v{version.version_number} with {version.active_word_count} active words."
                )
            )
        else:
            self.stdout.write(
                self.style.WARNING(
                    f"No changes detected. Current version remains v{version.version_number}."
                )
            )
