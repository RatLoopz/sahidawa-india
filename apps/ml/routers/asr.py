from fastapi import APIRouter, UploadFile, File, HTTPException
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

router = APIRouter(prefix="/asr", tags=["ASR"])

# Load model once at startup — avoids per-request cold start latency (~3-5s)
logger.info("Loading Whisper model...")
model = WhisperModel("medium", device="cpu", compute_type="int8")
logger.info("Whisper model loaded ✅")

ALLOWED_TYPES = {
    "audio/wav",
    "audio/x-wav",
    "audio/mpeg",       # MP3
    "audio/ogg",        # OGG / Opus
    "audio/mp4",        # M4A / MP4
    "audio/webm",       # WebM (browser MediaRecorder default)
    "audio/flac",
}


@router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
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
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio format '{file.content_type}'. "
                   f"Accepted: {', '.join(sorted(ALLOWED_TYPES))}"
        )

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
        # (no translation). beam_size=8 improves accuracy for regional languages.
        transcription_started_at = start_timer()
        memory_before_mb = get_memory_usage_mb()
        segments, info = model.transcribe(
            reduced_audio,
            language=None,
            task="transcribe",
            beam_size=8,
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
            f"Transcription complete | lang={info.language} "
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
