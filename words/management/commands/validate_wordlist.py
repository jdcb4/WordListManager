from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError

from words.services.quality import validate_wordlist


class Command(BaseCommand):
    help = "Run data quality checks and print a summary."

    def add_arguments(self, parser):
        parser.add_argument(
            "--max-issues",
            type=int,
            default=25,
            help="Maximum number of issues to print in detail.",
        )
        parser.add_argument(
            "--fail-on-warnings",
            action="store_true",
            help="Return non-zero if warnings are present.",
        )

    def handle(self, *args, **options):
        report = validate_wordlist()
        self.stdout.write(
            f"Checked {report['checked_words']} words. "
            f"Errors={report['error_count']} Warnings={report['warning_count']}"
        )

        for issue in report["issues"][: options["max_issues"]]:
            self.stdout.write(
                f"[{issue['severity']}] {issue['code']} "
                f"(word_id={issue['word_id']}): {issue['message']}"
            )

        if report["error_count"] > 0:
            raise CommandError("Validation failed due to errors.")
        if options["fail_on_warnings"] and report["warning_count"] > 0:
            raise CommandError("Validation failed due to warnings.")

        self.stdout.write(self.style.SUCCESS("Validation passed."))
