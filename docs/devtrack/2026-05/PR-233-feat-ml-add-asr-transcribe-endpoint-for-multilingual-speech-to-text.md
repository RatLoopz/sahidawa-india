# PR #233 — feat(ml): add /asr/transcribe endpoint for multilingual speech-to-text

> **Merged:** 2026-05-18 | **Author:** @parinaB | **Area:** ML/AI | **Impact Score:** 64 | **Closes:** #201

## What Changed

This pull request introduces a new `/asr/transcribe` endpoint to our existing `apps/ml` FastAPI service, enabling multilingual speech-to-text transcription. Users can now upload audio files containing spoken symptoms in various Indian languages and receive the transcribed text, along with the detected language and a confidence score. This feature significantly enhances accessibility by removing the English typing barrier for our rural users.

## The Problem Being Solved

Before this change, SahiDawa lacked a mechanism for users to input information via voice, particularly in their native Indian languages. This presented a significant barrier for rural users who may not be proficient in English typing or prefer to communicate in their local dialect. The absence of a speech-to-text capability meant that our platform was less accessible to a large segment of our target demographic, hindering our mission to provide inclusive health verification and services. This PR directly addresses this by integrating a robust, multilingual ASR system.

## Files Modified

- `apps/ml/Dockerfile`
- `apps/ml/main.py`
- `apps/ml/requirements.txt`
- `apps/ml/routers/asr.py`
- `apps/ml/tests/fixtures/bengali_sample.wav`
- `apps/ml/tests/fixtures/hindi_sample.wav`
- `apps/ml/tests/fixtures/tamil_sample.wav`
- `apps/ml/tests/test_asr.py`

## Implementation Details

The core of this feature is implemented within the new `apps/ml/routers/asr.py` file, which defines an `APIRouter` with the prefix `/asr` and tag "ASR".

1.  **Dependencies**: We added `faster-whisper`, `soundfile`, `noisereduce`, and `numpy` to `apps/ml/requirements.txt`.
2.  **Docker Environment**: The `apps/ml/Dockerfile` was updated to include `ffmpeg` and `libsndfile1` via `apt-get`. `ffmpeg` is crucial for `faster-whisper` to process various audio formats beyond WAV, while `libsndfile1` is required by `soundfile` on Linux systems. The `apt-get` commands were also consolidated into a single layer for Docker best practices.
3.  **Model Loading**: The `faster_whisper.WhisperModel` is initialized globally at import time within `apps/ml/routers/asr.py` as `model = WhisperModel("medium", device="cpu", compute_type="int8")`. This ensures the model is loaded only once when the FastAPI application starts, preventing per-request cold start latency.
4.  **Endpoint Definition**: A `POST` endpoint, `/asr/transcribe`, is defined, accepting an `UploadFile` named `file`.
5.  **Input Validation**:
    *   The `file.content_type` is validated against a list of `allowed_types` including `audio/wav`, `audio/x-wav`, `audio/mpeg`, `audio/ogg`, `audio/mp4`, `audio/webm`, and `audio/flac`. If an unsupported type is uploaded, an `HTTPException` with status code `400` is raised.
    *   FastAPI's default validation handles missing `file` fields, returning a `422` status code.
6.  **Audio Processing Flow**:
    *   The uploaded audio `contents` are read asynchronously using `await file.read()`.
    *   A temporary file is created using `tempfile.NamedTemporaryFile` with the appropriate suffix extracted from `file.filename`. The audio contents are written to this temporary file.
    *   `soundfile.read(tmp_path)` is used to load the audio data into a NumPy array (`audio_data`) and retrieve its `sample_rate`.
    *   If the audio is stereo (`audio_data.ndim > 1`), it is converted to mono by taking the mean across channels (`audio_data.mean(axis=1)`).
    *   The audio data is cast to `np.float32` as required by `faster-whisper`.
    *   Noise reduction is applied using `noisereduce.reduce_noise(y=audio_data, sr=sample_rate)`. This step helps improve transcription accuracy by filtering out background noise.
    *   The `model.transcribe()` method is called with the `reduced_audio`. Key parameters include:
        *   `language=None`: Allows the model to auto-detect the language.
        *   `task="transcribe"`: Ensures the output is in the detected native language, not translated to English.
        *   `beam_size=8`: A common setting for improved accuracy.
        *   `vad_filter=True` with `vad_parameters` (`min_silence_duration_ms=300`, `speech_pad_ms=400`, `threshold=0.3`): This Voice Activity Detection filter helps segment the audio, ignoring long pauses and silence, which is crucial for cleaner transcriptions.
