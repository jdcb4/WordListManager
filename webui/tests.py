from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.test.utils import override_settings

from words.models import FeedbackResolution, FeedbackVerdict, StagedWordStatus, WordEntry, WordFeedback, WordType
from words.services.datasets import publish_dataset
from words.services.staging import create_batch_from_csv

User = get_user_model()


class ManagementBulkActionTests(TestCase):
    def setUp(self):
        self.staff_user = User.objects.create_user(
            username="admin1",
            password="password123",
            is_staff=True,
        )
        self.client.force_login(self.staff_user)

    def test_bulk_feedback_resolve_deactivate(self):
        word = WordEntry.objects.create(text="Rocket", word_type=WordType.DESCRIBING)
        feedback = WordFeedback.objects.create(word=word, verdict=FeedbackVerdict.BAD)

        response = self.client.post(
            "/manage/feedback/bulk-resolve/",
            data={
                "feedback_ids": [feedback.id],
                "resolution": FeedbackResolution.DEACTIVATE,
                "note": "bulk moderation",
            },
        )
        self.assertEqual(response.status_code, 302)
        feedback.refresh_from_db()
        word.refresh_from_db()
        self.assertTrue(feedback.is_processed)
        self.assertEqual(feedback.resolution, FeedbackResolution.DEACTIVATE)
        self.assertFalse(word.is_active)

    def test_bulk_staging_review_approve(self):
        csv_bytes = b"word,word_type,category,hint\nMarie Curie,guessing,Who,Scientist\n"
        batch = create_batch_from_csv(file_name="bulk.csv", file_bytes=csv_bytes, created_by=self.staff_user)
        staged_word = batch.staged_words.first()

        response = self.client.post(
            "/manage/staging/bulk-review/",
            data={
                "staged_word_ids": [staged_word.id],
                "action": "approve",
                "note": "bulk approve",
            },
        )
        self.assertEqual(response.status_code, 302)
        staged_word.refresh_from_db()
        self.assertEqual(staged_word.status, StagedWordStatus.APPROVED)
        self.assertTrue(
            WordEntry.objects.filter(sanitized_text="Marie Curie", word_type=WordType.GUESSING).exists()
        )

    def test_upload_staging_json_file(self):
        payload = (
            b'[{"word":"Harbour","word_type":"describing","difficulty":"easy"},'
            b'{"word":"Ada Lovelace","word_type":"guessing","category":"Who"}]'
        )
        upload = SimpleUploadedFile("sample.json", payload, content_type="application/json")
        response = self.client.post(
            "/manage/staging/upload/",
            data={"upload_file": upload, "note": "json upload"},
        )
        self.assertEqual(response.status_code, 302)

    def test_manage_actions_routes(self):
        WordEntry.objects.create(text="Balloon", word_type=WordType.DESCRIBING)
        response_validate = self.client.post("/manage/actions/validate/")
        response_dedupe = self.client.post("/manage/actions/dedupe/")
        response_check = self.client.post("/manage/actions/check-deploy/")
        self.assertEqual(response_validate.status_code, 302)
        self.assertEqual(response_dedupe.status_code, 302)
        self.assertEqual(response_check.status_code, 302)

    def test_manage_validation_action_deactivate(self):
        word = WordEntry.objects.create(text="Needle", word_type=WordType.DESCRIBING)
        response = self.client.post(
            "/manage/validation/apply/",
            data={"action": "deactivate", "word_ids": [word.id]},
        )
        self.assertEqual(response.status_code, 302)
        word.refresh_from_db()
        self.assertFalse(word.is_active)

    def test_feedback_swipe_page_renders(self):
        response = self.client.get("/feedback/swipe/")
        self.assertEqual(response.status_code, 200)

    def test_feedback_app_page_renders(self):
        response = self.client.get("/feedback/app/")
        self.assertEqual(response.status_code, 200)

    def test_latest_export_download_route_returns_file(self):
        WordEntry.objects.create(text="Canyon", word_type=WordType.DESCRIBING)
        version, _created = publish_dataset()
        response = self.client.get("/exports/latest.csv")
        self.assertEqual(response.status_code, 200)
        self.assertIn(f"wordlist_v{version.version_number}.csv", response["Content-Disposition"])

    def test_manage_validation_page_renders(self):
        WordEntry.objects.create(text="Twig", word_type=WordType.DESCRIBING)
        response = self.client.get("/manage/validation/")
        self.assertEqual(response.status_code, 200)

    @override_settings(REACT_MANAGE_UI_ENABLED=True, REACT_UI_BASE_URL="http://localhost:5173")
    def test_manage_staging_redirects_to_react_when_enabled(self):
        response = self.client.get("/manage/staging/")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "http://localhost:5173/manage/staging")

    @override_settings(REACT_MANAGE_UI_ENABLED=True, REACT_UI_BASE_URL="http://localhost:5173")
    def test_manage_validation_redirects_to_react_when_enabled(self):
        response = self.client.get("/manage/validation/")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "http://localhost:5173/manage/validation")

    @override_settings(REACT_MANAGE_UI_ENABLED=True, REACT_UI_BASE_URL="http://localhost:5173")
    def test_manage_feedback_redirects_to_react_when_enabled(self):
        response = self.client.get("/manage/feedback/")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "http://localhost:5173/manage/feedback")

    @override_settings(REACT_MANAGE_UI_ENABLED=True, REACT_UI_BASE_URL="http://localhost:5173")
    def test_manage_ai_redirects_to_react_when_enabled(self):
        response = self.client.get("/manage/ai/")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "http://localhost:5173/manage/ai")

    @override_settings(REACT_MANAGE_UI_ENABLED=True, REACT_UI_BASE_URL="http://localhost:5173")
    def test_manage_ingestion_redirects_to_react_when_enabled(self):
        response = self.client.get("/manage/ingestion/")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "http://localhost:5173/manage/ingestion")

    @override_settings(REACT_MANAGE_UI_ENABLED=True, REACT_UI_BASE_URL="http://localhost:5173")
    def test_manage_ingestion_upload_redirects_to_react_when_enabled(self):
        response = self.client.get("/manage/ingestion/upload/")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "http://localhost:5173/manage/ingestion/upload")

    @override_settings(REACT_MANAGE_UI_ENABLED=True, REACT_UI_BASE_URL="http://localhost:5173")
    def test_manage_ingestion_generate_redirects_to_react_when_enabled(self):
        response = self.client.get("/manage/ingestion/generate/")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "http://localhost:5173/manage/ingestion/generate")

    @override_settings(REACT_MANAGE_UI_ENABLED=True, REACT_UI_BASE_URL="http://localhost:5173")
    def test_manage_ingestion_batches_redirects_to_react_when_enabled(self):
        response = self.client.get("/manage/ingestion/batches/")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "http://localhost:5173/manage/ingestion/batches")

    @override_settings(REACT_MANAGE_UI_ENABLED=True, REACT_UI_BASE_URL="http://localhost:5173")
    def test_manage_qa_redirects_to_react_when_enabled(self):
        response = self.client.get("/manage/qa/")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "http://localhost:5173/manage/qa")

    @override_settings(REACT_MANAGE_UI_ENABLED=True, REACT_UI_BASE_URL="http://localhost:5173")
    def test_manage_jobs_redirects_to_react_when_enabled(self):
        response = self.client.get("/manage/jobs/")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "http://localhost:5173/manage/jobs")

    @override_settings(REACT_MANAGE_UI_ENABLED=True, REACT_UI_BASE_URL="http://localhost:5173")
    def test_manage_settings_redirects_to_react_when_enabled(self):
        response = self.client.get("/manage/settings/")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "http://localhost:5173/manage/settings")

    @override_settings(REACT_UI_ENABLED=True, REACT_UI_BASE_URL="http://localhost:5173")
    def test_home_redirects_to_react_host_when_enabled(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "http://localhost:5173/")

    @override_settings(REACT_UI_ENABLED=True, REACT_UI_BASE_URL="http://localhost:5173")
    def test_feedback_redirects_to_react_host_when_enabled(self):
        response = self.client.get("/feedback/")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "http://localhost:5173/feedback")

    @override_settings(REACT_UI_ENABLED=True, REACT_UI_BASE_URL="http://localhost:5173")
    def test_feedback_app_redirects_to_react_host_when_enabled(self):
        response = self.client.get("/feedback/app/")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "http://localhost:5173/feedback/app")
