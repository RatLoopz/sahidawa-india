from __future__ import annotations  # MUST BE LINE 1

import io
import json
import logging
import os
import subprocess
import tempfile
import threading
import warnings
import wave
from collections.abc import Callable
from contextlib import asynccontextmanager
from json import JSONDecodeError

import noisereduce as nr
import numpy as np
import soundfile as sf
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from faster_whisper import WhisperModel

from services.fuzzy_matcher import get_phonetic_fuzzy_match  # Imported utility service
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
MAX_TRANSCRIPTION_DURATION_SECONDS = 60.0
STREAM_SAMPLE_RATE = 16000
STREAM_WINDOW_SECONDS = 12.0
STREAM_COMMIT_LAG_SECONDS = 1.0
STREAM_TRANSCRIBE_INTERVAL_SECONDS = 0.6
STREAM_MIN_BUFFER_SECONDS = 0.35
STREAM_SPEECH_RMS_THRESHOLD = 0.01
STREAM_DECODER_READ_SIZE = 4096
STREAM_VAD_PARAMETERS = dict(
    min_silence_duration_ms=300,
    speech_pad_ms=400,
    threshold=0.3,
)

WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "small")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
WHISPER_PRELOAD_ON_STARTUP = os.getenv("WHISPER_PRELOAD_ON_STARTUP", "").strip().lower()

# Load model lazily on first request — prevents blocking startup of the FastAPI microservice.
model: WhisperModel | None = None


# ---------------------------------------------------------------------------
# Model loading
# ---------------------------------------------------------------------------

def parse_beam_size(
    raw_value: str | None,
    *,
    default: int = DEFAULT_WHISPER_BEAM_SIZE,
) -> int:
    if raw_value is None:
        return default

    try:
        parsed = int(raw_value)
    except (TypeError, ValueError):
        logger.warning("Invalid WHISPER_BEAM_SIZE=%r; falling back to %s", raw_value, default)
        return default

    if parsed < 1:
        logger.warning("Invalid WHISPER_BEAM_SIZE=%r; falling back to %s", raw_value, default)
        return default

    return parsed


WHISPER_BEAM_SIZE = parse_beam_size(os.getenv("WHISPER_BEAM_SIZE"))


def should_preload_model_on_startup() -> bool:
    return WHISPER_PRELOAD_ON_STARTUP in {"1", "true", "yes", "on"}


