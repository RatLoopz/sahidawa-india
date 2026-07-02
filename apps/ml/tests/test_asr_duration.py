import io
import importlib.util
import os
import sys
import types
import wave

import numpy as np
import pytest
from fastapi import HTTPException

sys.modules["noisereduce"] = types.SimpleNamespace(reduce_noise=lambda y, sr: y)

sys.modules["faster_whisper"] = types.SimpleNamespace(WhisperModel=object)

sys.modules["soundfile"] = types.SimpleNamespace(
    read=lambda _path: (_ for _ in ()).throw(RuntimeError("stubbed"))
)

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

if sys.version_info < (3, 10):
    sys.modules["services.telemetry"] = types.SimpleNamespace(
        get_audio_duration_seconds=lambda audio_data, sample_rate: len(audio_data)
        / float(sample_rate),
        get_memory_usage_mb=lambda: 0.0,
        get_telemetry_logger=lambda: None,
        log_transcription_finished=lambda **_kwargs: None,
        start_timer=lambda: 0.0,
    )

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


def test_post_transcode_duration_guard_rejects_over_limit_non_wav(monkeypatch):
    model_loaded = False

    def successful_ffmpeg(*_args, **_kwargs):
        return asr_router.subprocess.CompletedProcess(
            args=["ffmpeg"],
            returncode=0,
            stdout=b"",
            stderr=b"",
        )

    def read_long_normalized_audio(_path):
        sample_rate = 16000
        return np.zeros(sample_rate * 61, dtype=np.float32), sample_rate

    def fail_if_model_loads():
        nonlocal model_loaded
        model_loaded = True
        raise AssertionError("model should not load for over-limit normalized audio")

    monkeypatch.setattr(asr_router.subprocess, "run", successful_ffmpeg)
    monkeypatch.setattr(asr_router.sf, "read", read_long_normalized_audio)
    monkeypatch.setattr(asr_router, "get_model", fail_if_model_loads)

    with pytest.raises(HTTPException) as exc:
        asr_router.transcribe_uploaded_bytes(
            b"fake compressed audio",
            original_name="long.webm",
            content_type="audio/webm",
            language=None,
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == "Uploaded audio must be 60 seconds or shorter."
    assert model_loaded is False

from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

def test_stream_duration_guard_rejects_over_limit_audio(monkeypatch):
    from main import app
    client = TestClient(app)

    class FakeStreamingSession:
        def __init__(self):
            self.total_audio_seconds = 0.0

        def append_and_maybe_transcribe(self, chunk, *, mime_type, language):
            self.total_audio_seconds += 61.0
            return None

        def finalize(self, *, mime_type, language):
            return {
                "transcript": "Partial text",
                "corrected_name": "",
                "suggestion_applied": False,
                "message": None,
                "language": "en",
                "languageConfidence": 0.99,
            }

        def close(self):
            pass

    monkeypatch.setattr(asr_router, "StreamingAsrSession", FakeStreamingSession)

    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect("/asr/stream") as websocket:
            websocket.send_text('{"type": "start", "mimeType": "audio/webm"}')
            assert websocket.receive_json() == {"type": "ready"}

            websocket.send_bytes(b"dummy audio data")

            response = websocket.receive_json()
            assert response["type"] == "error"
            assert "exceeded maximum duration" in response["error"]
            
            websocket.receive_json()
    
    assert exc.value.code == 1009
