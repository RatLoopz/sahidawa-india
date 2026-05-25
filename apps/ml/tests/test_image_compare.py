import sys
from pathlib import Path
import socket
import unittest
from unittest.mock import patch

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

    def test_rejects_private_resolved_hosts(self):
        with patch(
            "src.image_compare.socket.getaddrinfo",
            return_value=[(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 0))],
        ):
            with self.assertRaises(ValueError):
                validate_cloudinary_url(
                    "https://res.cloudinary.com/demo/image/upload/v123456789/sample.jpg"
                )


if __name__ == "__main__":
    unittest.main()