def get_model() -> WhisperModel:
    global model
    if model is None:
        logger.info(
            "Loading Whisper model lazily: size=%s device=%s compute_type=%s",
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


def get_medicine_database_list() -> list[str]:
    """
    Utility helper to fetch valid medicine masters from backend DB layers.
    Includes baseline fallback targets for test execution parameters.
    """
    try:
        # TODO: Link to actual database schema or configuration lookup when fully connected to Supabase seeds
        return ["Paracetamol", "Crocin", "Amoxicillin", "Ibuprofen", "Aspirin", "Metformin"]
    except Exception as e:
        logger.warning(f"Failed to query medicine master dataset: {e}")
        return []


@asynccontextmanager
async def asr_router_lifespan(_app):
    preload_model_if_configured()
    yield


router = APIRouter(prefix="/asr", tags=["ASR"], lifespan=asr_router_lifespan)

ALLOWED_TYPES = {
    "audio/wav",
    "audio/x-wav",
    "audio/mpeg",   # MP3
    "audio/ogg",    # OGG / Opus
    "audio/mp4",    # M4A / MP4
    "audio/webm",   # WebM (browser MediaRecorder default)
    "audio/flac",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def normalize_content_type(content_type: str | None) -> str:
    if not content_type:
        return ""
    return content_type.split(";", 1)[0].strip().lower()


def normalize_requested_language(language: str | None) -> str | None:
    if not language:
        return None

    normalized = language.strip().lower()
    if not normalized:
        return None

    primary_code = normalized.split("-")[0]
    if 2 <= len(primary_code) <= 3 and primary_code.isalpha():
        return primary_code

    return None


def get_wav_duration_seconds_from_bytes(contents: bytes) -> float:
    try:
        with wave.open(io.BytesIO(contents), "rb") as wav_file:
            frame_rate = wav_file.getframerate()
            frame_count = wav_file.getnframes()
    except (EOFError, wave.Error) as exc:
        raise HTTPException(
            status_code=400,
            detail="Uploaded WAV audio is invalid or corrupted.",
        ) from exc

    if frame_rate <= 0:
        raise HTTPException(
            status_code=400,
            detail="Uploaded WAV audio has an invalid frame rate.",
        )

    return frame_count / float(frame_rate)


def ensure_wav_duration_within_limit(contents: bytes) -> float:
    duration_seconds = get_wav_duration_seconds_from_bytes(contents)
    if duration_seconds > MAX_TRANSCRIPTION_DURATION_SECONDS:
        raise HTTPException(
            status_code=400,
            detail="Uploaded audio must be 60 seconds or shorter.",
        )
    return duration_seconds


def ensure_audio_duration_within_limit(audio_data, sample_rate: int) -> float:
    duration_seconds = get_audio_duration_seconds(audio_data, sample_rate)
    if duration_seconds > MAX_TRANSCRIPTION_DURATION_SECONDS:
        raise HTTPException(
            status_code=400,
            detail="Uploaded audio must be 60 seconds or shorter.",
        )
    return duration_seconds


def _run_ner(transcript: str) -> dict:
    """Run the NER pipeline and return a partial payload dict."""
    try:
        from services.medicine_ner import extract_medicine_entities, entities_to_dict
        ner_result = extract_medicine_entities(transcript)
        return {
            "entities": entities_to_dict(ner_result)["entities"],
            "primary_medicine": ner_result.primary_medicine,
            "primary_dosage": ner_result.primary_dosage,
        }
    except Exception:
        logger.warning("NER pipeline failed — returning empty entities.")
        return {"entities": [], "primary_medicine": None, "primary_dosage": None}


# ---------------------------------------------------------------------------
# Upload transcription
# ---------------------------------------------------------------------------

def transcribe_uploaded_bytes(
    contents: bytes,
    *,
    original_name: str,
    content_type: str | None,
    language: str | None,
) -> dict:
    normalized_content_type = normalize_content_type(content_type)
    if normalized_content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported audio format '{content_type}'. "
                f"Accepted: {', '.join(sorted(ALLOWED_TYPES))}"
            ),
        )

    if normalized_content_type in {"audio/wav", "audio/x-wav"}:
        ensure_wav_duration_within_limit(contents)

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
) -> dict:
    tmp_path: str | None = None
    normalized_path: str | None = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        normalized_path = tmp_path + "_norm.wav"

        try:
            ffmpeg_result = subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-i", tmp_path,
                    "-ar", "16000",
                    "-ac", "1",
                    "-f", "wav",
                    normalized_path,
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
        except FileNotFoundError:
            logger.error(
                "ffmpeg not found. Install it on the ML host "
                "(e.g. `sudo apt install ffmpeg`) so uploaded audio can be transcoded."
            )
            raise HTTPException(
                status_code=503,
                detail="Voice transcription is temporarily unavailable. Please try again later.",
            )

        if ffmpeg_result.returncode != 0:
            logger.error(
                "FFmpeg transcoding failed:\n%s",
                ffmpeg_result.stderr.decode("utf-8", errors="ignore"),
            )
            raise HTTPException(
                status_code=422,
                detail="Could not process audio file. Ensure it is a valid, non-corrupted audio recording.",
            )

        audio_data, sample_rate = sf.read(normalized_path)
        audio_duration_seconds = ensure_audio_duration_within_limit(audio_data, sample_rate)
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
            vad_parameters=STREAM_VAD_PARAMETERS,
        )

        transcript = " ".join(seg.text for seg in segments).strip()

        log_transcription_finished(
            started_at=transcription_started_at,
            audio_duration_seconds=audio_duration_seconds,
            memory_before_mb=memory_before_mb,
            logger=telemetry_logger,
        )

        logger.info(
            "Transcription complete | requested_lang=%s lang=%s prob=%.2f chars=%d",
            requested_language,
            info.language,
            info.language_probability,
            len(transcript),
        )

        # Apply Stage 1 & Stage 2 Pipeline Match Corrections
        medicine_db = get_medicine_database_list()
        fuzzy_match = get_phonetic_fuzzy_match(transcript, medicine_db)

        corrected_name = transcript
        suggestion_applied = False
        message = None

        if fuzzy_match and fuzzy_match["is_corrected"]:
            corrected_name = fuzzy_match["matched_name"]
            suggestion_applied = True
            message = f"Showing results for {corrected_name} — did you mean this?"

        return {
            "transcription": transcript,
            "corrected_name": corrected_name,
            "suggestion_applied": suggestion_applied,
            "message": message,
            "language": info.language,
            "language_probability": round(info.language_probability, 3),
            "filename": original_name,
            **_run_ner(transcript),
        }

    except HTTPException:
        raise

    except Exception as exc:
        logger.error("ASR transcription error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Oops..! Please try again later.")

    finally:
        for path in (tmp_path, normalized_path):
            if path and os.path.exists(path):
                try:
                    os.unlink(path)
                except OSError:
                    pass


