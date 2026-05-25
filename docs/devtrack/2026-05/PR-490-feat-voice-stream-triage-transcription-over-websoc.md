# PR #490 — feat(voice): stream triage transcription over websocket

> **Merged:** 2026-05-24 | **Author:** @shashank03-dev | **Area:** Frontend | **Impact Score:** 62 | **Closes:** #480

## What Changed

This PR introduces real-time voice transcription for our Voice Triage feature by implementing a WebSocket-based streaming ASR (Automatic Speech Recognition) pipeline. We've added a new `WS /asr/stream` endpoint to our `apps/ml` FastAPI service, enabling the `apps/web` frontend to stream `MediaRecorder` audio chunks as a citizen speaks. This allows for incremental transcript updates in the UI and includes a robust fallback mechanism to the existing HTTP POST `/transcribe` endpoint if the WebSocket connection fails.

## The Problem Being Solved

Previously, our Voice Triage system relied on a monolithic audio upload process where the entire audio recording had to be completed and uploaded via an HTTP POST request to `/api/voice/transcribe` before any transcription could begin. This resulted in a significant delay between the user finishing speaking and the first appearance of the transcribed text in the UI, leading to a suboptimal user experience. Users had to wait for the full audio upload, server-side processing, and then the complete transcript to be returned, which was inefficient for longer recordings and lacked immediate feedback.

## Files Modified

- `.env.example`
- `apps/ml/routers/asr.py`
- `apps/ml/tests/test_asr_stream.py`
- `apps/web/app/[locale]/voice/VoicePanels.tsx`
- `apps/web/app/[locale]/voice/lib/streaming.ts`
- `apps/web/app/[locale]/voice/page.tsx`
- `apps/web/app/[locale]/voice/types.ts`
- `apps/web/messages/bn.json`
- `apps/web/messages/en.json`
- `apps/web/messages/mr.json`
- `apps/web/messages/ta.json`
- `apps/web/messages/te.json`
- `apps/web/tests/voice-audio-visualizer.test.tsx`
- `apps/web/tests/voice-streaming.test.ts`
- `docs/SETUP_ML.md`
- `docs/api-reference.md`

## Implementation Details

The core of this feature involves a new WebSocket endpoint in our `apps/ml` service and a corresponding client-side streaming mechanism in `apps/web`.

**ML Service (`apps/ml`):**

1.  **Code Refactoring for Reusability:** The existing `transcribe_audio` function in `apps/ml/routers/asr.py` was refactored. Its core logic, which handles file validation, FFmpeg normalization, noise reduction via `noisereduce`, and transcription using `faster-whisper`, was extracted into two new helper functions:
    - `transcribe_uploaded_bytes(contents: bytes, *, original_name: str, content_type: str | None, language: str | None)`: This function now serves as the entry point for transcribing raw audio bytes, handling content type validation and calling the internal processing function.
    - `_transcribe_audio_bytes(contents: bytes, *, original_name: str, suffix: str, requested_language: str | None)`: This private helper encapsulates the actual audio processing pipeline, including temporary file management, FFmpeg transcoding to 16kHz mono WAV, `soundfile` reading, `noisereduce.reduce_noise`, and `faster-whisper` transcription. This ensures that both the HTTP POST and WebSocket paths utilize the same robust transcription logic.
2.  **`StreamingAsrSession` Class:** A new class, `StreamingAsrSession`, was introduced in `apps/ml/routers/asr.py` to manage the state of a single streaming transcription session.
    - It maintains a `self.chunks: list[bytes]` to accumulate incoming audio data.
    - `append_and_maybe_transcribe(self, chunk: bytes, *, mime_type: str, language: str | None)`: This method appends a new audio `chunk` to the session's buffer. If enough chunks have accumulated (currently, if `len(self.chunks) >= 2`), it concatenates them, calls `transcribe_uploaded_bytes` to get a transcript, and returns a partial result if the transcript is new or different from `self.last_transcript`. This prevents sending redundant updates.
    - `finalize(self, *, mime_type: str, language: str | None)`: Called at the end of the stream, this method processes all accumulated chunks to provide the final, complete transcript.
