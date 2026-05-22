from fastapi.testclient import TestClient
from unittest.mock import MagicMock
import sys
import os

# Mock faster_whisper before importing app
sys.modules["faster_whisper"] = MagicMock()

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app

client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {
        "message": "Welcome to SahiDawa ML API"
    }


def test_health_endpoint():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "healthy"
    }


def test_transcribe_missing_file():
    response = client.post("/asr/transcribe")

    assert response.status_code == 422