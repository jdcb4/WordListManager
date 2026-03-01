from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from django.db.models import Count, Q
from django.http import FileResponse, Http404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
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


class WordEntryViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = WordEntrySerializer
    permission_classes = [permissions.AllowAny]
    search_fields = ["sanitized_text", "hint", "subcategory"]
    ordering_fields = [
        "sanitized_text",
        "word_type",
        "difficulty",
        "category__name",
        "collection__name",
        "updated_at",
        "id",
    ]
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


def _coerce_id_list(raw_ids) -> list[int]:
    if isinstance(raw_ids, str):
        raw_ids = [raw_ids]
    if not isinstance(raw_ids, list):
        return []
    return sorted({int(item) for item in raw_ids if str(item).isdigit()})


def _as_text(value) -> str:
    return (value or "").strip() if isinstance(value, str) else (str(value).strip() if value is not None else "")


def _build_staging_preview(staged_word: StagedWord, existing_word: WordEntry | None) -> dict:
    staged_category = _as_text(staged_word.category_name)
    staged_collection = _as_text(staged_word.collection_name) or "Base"
    staged_values = {
        "text": _as_text(staged_word.sanitized_text or staged_word.text),
        "word_type": _as_text(staged_word.word_type),
        "category": staged_category,
        "collection": staged_collection,
        "subcategory": _as_text(staged_word.subcategory),
        "hint": _as_text(staged_word.hint),
        "difficulty": _as_text(staged_word.difficulty),
        "is_active": "true",
    }
    if existing_word is None:
        return {
            "action": "create",
            "is_new": True,
            "changed_fields": [field for field, value in staged_values.items() if value and field != "is_active"]
            + ["is_active"],
            "fields": [
                {"field": field, "from": "", "to": value, "changed": bool(value or field == "is_active")}
                for field, value in staged_values.items()
            ],
        }

    existing_values = {
        "text": _as_text(existing_word.sanitized_text or existing_word.text),
        "word_type": _as_text(existing_word.word_type),
        "category": _as_text(existing_word.category.name if existing_word.category else ""),
        "collection": _as_text(existing_word.collection.name if existing_word.collection else ""),
        "subcategory": _as_text(existing_word.subcategory),
        "hint": _as_text(existing_word.hint),
        "difficulty": _as_text(existing_word.difficulty),
        "is_active": "true" if existing_word.is_active else "false",
    }
    field_diffs = []
    changed_fields = []
    for field, staged_value in staged_values.items():
        current_value = existing_values[field]
        changed = current_value != staged_value
        if changed:
            changed_fields.append(field)
        field_diffs.append(
            {
                "field": field,
                "from": current_value,
                "to": staged_value,
                "changed": changed,
            }
        )
    return {
        "action": "update",
        "is_new": False,
        "changed_fields": changed_fields,
        "fields": field_diffs,
        "existing_word_id": existing_word.id,
    }