3.  **`@router.websocket("/stream")` Endpoint:** A new WebSocket endpoint was added to `apps/ml/routers/asr.py`.
    - Upon connection, it expects an initial JSON "start" message containing `mimeType` (e.g., "audio/webm") and an optional `language` hint.
    - It then sends a `{"type": "ready"}` message back to the client, signaling that it's prepared to receive audio.
    - The endpoint enters a continuous loop, receiving messages from the client.
    - If a message contains `bytes` (audio data), it passes the chunk to `session.append_and_maybe_transcribe`. If a new partial transcript is generated, it's sent back to the client as a `{"type": "partial", "transcript": "...", ...}` JSON message.
    - It handles `websocket.disconnect` events to clean up the session.
    - Robust error handling is implemented for invalid start messages or malformed control messages.

**Frontend (`apps/web`):**

1.  **`NEXT_PUBLIC_ML_SERVICE_URL`:** A new environment variable was added to `.env.example` and `docs/SETUP_ML.md` to allow the frontend to directly connect to the ML service for WebSocket communication, bypassing the `apps/api` proxy for this specific stream.
2.  **`apps/web/app/[locale]/voice/lib/streaming.ts`:** This new file contains the client-side logic for:
    - Initializing a `MediaRecorder` to capture audio from the user's microphone.
    - Establishing and managing the WebSocket connection to `ws://${NEXT_PUBLIC_ML_SERVICE_URL}/asr/stream`.
    - Sending `MediaRecorder`'s `dataavailable` events (audio chunks) as binary messages over the WebSocket.
    - Handling incoming `{"type": "partial"}` messages to update the UI with incremental transcripts.
    - Managing connection state (connecting, ready, error, closed) and implementing the fallback mechanism.
3.  **`apps/web/app/[locale]/voice/VoicePanels.tsx` and `apps/web/app/[locale]/voice/page.tsx`:** These components were updated to:
    - Integrate with the new streaming logic from `streaming.ts`.
    - Display the incremental transcript updates in real-time.
    - Handle the UI state transitions (e.g., "Listening...", "Processing...", "Transcription complete").
    - Trigger the fallback to the existing HTTP POST `/api/voice/transcribe` endpoint if the WebSocket connection fails or encounters an unrecoverable error. This ensures the user can still get a transcript, albeit with the original delay.
4.  **`apps/web/app/[locale]/voice/types.ts`:** New TypeScript types were introduced to define the structure of streaming messages and session states, improving type safety and developer clarity.
5.  **Internationalization (`apps/web/messages/*.json`):** New strings were added to support the UI updates related to streaming transcription status.

## Technical Decisions

