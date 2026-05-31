"""Locust load test for the local Whisper ASR endpoint.

Run from ``apps/ml``:
    locust -f tests/locustfile.py

Provide the ML service host in the Locust UI or with ``--host`` in headless
mode. The local development service uses port 8000 by default.
"""

from pathlib import Path

from locust import HttpUser, between, task
from locust.exception import StopUser


SAMPLE_WAV_PATH = Path(__file__).resolve().parent / "fixtures" / "hindi_sample.wav"


class ASRTranscriptionUser(HttpUser):
    """Simulates a user uploading a WAV symptom recording for transcription."""

    wait_time = between(1, 3)

    def on_start(self) -> None:
        if not SAMPLE_WAV_PATH.is_file():
            raise StopUser(f"Sample WAV fixture is missing: {SAMPLE_WAV_PATH}")

        self.sample_wav = SAMPLE_WAV_PATH.read_bytes()

    @task
    def transcribe_symptom_recording(self) -> None:
        files = {
            "file": (SAMPLE_WAV_PATH.name, self.sample_wav, "audio/wav"),
        }

        with self.client.post(
            "/asr/transcribe",
            files=files,
            catch_response=True,
            name="/asr/transcribe",
        ) as response:
            if not 200 <= response.status_code < 300:
                body_preview = response.text[:200].replace("\n", " ")
                response.failure(
                    f"ASR transcription failed with HTTP {response.status_code}: "
                    f"{body_preview}"
                )
                return

            if not response.content:
                response.failure("ASR transcription returned an empty response body.")
