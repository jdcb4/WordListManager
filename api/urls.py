from django.urls import include, path
from rest_framework.routers import DefaultRouter

from api.views import (
    FeedbackCreateView,
    LatestExportView,
    ManageAIGenerateView,
    ManageAICompleteView,
    ManageDashboardView,
    ManageConsolidateView,
    ManageDedupeView,
    ManageFeedbackPendingView,
    ManageFeedbackResolveView,
    ManagePublishView,
    ManageQACandidatesView,
    ManageStagingReviewView,
    ManageStagingUploadView,
    ManageStagingView,
    ManageValidateView,
    ManageValidationActionView,
    ManifestView,
    WordEntryViewSet,
    random_words,
    word_stats,
)

router = DefaultRouter()
router.register("words", WordEntryViewSet, basename="word-entry")

urlpatterns = [
    path("", include(router.urls)),
    path("words/random", random_words, name="words-random"),
    path("stats", word_stats, name="word-stats"),
    path("manifest", ManifestView.as_view(), name="manifest"),
    path("exports/latest.<str:export_format>", LatestExportView.as_view(), name="latest-export"),
    path("feedback", FeedbackCreateView.as_view(), name="feedback-create"),
    path("manage/dashboard", ManageDashboardView.as_view(), name="manage-dashboard-api"),
    path("manage/feedback/pending", ManageFeedbackPendingView.as_view(), name="manage-feedback-pending-api"),
    path("manage/feedback/resolve", ManageFeedbackResolveView.as_view(), name="manage-feedback-resolve-api"),
    path("manage/publish", ManagePublishView.as_view(), name="manage-publish-api"),
    path("manage/dedupe", ManageDedupeView.as_view(), name="manage-dedupe-api"),
    path("manage/consolidate", ManageConsolidateView.as_view(), name="manage-consolidate-api"),
    path("manage/staging", ManageStagingView.as_view(), name="manage-staging-api"),
    path("manage/staging/upload", ManageStagingUploadView.as_view(), name="manage-staging-upload-api"),
    path("manage/staging/review", ManageStagingReviewView.as_view(), name="manage-staging-review-api"),
    path("manage/validate", ManageValidateView.as_view(), name="manage-validate-api"),
    path("manage/qa/candidates", ManageQACandidatesView.as_view(), name="manage-qa-candidates-api"),
    path("manage/validation/action", ManageValidationActionView.as_view(), name="manage-validation-action-api"),
    path("manage/ai/complete", ManageAICompleteView.as_view(), name="manage-ai-complete-api"),
    path("manage/ai/generate", ManageAIGenerateView.as_view(), name="manage-ai-generate-api"),
]