1.  **WebSocket for Streaming:** We chose WebSockets over repeated HTTP requests (e.g., chunked uploads or polling) because WebSockets provide a persistent, full-duplex communication channel. This is ideal for real-time, low-latency applications like audio streaming, where continuous data flow and immediate feedback are critical. It minimizes overhead compared to establishing new HTTP connections for each audio chunk.
2.  **FastAPI's `WebSocket` Integration:** FastAPI's native support for WebSockets (`from fastapi import WebSocket`) simplifies the implementation on the server-side, providing a clear and robust API for handling connections, receiving binary data, and sending JSON responses.
3.  **`MediaRecorder` for Frontend Audio Capture:** `MediaRecorder` is the standard browser API for capturing audio and video. Its `ondataavailable` event is perfectly suited for generating audio chunks that can be directly streamed over a WebSocket, ensuring browser compatibility and efficient client-side processing.
4.  **Reusing Existing ASR Logic:** Instead of duplicating the complex audio processing pipeline (FFmpeg, `noisereduce`, `faster-whisper`), we refactored the existing `/transcribe` endpoint's logic into reusable helper functions (`transcribe_uploaded_bytes`, `_transcribe_audio_bytes`). This significantly reduces code duplication, simplifies maintenance, and ensures consistency in transcription quality between the batch and streaming modes.
5.  **Incremental Transcription Strategy:** The `StreamingAsrSession` class implements a strategy of accumulating audio chunks and only performing transcription when a sufficient amount of new audio is available, and only sending updates if the new transcript differs from the last. This balances between providing frequent updates and minimizing redundant ML processing, optimizing resource usage and latency.
6.  **Robust Fallback Mechanism:** The decision to implement a clean fallback to the existing HTTP POST `/api/voice/transcribe` endpoint is crucial for system reliability. It ensures that even if the WebSocket connection fails due to network issues, server errors, or client-side problems, the user's audio can still be processed and transcribed, preventing a complete failure of the Voice Triage feature. This prioritizes availability and user experience.
7.  **Direct ML Service Connection for WebSockets:** By introducing `NEXT_PUBLIC_ML_SERVICE_URL`, the frontend connects directly to the `apps/ml` service for WebSockets. This avoids proxying WebSocket traffic through `apps/api`, which can add latency and complexity, especially with certain proxy configurations. For HTTP POST requests, `apps/api` still acts as a gateway, but for persistent, high-throughput streaming, a direct connection is more efficient.

## How To Re-Implement (Contributor Reference)

To re-implement the real-time voice triage transcription feature, a contributor would follow these steps:

1.  **ML Service Setup (`apps/ml`):**
    - **Refactor Core Transcription Logic:**
        - Locate the existing `transcribe_audio` function in `apps/ml/routers/asr.py`.
        - Extract the core audio processing (temp file handling, FFmpeg, `soundfile`, `noisereduce`, `faster-whisper`) into a new private helper function, e.g., `_transcribe_audio_bytes(contents: bytes, *, original_name: str, suffix: str, requested_language: str | None) -> dict`. This function should return the full transcription payload.
        - Create a public wrapper function, `transcribe_uploaded_bytes(contents: bytes, *, original_name: str, content_type: str | None, language: str | None) -> dict`, which handles content type validation and calls `_transcribe_audio_bytes`.
        - Update the original `@router.post("/transcribe")` endpoint to use `transcribe_uploaded_bytes` after reading the `UploadFile` contents.
    - **Implement `StreamingAsrSession`:**
        - Define a class `StreamingAsrSession` in `apps/ml/routers/asr.py`.
        - It should have an `__init__` method to initialize `self.chunks: list[bytes]` and `self.last_transcript: str`.
        - Implement `append_and_maybe_transcribe(self, chunk: bytes, *, mime_type: str, language: str | None) -> dict | None`: This method should append `chunk`, concatenate `self.chunks`, call `transcribe_uploaded_bytes` on the combined audio, and return a dictionary `{"transcript": ..., "language": ..., "languageConfidence": ...}` only if the new transcript is non-empty and different from `self.last_transcript`. Update `self.last_transcript`.
        - Implement `finalize(self, *, mime_type: str, language: str | None) -> dict`: This method should perform a final transcription of all accumulated `self.chunks` using `transcribe_uploaded_bytes` and return the complete result. Handle the case where no chunks were received.
    - **Add WebSocket Endpoint:**
        - Define a new WebSocket endpoint: `@router.websocket("/stream") async def stream_transcription(websocket: WebSocket):`.
        - Call `await websocket.accept()`.
        - Receive the initial "start" message (JSON `{"type": "start", "mimeType": "audio/webm", "language": "en"}`). Validate its structure and content. Send `{"type": "error", ...}` and close if invalid.
        - Instantiate `session = StreamingAsrSession()`.
        - Send `await websocket.send_json({"type": "ready"})`.
        - Enter a `while True` loop to receive messages:
            - If `message.get("bytes")`, call `partial = session.append_and_maybe_transcribe(...)`. If `partial` is not `None`, send `await websocket.send_json({"type": "partial", **partial})`.
            - Handle `websocket.disconnect` to break the loop.
            - Implement error handling for unexpected message types or malformed JSON control messages.
    - **Testing:** Create `apps/ml/tests/test_asr_stream.py` with tests for the WebSocket endpoint, verifying connection, start message handling, chunk processing, partial transcript generation, and error conditions.

