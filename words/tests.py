from django.test import TestCase

from words.models import WordEntry, WordType
from words.services.datasets import publish_dataset
from words.services.normalization import normalized_key, sanitize_text


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

# Create your tests here.
