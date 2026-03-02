from __future__ import annotations

from collections import Counter
from io import StringIO
from pathlib import Path
import re

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required, user_passes_test
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db.models import Count
from django.http import HttpRequest, HttpResponse
from django.shortcuts import redirect, render
from django.views.decorators.http import require_POST

from words.models import (
    Category,
    Collection,
    DatasetVersion,
    FeedbackResolution,
    FeedbackVerdict,
    ImportBatch,
    StagedWord,
    StagedWordStatus,
    WordEntry,
    WordFeedback,
)
from words.services.ai import AIServiceError, DEFAULT_MODEL, complete_word_templates, generate_words
from words.services.maintenance import dedupe_word_entries
from words.services.pipeline import run_publish_pipeline
from words.services.quality import validate_wordlist
from words.services.staging import create_batch_from_upload, review_staged_word


def _react_ui_enabled(*, manage_scope: bool) -> bool:
    if getattr(settings, "REACT_UI_ENABLED", True):
        return True
    if manage_scope and getattr(settings, "REACT_MANAGE_UI_ENABLED", False):
        return True
    return False


def _react_redirect(request: HttpRequest, path: str, *, manage_scope: bool) -> HttpResponse | None:
    if not _react_ui_enabled(manage_scope=manage_scope):
        return None
    base_url = getattr(settings, "REACT_UI_BASE_URL", "")
    if not base_url:
        return None
    target = f"{base_url}{path}"
    query_string = request.META.get("QUERY_STRING", "").strip()
    if query_string:
        target = f"{target}?{query_string}"
    return redirect(target)


def _load_react_bundle() -> dict[str, str] | None:
    dist_index = Path(settings.BASE_DIR) / "frontend" / "dist" / "index.html"
    if not dist_index.exists():
        return None
    html = dist_index.read_text(encoding="utf-8")
    css_match = re.search(r'href="/static/([^"]+\.css)"', html)
    js_match = re.search(r'src="/static/([^"]+\.js)"', html)
    if not css_match or not js_match:
        return None
    return {"css": css_match.group(1), "js": js_match.group(1)}


def _react_shell(request: HttpRequest, route: str, *, manage_scope: bool) -> HttpResponse | None:
    if not _react_ui_enabled(manage_scope=manage_scope):
        return None
    external_redirect = _react_redirect(request, route, manage_scope=manage_scope)
    if external_redirect:
        return external_redirect
    bundle = _load_react_bundle()
    if not bundle:
        messages.error(
            request,
            "React UI is enabled but build assets were not found. Falling back to Django view.",
        )
        return None
    return render(
        request,
        "webui/react_shell.html",
        {
            "react_css_asset": bundle["css"],
            "react_js_asset": bundle["js"],
        },
    )


def home(request):
    react_target = request.path.rstrip("/") or "/"
    react_shell = _react_shell(request, react_target, manage_scope=False)
    if react_shell:
        return react_shell

    queryset = WordEntry.objects.filter(is_active=True).select_related("category", "collection")

    word_type = request.GET.get("word_type", "").strip()
    category_name = request.GET.get("category", "").strip()
    collection_name = request.GET.get("collection", "").strip()
    difficulty = request.GET.get("difficulty", "").strip()
    search = request.GET.get("q", "").strip()

    if word_type:
        queryset = queryset.filter(word_type=word_type)
    if category_name:
        queryset = queryset.filter(category__name=category_name)
    if collection_name:
        queryset = queryset.filter(collection__name=collection_name)
    if difficulty:
        queryset = queryset.filter(difficulty=difficulty)
    if search:
        queryset = queryset.filter(sanitized_text__icontains=search)

    words = queryset.order_by("sanitized_text", "id")[:500]

    context = {
        "words": words,
        "word_type": word_type,
        "category_name": category_name,
        "collection_name": collection_name,
        "difficulty": difficulty,
        "search": search,
        "categories": Category.objects.filter(is_active=True).order_by("name"),
        "collections": Collection.objects.filter(is_active=True).order_by("name"),
        "latest_version": DatasetVersion.latest(),
        "total_active": WordEntry.objects.filter(is_active=True).count(),
    }
    return render(request, "webui/home.html", context)