class ManageStagingView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        status_filter = _as_text(request.query_params.get("status", "pending")).lower()
        batch_id_raw = _as_text(request.query_params.get("batch_id", ""))
        try:
            limit = int(request.query_params.get("limit", 200))
        except (TypeError, ValueError):
            limit = 200
        limit = max(1, min(limit, 500))

        queryset = StagedWord.objects.select_related("batch").order_by("-created_at", "-id")
        if status_filter in {StagedWordStatus.PENDING, StagedWordStatus.APPROVED, StagedWordStatus.REJECTED}:
            queryset = queryset.filter(status=status_filter)
        if batch_id_raw.isdigit():
            queryset = queryset.filter(batch_id=int(batch_id_raw))

        total = queryset.count()
        staged_words = list(queryset[:limit])
        keys = {(word.normalized_text, word.word_type) for word in staged_words}
        normalized_values = [item[0] for item in keys]
        type_values = [item[1] for item in keys]
        existing_words = (
            WordEntry.objects.filter(normalized_text__in=normalized_values, word_type__in=type_values)
            .select_related("category", "collection")
            .order_by("id")
        )
        existing_by_key = {(word.normalized_text, word.word_type): word for word in existing_words}

        results = []
        for staged_word in staged_words:
            existing_word = existing_by_key.get((staged_word.normalized_text, staged_word.word_type))
            preview = _build_staging_preview(staged_word, existing_word)
            results.append(
                {
                    "id": staged_word.id,
                    "status": staged_word.status,
                    "word": staged_word.sanitized_text,
                    "word_type": staged_word.word_type,
                    "category": staged_word.category_name,
                    "collection": staged_word.collection_name or "Base",
                    "subcategory": staged_word.subcategory,
                    "hint": staged_word.hint,
                    "difficulty": staged_word.difficulty,
                    "created_at": staged_word.created_at,
                    "batch": {
                        "id": staged_word.batch_id,
                        "source_filename": staged_word.batch.source_filename,
                    },
                    "preview": preview,
                }
            )

        batch_rows = (
            ImportBatch.objects.annotate(
                pending_count=Count("staged_words", filter=Q(staged_words__status=StagedWordStatus.PENDING)),
                approved_count=Count("staged_words", filter=Q(staged_words__status=StagedWordStatus.APPROVED)),
                rejected_count=Count("staged_words", filter=Q(staged_words__status=StagedWordStatus.REJECTED)),
            )
            .order_by("-created_at")[:40]
        )
        batches = [
            {
                "id": row.id,
                "source_filename": row.source_filename,
                "status": row.status,
                "total_rows": row.total_rows,
                "pending_count": row.pending_count,
                "approved_count": row.approved_count,
                "rejected_count": row.rejected_count,
                "created_at": row.created_at,
            }
            for row in batch_rows
        ]
        return Response(
            {
                "total": total,
                "limit": limit,
                "status_filter": status_filter,
                "batch_id": int(batch_id_raw) if batch_id_raw.isdigit() else None,
                "results": results,
                "batches": batches,
            }
        )


class ManageStagingUploadView(APIView):
    permission_classes = [permissions.IsAdminUser]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        upload_file = request.FILES.get("file") or request.FILES.get("upload_file")
        if upload_file is None:
            return Response({"detail": "No upload file provided."}, status=status.HTTP_400_BAD_REQUEST)
        note = _as_text(request.data.get("note", ""))
        batch = create_batch_from_upload(
            file_name=upload_file.name,
            file_bytes=upload_file.read(),
            created_by=request.user,
            note=note,
        )
        return Response(
            {
                "batch_id": batch.id,
                "source_filename": batch.source_filename,
                "status": batch.status,
                "total_rows": batch.total_rows,
            },
            status=status.HTTP_201_CREATED,
        )


class ManageStagingReviewView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        action = _as_text(request.data.get("action", "")).lower()
        staged_word_ids = _coerce_id_list(request.data.get("staged_word_ids", []))
        if action not in {"approve", "reject"}:
            return Response({"detail": "action must be approve or reject."}, status=status.HTTP_400_BAD_REQUEST)
        if not staged_word_ids:
            return Response({"detail": "No staged_word_ids provided."}, status=status.HTTP_400_BAD_REQUEST)
        note = _as_text(request.data.get("note", ""))
        staged_words = list(
            StagedWord.objects.filter(id__in=staged_word_ids).select_related("batch").order_by("id")
        )
        reviewed = 0
        approved = 0
        rejected = 0
        skipped = 0
        for staged_word in staged_words:
            if staged_word.status != StagedWordStatus.PENDING:
                skipped += 1
                continue
            review_staged_word(
                staged_word=staged_word,
                reviewer=request.user,
                approve=(action == "approve"),
                note=note,
            )
            reviewed += 1
            if action == "approve":
                approved += 1
            else:
                rejected += 1
        return Response(
            {
                "action": action,
                "requested": len(staged_word_ids),
                "reviewed": reviewed,
                "approved": approved,
                "rejected": rejected,
                "skipped_non_pending": skipped,
            },
            status=status.HTTP_200_OK,
        )


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


class ManageFeedbackPendingView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        pending = (
            WordFeedback.objects.filter(is_processed=False)
            .select_related("word")
            .order_by("-created_at")
        )
        pending_bad = pending.filter(verdict=FeedbackVerdict.BAD)[:300]
        verdict_totals = dict(
            pending.values("verdict")
            .annotate(total=Count("id"))
            .values_list("verdict", "total")
        )
        return Response(
            {
                "pending_good_count": verdict_totals.get(FeedbackVerdict.GOOD, 0),
                "pending_bad_count": verdict_totals.get(FeedbackVerdict.BAD, 0),
                "results": [
                    {
                        "id": row.id,
                        "word_id": row.word_id,
                        "word": row.word.sanitized_text,
                        "verdict": row.verdict,
                        "comment": row.comment,
                        "created_at": row.created_at,
                    }
                    for row in pending_bad
                ],
            }
        )


