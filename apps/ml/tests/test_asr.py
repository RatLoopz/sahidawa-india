import pytest
import io
import wave
import numpy as np
from fastapi.testclient import TestClient
import sys
import os
from types import SimpleNamespace

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from main import app
from routers import asr as asr_router

client = TestClient(app)

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_silent_wav(duration_seconds: int = 2, sample_rate: int = 16000) -> bytes:
    """Creates a valid PCM WAV file with silence for unit-level testing."""
    buffer = io.BytesIO()
    samples = np.zeros(int(sample_rate * duration_seconds), dtype=np.int16)
    with wave.open(buffer, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)   # 16-bit PCM
        wf.setframerate(sample_rate)
        wf.writeframes(samples.tobytes())
    return buffer.getvalue()


def make_minimal_mp3() -> bytes:
    """
    Returns a minimal valid MP3 frame (ID3 + single MPEG frame header).
    Enough for FFmpeg to recognise the container and not throw a decode error.
    """
    # ID3v2 header (10 bytes) + one valid MPEG1 Layer3 silence frame (128 bytes)
    id3_header = b"ID3\x03\x00\x00\x00\x00\x00\x00"
    # Sync word 0xFFE0 | Layer3 | 128kbps | 44100Hz | stereo
    mp3_frame = bytes([0xFF, 0xFB, 0x90, 0x00]) + b"\x00" * 413
    return id3_header + mp3_frame


def make_minimal_ogg() -> bytes:
    """Returns a minimal OGG container header (capture pattern only)."""
    return b"OggS" + b"\x00" * 23


# ── 1. Router registration ─────────────────────────────────────────────────────

def test_asr_router_registered():
    """Confirms /asr/transcribe is reachable (not 404)."""
    response = client.post(
        "/asr/transcribe",
        files={"file": ("test.wav", make_silent_wav(), "audio/wav")},
    )
    assert response.status_code != 404, "/asr/transcribe route not registered in main.py"


# ── 2. Response shape ─────────────────────────────────────────────────────────

def test_response_has_required_fields():
    """All four response fields must be present on a successful request."""
    response = client.post(
        "/asr/transcribe",
        files={"file": ("test.wav", make_silent_wav(), "audio/wav")},
    )
    assert response.status_code == 200
    data = response.json()
    assert "transcription" in data,         "Missing field: transcription"
    assert "language" in data,              "Missing field: language"
    assert "language_probability" in data,  "Missing field: language_probability"
    assert "filename" in data,              "Missing field: filename"


def test_transcription_is_string():
    response = client.post(
        "/asr/transcribe",
        files={"file": ("test.wav", make_silent_wav(), "audio/wav")},
    )
    assert isinstance(response.json()["transcription"], str)


def test_language_probability_in_range():
    response = client.post(
        "/asr/transcribe",
        files={"file": ("test.wav", make_silent_wav(), "audio/wav")},
    )
    prob = response.json()["language_probability"]
    assert 0.0 <= prob <= 1.0, f"language_probability out of range: {prob}"


def test_filename_echoed_back():
    response = client.post(
        "/asr/transcribe",
        files={"file": ("my_audio.wav", make_silent_wav(), "audio/wav")},
    )
    assert response.json()["filename"] == "my_audio.wav"


# ── 3. Input validation ───────────────────────────────────────────────────────

def test_rejects_text_file():
    """Non-audio MIME types must return 400."""
    response = client.post(
        "/asr/transcribe",
        files={"file": ("notes.txt", io.BytesIO(b"not audio"), "text/plain")},
    )
    assert response.status_code == 400


def test_rejects_image_file():
    """Image MIME types must return 400."""
    response = client.post(
        "/asr/transcribe",
        files={"file": ("photo.jpg", io.BytesIO(b"\xff\xd8\xff"), "image/jpeg")},
    )
    assert response.status_code == 400


def test_missing_file_returns_422():
    """FastAPI must return 422 when required 'file' field is absent."""
    response = client.post("/asr/transcribe")
    assert response.status_code == 422


