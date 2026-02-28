from __future__ import annotations

from django.contrib import messages
from django.contrib.auth.decorators import login_required, user_passes_test
from django.db.models import Count
from django.shortcuts import redirect, render
from django.views.decorators.http import require_POST

from words.models import Category, DatasetVersion, WordEntry
from words.services.datasets import publish_dataset


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

# Create your views here.
