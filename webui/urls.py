from django.urls import path

from webui.views import (
    feedback_home,
    home,
    manage_dashboard,
    manage_feedback,
    publish_now,
    resolve_feedback,
    review_staging_word,
    staging_dashboard,
    submit_feedback,
    upload_staging_csv,
)

urlpatterns = [
    path("", home, name="home"),
    path("feedback/", feedback_home, name="feedback-home"),
    path("feedback/submit/", submit_feedback, name="submit-feedback"),
    path("manage/", manage_dashboard, name="manage-dashboard"),
    path("manage/feedback/", manage_feedback, name="manage-feedback"),
    path("manage/feedback/resolve/", resolve_feedback, name="resolve-feedback"),
    path("manage/staging/", staging_dashboard, name="staging-dashboard"),
    path("manage/staging/upload/", upload_staging_csv, name="upload-staging-csv"),
    path("manage/staging/review/", review_staging_word, name="review-staging-word"),
    path("manage/publish/", publish_now, name="publish-now"),
]
