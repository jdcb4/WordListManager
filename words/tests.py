from django.test import TestCase

from words.models import StagedWordStatus, WordEntry, WordType
from words.services.datasets import publish_dataset
from words.services.pipeline import run_publish_pipeline
from words.services.quality import validate_wordlist
from words.services.normalization import normalized_key, sanitize_text
from words.services.staging import create_batch_from_csv, review_staged_word


class NormalizationTests(TestCase):
    def test_sanitize_text_removes_control_and_collapses_space(self):
        raw = "  Hello\u200b\tWorld \n"
        self.assertEqual(sanitize_text(raw), "Hello World")

    def test_normalized_key_casefolds(self):
        self.assertEqual(normalized_key("CafE"), "cafe")


class PublishDatasetTests(TestCase):
    def test_publish_is_idempotent_without_changes(self):
        WordEntry.objects.create(text="Cat", word_type=WordType.DESCRIBING)
        first, created_first = publish_dataset()
        second, created_second = publish_dataset()

        self.assertTrue(created_first)
        self.assertFalse(created_second)
        self.assertEqual(first.version_number, second.version_number)

    def test_publish_pipeline_blocks_on_validation_errors(self):
        WordEntry.objects.create(text=("A" * 121), word_type=WordType.DESCRIBING)
        report = run_publish_pipeline()
        self.assertTrue(report["blocked_by_validation"])
        self.assertFalse(report["published"])

    def test_publish_pipeline_can_override_validation_errors(self):
        WordEntry.objects.create(text=("A" * 121), word_type=WordType.DESCRIBING)
        report = run_publish_pipeline(allow_validation_errors=True)
        self.assertFalse(report["blocked_by_validation"])
        self.assertTrue(report["published"])


class QualityTests(TestCase):
    def test_validate_wordlist_reports_long_text_error(self):
        WordEntry.objects.create(text=("A" * 121), word_type=WordType.DESCRIBING)
        report = validate_wordlist()
        self.assertGreaterEqual(report["error_count"], 1)


class StagingTests(TestCase):
    def test_upload_and_approve_staged_word(self):
        csv_bytes = b"word,word_type,category,hint\nAlbert Einstein,guessing,Who,Physicist\n"
        batch = create_batch_from_csv(file_name="new_words.csv", file_bytes=csv_bytes)
        staged = batch.staged_words.first()
        self.assertIsNotNone(staged)
        self.assertEqual(batch.total_rows, 1)

        review_staged_word(staged_word=staged, reviewer=None, approve=True, note="ok")
        staged.refresh_from_db()
        self.assertEqual(staged.status, StagedWordStatus.APPROVED)
        self.assertTrue(
            WordEntry.objects.filter(sanitized_text="Albert Einstein", word_type=WordType.GUESSING).exists()
        )

# Create your tests here.
