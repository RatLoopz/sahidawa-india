import asyncio
import json
import os
import sys
from types import SimpleNamespace

import numpy as np

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from main import app
from routers import asr as asr_router

client = TestClient(app)


class FakeDecoder:
    def __init__(self, audio_batches):
        self.audio_batches = list(audio_batches)
        self.closed = False
        self.pushed_chunks = []

    def push(self, chunk: bytes):
        self.pushed_chunks.append(chunk)

    def take_audio(self, timeout_seconds: float = 0.0):
        if self.audio_batches:
            return self.audio_batches.pop(0)
        return np.array([], dtype=np.float32)

    def finish(self, timeout_seconds: float = 0.0):
        return self.take_audio(timeout_seconds)

    def close(self):
        self.closed = True


class FakeModel:
    def __init__(self, responses):
        self.calls = []
        self.responses = list(responses)

    def transcribe(self, audio, **kwargs):
        self.calls.append(np.array(audio, copy=True))
        segments, info = self.responses.pop(0)
        return segments, info


def test_stream_returns_partial_and_final_events(monkeypatch):
    class FakeStreamingSession:
        def __init__(self):
            self.chunk_count = 0

        def append_and_maybe_transcribe(self, chunk, *, mime_type, language):
            self.chunk_count += 1
            if self.chunk_count < 2:
                return None
            return {
                "transcript": "I have fever",
                "language": "en",
                "languageConfidence": 0.72,
            }

        def finalize(self, *, mime_type, language):
            return {
                "transcript": "I have fever and cough",
                "language": "en",
                "languageConfidence": 0.91,
            }

        def close(self):
            return None

    monkeypatch.setattr(asr_router, "StreamingAsrSession", FakeStreamingSession)

    with client.websocket_connect("/asr/stream?language=en-IN") as websocket:
        websocket.send_text(json.dumps({"type": "start", "mimeType": "audio/webm"}))

        assert websocket.receive_json() == {"type": "ready"}

        websocket.send_bytes(b"chunk-1")
        websocket.send_bytes(b"chunk-2")

        partial = websocket.receive_json()
        assert partial["type"] == "partial"
        assert partial["transcript"] == "I have fever"

        websocket.send_text(json.dumps({"type": "stop"}))

        final = websocket.receive_json()
        assert final["type"] == "final"
        assert final["transcript"] == "I have fever and cough"


def test_stream_rejects_missing_start_message():
    with client.websocket_connect("/asr/stream") as websocket:
        websocket.send_bytes(b"chunk-before-start")

        payload = websocket.receive_json()
        assert payload["type"] == "error"
        assert "start" in payload["error"].lower()


def test_stream_returns_empty_final_when_stopped_before_audio():
    with client.websocket_connect("/asr/stream?language=en-IN") as websocket:
        websocket.send_text(json.dumps({"type": "start", "mimeType": "audio/webm"}))

        assert websocket.receive_json() == {"type": "ready"}

        websocket.send_text(json.dumps({"type": "stop"}))

        final = websocket.receive_json()
        assert final == {
            "type": "final",
            "transcript": "",
            "language": None,
            "languageConfidence": None,
        }


def test_stream_rejects_invalid_json_start_message():
    with client.websocket_connect("/asr/stream") as websocket:
        websocket.send_text("{not-json")

        payload = websocket.receive_json()
        assert payload["type"] == "error"
        assert "json" in payload["error"].lower()


def test_stream_rejects_non_object_start_payload():
    with client.websocket_connect("/asr/stream") as websocket:
        websocket.send_text('["start"]')

        payload = websocket.receive_json()
        assert payload["type"] == "error"
        assert "json object" in payload["error"].lower()


def test_stream_returns_cleanly_on_disconnect_message():
    class FakeWebSocket:
        def __init__(self):
            self.query_params = {}
            self.sent_payloads = []
            self.messages = [
                {"text": json.dumps({"type": "start", "mimeType": "audio/webm"})},
                {"type": "websocket.disconnect", "code": 1000},
            ]

        async def accept(self):
            return None

        async def receive(self):
            if not self.messages:
                raise AssertionError("stream_transcription read past the disconnect frame")
            return self.messages.pop(0)

        async def send_json(self, payload):
            self.sent_payloads.append(payload)

        async def close(self, code=None):
            raise AssertionError(f"stream_transcription should not close on disconnect: {code}")

    websocket = FakeWebSocket()

    asyncio.run(asr_router.stream_transcription(websocket))

    assert websocket.sent_payloads == [{"type": "ready"}]


def test_stream_returns_error_event_when_transcription_crashes(monkeypatch):
    class BrokenModel:
        def transcribe(self, audio, **kwargs):
            raise RuntimeError("decoder backend exploded")

    monkeypatch.setattr(
        asr_router,
        "create_streaming_audio_decoder",
        lambda mime_type: FakeDecoder([np.ones(16000, dtype=np.float32) * 0.2]),
    )
    monkeypatch.setattr(asr_router, "get_model", lambda: BrokenModel())

    with client.websocket_connect("/asr/stream?language=en-IN") as websocket:
        websocket.send_text(json.dumps({"type": "start", "mimeType": "audio/webm"}))

        assert websocket.receive_json() == {"type": "ready"}

        websocket.send_bytes(b"chunk-1")

        payload = websocket.receive_json()
        assert payload["type"] == "error"
        assert "failed to transcribe audio" in payload["error"].lower()