@login_required
@user_passes_test(lambda user: user.is_staff)
def manage_dashboard(request):
    react_shell = _react_shell(request, "/manage", manage_scope=True)
    if react_shell:
        return react_shell

    active_words = WordEntry.objects.filter(is_active=True)
    by_type = list(active_words.values("word_type").annotate(total=Count("id")).order_by("word_type"))
    by_collection = list(
        active_words.values("collection__name").annotate(total=Count("id")).order_by("collection__name")
    )
    by_difficulty = list(
        active_words.exclude(difficulty="")
        .values("difficulty")
        .annotate(total=Count("id"))
        .order_by("difficulty")
    )
    context = {
        "latest_version": DatasetVersion.latest(),
        "total_active": active_words.count(),
        "by_type": by_type,
        "by_collection": by_collection,
        "by_difficulty": by_difficulty,
        "collections": Collection.objects.filter(is_active=True).order_by("name"),
        "default_ai_model": DEFAULT_MODEL,
    }
    return render(request, "webui/manage.html", context)


@login_required
@user_passes_test(lambda user: user.is_staff)
def manage_ai(request):
    react_shell = _react_shell(request, "/manage/ai", manage_scope=True)
    if react_shell:
        return react_shell
    return redirect("manage-dashboard")


@login_required
@user_passes_test(lambda user: user.is_staff)
def manage_ingestion(request):
    react_shell = _react_shell(request, "/manage/ingestion", manage_scope=True)
    if react_shell:
        return react_shell
    return redirect("manage-dashboard")


@login_required
@user_passes_test(lambda user: user.is_staff)
def manage_qa(request):
    react_shell = _react_shell(request, "/manage/qa", manage_scope=True)
    if react_shell:
        return react_shell
    return redirect("manage-dashboard")


@login_required
@user_passes_test(lambda user: user.is_staff)
def manage_jobs(request):
    react_shell = _react_shell(request, "/manage/jobs", manage_scope=True)
    if react_shell:
        return react_shell
    return redirect("manage-dashboard")


@login_required
@user_passes_test(lambda user: user.is_staff)
def manage_settings(request):
    react_shell = _react_shell(request, "/manage/settings", manage_scope=True)
    if react_shell:
        return react_shell
    return redirect("manage-dashboard")


def _command_output(command_name: str, **kwargs) -> tuple[bool, str]:
    stdout = StringIO()
    try:
        call_command(command_name, stdout=stdout, stderr=stdout, **kwargs)
        return True, stdout.getvalue().strip()
    except CommandError as exc:
        output = stdout.getvalue().strip()
        return False, "\n".join(part for part in [output, str(exc)] if part).strip()


def _shorten(text: str, max_len: int = 500) -> str:
    if len(text) <= max_len:
        return text
    return f"{text[:max_len]}..."


@require_POST
@login_required
@user_passes_test(lambda user: user.is_staff)
def publish_now(request):
    report = run_publish_pipeline(force=False, run_dedupe=True, run_validation=True)
    if report.get("blocked_by_validation"):
        messages.error(
            request,
            f"Publish blocked by validation. Errors: {report['validation']['error_count']}, "
            f"warnings: {report['validation']['warning_count']}.",
        )
        return redirect("manage-dashboard")
    if report["published"]:
        messages.success(request, f"Published version v{report['dataset_version']}.")
    else:
        messages.info(request, f"No data changes; current version is v{report['dataset_version']}.")
    return redirect("manage-dashboard")


@require_POST
@login_required
@user_passes_test(lambda user: user.is_staff)
def run_manage_import(request: HttpRequest) -> HttpResponse:
    ok, output = _command_output("import_source_data")
    if ok:
        messages.success(request, _shorten(output or "Import completed."))
    else:
        messages.error(request, _shorten(output or "Import failed."))
    return redirect("manage-dashboard")


@require_POST
@login_required
@user_passes_test(lambda user: user.is_staff)
def run_manage_dedupe(request: HttpRequest) -> HttpResponse:
    report = dedupe_word_entries(dry_run=False)
    messages.success(
        request,
        f"Dedupe completed. Groups: {report['groups']}, "
        f"duplicate rows: {report['duplicate_rows']}, deleted: {report['deleted_rows']}.",
    )
    return redirect("manage-dashboard")


@require_POST
@login_required
@user_passes_test(lambda user: user.is_staff)
def run_manage_validate(request: HttpRequest) -> HttpResponse:
    report = validate_wordlist()
    if report["error_count"] > 0:
        messages.error(request, f"Validation found {report['error_count']} errors.")
    messages.info(request, f"Validation warnings: {report['warning_count']}.")
    return redirect("manage-validation")