7.  **Response Generation**:
    *   The transcribed segments are joined into a single `transcript` string.
    *   A JSON response is returned containing:
        *   `transcription`: The full transcribed text.
        *   `language`: The detected language code (e.g., "hi", "ta", "bn").
        *   `language_probability`: The model's confidence in the detected language, rounded to three decimal places.
        *   `filename`: The original filename of the uploaded audio, echoed back.
8.  **Error Handling & Cleanup**:
    *   A `try...except` block catches general exceptions during transcription, logging them with `logger.error` and raising an `HTTPException` with status code `500`.
    *   A `finally` block ensures that the temporary audio file created is always unlinked (`os.unlink(tmp_path)`), preventing disk space accumulation.
9.  **Router Inclusion**: The new `asr.router` is included in `apps/ml/main.py` using `app.include_router(asr.router)`, making the endpoint accessible.

## Technical Decisions

1.  **Choice of ASR Library (`faster-whisper`)**: We opted for `faster-whisper` over the original OpenAI Whisper implementation due to its superior performance and efficiency. `faster-whisper` uses CTranslate2, a fast inference engine, which provides significant speedups and reduced memory usage, especially critical for a production ML service running on potentially constrained resources.
2.  **Model Size (`medium`)**: The "medium" Whisper model was chosen after evaluating its balance between accuracy and computational cost. While "small" is faster, "medium" offers significantly better accuracy for diverse Indian regional languages, which is paramount for a health platform where precision in symptom description is vital. Larger models like "large" were deemed too resource-intensive for our current CPU-based deployment strategy without a proportional gain in *semantic* accuracy for our specific use case.
3.  **Compute Type (`int8`)**: We specified `compute_type="int8"` for the `WhisperModel`. This enables 8-bit integer quantization, which drastically reduces memory footprint and speeds up inference on CPU devices without a significant drop in transcription quality. This is a crucial optimization for cost-effective deployment.
4.  **Voice Activity Detection (VAD)**: Implementing `vad_filter=True` with custom `vad_parameters` was a deliberate choice to improve transcription quality. VAD helps the model focus only on spoken segments, effectively filtering out long silences, pauses, and background noise. This prevents the model from hallucinating text in silent parts and provides cleaner, more concise transcripts, which is particularly useful in real-world audio recordings from varied environments.
5.  **Noise Reduction Pre-processing**: The `noisereduce` library was integrated to perform an initial pass of noise reduction on the audio. This pre-processing step further enhances the audio quality before it reaches the Whisper model, leading to more accurate transcriptions, especially for recordings that might contain ambient noise common in rural settings.
6.  **Global Model Loading**: Loading the `WhisperModel` once globally at the module level (`apps/ml/routers/asr.py`) was a critical decision to avoid "cold start" latency. If the model were loaded per request, each API call would incur the overhead of loading the multi-gigabyte model into memory, making the endpoint unusable for real-time applications.
7.  **Transcription Task (`task="transcribe"`)**: We explicitly set `task="transcribe"` instead of `task="translate"`. This ensures that the output is the spoken text in its original detected language (e.g., Hindi output for Hindi input), rather than an English translation. For a health assistant, understanding the exact words spoken in the native language is often more important than an immediate translation, allowing for further processing or display in the user's preferred language.
8.  **Pattern Consistency**: The implementation closely follows the existing `apps/ml/routers/ocr.py` pattern for FastAPI router setup, `UploadFile` handling, content-type validation, and error logging. This promotes code consistency, reduces cognitive load for contributors, and ensures a unified approach across our ML service endpoints.
9.  **Dockerfile Optimization**: Merging `apt-get` commands into a single `RUN` layer in the `Dockerfile` is a standard Docker best practice. It reduces the number of image layers, leading to smaller image sizes and faster build times, which benefits our CI/CD pipeline.

## How To Re-Implement (Contributor Reference)

To re-implement the ASR transcription feature from scratch, a contributor would follow these steps:

