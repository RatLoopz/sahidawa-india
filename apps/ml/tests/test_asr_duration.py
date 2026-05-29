import io
import os
import sys
import wave

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from routers import asr as asr_router


def make_silent_wav(duration_seconds: float, sample_rate: int = 8000) -> bytes:
    buffer = io.BytesIO()
    frame_count = int(duration_seconds * sample_rate)
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(b"\x00\x00" * frame_count)
    return buffer.getvalue()


def test_wav_duration_reader_uses_in_memory_metadata():
    duration = asr_router.get_wav_duration_seconds_from_bytes(make_silent_wav(1.5))

    assert duration == pytest.approx(1.5)


def test_duration_guard_allows_sixty_second_wav():
    duration = asr_router.ensure_wav_duration_within_limit(make_silent_wav(60))

    assert duration == pytest.approx(60.0)


def test_duration_guard_rejects_over_limit_wav():
    with pytest.raises(HTTPException) as exc:
        asr_router.ensure_wav_duration_within_limit(make_silent_wav(60.25))

    assert exc.value.status_code == 400
    assert exc.value.detail == "Uploaded audio must be 60 seconds or shorter."


def test_upload_validation_rejects_over_limit_wav_before_model_load(monkeypatch):
    model_loaded = False

    def fail_if_model_loads():
        nonlocal model_loaded
        model_loaded = True
        raise AssertionError("model should not load for over-limit WAV")

    monkeypatch.setattr(asr_router, "get_model", fail_if_model_loads)

    with pytest.raises(HTTPException) as exc:
        asr_router.transcribe_uploaded_bytes(
            make_silent_wav(61),
            original_name="long.wav",
            content_type="audio/wav",
            language=None,
        )

    assert exc.value.status_code == 400
    assert model_loaded is False


def test_upload_validation_rejects_invalid_wav_before_ffmpeg(monkeypatch):
    ffmpeg_called = False

    def fail_if_ffmpeg_runs(*_args, **_kwargs):
        nonlocal ffmpeg_called
        ffmpeg_called = True
        raise AssertionError("ffmpeg should not run for invalid WAV")

    monkeypatch.setattr(asr_router.subprocess, "run", fail_if_ffmpeg_runs)

    with pytest.raises(HTTPException) as exc:
        asr_router.transcribe_uploaded_bytes(
            b"not a wav",
            original_name="broken.wav",
            content_type="audio/wav",
            language=None,
        )

    assert exc.value.status_code == 400
    assert ffmpeg_called is False