@require_POST
@login_required
@user_passes_test(lambda user: user.is_staff)
def run_manage_check_deploy(request: HttpRequest) -> HttpResponse:
    ok, output = _command_output("check_deploy_config")
    if ok:
        messages.success(request, _shorten(output or "Deploy config check complete."))
    else:
        messages.error(request, _shorten(output or "Deploy config check failed."))
    return redirect("manage-dashboard")


@login_required
@user_passes_test(lambda user: user.is_staff)
def manage_validation(request: HttpRequest) -> HttpResponse:
    react_shell = _react_shell(request, "/manage/validation", manage_scope=True)
    if react_shell:
        return react_shell

    report = validate_wordlist()
    issues = report.get("issues", [])
    word_ids = sorted({issue["word_id"] for issue in issues if issue.get("word_id")})
    words = WordEntry.objects.filter(id__in=word_ids).select_related("category", "collection")
    words_map = {word.id: word for word in words}
    enriched_issues = []
    for issue in issues:
        word = words_map.get(issue.get("word_id"))
        enriched_issues.append({"issue": issue, "word": word})
    context = {"report": report, "issues": enriched_issues, "default_model": DEFAULT_MODEL}
    return render(request, "webui/manage_validation.html", context)


@require_POST
@login_required
@user_passes_test(lambda user: user.is_staff)
def apply_validation_action(request: HttpRequest) -> HttpResponse:
    action = request.POST.get("action", "").strip()
    raw_ids = request.POST.getlist("word_ids")
    word_ids = sorted({int(item) for item in raw_ids if item.isdigit()})
    if not word_ids:
        messages.error(request, "Select at least one item.")
        return redirect("manage-validation")

    if action == "deactivate":
        updated = WordEntry.objects.filter(id__in=word_ids, is_active=True).update(is_active=False)
        messages.success(request, f"Deactivated {updated} word(s).")
        return redirect("manage-validation")

    if action == "ai_complete":
        model = request.POST.get("model", "").strip() or DEFAULT_MODEL
        try:
            report = complete_word_templates(word_ids=word_ids, model=model, created_by=request.user)
        except AIServiceError as exc:
            messages.error(request, f"AI completion failed: {exc}")
            return redirect("manage-validation")
        messages.success(
            request,
            f"AI completion processed {report['processed']} word(s), "
            f"suggested {report['suggested']} and staged batch {report['batch_id']}.",
        )
        return redirect("staging-dashboard")

    messages.error(request, "Unknown action.")
    return redirect("manage-validation")


@require_POST
@login_required
@user_passes_test(lambda user: user.is_staff)
def run_ai_complete_templates(request: HttpRequest) -> HttpResponse:
    model = request.POST.get("model", "").strip() or DEFAULT_MODEL
    try:
        limit = int(request.POST.get("limit", "200"))
    except ValueError:
        limit = 200
    limit = max(1, min(limit, 2000))

    try:
        report = complete_word_templates(model=model, limit=limit, created_by=request.user)
    except AIServiceError as exc:
        messages.error(request, f"AI completion failed: {exc}")
        return redirect("manage-dashboard")

    messages.success(
        request,
        f"AI completion processed {report['processed']} words in {report['batches']} batches; "
        f"suggested {report['suggested']} and staged batch {report['batch_id']}.",
    )
    return redirect("staging-dashboard")


@require_POST
@login_required
@user_passes_test(lambda user: user.is_staff)
def run_ai_generate_words(request: HttpRequest) -> HttpResponse:
    word_type = request.POST.get("word_type", "").strip().lower()
    if word_type not in {"guessing", "describing"}:
        messages.error(request, "word_type must be 'guessing' or 'describing'.")
        return redirect("manage-dashboard")

    category = request.POST.get("category", "").strip()
    subcategory = request.POST.get("subcategory", "").strip()
    difficulty = request.POST.get("difficulty", "").strip().lower()
    collection = request.POST.get("collection", "").strip() or "Base"
    model = request.POST.get("model", "").strip() or DEFAULT_MODEL
    try:
        count = int(request.POST.get("count", "20"))
    except ValueError:
        count = 20

    try:
        report = generate_words(
            word_type=word_type,
            category=category,
            subcategory=subcategory,
            difficulty=difficulty,
            collection=collection,
            count=count,
            model=model,
            created_by=request.user,
        )
    except AIServiceError as exc:
        messages.error(request, f"AI generation failed: {exc}")
        return redirect("manage-dashboard")
    if not report.get("batch_id"):
        messages.error(
            request,
            f"AI generation produced no stageable rows (skipped invalid category: {report['skipped_invalid_category']}).",
        )
        return redirect("manage-dashboard")
    messages.success(
        request,
        f"AI generated {report['generated']} item(s), staged in batch {report['batch_id']} "
        f"(skipped invalid category: {report['skipped_invalid_category']}).",
    )
    return redirect("staging-dashboard")


