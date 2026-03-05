from django.urls import reverse
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from unittest.mock import patch
from rest_framework.test import APITestCase

from words.models import (
    Category,
    DatasetVersion,
    FeedbackResolution,
    FeedbackVerdict,
    StagedWordStatus,
    WordEntry,
    WordFeedback,
    WordType,
)
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

    def test_word_list_q_search_param(self):
        WordEntry.objects.create(text="Alpha Centauri", word_type=WordType.DESCRIBING)
        response = self.client.get("/api/v1/words/?q=alpha")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["word"], "Alpha Centauri")

    def test_feedback_create_endpoint(self):
        word = WordEntry.objects.first()
        response = self.client.post(
            "/api/v1/feedback",
            data={"word": word.id, "verdict": FeedbackVerdict.GOOD, "comment": "solid"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(WordFeedback.objects.count(), 1)

    def test_word_list_multi_filter_supports_csv_values(self):
        who, _ = Category.objects.get_or_create(name="Who")
        WordEntry.objects.create(text="Ada Lovelace", word_type=WordType.GUESSING, category=who, difficulty="easy")
        WordEntry.objects.create(text="Sydney Harbour", word_type=WordType.DESCRIBING, difficulty="medium")
        response = self.client.get("/api/v1/words/?word_type=guessing,describing&difficulty=easy,medium")
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(response.data["count"], 2)


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

    def test_manage_consolidate_endpoint(self):
        response = self.client.post("/api/v1/manage/consolidate", data={}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("post_check", response.data)


class ManageFeedbackApiTests(APITestCase):
    def setUp(self):
        self.staff_user = User.objects.create_user(
            username="admin_feedback_api",
            password="password123",
            is_staff=True,
        )
        self.client.force_authenticate(user=self.staff_user)

    def test_pending_feedback_endpoint(self):
        word = WordEntry.objects.create(text="Banana", word_type=WordType.DESCRIBING)
        WordFeedback.objects.create(word=word, verdict=FeedbackVerdict.BAD, comment="too easy")
        response = self.client.get("/api/v1/manage/feedback/pending")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["pending_bad_count"], 1)
        self.assertEqual(len(response.data["results"]), 1)

    def test_resolve_feedback_endpoint(self):
        word = WordEntry.objects.create(text="Shark", word_type=WordType.DESCRIBING)
        feedback = WordFeedback.objects.create(word=word, verdict=FeedbackVerdict.BAD, comment="too hard")
        response = self.client.post(
            "/api/v1/manage/feedback/resolve",
            data={
                "feedback_ids": [feedback.id],
                "resolution": FeedbackResolution.DEACTIVATE,
                "note": "processed in test",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        feedback.refresh_from_db()
        word.refresh_from_db()
        self.assertTrue(feedback.is_processed)
        self.assertEqual(feedback.resolution, FeedbackResolution.DEACTIVATE)
        self.assertFalse(word.is_active)


class ManageQaCandidatesApiTests(APITestCase):
    def setUp(self):
        self.staff_user = User.objects.create_user(
            username="admin_qa_api",
            password="password123",
            is_staff=True,
        )
        self.client.force_authenticate(user=self.staff_user)

    def test_manage_qa_candidates_includes_missing_hint_and_difficulty(self):
        who, _ = Category.objects.get_or_create(name="Who")
        WordEntry.objects.create(
            text="Ada Lovelace",
            word_type=WordType.GUESSING,
            category=who,
            hint="",
            difficulty="",
        )
        response = self.client.get("/api/v1/manage/qa/candidates?limit=100")
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(response.data["count"], 1)
        row = response.data["results"][0]
        self.assertIn("missing_hint", row["missing_codes"])
        self.assertIn("missing_difficulty", row["missing_codes"])

    @patch("api.views.complete_word_templates")
    def test_manage_ai_complete_ignores_limit_for_selected_word_ids(self, mock_complete):
        mock_complete.return_value = {
            "processed": 3,
            "suggested": 2,
            "batches": 1,
            "batch_id": 10,
            "staged_rows": 2,
        }
        word = WordEntry.objects.create(
            text="Hammer",
            word_type=WordType.DESCRIBING,
            hint="",
            difficulty="",
        )
        response = self.client.post(
            "/api/v1/manage/ai/complete",
            data={"word_ids": [word.id], "limit": 1, "model": "test-model"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(mock_complete.called)
        kwargs = mock_complete.call_args.kwargs
        self.assertEqual(kwargs["word_ids"], [word.id])
        self.assertIsNone(kwargs["limit"])


class ManageValidationApiTests(APITestCase):
    def setUp(self):
        self.staff_user = User.objects.create_user(
            username="admin_validation_api",
            password="password123",
            is_staff=True,
        )
        self.client.force_authenticate(user=self.staff_user)

    def test_acknowledged_warning_is_hidden_on_next_validation(self):
        where, _ = Category.objects.get_or_create(name="Where")
        word = WordEntry.objects.create(
            text="Sydney Harbour",
            word_type=WordType.GUESSING,
            category=where,
            hint="",
        )

        first_report = self.client.get("/api/v1/manage/validate")
        self.assertEqual(first_report.status_code, 200)
        self.assertTrue(
            any(
                issue["code"] == "missing_hint" and issue["word_id"] == word.id
                for issue in first_report.data["issues"]
            )
        )

        ack_response = self.client.post(
            "/api/v1/manage/validation/acknowledge",
            data={"issues": [{"word_id": word.id, "code": "missing_hint"}]},
            format="json",
        )
        self.assertEqual(ack_response.status_code, 200)
        self.assertEqual(ack_response.data["acknowledged"], 1)

        second_report = self.client.get("/api/v1/manage/validate")
        self.assertEqual(second_report.status_code, 200)
        self.assertFalse(
            any(
                issue["code"] == "missing_hint" and issue["word_id"] == word.id
                for issue in second_report.data["issues"]
            )
        )

    def test_duplicate_hint_includes_word_hint_and_duplicate_word_context_when_under_five(self):
        where, _ = Category.objects.get_or_create(name="Where")
        primary = WordEntry.objects.create(
            text="Abu Simbel",
            word_type=WordType.GUESSING,
            category=where,
            hint="Ancient landmark",
        )
        peer_one = WordEntry.objects.create(
            text="Karnak",
            word_type=WordType.GUESSING,
            category=where,
            hint="Ancient landmark",
        )
        peer_two = WordEntry.objects.create(
            text="Adelaide",
            word_type=WordType.GUESSING,
            category=where,
            hint="Ancient landmark",
        )

        report = self.client.get("/api/v1/manage/validate")
        self.assertEqual(report.status_code, 200)
        issue = next(
            (
                row
                for row in report.data["issues"]
                if row["code"] == "duplicate_hint" and row["word_id"] == primary.id
            ),
            None,
        )
        self.assertIsNotNone(issue)
        self.assertEqual(issue["word"]["hint"], "Ancient landmark")
        self.assertEqual(issue["duplicate_hint"]["mode"], "list")
        self.assertEqual(issue["duplicate_hint"]["count"], 2)
        duplicate_rows = issue["duplicate_hint"]["words"]
        self.assertEqual({row["id"] for row in duplicate_rows}, {peer_one.id, peer_two.id})
        self.assertTrue(all(row["hint"] == "Ancient landmark" for row in duplicate_rows))
        self.assertTrue(all(row["category"] == "Where" for row in duplicate_rows))

    def test_duplicate_hint_uses_multiple_mode_when_five_or_more_duplicates(self):
        where, _ = Category.objects.get_or_create(name="Where")
        words = []
        for text in ["Abu Simbel", "Karnak", "Adelaide", "Brisbane", "Canberra", "Darwin"]:
            words.append(
                WordEntry.objects.create(
                    text=text,
                    word_type=WordType.GUESSING,
                    category=where,
                    hint="Shared city hint",
                )
            )

        report = self.client.get("/api/v1/manage/validate")
        self.assertEqual(report.status_code, 200)
        issue = next(
            (
                row
                for row in report.data["issues"]
                if row["code"] == "duplicate_hint" and row["word_id"] == words[0].id
            ),
            None,
        )
        self.assertIsNotNone(issue)
        self.assertEqual(issue["duplicate_hint"]["mode"], "multiple")
        self.assertEqual(issue["duplicate_hint"]["count"], 5)
        self.assertEqual(issue["duplicate_hint"]["words"], [])

# Create your tests here.
