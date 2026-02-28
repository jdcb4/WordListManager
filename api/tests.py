from django.urls import reverse
from rest_framework.test import APITestCase

from words.models import DatasetVersion, WordEntry, WordType
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

# Create your tests here.
