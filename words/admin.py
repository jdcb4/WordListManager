from django.contrib import admin

from words.models import (
    Category,
    DatasetVersion,
    ExportArtifact,
    ImportBatch,
    StagedWord,
    WordEntry,
    WordFeedback,
)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name",)


@admin.register(WordEntry)
class WordEntryAdmin(admin.ModelAdmin):
    list_display = (
        "sanitized_text",
        "word_type",
        "category",
        "difficulty",
        "is_active",
        "source",
        "updated_at",
    )
    list_filter = ("word_type", "difficulty", "category", "is_active")
    search_fields = ("sanitized_text", "normalized_text", "hint", "subcategory")
    autocomplete_fields = ("category",)


@admin.register(DatasetVersion)
class DatasetVersionAdmin(admin.ModelAdmin):
    list_display = ("version_number", "checksum_sha256", "active_word_count", "created_at")
    search_fields = ("checksum_sha256",)


@admin.register(ExportArtifact)
class ExportArtifactAdmin(admin.ModelAdmin):
    list_display = (
        "dataset_version",
        "export_format",
        "file_path",
        "file_size_bytes",
        "checksum_sha256",
        "created_at",
    )
    list_filter = ("export_format",)
    search_fields = ("file_path", "checksum_sha256")


@admin.register(WordFeedback)
class WordFeedbackAdmin(admin.ModelAdmin):
    list_display = ("word", "verdict", "is_processed", "resolution", "created_at")
    list_filter = ("verdict", "is_processed", "resolution")
    search_fields = ("word__sanitized_text", "comment", "manager_note")
    autocomplete_fields = ("word", "processed_by")


@admin.register(ImportBatch)
class ImportBatchAdmin(admin.ModelAdmin):
    list_display = ("id", "source_filename", "status", "total_rows", "created_by", "created_at")
    list_filter = ("status",)
    search_fields = ("source_filename", "note")
    autocomplete_fields = ("created_by",)


@admin.register(StagedWord)
class StagedWordAdmin(admin.ModelAdmin):
    list_display = ("sanitized_text", "word_type", "category_name", "status", "batch", "created_at")
    list_filter = ("status", "word_type", "difficulty")
    search_fields = ("sanitized_text", "normalized_text", "category_name", "hint", "review_note")
    autocomplete_fields = ("batch", "reviewed_by", "resulting_word")

# Register your models here.
