import os
import shutil
import sys

import pytest
from fastapi.testclient import TestClient

from main import app


sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

client = TestClient(app)
FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")

# ── 6. Real language audio fixtures ──────────────────────────────────────────
# These tests are skipped automatically if fixture files are missing.
# Run locally after downloading real audio samples.


@pytest.mark.skipif(
    not os.path.exists(os.path.join(FIXTURES_DIR, "hindi_sample.wav"))
    or shutil.which("ffmpeg") is None,
    reason="Hindi fixture not found or ffmpeg not available",
)
def test_hindi_language_detection():
    """Real Hindi audio must be detected as 'hi' or 'ur' (Whisper limitation)."""
    with open(os.path.join(FIXTURES_DIR, "hindi_sample.wav"), "rb") as f:
        response = client.post(
            "/asr/transcribe",
            files={"file": ("hindi_sample.wav", f, "audio/wav")},
            data={"language": "hi-IN"},
        )
    assert response.status_code == 200
    assert response.json()["language"] in ["hi", "ur"], \
        f"Expected hi or ur, got: {response.json()['language']}"
    

@pytest.mark.skipif(
    not os.path.exists(os.path.join(FIXTURES_DIR, "tamil_sample.wav"))
    or shutil.which("ffmpeg") is None,
    reason="Tamil fixture not found or ffmpeg not available",
)
def test_tamil_language_detection():
    """Real Tamil audio must be detected as 'ta'."""
    with open(os.path.join(FIXTURES_DIR, "tamil_sample.wav"), "rb") as f:
        response = client.post(
            "/asr/transcribe",
            files={"file": ("tamil_sample.wav", f, "audio/wav")},
            data={"language": "ta-IN"},
        )
    print(response.json())   
    assert response.status_code == 200
    assert response.json()["language"] == "ta", \
        f"Expected ta, got: {response.json()['language']}"


@pytest.mark.skipif(
    not os.path.exists(os.path.join(FIXTURES_DIR, "bengali_sample.wav"))
    or shutil.which("ffmpeg") is None,
    reason="Bengali fixture not found or ffmpeg not available",
)
def test_bengali_language_detection():
    """Real Bengali audio must be detected as 'bn'."""
    with open(os.path.join(FIXTURES_DIR, "bengali_sample.wav"), "rb") as f:
        response = client.post(
            "/asr/transcribe",
            files={"file": ("bengali_sample.wav", f, "audio/wav")},
            data={"language": "bn-IN"},
        )
    assert response.status_code == 200
    assert response.json()["language"] == "bn", \
        f"Expected bn, got: {response.json()['language']}"
    

@pytest.mark.skipif(
    not os.path.exists(os.path.join(FIXTURES_DIR, "telugu_sample.wav"))
    or shutil.which("ffmpeg") is None,
    reason="Telugu fixture not found or ffmpeg not available",
)
def test_telugu_language_detection():
    """Real Telugu audio must be detected as 'te'."""
    with open(os.path.join(FIXTURES_DIR, "telugu_sample.wav"), "rb") as f:
        response = client.post(
            "/asr/transcribe",
            files={"file": ("telugu_sample.wav", f, "audio/wav")},
            data={"language": "te-IN"},
        )
    assert response.status_code == 200
    assert response.json()["language"] == "te", \
        f"Expected bn, got: {response.json()['language']}"