# ---------------------------------------------------------------------------
# Streaming helpers
# ---------------------------------------------------------------------------

def merge_transcript_text(base: str, addition: str) -> str:
    base = base.strip()
    addition = addition.strip()

    if not base:
        return addition
    if not addition:
        return base
    if addition.startswith(base):
        return addition
    if base.endswith(addition):
        return base

    base_words = base.split()
    addition_words = addition.split()
    overlap_limit = min(len(base_words), len(addition_words))

    for size in range(overlap_limit, 0, -1):
        if [w.lower() for w in base_words[-size:]] == [w.lower() for w in addition_words[:size]]:
            return " ".join(base_words + addition_words[size:])

    return f"{base} {addition}".strip()


def has_meaningful_speech(audio: np.ndarray, *, threshold: float) -> bool:
    if audio.size == 0:
        return False
    rms = float(np.sqrt(np.mean(np.square(audio), dtype=np.float64)))
    return rms >= threshold


def pcm16_bytes_to_float32(raw_audio: bytes) -> np.ndarray:
    if not raw_audio:
        return np.array([], dtype=np.float32)
    pcm = np.frombuffer(raw_audio, dtype=np.int16)
    if pcm.size == 0:
        return np.array([], dtype=np.float32)
    return pcm.astype(np.float32) / 32768.0


# ---------------------------------------------------------------------------
# Streaming audio decoder
# ---------------------------------------------------------------------------

