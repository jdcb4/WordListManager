from django.contrib.auth import get_user_model
from django.test import TestCase

from words.models import FeedbackResolution, FeedbackVerdict, StagedWordStatus, WordEntry, WordFeedback, WordType
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
