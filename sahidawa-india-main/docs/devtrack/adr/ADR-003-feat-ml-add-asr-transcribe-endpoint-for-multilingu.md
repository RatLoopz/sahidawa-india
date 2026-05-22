# ADR — feat(ml): add /asr/transcribe endpoint for multilingual speech-to-text

> **Date:** 2026-05-18 | **PR:** #233 | **Status:** Accepted

## Context

The SahiDawa platform aimed to improve accessibility for rural Indian users by enabling voice input for symptom reporting. A significant barrier was the reliance on English typing, which excluded users who preferred or only spoke native Indian languages. The need arose for a Voice Health Assistant feature that could transcribe spoken symptoms in multiple Indian languages into text, thereby removing this barrier and enhancing the platform's utility for its target demographic.

## Decision

A new `/asr/transcribe` endpoint was added to the existing `apps/ml` FastAPI service. This endpoint accepts audio file uploads (supporting `wav`, `mp3`, `ogg`, `webm`, `flac`) and returns the transcribed text, detected language, language code, and confidence probability.

The implementation details included:
- **Model Selection:** The `faster-whisper` "medium" model was chosen for its balance of accuracy, particularly for Indian regional languages, and performance.
- **Compute Optimization:** `compute_type="int8"` was used to optimize the model for CPU execution, ensuring efficiency without requiring dedicated GPU resources.
- **Audio Preprocessing:** Voice Activity Detection (VAD) was integrated to handle silence and pauses, and `noisereduce` was applied to mitigate background noise, improving transcription accuracy in real-world audio environments.
- **Performance:** The `faster-whisper` model was loaded once at service import time to minimize per-request cold start latency.
- **API Consistency:** The new endpoint followed the established pattern of the existing `routers/ocr.py` for input handling, content-type validation, and error reporting.
- **Infrastructure:** The `apps/ml/Dockerfile` was updated to include `ffmpeg` (for diverse audio format support) and `libsndfile1` (for `soundfile` library compatibility on Linux), and `requirements.txt` was updated with necessary Python packages (`faster-whisper`, `soundfile`, `noisereduce`, `numpy`).

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Smaller `faster-whisper` models (e.g., `small`, `base`)** | Rejected due to lower reported accuracy on the diverse range of Indian regional languages, which was a critical requirement for the platform's target users. The "medium" model offered a better accuracy-to-resource trade-off. |
| **Cloud-based ASR services (e.g., Google Cloud Speech-to-Text, AWS Transcribe)** | Rejected primarily due to cost implications for an open-source, free platform, potential data privacy concerns for sensitive health information being sent to third-party services, and potential latency issues for rural users with unreliable internet connectivity. |
| **No audio preprocessing (VAD, noise reduction)** | Rejected because it would significantly degrade transcription accuracy, especially in the noisy environments typical of rural settings, leading to a poorer user experience and less reliable symptom capture. |

## Consequences

**Positive:**
- Significantly improved accessibility for rural users by removing the English typing barrier, enabling voice input in native Indian languages.
- Enhanced user experience by providing a more natural and intuitive way to interact with the SahiDawa platform.
- Leveraged existing `apps/ml` service architecture, maintaining consistency and reducing deployment complexity.
- The `faster-whisper` "medium" model with `int8` compute provided a robust balance of transcription accuracy and CPU efficiency.
- Integrated VAD and noise reduction improved the quality and reliability of transcriptions from real-world audio.

**Trade-offs:**
- Increased resource consumption (CPU and RAM) on the `apps/ml` service due to running the "medium" ASR model and audio preprocessing.
- Introduced new external dependencies (`ffmpeg`, `libsndfile1`) requiring updates to the Docker build process and image size.
- The chosen ASR model has a known upstream limitation in acoustically distinguishing Hindi and Urdu, which was accepted given their linguistic similarities and the context of symptom reporting.

## Related Issues & PRs

- PR #233: feat(ml): add /asr/transcribe endpoint for multilingual speech-to-text
- Issue #201