class ManageFeedbackResolveView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        resolution = str(request.data.get("resolution", "")).strip().lower()
        note = str(request.data.get("note", "")).strip()
        feedback_ids = _coerce_id_list(
            request.data.get("feedback_ids", request.data.get("feedback_id", []))
        )
        if resolution not in {
            FeedbackResolution.KEEP,
            FeedbackResolution.DEACTIVATE,
            FeedbackResolution.IGNORE,
        }:
            return Response({"detail": "Invalid resolution."}, status=status.HTTP_400_BAD_REQUEST)
        if not feedback_ids:
            return Response({"detail": "No feedback IDs provided."}, status=status.HTTP_400_BAD_REQUEST)
        queryset = WordFeedback.objects.select_related("word").filter(
            id__in=feedback_ids,
            is_processed=False,
        )
        processed = 0
        deactivated = 0
        for feedback in queryset:
            if resolution == FeedbackResolution.DEACTIVATE and feedback.word.is_active:
                feedback.word.is_active = False
                feedback.word.save(update_fields=["is_active", "updated_at"])
                deactivated += 1
            feedback.mark_processed(by_user=request.user, resolution=resolution, note=note)
            processed += 1
        return Response(
            {
                "processed": processed,
                "deactivated_words": deactivated,
                "resolution": resolution,
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
        issues = report.get("issues", [])
        word_ids = sorted({issue.get("word_id") for issue in issues if issue.get("word_id")})
        words = {
            word.id: word
            for word in WordEntry.objects.filter(id__in=word_ids).select_related("category", "collection")
        }
        enriched = []
        for issue in issues:
            word_id = issue.get("word_id")
            word = words.get(word_id)
            enriched.append(
                {
                    **issue,
                    "word": (
                        {
                            "id": word.id,
                            "text": word.sanitized_text,
                            "word_type": word.word_type,
                            "category": word.category.name if word.category else "",
                            "collection": word.collection.name if word.collection else "",
                            "difficulty": word.difficulty,
                        }
                        if word
                        else None
                    ),
                }
            )
        report["issues"] = enriched
        return Response(report, status=status.HTTP_200_OK)


class ManageQACandidatesView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        try:
            limit = int(request.query_params.get("limit", 2000))
        except (TypeError, ValueError):
            limit = 2000
        limit = max(1, min(limit, 5000))

        queryset = (
            WordEntry.objects.filter(is_active=True)
            .select_related("category", "collection")
            .order_by("id")
        )

        candidates = []
        for word in queryset.iterator():
            missing_codes = []
            if not _as_text(word.hint):
                missing_codes.append("missing_hint")
            if not _as_text(word.difficulty):
                missing_codes.append("missing_difficulty")
            if not missing_codes:
                continue
            candidates.append(
                {
                    "id": word.id,
                    "text": word.sanitized_text,
                    "word_type": word.word_type,
                    "category": word.category.name if word.category else "",
                    "collection": word.collection.name if word.collection else "",
                    "difficulty": word.difficulty,
                    "missing_codes": missing_codes,
                    "missing_summary": ", ".join(missing_codes),
                }
            )

        return Response(
            {
                "count": len(candidates),
                "limit": limit,
                "results": candidates[:limit],
                "generated_at_utc": datetime.now(tz=timezone.utc).isoformat(),
            },
            status=status.HTTP_200_OK,
        )


class ManageValidationActionView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        action = str(request.data.get("action", "")).strip()
        word_ids = _coerce_id_list(request.data.get("word_ids", []))
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
        word_ids = _coerce_id_list(request.data.get("word_ids", []))
        model = str(request.data.get("model", "")).strip() or DEFAULT_MODEL
        try:
            report = complete_word_templates(
                word_ids=word_ids or None,
                model=model,
                limit=limit,
                created_by=request.user,
            )
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