def feedback_home(request: HttpRequest) -> HttpResponse:
    react_target = request.path.rstrip("/") or "/feedback"
    react_shell = _react_shell(request, react_target, manage_scope=False)
    if react_shell:
        return react_shell

    word = WordEntry.objects.filter(is_active=True).order_by("?").first()
    recent = (
        WordFeedback.objects.filter(reporter_token=request.session.session_key or "")
        .select_related("word")
        .order_by("-created_at")[:10]
    )
    context = {
        "word": word,
        "recent_feedback": recent,
    }
    return render(request, "webui/feedback.html", context)


def feedback_swipe(request: HttpRequest) -> HttpResponse:
    react_target = request.path.rstrip("/") or "/feedback/swipe"
    react_shell = _react_shell(request, react_target, manage_scope=False)
    if react_shell:
        return react_shell
    return render(
        request,
        "webui/feedback_swipe.html",
        {"api_random_url": "/api/v1/words/random?count=1", "api_feedback_url": "/api/v1/feedback"},
    )


@require_POST
def submit_feedback(request: HttpRequest) -> HttpResponse:
    word_id = request.POST.get("word_id")
    verdict = request.POST.get("verdict", "").lower().strip()
    comment = request.POST.get("comment", "").strip()
    if verdict not in {FeedbackVerdict.GOOD, FeedbackVerdict.BAD}:
        messages.error(request, "Invalid feedback option.")
        return redirect("feedback-home")

    word = WordEntry.objects.filter(id=word_id, is_active=True).first()
    if word is None:
        messages.error(request, "Word not found.")
        return redirect("feedback-home")

    if not request.session.session_key:
        request.session.create()
    WordFeedback.objects.create(
        word=word,
        verdict=verdict,
        comment=comment,
        reporter_token=request.session.session_key or "",
    )
    messages.success(request, "Feedback submitted.")
    return redirect("feedback-home")


@login_required
@user_passes_test(lambda user: user.is_staff)
def manage_feedback(request: HttpRequest) -> HttpResponse:
    react_shell = _react_shell(request, "/manage/feedback", manage_scope=True)
    if react_shell:
        return react_shell

    pending_bad = (
        WordFeedback.objects.filter(
            verdict=FeedbackVerdict.BAD,
            is_processed=False,
            word__is_active=True,
        )
        .select_related("word")
        .order_by("-created_at")
    )
    totals = Counter(
        WordFeedback.objects.filter(is_processed=False).values_list("verdict", flat=True)
    )
    context = {
        "pending_bad": pending_bad[:300],
        "pending_good_count": totals.get(FeedbackVerdict.GOOD, 0),
        "pending_bad_count": totals.get(FeedbackVerdict.BAD, 0),
    }
    return render(request, "webui/manage_feedback.html", context)


@require_POST
@login_required
@user_passes_test(lambda user: user.is_staff)
def resolve_feedback(request: HttpRequest) -> HttpResponse:
    feedback_id = request.POST.get("feedback_id")
    resolution = request.POST.get("resolution", FeedbackResolution.KEEP)
    note = request.POST.get("note", "")
    feedback = WordFeedback.objects.select_related("word").filter(id=feedback_id).first()
    if feedback is None:
        messages.error(request, "Feedback item not found.")
        return redirect("manage-feedback")
    if resolution not in {FeedbackResolution.KEEP, FeedbackResolution.DEACTIVATE, FeedbackResolution.IGNORE}:
        messages.error(request, "Invalid resolution.")
        return redirect("manage-feedback")

    if resolution == FeedbackResolution.DEACTIVATE:
        feedback.word.is_active = False
        feedback.word.save(update_fields=["is_active", "updated_at"])
    feedback.mark_processed(by_user=request.user, resolution=resolution, note=note)
    messages.success(request, "Feedback processed.")
    return redirect("manage-feedback")


