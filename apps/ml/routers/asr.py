from contextlib import asynccontextmanager
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
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
    # ── 1. Validate content type ──────────────────────────────────────────────
    normalized_content_type = normalize_content_type(file.content_type)
    if normalized_content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio format '{file.content_type}'. "
                   f"Accepted: {', '.join(sorted(ALLOWED_TYPES))}"
        )

    requested_language = normalize_requested_language(language)
    tmp_path: str | None = None
    normalized_path: str | None = None
    transcription_started_at: float | None = None
    audio_duration_seconds = 0.0
    memory_before_mb = 0.0

    try:
        # ── 2. Write raw upload to disk ───────────────────────────────────────
        contents = await file.read()

        # Guard against None filename (some clients omit it)
        original_name = file.filename or "upload"
        suffix = os.path.splitext(original_name)[-1].lower() or ".wav"

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        # ── 3. FFmpeg normalization → 16kHz mono WAV ──────────────────────────
        # soundfile/libsndfile does NOT natively decode MP3, WebM, or MP4
        # containers in standard linux slim Docker images. We always transcode
        # through FFmpeg (already installed in Dockerfile) to a safe WAV stream.
        normalized_path = tmp_path + "_norm.wav"

        ffmpeg_result = subprocess.run(
            [
                "ffmpeg",
                "-y",           # Overwrite output file without prompting
                "-i", tmp_path, # Raw uploaded audio (any format)
                "-ar", "16000", # Resample to 16kHz (Whisper optimal rate)
                "-ac", "1",     # Convert stereo → mono
                "-f", "wav",    # Force WAV container output
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

        # ── 4. Read normalized WAV with soundfile (always safe) ───────────────
        audio_data, sample_rate = sf.read(normalized_path)
        audio_duration_seconds = get_audio_duration_seconds(audio_data, sample_rate)

        # Ensure float32 — required by noisereduce and faster-whisper
        audio_data = audio_data.astype(np.float32)

        # ── 5. Noise reduction ────────────────────────────────────────────────
        # Suppresses background noise and silence artifacts before ASR
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)
            reduced_audio = nr.reduce_noise(y=audio_data, sr=sample_rate)

        # ── 6. Transcribe with faster-whisper ─────────────────────────────────
        # language=None → auto-detect; task="transcribe" preserves native language
        # (no translation). Beam size stays configurable so deployments can tune
        # accuracy vs latency without code changes.
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
        # Re-raise FastAPI exceptions as-is (don't swallow them as 500)
        raise

    except Exception as e:
        logger.error(f"ASR transcription error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to transcribe audio: {str(e)}"
        )

    finally:
        # ── 7. Cleanup both temp files regardless of outcome ──────────────────
        for path in (tmp_path, normalized_path):
            if path and os.path.exists(path):
                try:
                    os.unlink(path)
                except OSError:
                    pass  # Non-fatal if cleanup fails