class StreamingAudioDecoder:
    def __init__(self, mime_type: str) -> None:
        self.mime_type = mime_type
        self._stdout_buffer = bytearray()
        self._stderr_buffer: list[bytes] = []
        self._stdout_cursor = 0
        self._lock = threading.Lock()
        self._data_event = threading.Event()

        try:
            self._process = subprocess.Popen(
                [
                    "ffmpeg",
                    "-loglevel", "error",
                    "-i", "pipe:0",
                    "-ac", "1",
                    "-ar", str(STREAM_SAMPLE_RATE),
                    "-f", "s16le",
                    "pipe:1",
                ],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                bufsize=0,
            )
        except FileNotFoundError as exc:
            logger.error(
                "ffmpeg not found. Install it on the ML host "
                "(e.g. `sudo apt install ffmpeg`) so streaming audio can be decoded."
            )
            raise HTTPException(
                status_code=503,
                detail="Voice transcription is temporarily unavailable. Please try again later.",
            ) from exc

        self._stdout_thread = threading.Thread(target=self._drain_stdout, daemon=True)
        self._stderr_thread = threading.Thread(target=self._drain_stderr, daemon=True)
        self._stdout_thread.start()
        self._stderr_thread.start()

    # ------------------------------------------------------------------
    # Internal drain threads
    # ------------------------------------------------------------------

    def _drain_stdout(self) -> None:
        assert self._process.stdout is not None
        while True:
            chunk = self._process.stdout.read(STREAM_DECODER_READ_SIZE)
            if not chunk:
                return
            with self._lock:
                self._stdout_buffer.extend(chunk)
                self._data_event.set()

    def _drain_stderr(self) -> None:
        assert self._process.stderr is not None
        while True:
            chunk = self._process.stderr.read(STREAM_DECODER_READ_SIZE)
            if not chunk:
                return
            with self._lock:
                self._stderr_buffer.append(chunk)
                self._stderr_buffer = self._stderr_buffer[-8:]

    def _decoder_error(self) -> HTTPException:
        stderr_output = b"".join(self._stderr_buffer).decode("utf-8", errors="ignore").strip()
        logger.error(
            "Streaming audio decoder failed for mime_type=%s: %s",
            self.mime_type,
            stderr_output or "unknown decoder error",
        )
        return HTTPException(
            status_code=422,
            detail="Could not process streaming audio. Ensure the recording format is supported.",
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def push(self, chunk: bytes) -> None:
        if not chunk:
            return
        if self._process.poll() is not None or self._process.stdin is None:
            raise self._decoder_error()
        try:
            self._process.stdin.write(chunk)
            self._process.stdin.flush()
        except BrokenPipeError as exc:
            raise self._decoder_error() from exc

    def take_audio(self, timeout_seconds: float = 0.0) -> np.ndarray:
        if timeout_seconds > 0:
            self._data_event.wait(timeout_seconds)

        with self._lock:
            if self._stdout_cursor >= len(self._stdout_buffer):
                self._data_event.clear()
                return np.array([], dtype=np.float32)

            raw_audio = bytes(self._stdout_buffer[self._stdout_cursor:])
            self._stdout_cursor = len(self._stdout_buffer)

            if self._stdout_cursor == len(self._stdout_buffer):
                self._data_event.clear()

            if self._stdout_cursor >= STREAM_DECODER_READ_SIZE * 32:
                del self._stdout_buffer[: self._stdout_cursor]
                self._stdout_cursor = 0

        return pcm16_bytes_to_float32(raw_audio)

    def _wait_for_process_exit(self, timeout_seconds: float) -> None:
        try:
            self._process.wait(timeout=timeout_seconds)
            return
        except subprocess.TimeoutExpired:
            self._process.terminate()

        try:
            self._process.wait(timeout=timeout_seconds)
            return
        except subprocess.TimeoutExpired:
            self._process.kill()

        try:
            self._process.wait(timeout=timeout_seconds)
        except subprocess.TimeoutExpired:
            logger.warning(
                "Streaming audio decoder did not exit after kill for mime_type=%s",
                self.mime_type,
            )

    def finish(self, timeout_seconds: float = 0.2) -> np.ndarray:
        if self._process.stdin is not None and not self._process.stdin.closed:
            self._process.stdin.close()
        self._stdout_thread.join(timeout_seconds)
        self._wait_for_process_exit(timeout_seconds)
        return self.take_audio(timeout_seconds)

    def close(self) -> None:
        if self._process.poll() is None:
            self._wait_for_process_exit(0.2)


def create_streaming_audio_decoder(mime_type: str) -> StreamingAudioDecoder:
    return StreamingAudioDecoder(mime_type)


# ---------------------------------------------------------------------------
# Streaming ASR session
# ---------------------------------------------------------------------------

class StreamingAsrSession:
    def __init__(
        self,
        *,
        decoder_factory: Callable[[str], StreamingAudioDecoder] | None = None,
        model_getter: Callable[[], WhisperModel] | None = None,
        window_seconds: float = STREAM_WINDOW_SECONDS,
        commit_lag_seconds: float = STREAM_COMMIT_LAG_SECONDS,
        transcribe_interval_seconds: float = STREAM_TRANSCRIBE_INTERVAL_SECONDS,
        min_buffer_seconds: float = STREAM_MIN_BUFFER_SECONDS,
        speech_rms_threshold: float = STREAM_SPEECH_RMS_THRESHOLD,
    ) -> None:
        self.decoder_factory = decoder_factory or create_streaming_audio_decoder
        self.model_getter = model_getter or get_model
        self.window_seconds = max(window_seconds, 1.0)
        self.commit_lag_seconds = max(commit_lag_seconds, 0.0)
        self.transcribe_interval_seconds = max(transcribe_interval_seconds, 0.0)
        self.min_buffer_seconds = max(min_buffer_seconds, 0.0)
        self.speech_rms_threshold = max(speech_rms_threshold, 0.0)

        self.decoder: StreamingAudioDecoder | None = None
        self.audio_buffer = np.array([], dtype=np.float32)
        self.buffer_start_seconds = 0.0
        self.total_audio_seconds = 0.0
        self.last_inference_audio_seconds = 0.0
        self.pending_speech_since_inference = False
        self.committed_until_seconds = 0.0
        self.committed_transcript = ""
        self.last_partial_transcript = ""
        self.last_language: str | None = None
        self.last_language_confidence: float | None = None

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get_decoder(self, mime_type: str) -> StreamingAudioDecoder:
        if self.decoder is None:
            self.decoder = self.decoder_factory(mime_type)
        return self.decoder

    def _append_audio(self, audio: np.ndarray) -> None:
        if audio.size == 0:
            return
        self.audio_buffer = np.concatenate((self.audio_buffer, audio.astype(np.float32)))
        self.total_audio_seconds += len(audio) / STREAM_SAMPLE_RATE
        if has_meaningful_speech(audio, threshold=self.speech_rms_threshold):
            self.pending_speech_since_inference = True
        self._trim_audio_buffer()

    def _trim_audio_buffer(self) -> None:
        max_window_trim = max(
            0.0,
            self.total_audio_seconds - (self.window_seconds + self.commit_lag_seconds),
        )
        committed_trim = max(0.0, self.committed_until_seconds - self.commit_lag_seconds)
        trim_before_seconds = min(committed_trim, max_window_trim)
        samples_to_trim = int(
            max(0.0, trim_before_seconds - self.buffer_start_seconds) * STREAM_SAMPLE_RATE
        )

        if samples_to_trim <= 0:
            return

        samples_to_trim = min(samples_to_trim, len(self.audio_buffer))
        if samples_to_trim == 0:
            return

        self.audio_buffer = self.audio_buffer[samples_to_trim:]
        self.buffer_start_seconds += samples_to_trim / STREAM_SAMPLE_RATE

    def _build_response(self, transcript: str, *, run_ner: bool = False) -> dict:
        medicine_db = get_medicine_database_list()
        fuzzy_match = get_phonetic_fuzzy_match(transcript, medicine_db)

        corrected_name = transcript
        suggestion_applied = False
        message = None

        if fuzzy_match and fuzzy_match["is_corrected"]:
            corrected_name = fuzzy_match["matched_name"]
            suggestion_applied = True
            message = f"Showing results for {corrected_name} — did you mean this?"

        base: dict = {
            "transcript": transcript,
            "corrected_name": corrected_name,
            "suggestion_applied": suggestion_applied,
            "message": message,
            "language": self.last_language,
            "languageConfidence": self.last_language_confidence,
        }
        if run_ner and transcript:
            base.update(_run_ner(transcript))
        return base


    def _run_transcription(self, *, language: str | None, final: bool) -> dict:
        if self.audio_buffer.size == 0:
            return self._build_response(self.committed_transcript)

        try:
            segments, info = self.model_getter().transcribe(
                self.audio_buffer,
                language=language,
                task="transcribe",
                beam_size=WHISPER_BEAM_SIZE,
                vad_filter=True,
                vad_parameters=STREAM_VAD_PARAMETERS,
            )
            self.last_language = info.language
            self.last_language_confidence = round(info.language_probability, 3)

            analysis_end_seconds = self.buffer_start_seconds + (
                len(self.audio_buffer) / STREAM_SAMPLE_RATE
            )
            stable_cutoff_seconds = (
                float("inf")
                if final
                else max(
                    self.committed_until_seconds,
                    analysis_end_seconds - self.commit_lag_seconds,
                )
            )

            active_transcript = ""
            for segment in segments:
                text = str(segment.text).strip()
                if not text:
                    continue

                segment_start = self.buffer_start_seconds + max(float(segment.start), 0.0)
                segment_end = max(
                    segment_start,
                    self.buffer_start_seconds + max(float(segment.end), 0.0),
                )

                if segment_end <= self.committed_until_seconds + 1e-3:
                    continue

                if segment_end <= stable_cutoff_seconds:
                    self.committed_transcript = merge_transcript_text(
                        self.committed_transcript, text
                    )
                    self.committed_until_seconds = max(
                        self.committed_until_seconds, segment_end
                    )
                else:
                    active_transcript = merge_transcript_text(active_transcript, text)

            full_transcript = merge_transcript_text(
                self.committed_transcript, active_transcript
            )
            self.last_inference_audio_seconds = self.total_audio_seconds
            self.pending_speech_since_inference = False
            self._trim_audio_buffer()
            return self._build_response(full_transcript, run_ner=final)

        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Streaming ASR transcription error: %s", exc, exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to transcribe audio: {exc}",
            ) from exc

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def append_and_maybe_transcribe(
        self,
        chunk: bytes,
        *,
        mime_type: str,
        language: str | None,
    ) -> dict | None:
        decoder = self._get_decoder(mime_type)
        decoder.push(chunk)
        self._append_audio(decoder.take_audio(timeout_seconds=0.05))

        if self.audio_buffer.size == 0:
            return None
        if self.total_audio_seconds < self.min_buffer_seconds:
            return None
        if not self.pending_speech_since_inference:
            return None
        if (
            self.total_audio_seconds - self.last_inference_audio_seconds
            < self.transcribe_interval_seconds
        ):
            return None

        # Partials do not run NER (final=False).
        payload = self._run_transcription(language=language, final=False)
        transcript = str(payload["transcript"]).strip()
        if not transcript or transcript == self.last_partial_transcript:
            return None

        self.last_partial_transcript = transcript
        return payload

    def finalize(self, *, mime_type: str, language: str | None) -> dict:
        if self.decoder is None:
            return {
                "transcript": "",
                "corrected_name": "",
                "suggestion_applied": False,
                "message": None,
                "language": None,
                "languageConfidence": None,
            }

        self._append_audio(self.decoder.finish(timeout_seconds=0.15))
        try:
            return self._run_transcription(language=language, final=True)
        finally:
            self.close()

    def close(self) -> None:
        if self.decoder is None:
            return
        self.decoder.close()
        self.decoder = None