def test_streaming_session_skips_silent_audio():
    decoder = FakeDecoder([np.zeros(16000, dtype=np.float32)])
    model = FakeModel([])

    session = asr_router.StreamingAsrSession(
        decoder_factory=lambda mime_type: decoder,
        model_getter=lambda: model,
        transcribe_interval_seconds=0.0,
    )

    result = session.append_and_maybe_transcribe(
        b"silent",
        mime_type="audio/webm",
        language="en",
    )

    assert result is None
    assert model.calls == []


def test_streaming_session_transcribes_bounded_audio_window():
    decoder = FakeDecoder(
        [
            np.ones(16000, dtype=np.float32) * 0.2,
            np.ones(16000, dtype=np.float32) * 0.2,
            np.ones(16000, dtype=np.float32) * 0.2,
            np.ones(16000, dtype=np.float32) * 0.2,
        ]
    )
    model = FakeModel(
        [
            (
                [SimpleNamespace(start=0.0, end=0.4, text="alpha")],
                SimpleNamespace(language="en", language_probability=0.6),
            ),
            (
                [SimpleNamespace(start=0.6, end=1.0, text="beta")],
                SimpleNamespace(language="en", language_probability=0.7),
            ),
            (
                [SimpleNamespace(start=1.4, end=1.8, text="gamma")],
                SimpleNamespace(language="en", language_probability=0.8),
            ),
            (
                [SimpleNamespace(start=1.8, end=2.2, text="delta")],
                SimpleNamespace(language="en", language_probability=0.9),
            ),
        ]
    )

    session = asr_router.StreamingAsrSession(
        decoder_factory=lambda mime_type: decoder,
        model_getter=lambda: model,
        window_seconds=2.0,
        commit_lag_seconds=0.5,
        transcribe_interval_seconds=0.0,
        min_buffer_seconds=0.0,
        speech_rms_threshold=0.01,
    )

    for index in range(4):
        session.append_and_maybe_transcribe(
            f"chunk-{index}".encode(),
            mime_type="audio/webm",
            language="en",
        )

    observed_durations = [len(audio) / asr_router.STREAM_SAMPLE_RATE for audio in model.calls]

    assert len(model.calls) == 4
    assert observed_durations[-1] < 4.0
    assert max(observed_durations) <= 2.8


def test_streaming_session_final_transcript_merges_overlap():
    decoder = FakeDecoder(
        [
            np.ones(16000, dtype=np.float32) * 0.2,
            np.ones(16000, dtype=np.float32) * 0.2,
        ]
    )
    model = FakeModel(
        [
            (
                [SimpleNamespace(start=0.0, end=0.4, text="I have fever")],
                SimpleNamespace(language="en", language_probability=0.7),
            ),
            (
                [SimpleNamespace(start=0.3, end=1.0, text="fever and cough")],
                SimpleNamespace(language="en", language_probability=0.9),
            ),
        ]
    )

    session = asr_router.StreamingAsrSession(
        decoder_factory=lambda mime_type: decoder,
        model_getter=lambda: model,
        transcribe_interval_seconds=0.0,
        commit_lag_seconds=0.0,
        min_buffer_seconds=0.0,
        speech_rms_threshold=0.01,
    )

    partial = session.append_and_maybe_transcribe(
        b"chunk-1",
        mime_type="audio/webm",
        language="en",
    )
    final = session.finalize(mime_type="audio/webm", language="en")

    assert partial["transcript"] == "I have fever"
    assert final["transcript"] == "I have fever and cough"


def test_streaming_decoder_finish_kills_stuck_process():
    class FakeStdIn:
        def __init__(self):
            self.closed = False

        def close(self):
            self.closed = True

    class FakeThread:
        def __init__(self):
            self.join_calls = []

        def join(self, timeout):
            self.join_calls.append(timeout)

    class FakeProcess:
        def __init__(self):
            self.stdin = FakeStdIn()
            self.wait_calls = []
            self.terminate_calls = 0
            self.kill_calls = 0

        def wait(self, timeout):
            self.wait_calls.append(timeout)
            if len(self.wait_calls) < 3:
                raise asr_router.subprocess.TimeoutExpired("ffmpeg", timeout)
            return 0

        def terminate(self):
            self.terminate_calls += 1

        def kill(self):
            self.kill_calls += 1

    decoder = asr_router.StreamingAudioDecoder.__new__(asr_router.StreamingAudioDecoder)
    decoder._process = FakeProcess()
    decoder._stdout_thread = FakeThread()
    decoder.take_audio = lambda timeout_seconds: np.array([], dtype=np.float32)

    result = decoder.finish(timeout_seconds=0.1)

    assert result.size == 0
    assert decoder._process.stdin.closed is True
    assert decoder._process.terminate_calls == 1
    assert decoder._process.kill_calls == 1
