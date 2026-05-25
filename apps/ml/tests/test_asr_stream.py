import asyncio
import json
import os
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from main import app
from routers import asr as asr_router

client = TestClient(app)


def test_stream_returns_partial_and_final_events(monkeypatch):
    responses = iter(
        [
            {
                "transcription": "I have fever",
                "language": "en",
                "language_probability": 0.72,
            },
            {
                "transcription": "I have fever and cough",
                "language": "en",
                "language_probability": 0.91,
            },
        ]
    )

    monkeypatch.setattr(
        asr_router,
        "transcribe_uploaded_bytes",
        lambda *args, **kwargs: next(responses),
        raising=False,
    )

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
