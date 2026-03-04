"""Data quality checks for publish readiness."""

from __future__ import annotations

from collections import defaultdict

from words.models import ValidationIssueAcknowledgement, WordEntry, WordType


def _issue(*, severity: str, code: str, word_id: int | None, message: str) -> dict:
    return {
        "severity": severity,
        "code": code,
        "word_id": word_id,
        "message": message,
    }


def validate_wordlist() -> dict:
    """Run validation checks and return a structured report."""
    queryset = WordEntry.objects.filter(is_active=True).select_related("category")
    issues: list[dict] = []

    hint_buckets: dict[tuple[str, str], list[int]] = defaultdict(list)
    word_rows = list(queryset)
    for word in word_rows:
        if len(word.sanitized_text) < 2:
            issues.append(
                _issue(
                    severity="warning",
                    code="text_short",
                    word_id=word.id,
                    message="Word text is only one character.",
                )
            )
        if len(word.sanitized_text) > 120:
            issues.append(
                _issue(
                    severity="error",
                    code="text_too_long",
                    word_id=word.id,
                    message="Word text exceeds 120 characters.",
                )
            )
        if word.is_guessing and word.category is None:
            issues.append(
                _issue(
                    severity="error",
                    code="missing_category",
                    word_id=word.id,
                    message="Guessing words must have a category.",
                )
            )
        if word.collection is None:
            issues.append(
                _issue(
                    severity="warning",
                    code="missing_collection",
                    word_id=word.id,
                    message="Word has no collection and should be assigned (for example Base).",
                )
            )
        if word.category and not word.category.is_active:
            issues.append(
                _issue(
                    severity="warning",
                    code="inactive_category",
                    word_id=word.id,
                    message=f"Category '{word.category.name}' is inactive.",
                )
            )
        if word.is_guessing and not word.hint:
            issues.append(
                _issue(
                    severity="warning",
                    code="missing_hint",
                    word_id=word.id,
                    message="Guessing word has no hint.",
                )
            )
        if word.hint:
            category_label = word.category.name if word.category else "__none__"
            hint_buckets[(category_label.casefold(), word.hint.casefold())].append(word.id)

    for (_, _), ids in hint_buckets.items():
        if len(ids) > 1:
            for word_id in ids:
                issues.append(
                    _issue(
                        severity="warning",
                        code="duplicate_hint",
                        word_id=word_id,
                        message="Hint text is shared by multiple words in the same category.",
                    )
                )

    warning_word_ids = sorted(
        {issue["word_id"] for issue in issues if issue["severity"] == "warning" and issue.get("word_id")}
    )
    warning_codes = sorted(
        {issue["code"] for issue in issues if issue["severity"] == "warning" and issue.get("word_id")}
    )
    acknowledged_warning_pairs = set()
    if warning_word_ids and warning_codes:
        acknowledged_warning_pairs = set(
            ValidationIssueAcknowledgement.objects.filter(
                severity="warning",
                word_id__in=warning_word_ids,
                code__in=warning_codes,
            ).values_list("word_id", "code")
        )

    filtered_issues = []
    for issue in issues:
        if issue["severity"] == "warning" and issue.get("word_id"):
            if (issue["word_id"], issue["code"]) in acknowledged_warning_pairs:
                continue
        filtered_issues.append(issue)

    errors = [issue for issue in filtered_issues if issue["severity"] == "error"]
    warnings = [issue for issue in filtered_issues if issue["severity"] == "warning"]
    return {
        "checked_words": len(word_rows),
        "error_count": len(errors),
        "warning_count": len(warnings),
        "issues": filtered_issues,
    }
