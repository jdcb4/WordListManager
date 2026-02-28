from django.contrib import admin

from words.models import Category, DatasetVersion, ExportArtifact, WordEntry


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

# Register your models here.
