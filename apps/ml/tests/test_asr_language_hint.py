import io
import os
import sys
from types import SimpleNamespace

import numpy as np
from fastapi.testclient import TestClient
from starlette.routing import _DefaultLifespan

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from main import app
from routers import asr


client = TestClient(app)


class DummyTranscriber:
    def __init__(self):
        self.calls = []

    def transcribe(self, audio, **kwargs):
        self.calls.append(kwargs)
        return [SimpleNamespace(text="test transcript")], SimpleNamespace(
            language="ta",
            language_probability=0.93,
        )


def setup_successful_audio_pipeline(monkeypatch):
    dummy_transcriber = DummyTranscriber()

    monkeypatch.setattr(asr, "get_model", lambda: dummy_transcriber)
    monkeypatch.setattr(
        asr.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(returncode=0, stderr=b""),
    )
    monkeypatch.setattr(
        asr.sf,
        "read",
        lambda *args, **kwargs: (np.zeros(16000, dtype=np.float32), 16000),
    )
    monkeypatch.setattr(asr.nr, "reduce_noise", lambda y, sr: y)

    return dummy_transcriber


def test_language_hint_is_normalized_and_passed_to_whisper(monkeypatch):
    dummy_transcriber = setup_successful_audio_pipeline(monkeypatch)

    response = client.post(
        "/asr/transcribe",
        files={"file": ("voice.wav", io.BytesIO(b"fake-audio"), "audio/wav")},
        data={"language": "ta-IN"},
    )

    assert response.status_code == 200
    assert dummy_transcriber.calls[0]["language"] == "ta"


def test_missing_language_hint_keeps_auto_detection(monkeypatch):
    dummy_transcriber = setup_successful_audio_pipeline(monkeypatch)

    response = client.post(
        "/asr/transcribe",
        files={"file": ("voice.wav", io.BytesIO(b"fake-audio"), "audio/wav")},
    )

    assert response.status_code == 200
    assert dummy_transcriber.calls[0]["language"] is None


def test_get_model_uses_environment_driven_settings(monkeypatch):
    captured = {}

    def fake_whisper_model(model_size, device, compute_type):
        captured["model_size"] = model_size
        captured["device"] = device
        captured["compute_type"] = compute_type
        return object()

    monkeypatch.setattr(asr, "WhisperModel", fake_whisper_model)
    monkeypatch.setattr(asr, "WHISPER_MODEL_SIZE", "tiny")
    monkeypatch.setattr(asr, "WHISPER_DEVICE", "cpu")
    monkeypatch.setattr(asr, "WHISPER_COMPUTE_TYPE", "int8")
    monkeypatch.setattr(asr, "model", None)

    model = asr.get_model()

    assert model is not None
    assert captured == {
        "model_size": "tiny",
        "device": "cpu",
        "compute_type": "int8",
    }


def test_preload_model_if_configured_calls_get_model(monkeypatch):
    calls = []

    monkeypatch.setattr(asr, "WHISPER_PRELOAD_ON_STARTUP", "true")
    monkeypatch.setattr(asr, "get_model", lambda: calls.append("loaded") or object())

    asr.preload_model_if_configured()

    assert calls == ["loaded"]


def test_preload_model_if_configured_skips_when_disabled(monkeypatch):
    calls = []

    monkeypatch.setattr(asr, "WHISPER_PRELOAD_ON_STARTUP", "false")
    monkeypatch.setattr(asr, "get_model", lambda: calls.append("loaded") or object())

    asr.preload_model_if_configured()

    assert calls == []


def test_normalize_content_type_strips_codec_parameters():
    assert asr.normalize_content_type("audio/webm;codecs=opus") == "audio/webm"
    assert asr.normalize_content_type("audio/mp4; codecs=mp4a.40.2") == "audio/mp4"
    assert asr.normalize_content_type(None) == ""


def test_parse_beam_size_falls_back_when_env_value_is_invalid(caplog):
    with caplog.at_level("WARNING"):
        beam_size = asr.parse_beam_size("fast")

    assert beam_size == 5
    assert "WHISPER_BEAM_SIZE" in caplog.text


def test_router_uses_lifespan_instead_of_legacy_startup_hooks():
    assert asr.router.on_startup == []
    assert not isinstance(asr.router.lifespan_context, _DefaultLifespan)
