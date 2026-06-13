from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import pytest

from main import app

client = TestClient(app)

@patch("routers.triage.run_triage_flow")
def test_triage_chat_endpoint_success(mock_run_triage):
    # Mock triage result
    mock_run_triage.return_value = {
        "response": "How long have you had this pain?",
        "emergency": False,
        "language": "English",
        "summary": "Mild headache symptoms",
        "recommendations": ["Rest", "Hydrate"],
        "disclaimer": "Informational only",
        "details": {"onset": "unknown", "severity": "mild"}
    }
    
    payload = {
        "messages": [
            {"role": "user", "content": "I have a headache."}
        ],
        "locale": "en"
    }
    
    response = client.post("/triage/chat", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert data["response"] == "How long have you had this pain?"
    assert data["emergency"] is False
    assert data["language"] == "English"
    assert "onset" in data["details"]
