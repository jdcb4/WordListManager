from __future__ import annotations

import django_filters

from words.models import WordEntry


class WordEntryFilter(django_filters.FilterSet):
    category = django_filters.CharFilter(field_name="category__name", lookup_expr="iexact")

    class Meta:
        model = WordEntry
        fields = ["word_type", "difficulty", "category"]
