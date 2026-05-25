import json
from json import JSONDecodeError
from contextlib import asynccontextmanager
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect
import noisereduce as nr
import numpy as np
import tempfile
import warnings
import subprocess
import soundfile as sf
import logging
import os

from faster_whisper import WhisperModel
from services.telemetry import (
    get_audio_duration_seconds,
    get_memory_usage_mb,
    get_telemetry_logger,
    log_transcription_finished,
    start_timer,
)

logger = logging.getLogger(__name__)
telemetry_logger = get_telemetry_logger()
DEFAULT_WHISPER_BEAM_SIZE = 5

# Load model lazily on first request — prevents blocking startup of FastAPI microservice
model = None
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "small")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
WHISPER_PRELOAD_ON_STARTUP = os.getenv("WHISPER_PRELOAD_ON_STARTUP", "").strip().lower()


def parse_beam_size(
    raw_value: str | None,
    *,
    default: int = DEFAULT_WHISPER_BEAM_SIZE,
) -> int:
    if raw_value is None:
        return default

    try:
        parsed_value = int(raw_value)
    except (TypeError, ValueError):
        logger.warning(
            "Invalid WHISPER_BEAM_SIZE=%r; falling back to %s",
            raw_value,
            default,
        )
        return default

    if parsed_value < 1:
        logger.warning(
            "Invalid WHISPER_BEAM_SIZE=%r; falling back to %s",
            raw_value,
            default,
        )
        return default

    return parsed_value


WHISPER_BEAM_SIZE = parse_beam_size(os.getenv("WHISPER_BEAM_SIZE"))


def should_preload_model_on_startup() -> bool:
    return WHISPER_PRELOAD_ON_STARTUP in {"1", "true", "yes", "on"}

def get_model():
    global model
    if model is None:
        logger.info(
            "Loading Whisper model lazily with size=%s device=%s compute_type=%s",
            WHISPER_MODEL_SIZE,
            WHISPER_DEVICE,
            WHISPER_COMPUTE_TYPE,
        )
        model = WhisperModel(
            WHISPER_MODEL_SIZE,
            device=WHISPER_DEVICE,
            compute_type=WHISPER_COMPUTE_TYPE,
        )
        logger.info("Whisper model loaded ✅")
    return model


def preload_model_if_configured() -> None:
    if should_preload_model_on_startup():
        logger.info("Preloading Whisper model during startup...")
        get_model()


@asynccontextmanager
async def asr_router_lifespan(_app):
    preload_model_if_configured()
    yield


router = APIRouter(prefix="/asr", tags=["ASR"], lifespan=asr_router_lifespan)

ALLOWED_TYPES = {
    "audio/wav",
    "audio/x-wav",
    "audio/mpeg",       # MP3
    "audio/ogg",        # OGG / Opus
    "audio/mp4",        # M4A / MP4
    "audio/webm",       # WebM (browser MediaRecorder default)
    "audio/flac",
}


def normalize_content_type(content_type: str | None) -> str:
    if not content_type:
        return ""

    return content_type.split(";", 1)[0].strip().lower()


def normalize_requested_language(language: str | None) -> str | None:
    if language is None:
        return None

    normalized = language.strip().lower()
    if not normalized:
        return None

    primary_code = normalized.split("-")[0]
    if 2 <= len(primary_code) <= 3 and primary_code.isalpha():
        return primary_code

    return None


def transcribe_uploaded_bytes(
    contents: bytes,
    *,
    original_name: str,
    content_type: str | None,
    language: str | None,
):
    normalized_content_type = normalize_content_type(content_type)
    if normalized_content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio format '{content_type}'. "
                   f"Accepted: {', '.join(sorted(ALLOWED_TYPES))}"
        )

    requested_language = normalize_requested_language(language)
    suffix = os.path.splitext(original_name)[-1].lower() or ".wav"

    return _transcribe_audio_bytes(
        contents,
        original_name=original_name,
        suffix=suffix,
        requested_language=requested_language,
    )


def _transcribe_audio_bytes(
    contents: bytes,
    *,
    original_name: str,
    suffix: str,
    requested_language: str | None,
):
    tmp_path: str | None = None
    normalized_path: str | None = None
    transcription_started_at: float | None = None
    audio_duration_seconds = 0.0
    memory_before_mb = 0.0

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        normalized_path = tmp_path + "_norm.wav"

        ffmpeg_result = subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i", tmp_path,
                "-ar", "16000",
                "-ac", "1",
                "-f", "wav",
                normalized_path,
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        if ffmpeg_result.returncode != 0:
            ffmpeg_stderr = ffmpeg_result.stderr.decode("utf-8", errors="ignore")
            logger.error(f"FFmpeg transcoding failed:\n{ffmpeg_stderr}")
            raise HTTPException(
                status_code=422,
                detail="Could not process audio file. Ensure it is a valid, non-corrupted audio recording."
            )

        audio_data, sample_rate = sf.read(normalized_path)
        audio_duration_seconds = get_audio_duration_seconds(audio_data, sample_rate)
        audio_data = audio_data.astype(np.float32)

        with warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)
            reduced_audio = nr.reduce_noise(y=audio_data, sr=sample_rate)

        transcription_started_at = start_timer()
        memory_before_mb = get_memory_usage_mb()
        segments, info = get_model().transcribe(
            reduced_audio,
            language=requested_language,
            task="transcribe",
            beam_size=WHISPER_BEAM_SIZE,
            vad_filter=True,
            vad_parameters=dict(
                min_silence_duration_ms=300,
                speech_pad_ms=400,
                threshold=0.3,
            ),
        )

        transcript = " ".join(seg.text for seg in segments).strip()
        log_transcription_finished(
            started_at=transcription_started_at,
            audio_duration_seconds=audio_duration_seconds,
            memory_before_mb=memory_before_mb,
            logger=telemetry_logger,
        )

        logger.info(
            f"Transcription complete | requested_lang={requested_language} "
            f"lang={info.language} "
            f"prob={info.language_probability:.2f} | chars={len(transcript)}"
        )

        return {
            "transcription": transcript,
            "language": info.language,
            "language_probability": round(info.language_probability, 3),
            "filename": original_name,
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"ASR transcription error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to transcribe audio: {str(e)}"
        )

    finally:
        for path in (tmp_path, normalized_path):
            if path and os.path.exists(path):
                try:
                    os.unlink(path)
                except OSError:
                    pass


