from __future__ import annotations

import django_filters
from django.db.models import Q

from words.models import WordEntry


def _split_csv(value: str) -> list[str]:
    if not value:
        return []
    return [part.strip() for part in value.split(",") if part.strip()]


class WordEntryFilter(django_filters.FilterSet):
    word_type = django_filters.CharFilter(method="filter_word_type")
    difficulty = django_filters.CharFilter(method="filter_difficulty")
    category = django_filters.CharFilter(method="filter_category")
    collection = django_filters.CharFilter(method="filter_collection")

    class Meta:
        model = WordEntry
        fields = ["word_type", "difficulty", "category", "collection"]

    def filter_word_type(self, queryset, _name, value):
        values = _split_csv(value)
        if not values:
            return queryset
        return queryset.filter(word_type__in=values)

    def filter_difficulty(self, queryset, _name, value):
        values = _split_csv(value)
        if not values:
            return queryset
        return queryset.filter(difficulty__in=values)

    def filter_category(self, queryset, _name, value):
        values = _split_csv(value)
        if not values:
            return queryset
        category_query = Q()
        for item in values:
            category_query |= Q(category__name__iexact=item)
        return queryset.filter(category_query)

    def filter_collection(self, queryset, _name, value):
        values = _split_csv(value)
        if not values:
            return queryset
        collection_query = Q()
        for item in values:
            collection_query |= Q(collection__name__iexact=item)
        return queryset.filter(collection_query)
