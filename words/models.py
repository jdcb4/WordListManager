from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import models
from django.db.models import Max
from django.utils import timezone

from words.services.normalization import normalized_key, sanitize_text

User = get_user_model()


class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Category(TimestampedModel):
    name = models.CharField(max_length=64, unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Collection(TimestampedModel):
    name = models.CharField(max_length=64, unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

    @classmethod
    def get_base(cls) -> "Collection":
        collection, _ = cls.objects.get_or_create(name="Base", defaults={"is_active": True})
        return collection


class WordType(models.TextChoices):
    GUESSING = "guessing", "Guessing"
    DESCRIBING = "describing", "Describing"


class Difficulty(models.TextChoices):
    EASY = "easy", "Easy"
    MEDIUM = "medium", "Medium"
    HARD = "hard", "Hard"


class WordEntry(TimestampedModel):
    text = models.CharField(max_length=255)
    sanitized_text = models.CharField(max_length=255, editable=False, db_index=True)
    normalized_text = models.CharField(max_length=255, editable=False, db_index=True)
    word_type = models.CharField(max_length=24, choices=WordType.choices)
    is_guessing = models.BooleanField(default=False)
    is_describing = models.BooleanField(default=False)
    category = models.ForeignKey(
        Category,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="words",
    )
    collection = models.ForeignKey(
        Collection,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="words",
    )
    subcategory = models.CharField(max_length=128, blank=True)
    hint = models.TextField(blank=True)
    difficulty = models.CharField(max_length=16, blank=True, choices=Difficulty.choices)
    is_active = models.BooleanField(default=True)
    source = models.CharField(max_length=128, blank=True)

    class Meta:
        ordering = ["sanitized_text"]
        constraints = [
            models.UniqueConstraint(
                fields=["normalized_text"],
                name="uq_wordentry_normalized",
            ),
            models.CheckConstraint(
                check=(
                    models.Q(is_guessing=True)
                    | models.Q(is_describing=True)
                ),
                name="ck_wordentry_has_type",
            ),
            models.CheckConstraint(
                check=(
                    models.Q(is_guessing=False)
                    | models.Q(category__isnull=False)
                ),
                name="ck_guessing_requires_category",
            ),
        ]

    @property
    def word_types(self) -> list[str]:
        values: list[str] = []
        if self.is_guessing:
            values.append(WordType.GUESSING)
        if self.is_describing:
            values.append(WordType.DESCRIBING)
        return values

    def canonical_word_type(self) -> str:
        # Keep legacy `word_type` populated for backward compatibility.
        if self.is_describing:
            return WordType.DESCRIBING
        return WordType.GUESSING

    def save(self, *args, **kwargs):
        self.sanitized_text = sanitize_text(self.text)
        self.normalized_text = normalized_key(self.text)
        self.subcategory = sanitize_text(self.subcategory)
        self.hint = sanitize_text(self.hint)
        if not self.is_guessing and not self.is_describing:
            if self.word_type == WordType.DESCRIBING:
                self.is_describing = True
            else:
                self.is_guessing = True
        self.word_type = self.canonical_word_type()
        if self.collection_id is None:
            self.collection = Collection.get_base()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.sanitized_text} ({', '.join(self.word_types)})"


class DatasetVersion(TimestampedModel):
    version_number = models.PositiveIntegerField(unique=True, db_index=True)
    checksum_sha256 = models.CharField(max_length=64, db_index=True)
    active_word_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-version_number"]

    @classmethod
    def next_version_number(cls) -> int:
        max_version = cls.objects.aggregate(max_v=Max("version_number"))["max_v"] or 0
        return max_version + 1

    @classmethod
    def latest(cls) -> "DatasetVersion | None":
        return cls.objects.order_by("-version_number").first()

    def __str__(self) -> str:
        return f"v{self.version_number}"


class ExportFormat(models.TextChoices):
    CSV = "csv", "CSV"
    JSON = "json", "JSON"


class ExportArtifact(TimestampedModel):
    dataset_version = models.ForeignKey(
        DatasetVersion, on_delete=models.CASCADE, related_name="artifacts"
    )
    export_format = models.CharField(max_length=8, choices=ExportFormat.choices, db_index=True)
    file_path = models.CharField(max_length=512)
    file_size_bytes = models.PositiveBigIntegerField(default=0)
    checksum_sha256 = models.CharField(max_length=64, blank=True)

    class Meta:
        ordering = ["-dataset_version__version_number", "export_format"]
        constraints = [
            models.UniqueConstraint(
                fields=["dataset_version", "export_format"],
                name="uq_exportartifact_version_format",
            )
        ]

    def __str__(self) -> str:
        return f"{self.dataset_version} {self.export_format}"


class FeedbackVerdict(models.TextChoices):
    GOOD = "good", "Good"
    BAD = "bad", "Bad"


class FeedbackResolution(models.TextChoices):
    KEEP = "keep", "Keep"
    DEACTIVATE = "deactivate", "Deactivate"
    IGNORE = "ignore", "Ignore"


class WordFeedback(TimestampedModel):
    word = models.ForeignKey(WordEntry, on_delete=models.CASCADE, related_name="feedback")
    verdict = models.CharField(max_length=16, choices=FeedbackVerdict.choices)
    reporter_token = models.CharField(max_length=64, blank=True, db_index=True)
    comment = models.TextField(blank=True)
    is_processed = models.BooleanField(default=False, db_index=True)
    resolution = models.CharField(max_length=16, choices=FeedbackResolution.choices, blank=True)
    manager_note = models.TextField(blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    processed_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="processed_feedback"
    )

    class Meta:
        ordering = ["-created_at"]

    def mark_processed(self, *, by_user: User, resolution: str, note: str = "") -> None:
        self.is_processed = True
        self.resolution = resolution
        self.manager_note = sanitize_text(note)
        self.processed_at = timezone.now()
        self.processed_by = by_user
        self.save(
            update_fields=[
                "is_processed",
                "resolution",
                "manager_note",
                "processed_at",
                "processed_by",
                "updated_at",
            ]
        )


class ValidationIssueAcknowledgement(TimestampedModel):
    word = models.ForeignKey(
        WordEntry,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="validation_acknowledgements",
    )
    severity = models.CharField(max_length=16, default="warning")
    code = models.CharField(max_length=64)
    acknowledged_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="validation_acknowledgements",
    )
    note = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["word", "severity", "code"],
                name="uq_validation_ack_word_severity_code",
            )
        ]


class ImportBatchStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    IN_REVIEW = "in_review", "In Review"
    COMPLETED = "completed", "Completed"


class ImportBatch(TimestampedModel):
    source_filename = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=ImportBatchStatus.choices, default=ImportBatchStatus.PENDING)
    created_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="import_batches"
    )
    total_rows = models.PositiveIntegerField(default=0)
    note = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Batch {self.id} ({self.source_filename})"


class StagedWordStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"


class StagedWord(TimestampedModel):
    batch = models.ForeignKey(ImportBatch, on_delete=models.CASCADE, related_name="staged_words")
    text = models.CharField(max_length=255)
    sanitized_text = models.CharField(max_length=255, editable=False, db_index=True)
    normalized_text = models.CharField(max_length=255, editable=False, db_index=True)
    word_type = models.CharField(max_length=24, choices=WordType.choices, default=WordType.GUESSING)
    category_name = models.CharField(max_length=64, blank=True)
    collection_name = models.CharField(max_length=64, blank=True)
    subcategory = models.CharField(max_length=128, blank=True)
    hint = models.TextField(blank=True)
    difficulty = models.CharField(max_length=16, blank=True, choices=Difficulty.choices)
    status = models.CharField(max_length=16, choices=StagedWordStatus.choices, default=StagedWordStatus.PENDING)
    review_note = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="reviewed_staged_words"
    )
    resulting_word = models.ForeignKey(
        WordEntry, null=True, blank=True, on_delete=models.SET_NULL, related_name="staged_origins"
    )

    class Meta:
        ordering = ["status", "created_at"]

    def save(self, *args, **kwargs):
        self.sanitized_text = sanitize_text(self.text)
        self.normalized_text = normalized_key(self.text)
        self.category_name = sanitize_text(self.category_name)
        self.collection_name = sanitize_text(self.collection_name)
        self.subcategory = sanitize_text(self.subcategory)
        self.hint = sanitize_text(self.hint)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.sanitized_text} ({self.word_type})"

# Create your models here.