2.  **Frontend Setup (`apps/web`):**
    - **Environment Variable:** Add `NEXT_PUBLIC_ML_SERVICE_URL=http://localhost:8000` (or appropriate ML service URL) to `.env.example`.
    - **Streaming Utility (`apps/web/app/[locale]/voice/lib/streaming.ts`):**
        - Create a function, e.g., `startStreamingTranscription(onPartialTranscript: (transcript: string) => void, onFinalTranscript: (transcript: string) => void, onError: (error: Error) => void, language: string)`.
        - Inside this function:
            - Request microphone access using `navigator.mediaDevices.getUserMedia({ audio: true })`.
            - Create a `MediaRecorder` instance with the audio stream and a suitable `mimeType` (e.g., `audio/webm; codecs=opus`).
            - Open a WebSocket connection to `ws://${process.env.NEXT_PUBLIC_ML_SERVICE_URL}/asr/stream`.
            - On WebSocket `open` event, send the initial "start" message as JSON: `{"type": "start", "mimeType": "audio/webm", "language": language}`.
            - On `MediaRecorder.ondataavailable` event, send `event.data` (the audio chunk) as a binary message over the WebSocket.
            - On WebSocket `message` event:
                - Parse the incoming JSON.
                - If `{"type": "partial", "transcript": "..."}`, call `onPartialTranscript`.
                - If `{"type": "final", "transcript": "..."}` (or similar, from `finalize` if implemented), call `onFinalTranscript`.
                - If `{"type": "error", "error": "..."}`, call `onError`.
            - Implement `MediaRecorder.onstop` to send a "stop" control message (if needed) or simply close the WebSocket.
            - Implement WebSocket `onclose` and `onerror` to handle disconnections and errors, triggering the fallback mechanism.
    - **UI Integration (`apps/web/app/[locale]/voice/page.tsx`, `apps/web/app/[locale]/voice/VoicePanels.tsx`):**
        - Manage the recording state (idle, recording, transcribing, error).
        - Call `startStreamingTranscription` when recording begins.
        - Update a state variable with the `onPartialTranscript` callback to display incremental text.
        - Implement the fallback: if `onError` is called from the streaming utility, switch to the existing HTTP POST upload flow for the recorded audio.
        - Display appropriate internationalized messages (`apps/web/messages/*.json`) for streaming status.
    - **Testing:** Create `apps/web/tests/voice-streaming.test.ts` to mock `MediaRecorder` and `WebSocket` APIs and verify the client-side streaming logic, UI updates, and fallback behavior.

3.  **Documentation:**
    - Update `docs/SETUP_ML.md` to include the `NEXT_PUBLIC_ML_SERVICE_URL` environment variable and any specific setup instructions for the ML service's WebSocket endpoint.
    - Update `docs/api-reference.md` to document the new `WS /asr/stream` endpoint, its expected message formats (start, audio chunks, partial/final responses), and error codes.

## Impact on System Architecture

This change significantly enhances the real-time capabilities of the SahiDawa platform, particularly for the Voice Triage feature.

