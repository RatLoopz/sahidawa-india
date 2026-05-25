import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.image_compare import validate_cloudinary_url


class ValidateCloudinaryUrlTests(unittest.TestCase):
    def test_allows_cloudinary_urls(self):
        validate_cloudinary_url(
            "https://res.cloudinary.com/demo/image/upload/v123456789/sample.jpg"
        )

    def test_rejects_non_cloudinary_urls(self):
        with self.assertRaises(ValueError):
            validate_cloudinary_url("https://example.com/image.jpg")

    def test_rejects_localhost_urls(self):
        with self.assertRaises(ValueError):
            validate_cloudinary_url("https://localhost:8000/image.jpg")

    def test_rejects_non_https_urls(self):
        with self.assertRaises(ValueError):
            validate_cloudinary_url("http://res.cloudinary.com/demo/image.jpg")


if __name__ == "__main__":
    unittest.main()