class StreamingAsrSession:
    def __init__(self) -> None:
        self.chunks: list[bytes] = []
        self.last_transcript = ""

    def append_and_maybe_transcribe(
        self,
        chunk: bytes,
        *,
        mime_type: str,
        language: str | None,
    ):
        self.chunks.append(chunk)
        if len(self.chunks) < 2:
            return None

        payload = transcribe_uploaded_bytes(
            b"".join(self.chunks),
            original_name="stream.webm",
            content_type=mime_type,
            language=language,
        )
        transcript = str(payload["transcription"]).strip()
        if not transcript or transcript == self.last_transcript:
            return None

        self.last_transcript = transcript
        return {
            "transcript": transcript,
            "language": payload["language"],
            "languageConfidence": payload["language_probability"],
        }

    def finalize(self, *, mime_type: str, language: str | None):
        if not self.chunks:
            return {
                "transcript": "",
                "language": None,
                "languageConfidence": None,
            }

        payload = transcribe_uploaded_bytes(
            b"".join(self.chunks),
            original_name="stream.webm",
            content_type=mime_type,
            language=language,
        )
        return {
            "transcript": str(payload["transcription"]).strip(),
            "language": payload["language"],
            "languageConfidence": payload["language_probability"],
        }


@router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...), language: str | None = Form(default=None)):
    """
    Accepts any supported audio file upload and returns transcribed text.

    Supports: WAV, MP3, OGG, WebM, MP4, FLAC
    Returns: transcription text, detected language code, language confidence,
             and echoed filename.

    Internally normalizes all formats to 16kHz mono WAV via FFmpeg before
    passing to faster-whisper — ensures compatibility across all container
    environments regardless of libsndfile codec availability.
    """
    contents = await file.read()
    original_name = file.filename or "upload"
    return transcribe_uploaded_bytes(
        contents,
        original_name=original_name,
        content_type=file.content_type,
        language=language,
    )


@router.websocket("/stream")
async def stream_transcription(websocket: WebSocket):
    await websocket.accept()

    try:
        start_message = await websocket.receive()
        if "text" not in start_message or not start_message["text"]:
            await websocket.send_json(
                {"type": "error", "error": "Expected start message before audio chunks."}
            )
            await websocket.close(code=1003)
            return

        try:
            payload = json.loads(start_message["text"])
        except JSONDecodeError:
            await websocket.send_json(
                {"type": "error", "error": "Invalid JSON in start message."}
            )
            await websocket.close(code=1003)
            return

        if not isinstance(payload, dict):
            await websocket.send_json(
                {"type": "error", "error": "Start message must be a JSON object."}
            )
            await websocket.close(code=1003)
            return

        if payload.get("type") != "start":
            await websocket.send_json(
                {"type": "error", "error": "Expected start message before audio chunks."}
            )
            await websocket.close(code=1003)
            return

        session = StreamingAsrSession()
        mime_type = payload.get("mimeType") or "audio/webm"
        language = payload.get("language")
        if not language:
            language = websocket.query_params.get("language")

        await websocket.send_json({"type": "ready"})

        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                return

            if message.get("bytes"):
                partial = session.append_and_maybe_transcribe(
                    message["bytes"],
                    mime_type=mime_type,
                    language=language,
                )
                if partial:
                    await websocket.send_json({"type": "partial", **partial})
                continue

            if message.get("text"):
                try:
                    text_payload = json.loads(message["text"])
                except JSONDecodeError:
                    await websocket.send_json(
                        {"type": "error", "error": "Invalid JSON in control message."}
                    )
                    await websocket.close(code=1003)
                    return

                if not isinstance(text_payload, dict):
                    await websocket.send_json(
                        {"type": "error", "error": "Control message must be a JSON object."}
                    )
                    await websocket.close(code=1003)
                    return

                if text_payload.get("type") == "stop":
                    final = session.finalize(mime_type=mime_type, language=language)
                    await websocket.send_json({"type": "final", **final})
                    await websocket.close()
                    return
    except HTTPException as error:
        await websocket.send_json({"type": "error", "error": error.detail})
        await websocket.close(code=1011)
    except WebSocketDisconnect:
        return