# ---------------------------------------------------------------------------
# HTTP endpoint
# ---------------------------------------------------------------------------

@router.post(
    "/transcribe",
    responses={
        400: {"description": "Invalid audio input, unsupported format, corrupted audio, or duration exceeds limit."},
        422: {"description": "Unable to process the uploaded audio file."},
        503: {"description": "Transcription service temporarily unavailable."},
        500: {"description": "Internal server error during transcription."},
    },
)
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str | None = Form(default=None),
):
    """
    Accept any supported audio file and return transcribed text.

    Supported formats: WAV, MP3, OGG, WebM, MP4, FLAC.

    All formats are normalised to 16 kHz mono WAV via FFmpeg before being
    passed to faster-whisper, ensuring compatibility across all environments
    regardless of libsndfile codec availability.

    Returns transcription text, detected language code, language confidence,
    the echoed filename, and any extracted medicine entities.
    """
    contents = await file.read()
    original_name = file.filename or "upload"
    return transcribe_uploaded_bytes(
        contents,
        original_name=original_name,
        content_type=file.content_type,
        language=language,
    )


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@router.websocket("/stream")
async def stream_transcription(websocket: WebSocket):
    await websocket.accept()
    session: StreamingAsrSession | None = None

    try:
        # ---- handshake ----
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
            await websocket.send_json({"type": "error", "error": "Invalid JSON in start message."})
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
        mime_type: str = payload.get("mimeType") or "audio/webm"
        language: str | None = payload.get("language") or websocket.query_params.get("language")

        await websocket.send_json({"type": "ready"})

        # ---- main loop ----
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

    except HTTPException as exc:
        await websocket.send_json({"type": "error", "error": exc.detail})
        await websocket.close(code=1011)
    except WebSocketDisconnect:
        return
    finally:
        if session is not None:
            session.close()