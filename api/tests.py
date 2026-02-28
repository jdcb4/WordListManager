from django.urls import reverse
from rest_framework.test import APITestCase

from words.models import DatasetVersion, FeedbackVerdict, WordEntry, WordFeedback, WordType
from words.services.datasets import publish_dataset


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

# Create your tests here.
