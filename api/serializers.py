from __future__ import annotations

from rest_framework import serializers

from words.models import DatasetVersion, ExportArtifact, WordEntry


class WordEntrySerializer(serializers.ModelSerializer):
    word = serializers.CharField(source="sanitized_text")
    category = serializers.CharField(source="category.name", default=None)

    class Meta:
        model = WordEntry
        fields = [
            "id",
            "word",
            "word_type",
            "category",
            "subcategory",
            "hint",
            "difficulty",
            "source",
            "updated_at",
        ]


class ExportArtifactSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = ExportArtifact
        fields = [
            "export_format",
            "file_size_bytes",
            "checksum_sha256",
            "created_at",
            "url",
        ]

    def get_url(self, obj):
        request = self.context.get("request")
        if request is None:
            return None
        return request.build_absolute_uri(f"/api/v1/exports/latest.{obj.export_format}")


class DatasetManifestSerializer(serializers.ModelSerializer):
    exports = ExportArtifactSerializer(many=True, source="artifacts")

    class Meta:
        model = DatasetVersion
        fields = [
            "version_number",
            "checksum_sha256",
            "active_word_count",
            "created_at",
            "exports",
        ]
