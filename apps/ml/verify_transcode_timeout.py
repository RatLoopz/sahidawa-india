import sys
import subprocess
from unittest.mock import patch

sys.path.insert(0, ".")

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def fake_hanging_run(*args, **kwargs):
    # Simulate ffmpeg hanging past the timeout
    raise subprocess.TimeoutExpired(cmd=args[0], timeout=kwargs.get("timeout", 30))

with patch("routers.asr.subprocess.run", side_effect=fake_hanging_run):
    response = client.post(
        "/api/v1/asr/transcribe",  # adjust path if your actual route differs
        files={"file": ("test.wav", b"\x00" * 1000, "audio/wav")},
    )

print("Status code:", response.status_code)
print("Body:", response.json())

assert response.status_code == 408, f"Expected 408, got {response.status_code}"
print("PASS: timeout returns HTTP 408 as expected")