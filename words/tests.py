import csv
import json

from django.conf import settings
from django.test import TestCase

from words.models import Category, Collection, StagedWordStatus, WordEntry, WordType
from words.services.datasets import publish_dataset
from words.services.pipeline import run_publish_pipeline
from words.services.quality import validate_wordlist
from words.services.normalization import normalized_key, sanitize_text
from words.services.staging import create_batch_from_csv, create_batch_from_json, review_staged_word


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

    def test_publish_writes_latest_exports_with_version_number(self):
        WordEntry.objects.create(text="Cat", word_type=WordType.DESCRIBING)
        version, _created = publish_dataset()

        latest_json = settings.EXPORTS_DIR / "latest.json"
        latest_csv = settings.EXPORTS_DIR / "latest.csv"

        self.assertTrue(latest_json.exists())
        self.assertTrue(latest_csv.exists())

        json_payload = json.loads(latest_json.read_text(encoding="utf-8"))
        self.assertEqual(json_payload[0]["versionNumber"], version.version_number)

        with latest_csv.open("r", encoding="utf-8", newline="") as file_obj:
            rows = list(csv.DictReader(file_obj))
        self.assertEqual(int(rows[0]["versionNumber"]), version.version_number)


class QualityTests(TestCase):
    def test_validate_wordlist_reports_long_text_error(self):
        WordEntry.objects.create(text=("A" * 121), word_type=WordType.DESCRIBING)
        report = validate_wordlist()
        self.assertGreaterEqual(report["error_count"], 1)


class CollectionTests(TestCase):
    def test_word_defaults_to_base_collection(self):
        word = WordEntry.objects.create(text="Helicopter", word_type=WordType.DESCRIBING)
        self.assertIsNotNone(word.collection)
        self.assertEqual(word.collection.name, "Base")
        self.assertTrue(Collection.objects.filter(name="Base").exists())


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

    def test_upload_json_batch(self):
        json_bytes = (
            b'[{"word":"Sydney Harbour Bridge","word_type":"guessing","category":"Where","hint":"Iconic bridge"},'
            b'{"word":"Paintbrush","word_type":"describing"}]'
        )
        batch = create_batch_from_json(file_name="new_words.json", file_bytes=json_bytes)
        self.assertEqual(batch.total_rows, 2)
        self.assertEqual(batch.staged_words.count(), 2)

    def test_approving_second_type_merges_into_existing_word(self):
        existing = WordEntry.objects.create(
            text="Helicopter",
            word_type=WordType.DESCRIBING,
            is_describing=True,
            is_guessing=False,
        )
        csv_bytes = b"word,word_type,category,hint\nHelicopter,guessing,What,Aircraft\n"
        batch = create_batch_from_csv(file_name="add_type.csv", file_bytes=csv_bytes)
        staged = batch.staged_words.first()
        review_staged_word(staged_word=staged, reviewer=None, approve=True, note="merge type")
        self.assertEqual(WordEntry.objects.filter(normalized_text=existing.normalized_text).count(), 1)
        merged = WordEntry.objects.get(id=existing.id)
        self.assertTrue(merged.is_describing)
        self.assertTrue(merged.is_guessing)
        self.assertIsNotNone(merged.category)
        self.assertEqual(merged.category.name, "What")

# Create your tests here.