1.  **Set up FastAPI Application**:
    *   Ensure a FastAPI application (`app`) is initialized in `apps/ml/main.py`.
    *   Create a new Python file, e.g., `apps/ml/routers/asr.py`, for the ASR router.
2.  **Install Dependencies**:
    *   Add the following to `apps/ml/requirements.txt`:
        ```
        faster-whisper>=1.1.0
        soundfile>=0.12.1
        noisereduce>=3.0.0
        numpy>=1.26.0
        ```
    *   Run `pip install -r apps/ml/requirements.txt`.
3.  **Update Dockerfile**:
    *   Modify `apps/ml/Dockerfile` to include system-level dependencies:
        ```dockerfile
        RUN apt-get update && apt-get install -y \
            tesseract-ocr \
            libtesseract-dev \
            ffmpeg \
            libsndfile1 \
            && rm -rf /var/lib/apt/lists/*
        ```
    *   This ensures `ffmpeg` (for `faster-whisper` audio processing) and `libsndfile1` (for `soundfile`) are available in the container.
4.  **Initialize ASR Router (`apps/ml/routers/asr.py`)**:
    *   Import necessary modules: `APIRouter`, `UploadFile`, `File`, `HTTPException`, `noisereduce`, `numpy`, `tempfile`, `warnings`, `soundfile`, `logging`, `os`, `WhisperModel`.
    *   Set up logging: `logger = logging.getLogger(__name__)`.
    *   Define the router: `router = APIRouter(prefix="/asr", tags=["ASR"])`.
    *   **Global Model Loading**: Load the `WhisperModel` once at the module level to avoid re-loading on each request:
        ```python
        logger.info("Loading Whisper model...")
        model = WhisperModel("medium", device="cpu", compute_type="int8")
        logger.info("Whisper model loaded ✅")
        ```
5.  **Define Transcription Endpoint**:
    *   Create the `POST /transcribe` endpoint function:
        ```python
        @router.post("/transcribe")
        async def transcribe_audio(file: UploadFile = File(...)):
            allowed_types = [
                "audio/wav", "audio/x-wav", "audio/mpeg",
                "audio/ogg", "audio/mp4", "audio/webm", "audio/flac"
            ]
            if file.content_type not in allowed_types:
                raise HTTPException(status_code=400, detail="File uploaded is not a supported audio format.")

            tmp_path = None # Initialize to None for finally block
            try:
                contents = await file.read()
                suffix = os.path.splitext(file.filename)[-1] or ".wav"
                with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                    tmp.write(contents)
                    tmp_path = tmp.name

                audio_data, sample_rate = sf.read(tmp_path)

                if audio_data.ndim > 1:
                    audio_data = audio_data.mean(axis=1)
                audio_data = audio_data.astype(np.float32)

                with warnings.catch_warnings():
                    warnings.simplefilter("ignore", RuntimeWarning)
                    reduced_audio = nr.reduce_noise(y=audio_data, sr=sample_rate)

                segments, info = model.transcribe(
                    reduced_audio,
                    language=None,
                    task="transcribe",
                    beam_size=8,
                    vad_filter=True,
                    vad_parameters=dict(
                        min_silence_duration_ms=300,
                        speech_pad_ms=400,
                        threshold=0.3
                    )
                )

                transcript = " ".join(seg.text for seg in segments).strip()
                logger.info(f"Transcription complete. Detected language: {info.language}, length: {len(transcript)}")

                return {
                    "transcription": transcript,
                    "language": info.language,
                    "language_probability": round(info.language_probability, 3),
                    "filename": file.filename
                }

            except Exception as e:
                logger.error(f"ASR error: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Failed to transcribe audio: {str(e)}")
            finally:
                if tmp_path and os.path.exists(tmp_path):
                    os.unlink(tmp_path)
        ```
6.  **Include Router in Main App**:
    *   In `apps/ml/main.py`, import and include the new router:
        ```python
        from routers import ocr, asr
        app.include_router(ocr.router)
        app.include_router(asr.router)
        ```