1.  **Real-time Interaction:** It shifts the Voice Triage experience from a batch-processing model to a real-time interactive one, providing immediate feedback to the user. This is critical for improving usability and reducing perceived latency, making the platform feel more responsive and modern.
2.  **ML Service Specialization:** The `apps/ml` service now explicitly supports both batch (HTTP POST) and streaming (WebSocket) ASR. This specialization allows for optimized handling of different interaction patterns, with the WebSocket path designed for low-latency, continuous data flow.
3.  **Decoupling of Frontend and ML Service:** By introducing `NEXT_PUBLIC_ML_SERVICE_URL`, the frontend can now establish a direct WebSocket connection to the `apps/ml` service. While `apps/api` still serves as a general-purpose backend, this direct connection for streaming reduces the load on `apps/api` and avoids potential latency or complexity introduced by proxying WebSocket traffic.
4.  **Foundation for Future Real-time Features:** This implementation lays a robust foundation for other real-time voice-enabled features, such as live translation, voice commands, or more sophisticated interactive voice agents, by demonstrating a proven pattern for streaming audio to an ML backend.
5.  **Increased Infrastructure Demands:** While improving user experience, streaming ASR can increase the computational load on the `apps/ml` service, as it processes audio continuously rather than in discrete batches. This might necessitate scaling considerations for the ML service in production environments.
6.  **Enhanced Reliability:** The built-in fallback to the existing HTTP POST mechanism ensures that the core functionality remains available even if the real-time streaming path experiences issues, contributing to the overall robustness of the platform.

## Testing & Verification

This change was thoroughly tested across both the frontend and ML services.

**Frontend Testing:**

- **Unit/Integration Tests:** `apps/web/tests/voice-streaming.test.ts` was added to specifically test the client-side WebSocket streaming logic, `MediaRecorder` integration, and state management. This includes verifying that audio chunks are sent correctly, partial transcripts are received and displayed, and the fallback mechanism is triggered upon WebSocket failure.
- **Existing UI Tests:** `apps/web/tests/voice-audio-visualizer.test.tsx` and `apps/web/tests/voice-helpers.test.ts` were run to ensure existing voice-related UI components and helper functions were not regressed.
- **Manual Verification:** A screencast (`https://github.com/user-attachments/assets/1e4aed3e-da02-4c09-8e3e-561317017665`) was provided, demonstrating the real-time incremental transcription in the UI during a live recording session. This visually confirmed the feature's functionality and user experience.

**ML Service Testing:**

- **Unit Tests:** `apps/ml/tests/test_asr_stream.py` was added to test the new `WS /asr/stream` endpoint. These tests cover:
    - Successful WebSocket connection and initial "start" message handling.
    - Correct processing of audio chunks and generation of partial transcripts.
    - Verification of the `StreamingAsrSession` class's logic for accumulating chunks and returning distinct partial results.
    - Error handling for malformed "start" messages or invalid control messages.
- **Existing ASR Tests:** `apps/ml/tests/test_asr.py::test_language_hint_is_passed_to_whisper` and `apps/ml/tests/test_asr.py::test_missing_file_returns_422` were run to ensure that the refactoring of the core transcription logic did not introduce regressions into the existing HTTP POST `/transcribe` endpoint.

**Edge Cases:**

- **Network Latency/Disconnection:** The fallback mechanism to the HTTP POST upload addresses this by ensuring a transcript is still generated even if the WebSocket stream is interrupted.
- **Silence/No Speech:** The `StreamingAsrSession.append_and_maybe_transcribe` logic implicitly handles this by only returning a partial transcript if it's different from the last one, preventing constant empty updates. The `faster-whisper` model itself is robust to silence.
- **Unsupported Audio Formats:** The `normalize_content_type` and FFmpeg transcoding steps in `_transcribe_audio_bytes` ensure that various input formats are normalized to a consistent 16kHz mono WAV for the ASR model, mitigating issues with client-side `MediaRecorder` output variations.
- **Long Pauses:** Not documented in this PR, but typically, a streaming ASR system might implement a "finalization" logic after a period of silence to send a complete segment. The current implementation sends partials based on accumulated chunks, which might result in longer partials during pauses. The `finalize` method is called at the end of the stream.