def test_language_hint_is_passed_to_whisper(monkeypatch):
    captured = {}

    class FakeModel:
        def transcribe(self, audio, **kwargs):
            captured["language"] = kwargs.get("language")
            return [SimpleNamespace(text="வணக்கம்")], SimpleNamespace(
                language="ta",
                language_probability=0.97,
            )

    monkeypatch.setattr(asr_router, "get_model", lambda: FakeModel())
    monkeypatch.setattr(
        asr_router.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(returncode=0, stderr=b""),
    )
    monkeypatch.setattr(
        asr_router.sf,
        "read",
        lambda *args, **kwargs: (np.zeros(16000, dtype=np.float32), 16000),
    )
    monkeypatch.setattr(asr_router.nr, "reduce_noise", lambda y, sr: y)

    response = client.post(
        "/asr/transcribe",
        files={"file": ("test.wav", make_silent_wav(), "audio/wav")},
        data={"language": "ta-IN"},
    )

    assert response.status_code == 200
    assert captured["language"] == "ta"


# ── 4. Accepted MIME types — content-type validation only (NOT 400) ───────────
# These tests verify that the content-type guard allows the format through.
# FFmpeg handles actual decoding so we submit a WAV payload — the critical
# assertion is that the router does NOT reject the MIME type with 400.

@pytest.mark.parametrize("content_type", [
    "audio/wav",
    "audio/x-wav",
    "audio/mpeg",    # MP3
    "audio/ogg",     # OGG / Opus
    "audio/webm",    # Browser MediaRecorder default
    "audio/mp4",     # M4A / AAC
    "audio/flac",
])
def test_accepted_audio_mime_types_not_rejected(content_type):
    """
    MIME validation check: all declared audio types must pass the content-type
    guard (not return 400). FFmpeg downstream handles codec differences.
    """
    response = client.post(
        "/asr/transcribe",
        files={"file": ("audio.wav", make_silent_wav(), content_type)},
    )
    assert response.status_code != 400, \
        f"Content type '{content_type}' was incorrectly rejected at MIME validation"


# ── 5. Health check ───────────────────────────────────────────────────────────

def test_health_endpoint():
    """Service must report healthy with ASR router loaded."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


# ── 6. Real language audio fixtures ──────────────────────────────────────────
# These tests are skipped automatically if fixture files are missing.
# Run locally after downloading real audio samples.

@pytest.mark.skipif(
    not os.path.exists(os.path.join(FIXTURES_DIR, "hindi_sample.wav")),
    reason="Hindi fixture not found",
)
def test_hindi_language_detection():
    """Real Hindi audio must be detected as 'hi' or 'ur' (Whisper limitation)."""
    with open(os.path.join(FIXTURES_DIR, "hindi_sample.wav"), "rb") as f:
        response = client.post(
            "/asr/transcribe",
            files={"file": ("hindi_sample.wav", f, "audio/wav")},
        )
    assert response.status_code == 200
    assert response.json()["language"] in ["hi", "ur"], \
        f"Expected hi or ur, got: {response.json()['language']}"


@pytest.mark.skipif(
    not os.path.exists(os.path.join(FIXTURES_DIR, "tamil_sample.wav")),
    reason="Tamil fixture not found",
)
def test_tamil_language_detection():
    """Real Tamil audio must be detected as 'ta'."""
    with open(os.path.join(FIXTURES_DIR, "tamil_sample.wav"), "rb") as f:
        response = client.post(
            "/asr/transcribe",
            files={"file": ("tamil_sample.wav", f, "audio/wav")},
        )
    assert response.status_code == 200
    assert response.json()["language"] == "ta"


@pytest.mark.skipif(
    not os.path.exists(os.path.join(FIXTURES_DIR, "bengali_sample.wav")),
    reason="Bengali fixture not found",
)
def test_bengali_language_detection():
    """Real Bengali audio must be detected as 'bn'."""
    with open(os.path.join(FIXTURES_DIR, "bengali_sample.wav"), "rb") as f:
        response = client.post(
            "/asr/transcribe",
            files={"file": ("bengali_sample.wav", f, "audio/wav")},
        )
    assert response.status_code == 200
    assert response.json()["language"] == "bn"
