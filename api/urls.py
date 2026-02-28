from django.urls import include, path
from rest_framework.routers import DefaultRouter

from api.views import LatestExportView, ManifestView, WordEntryViewSet, random_words, word_stats

router = DefaultRouter()
router.register("words", WordEntryViewSet, basename="word-entry")

urlpatterns = [
    path("", include(router.urls)),
    path("words/random", random_words, name="words-random"),
    path("stats", word_stats, name="word-stats"),
    path("manifest", ManifestView.as_view(), name="manifest"),
    path("exports/latest.<str:export_format>", LatestExportView.as_view(), name="latest-export"),
]