@require_POST
@login_required
@user_passes_test(lambda user: user.is_staff)
def bulk_resolve_feedback(request: HttpRequest) -> HttpResponse:
    resolution = request.POST.get("resolution", FeedbackResolution.KEEP)
    note = request.POST.get("note", "")
    raw_ids = request.POST.getlist("feedback_ids")
    ids = [int(item) for item in raw_ids if item.isdigit()]
    if not ids:
        messages.error(request, "Select at least one feedback row.")
        return redirect("manage-feedback")
    if resolution not in {FeedbackResolution.KEEP, FeedbackResolution.DEACTIVATE, FeedbackResolution.IGNORE}:
        messages.error(request, "Invalid resolution.")
        return redirect("manage-feedback")

    queryset = WordFeedback.objects.select_related("word").filter(id__in=ids, is_processed=False)
    processed = 0
    for feedback in queryset:
        if resolution == FeedbackResolution.DEACTIVATE:
            feedback.word.is_active = False
            feedback.word.save(update_fields=["is_active", "updated_at"])
        feedback.mark_processed(by_user=request.user, resolution=resolution, note=note)
        processed += 1
    messages.success(request, f"Processed {processed} feedback item(s).")
    return redirect("manage-feedback")


@login_required
@user_passes_test(lambda user: user.is_staff)
def staging_dashboard(request: HttpRequest) -> HttpResponse:
    react_shell = _react_shell(request, "/manage/staging", manage_scope=True)
    if react_shell:
        return react_shell

    batches = ImportBatch.objects.all()[:30]
    pending_words = (
        StagedWord.objects.filter(status=StagedWordStatus.PENDING)
        .select_related("batch")
        .order_by("created_at")[:400]
    )
    context = {
        "batches": batches,
        "pending_words": pending_words,
    }
    return render(request, "webui/staging_dashboard.html", context)


@require_POST
@login_required
@user_passes_test(lambda user: user.is_staff)
def upload_staging_csv(request: HttpRequest) -> HttpResponse:
    upload = request.FILES.get("upload_file")
    note = request.POST.get("note", "")
    if upload is None:
        messages.error(request, "Choose a CSV or JSON file to upload.")
        return redirect("staging-dashboard")

    try:
        batch = create_batch_from_upload(
            file_name=upload.name,
            file_bytes=upload.read(),
            created_by=request.user,
            note=note,
        )
    except Exception as exc:
        messages.error(request, f"Upload failed: {exc}")
        return redirect("staging-dashboard")

    messages.success(request, f"Uploaded {upload.name} as batch {batch.id} with {batch.total_rows} rows.")
    return redirect("staging-dashboard")


@require_POST
@login_required
@user_passes_test(lambda user: user.is_staff)
def review_staging_word(request: HttpRequest) -> HttpResponse:
    staged_word_id = request.POST.get("staged_word_id")
    action = request.POST.get("action", "").strip().lower()
    note = request.POST.get("note", "")

    staged_word = StagedWord.objects.filter(id=staged_word_id).first()
    if staged_word is None:
        messages.error(request, "Staged word not found.")
        return redirect("staging-dashboard")
    if action not in {"approve", "reject"}:
        messages.error(request, "Invalid staging action.")
        return redirect("staging-dashboard")

    review_staged_word(
        staged_word=staged_word,
        reviewer=request.user,
        approve=(action == "approve"),
        note=note,
    )
    messages.success(request, "Staged word reviewed.")
    return redirect("staging-dashboard")


@require_POST
@login_required
@user_passes_test(lambda user: user.is_staff)
def bulk_review_staging(request: HttpRequest) -> HttpResponse:
    action = request.POST.get("action", "").strip().lower()
    note = request.POST.get("note", "")
    raw_ids = request.POST.getlist("staged_word_ids")
    ids = [int(item) for item in raw_ids if item.isdigit()]
    if not ids:
        messages.error(request, "Select at least one staged row.")
        return redirect("staging-dashboard")
    if action not in {"approve", "reject"}:
        messages.error(request, "Invalid staging action.")
        return redirect("staging-dashboard")

    queryset = StagedWord.objects.filter(id__in=ids, status=StagedWordStatus.PENDING)
    processed = 0
    for staged_word in queryset:
        review_staged_word(
            staged_word=staged_word,
            reviewer=request.user,
            approve=(action == "approve"),
            note=note,
        )
        processed += 1
    messages.success(request, f"Reviewed {processed} staged word(s).")
    return redirect("staging-dashboard")

# Create your views here.
