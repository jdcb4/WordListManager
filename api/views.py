from __future__ import annotations

from pathlib import Path

from django.db.models import Count
from django.http import FileResponse, Http404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from api.filters import WordEntryFilter
from api.serializers import (
    DatasetManifestSerializer,
    WordEntrySerializer,
    WordFeedbackCreateSerializer,
)
from words.models import (
    DatasetVersion,
    ExportFormat,
    WordEntry,
    WordFeedback,
)
from words.services.ai import AIServiceError, DEFAULT_MODEL, complete_word_templates, generate_words
from words.services.maintenance import dedupe_word_entries
from words.services.pipeline import run_publish_pipeline
from words.services.quality import validate_wordlist


class WordEntryViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = WordEntrySerializer
    permission_classes = [permissions.AllowAny]
    search_fields = ["sanitized_text", "hint", "subcategory"]
    ordering_fields = ["sanitized_text", "updated_at", "id"]
    filterset_class = WordEntryFilter

    def get_queryset(self):
        return (
            WordEntry.objects.filter(is_active=True)
            .select_related("category", "collection")
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
    queryset = (
        WordEntry.objects.filter(is_active=True)
        .select_related("category", "collection")
        .order_by("?")[:count]
    )
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
    by_collection = list(
        active_words.exclude(collection=None)
        .values("collection__name")
        .annotate(total=Count("id"))
        .order_by("-total", "collection__name")
    )
    latest = DatasetVersion.latest()
    return Response(
        {
            "total_active_words": active_words.count(),
            "by_type": by_type,
            "by_difficulty": by_difficulty,
            "categories": by_category,
            "collections": by_collection,
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


class FeedbackCreateView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "user"

    def post(self, request):
        serializer = WordFeedbackCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if not request.session.session_key:
            request.session.create()

        feedback = WordFeedback.objects.create(
            word=serializer.validated_data["word"],
            verdict=serializer.validated_data["verdict"],
            comment=serializer.validated_data.get("comment", ""),
            reporter_token=request.session.session_key or "",
        )
        return Response({"id": feedback.id, "status": "recorded"}, status=status.HTTP_201_CREATED)


class ManageDashboardView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        active_words = WordEntry.objects.filter(is_active=True)
        latest = DatasetVersion.latest()
        return Response(
            {
                "total_active_words": active_words.count(),
                "dataset_version": latest.version_number if latest else None,
                "collections": list(
                    active_words.values("collection__name")
                    .annotate(total=Count("id"))
                    .order_by("collection__name")
                ),
                "types": list(
                    active_words.values("word_type")
                    .annotate(total=Count("id"))
                    .order_by("word_type")
                ),
            }
        )


class ManagePublishView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        report = run_publish_pipeline(force=False, run_dedupe=True, run_validation=True)
        return Response(report, status=status.HTTP_200_OK)


class ManageDedupeView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        report = dedupe_word_entries(dry_run=False)
        return Response(report, status=status.HTTP_200_OK)


class ManageValidateView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        report = validate_wordlist()
        return Response(report, status=status.HTTP_200_OK)


class ManageValidationActionView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        action = str(request.data.get("action", "")).strip()
        raw_ids = request.data.get("word_ids", [])
        if isinstance(raw_ids, str):
            raw_ids = [raw_ids]
        word_ids = sorted({int(item) for item in raw_ids if str(item).isdigit()})
        if not word_ids:
            return Response({"detail": "No word_ids provided."}, status=status.HTTP_400_BAD_REQUEST)

        if action == "deactivate":
            updated = WordEntry.objects.filter(id__in=word_ids, is_active=True).update(is_active=False)
            return Response({"action": action, "updated": updated})

        if action == "ai_complete":
            model = str(request.data.get("model", "")).strip() or DEFAULT_MODEL
            try:
                report = complete_word_templates(word_ids=word_ids, model=model, created_by=request.user)
            except AIServiceError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            return Response({"action": action, "report": report})

        return Response({"detail": "Unknown action."}, status=status.HTTP_400_BAD_REQUEST)


class ManageAICompleteView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        try:
            limit = int(request.data.get("limit", 200))
        except (TypeError, ValueError):
            limit = 200
        limit = max(1, min(limit, 2000))
        model = str(request.data.get("model", "")).strip() or DEFAULT_MODEL
        try:
            report = complete_word_templates(model=model, limit=limit, created_by=request.user)
        except AIServiceError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(report, status=status.HTTP_200_OK)


class ManageAIGenerateView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        word_type = str(request.data.get("word_type", "")).strip().lower()
        if word_type not in {"guessing", "describing"}:
            return Response({"detail": "word_type must be guessing or describing."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            count = int(request.data.get("count", 20))
        except (TypeError, ValueError):
            count = 20
        model = str(request.data.get("model", "")).strip() or DEFAULT_MODEL
        category = str(request.data.get("category", "")).strip()
        subcategory = str(request.data.get("subcategory", "")).strip()
        difficulty = str(request.data.get("difficulty", "")).strip().lower()
        collection = str(request.data.get("collection", "")).strip() or "Base"
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
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(report, status=status.HTTP_200_OK)

# Create your views here.
