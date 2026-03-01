from django.urls import reverse
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase

from words.models import Category, DatasetVersion, FeedbackVerdict, StagedWordStatus, WordEntry, WordFeedback, WordType
from words.services.datasets import publish_dataset
from words.services.staging import create_batch_from_csv

User = get_user_model()


class ApiSmokeTests(APITestCase):
    def setUp(self):
        WordEntry.objects.create(text="Cat", word_type=WordType.DESCRIBING)
        publish_dataset()

    def test_manifest_endpoint(self):
        response = self.client.get(reverse("manifest"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["version_number"], DatasetVersion.latest().version_number)

    def test_word_list_endpoint(self):
        response = self.client.get("/api/v1/words/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)

    def test_feedback_create_endpoint(self):
        word = WordEntry.objects.first()
        response = self.client.post(
            "/api/v1/feedback",
            data={"word": word.id, "verdict": FeedbackVerdict.GOOD, "comment": "solid"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(WordFeedback.objects.count(), 1)


class ManageStagingApiTests(APITestCase):
    def setUp(self):
        self.staff_user = User.objects.create_user(
            username="admin_api",
            password="password123",
            is_staff=True,
        )
        self.client.force_authenticate(user=self.staff_user)

    def test_manage_staging_list_includes_field_diff_preview(self):
        who, _ = Category.objects.get_or_create(name="Who")
        WordEntry.objects.create(text="Albert Einstein", word_type=WordType.GUESSING, category=who, hint="")
        csv_bytes = (
            b"word,word_type,category,hint,difficulty,collection\n"
            b"Albert Einstein,guessing,Who,Scientist,easy,Base\n"
        )
        create_batch_from_csv(file_name="stage.csv", file_bytes=csv_bytes, created_by=self.staff_user)
        response = self.client.get("/api/v1/manage/staging?status=pending")
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data["results"]), 1)
        row = response.data["results"][0]
        self.assertEqual(row["preview"]["action"], "update")
        self.assertIn("hint", row["preview"]["changed_fields"])
        self.assertTrue(any(field["field"] == "hint" for field in row["preview"]["fields"]))

    def test_manage_staging_bulk_review_approve(self):
        csv_bytes = b"word,word_type,category\nMarie Curie,guessing,Who\n"
        batch = create_batch_from_csv(file_name="review.csv", file_bytes=csv_bytes, created_by=self.staff_user)
        staged_word = batch.staged_words.first()
        response = self.client.post(
            "/api/v1/manage/staging/review",
            data={"action": "approve", "staged_word_ids": [staged_word.id]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        staged_word.refresh_from_db()
        self.assertEqual(staged_word.status, StagedWordStatus.APPROVED)
        self.assertTrue(
            WordEntry.objects.filter(sanitized_text="Marie Curie", word_type=WordType.GUESSING).exists()
        )

    def test_manage_staging_upload(self):
        upload = SimpleUploadedFile(
            "sample_upload.json",
            b'[{"word":"Harbour","word_type":"describing","difficulty":"easy"}]',
            content_type="application/json",
        )
        response = self.client.post(
            "/api/v1/manage/staging/upload",
            data={"file": upload, "note": "api upload"},
            format="multipart",
        )
        self.assertEqual(response.status_code, 201)
        self.assertIn("batch_id", response.data)

# Create your tests here.