7.  **Testing**:
    *   Create `apps/ml/tests/test_asr.py`.
    *   Use `fastapi.testclient.TestClient` to send requests.
    *   Implement tests for router registration, response structure, input validation (valid/invalid MIME types, missing file), and language detection with sample audio files.
    *   Consider creating helper functions like `make_silent_wav` for generating synthetic audio for basic tests.
    *   Add actual audio fixture files (e.g., `bengali_sample.wav`, `hindi_sample.wav`, `tamil_sample.wav`) to `apps/ml/tests/fixtures/` for language-specific tests.

## Impact on System Architecture

This change significantly expands the capabilities of our `apps/ml` service, transforming it from primarily an OCR (Optical Character Recognition) engine into a multimodal AI service that now also handles ASR (Automatic Speech Recognition).

*   **Expanded ML Service Scope**: The `apps/ml` service is no longer limited to text and image processing. It now directly supports audio input, making it a more versatile component in our microservices architecture.
*   **Enhanced Accessibility**: This feature is foundational for building a more inclusive SahiDawa platform. It directly enables voice-driven interfaces, which are critical for users in rural India who may have low literacy rates or prefer verbal communication in their native languages.
*   **New Interaction Paradigm**: By providing a robust ASR endpoint, we unlock the potential for entirely new interaction paradigms within the SahiDawa ecosystem. Future developments could include voice-controlled health assistants, spoken symptom diaries, or interactive voice response (IVR) systems integrated with our platform.
*   **Increased Resource Demands**: While optimized with `int8` quantization and global model loading, the `faster-whisper` model is still substantial. This introduces a higher memory and CPU footprint for the `apps/ml` service, which will need to be considered in deployment scaling and resource allocation strategies.
*   **Foundation for Multilingual Support**: This ASR capability lays the groundwork for broader multilingual support across the platform, encouraging the development of frontend components that leverage this endpoint to serve diverse linguistic communities.

## Testing & Verification

The `/asr/transcribe` endpoint underwent comprehensive testing using `pytest` and FastAPI's `TestClient` within `apps/ml/tests/test_asr.py`.

Key aspects verified include:

1.  **Router Registration**: `test_asr_router_registered` confirmed that the `/asr/transcribe` endpoint is correctly registered in `main.py` and reachable, not returning a `404` error.
2.  **Response Structure and Data Types**:
    *   `test_response_has_required_fields` ensured that all mandatory fields (`transcription`, `language`, `language_probability`, `filename`) are present in the JSON response.
    *   `test_transcription_is_string` verified that the `transcription` field is a string.
    *   `test_language_probability_in_range` checked that `language_probability` is a float between `0.0` and `1.0`.
    *   `test_filename_echoed_back` confirmed that the `filename` in the response matches the uploaded filename.
3.  **Input Validation**:
    *   `test_rejects_non_audio_file` and `test_rejects_image_file` validated that uploading non-audio content types (e.g., `text/plain`, `image/jpeg`) correctly results in a `400 Bad Request` status.
    *   `test_missing_file_returns_422` confirmed that omitting the `file` field triggers a `422 Unprocessable Entity` error, as expected by FastAPI's validation.
4.  **Accepted Audio MIME Types**: A parameterized test (`test_accepted_audio_types`) covered all declared supported audio types (`audio/wav`, `audio/x-wav`, `audio/mpeg`, `audio/ogg`, `audio/webm`), ensuring they are not incorrectly rejected with a `400` status.
5.  **Health Check**: `test_health_endpoint` confirmed that the `/health` endpoint returns `200 OK` with `{"status": "healthy"}`, indicating the service starts correctly with the ASR router loaded.
6.  **Real Audio Language Detection**:
    *   Dedicated tests (`test_hindi_language_detection`, `test_tamil_language_detection`, `test_bengali_language_detection`) were implemented using actual recorded audio samples stored in `apps/ml/tests/fixtures/`.
    *   These tests verified that the model correctly identifies Hindi (accepting `hi` or `ur` due to known Whisper limitations), Tamil (`ta`), and Bengali (`bn`) languages from their respective audio inputs.
    *   These tests are conditionally skipped if the fixture files are not present, allowing for flexible testing environments.

The PR description also included a screenshot showing 17 tests passed, 0 failed, confirming the robustness of the new endpoint. An important note was made regarding the Word Error Rate (WER) metric, clarifying that for a health assistant, semantic accuracy is prioritized over exact word matching, especially in translation contexts, and that the model correctly understood key symptoms despite potential WER limitations.