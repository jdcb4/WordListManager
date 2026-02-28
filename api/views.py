from __future__ import annotations

from pathlib import Path

from django.db.models import Count
from django.http import FileResponse, Http404
from rest_framework import permissions, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from api.filters import WordEntryFilter
from api.serializers import DatasetManifestSerializer, WordEntrySerializer
from words.models import DatasetVersion, ExportFormat, WordEntry


class WordEntryViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = WordEntrySerializer
    permission_classes = [permissions.AllowAny]
    search_fields = ["sanitized_text", "hint", "subcategory"]
    ordering_fields = ["sanitized_text", "updated_at", "id"]
    filterset_class = WordEntryFilter

    def get_queryset(self):
        return (
            WordEntry.objects.filter(is_active=True)
            .select_related("category")
            .order_by("sanitized_text", "id")
        )


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def random_words(request):
    try:
        count = int(request.query_params.get("count", 1))
    except ValueError:
        count = 1
    count = max(1, min(count, 100))
    queryset = WordEntry.objects.filter(is_active=True).select_related("category").order_by("?")[:count]
    serializer = WordEntrySerializer(queryset, many=True)
    return Response({"count": count, "results": serializer.data})


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def word_stats(request):
    active_words = WordEntry.objects.filter(is_active=True)
    by_type = dict(active_words.values_list("word_type").annotate(total=Count("id")))
    by_difficulty = dict(
        active_words.exclude(difficulty="")
        .values_list("difficulty")
        .annotate(total=Count("id"))
    )
    by_category = list(
        active_words.exclude(category=None)
        .values("category__name")
        .annotate(total=Count("id"))
        .order_by("-total", "category__name")
    )
    latest = DatasetVersion.latest()
    return Response(
        {
            "total_active_words": active_words.count(),
            "by_type": by_type,
            "by_difficulty": by_difficulty,
            "categories": by_category,
            "dataset_version": latest.version_number if latest else None,
        }
    )


class ManifestView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        latest = DatasetVersion.latest()
        if latest is None:
            return Response(
                {
                    "version_number": None,
                    "checksum_sha256": None,
                    "active_word_count": 0,
                    "created_at": None,
                    "exports": [],
                }
            )
        serializer = DatasetManifestSerializer(latest, context={"request": request})
        return Response(serializer.data)


class LatestExportView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "exports"

    def get(self, request, export_format: str):
        if export_format not in {ExportFormat.CSV, ExportFormat.JSON}:
            raise Http404("Unsupported format.")

        latest = DatasetVersion.latest()
        if latest is None:
            raise Http404("No published dataset found.")
        artifact = latest.artifacts.filter(export_format=export_format).first()
        if artifact is None:
            raise Http404("Requested artifact not found.")

        path = Path(artifact.file_path)
        if not path.exists():
            raise Http404("Artifact file missing on server.")

        response = FileResponse(path.open("rb"), as_attachment=True, filename=path.name)
        response["ETag"] = artifact.checksum_sha256
        response["X-Wordlist-Version"] = str(latest.version_number)
        return response

# Create your views here.
