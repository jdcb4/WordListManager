from __future__ import annotations

from django.db import models
from django.db.models import Max

from words.services.normalization import normalized_key, sanitize_text


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
    category = models.ForeignKey(
        Category,
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
                fields=["normalized_text", "word_type"],
                name="uq_wordentry_normalized_word_type",
            ),
            models.CheckConstraint(
                check=(
                    models.Q(word_type=WordType.GUESSING, category__isnull=False)
                    | ~models.Q(word_type=WordType.GUESSING)
                ),
                name="ck_guessing_requires_category",
            ),
        ]

    def save(self, *args, **kwargs):
        self.sanitized_text = sanitize_text(self.text)
        self.normalized_text = normalized_key(self.text)
        self.subcategory = sanitize_text(self.subcategory)
        self.hint = sanitize_text(self.hint)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.sanitized_text} ({self.word_type})"


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

# Create your models here.
