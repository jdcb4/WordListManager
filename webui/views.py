from __future__ import annotations

from collections import Counter

from django.contrib import messages
from django.contrib.auth.decorators import login_required, user_passes_test
from django.db.models import Count
from django.http import HttpRequest, HttpResponse
from django.shortcuts import redirect, render
from django.views.decorators.http import require_POST

from words.models import (
    Category,
    DatasetVersion,
    FeedbackResolution,
    FeedbackVerdict,
    ImportBatch,
    StagedWord,
    StagedWordStatus,
    WordEntry,
    WordFeedback,
)
from words.services.datasets import publish_dataset
from words.services.staging import create_batch_from_csv, review_staged_word


def home(request):
    queryset = WordEntry.objects.filter(is_active=True).select_related("category")

    word_type = request.GET.get("word_type", "").strip()
    category_name = request.GET.get("category", "").strip()
    difficulty = request.GET.get("difficulty", "").strip()
    search = request.GET.get("q", "").strip()

    if word_type:
        queryset = queryset.filter(word_type=word_type)
    if category_name:
        queryset = queryset.filter(category__name=category_name)
    if difficulty:
        queryset = queryset.filter(difficulty=difficulty)
    if search:
        queryset = queryset.filter(sanitized_text__icontains=search)

    words = queryset.order_by("sanitized_text", "id")[:500]

    context = {
        "words": words,
        "word_type": word_type,
        "category_name": category_name,
        "difficulty": difficulty,
        "search": search,
        "categories": Category.objects.filter(is_active=True).order_by("name"),
        "latest_version": DatasetVersion.latest(),
        "total_active": WordEntry.objects.filter(is_active=True).count(),
    }
    return render(request, "webui/home.html", context)


@login_required
def manage_dashboard(request):
    active_words = WordEntry.objects.filter(is_active=True)
    by_type = list(active_words.values("word_type").annotate(total=Count("id")).order_by("word_type"))
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
        "by_difficulty": by_difficulty,
    }
    return render(request, "webui/manage.html", context)


@require_POST
@login_required
@user_passes_test(lambda user: user.is_staff)
def publish_now(request):
    version, created = publish_dataset(force=False)
    if created:
        messages.success(request, f"Published version v{version.version_number}.")
    else:
        messages.info(request, f"No data changes; current version is v{version.version_number}.")
    return redirect("manage-dashboard")


def feedback_home(request: HttpRequest) -> HttpResponse:
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
    pending_bad = WordFeedback.objects.filter(
        verdict=FeedbackVerdict.BAD,
        is_processed=False,
        word__is_active=True,
    ).select_related("word")
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


@login_required
@user_passes_test(lambda user: user.is_staff)
def staging_dashboard(request: HttpRequest) -> HttpResponse:
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
        messages.error(request, "Choose a CSV file to upload.")
        return redirect("staging-dashboard")

    batch = create_batch_from_csv(
        file_name=upload.name,
        file_bytes=upload.read(),
        created_by=request.user,
        note=note,
    )
    messages.success(request, f"Uploaded batch {batch.id} with {batch.total_rows} rows.")
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

# Create your views here.
