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


def test_models_current_endpoint():
    response = client.get("/models/current")

    assert response.status_code == 200
    data = response.json()
    
    # Assert top-level keys exist
    for key in ["asr", "tts", "ner", "embedding", "triage", "tflite_models"]:
        assert key in data
        
    # Assert ASR details
    asr_data = data["asr"]
    assert "model_size" in asr_data
    assert "device" in asr_data
    assert "compute_type" in asr_data
    assert "loaded" in asr_data
    assert isinstance(asr_data["loaded"], bool)
    
    # Assert NER details
    ner_data = data["ner"]
    assert "model_name" in ner_data
    assert "loaded" in ner_data
    assert isinstance(ner_data["loaded"], bool)

    # Assert embedding details
    embedding_data = data["embedding"]
    assert embedding_data["model_name"] == "gemini-embedding-2"
    assert embedding_data["dimensions"] == 768

    # Assert TFLite models
    assert isinstance(data["tflite_models"], list)
    assert len(data["tflite_models"]) > 0
    tflite_model = data["tflite_models"][0]
    assert tflite_model["filename"] == "mobilenetv3_large_int8.tflite"
    assert tflite_model["exists"] is True


def test_transcribe_missing_file():
    response = client.post("/asr/transcribe")

    assert response.status_code == 422