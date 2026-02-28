from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError

from words.services.pipeline import run_publish_pipeline


class Command(BaseCommand):
    help = "Run full publish pipeline (dedupe + validation + exports/version)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Create a new version even if checksum is unchanged.",
        )
        parser.add_argument(
            "--skip-dedupe",
            action="store_true",
            help="Skip dedupe stage before publish.",
        )
        parser.add_argument(
            "--skip-validation",
            action="store_true",
            help="Skip data quality validation stage.",
        )
        parser.add_argument(
            "--allow-validation-errors",
            action="store_true",
            help="Publish even when validation reports blocking errors.",
        )
        parser.add_argument(
            "--report-path",
            default=None,
            help="Optional output path for publish report JSON.",
        )

    def handle(self, *args, **options):
        report = run_publish_pipeline(
            force=options["force"],
            run_dedupe=not options["skip_dedupe"],
            run_validation=not options["skip_validation"],
            allow_validation_errors=options["allow_validation_errors"],
            report_path=options["report_path"],
        )

        dedupe = report.get("dedupe")
        if dedupe is not None:
            self.stdout.write(
                f"Dedupe: groups={dedupe['groups']} duplicate_rows={dedupe['duplicate_rows']} "
                f"deleted_rows={dedupe['deleted_rows']}"
            )

        validation = report.get("validation")
        if validation is not None:
            self.stdout.write(
                f"Validation: checked={validation['checked_words']} "
                f"errors={validation['error_count']} warnings={validation['warning_count']}"
            )

        if report.get("blocked_by_validation"):
            raise CommandError(
                "Publish blocked: validation errors found. "
                "Rerun with --allow-validation-errors to override."
            )

        if report["published"]:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Published version v{report['dataset_version']} with {report['active_word_count']} active words."
                )
            )
        else:
            self.stdout.write(
                self.style.WARNING(
                    f"No changes detected. Current version remains v{report['dataset_version']}."
                )
            )
