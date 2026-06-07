# PR #1242 — feat(voice): add cloud Text-to-Speech for Voice Triage results

> **Merged:** 2026-06-04 | **Author:** @xrvnd | **Area:** ML/AI | **Impact Score:** 52 | **Closes:** #522

## What Changed

We have integrated Google Cloud Text-to-Speech (TTS) into our Voice Triage flow, enabling high-quality, consistent voice output for triage results across all browsers and devices. This enhancement replaces our primary reliance on the inconsistent native `speechSynthesis` API, which is now retained as a graceful fallback. Additionally, we've improved the robustness of our ML services by implementing structured output for Gemini model responses and adding graceful error handling for `ffmpeg` unavailability in our ASR service.

## The Problem Being Solved

Before this PR, our Voice Triage feature relied heavily on the browser's native `speechSynthesis` API for reading out triage results. This led to a fragmented user experience due to varying voice quality, availability, and pronunciation consistency across different browsers, operating systems, and devices. Users in rural India, where diverse regional languages are critical, often experienced poor-quality or non-existent voice output for non-English languages.

Furthermore, the Gemini model's output for voice triage sometimes returned markdown-fenced or language-mixed JSON, which caused parsing failures in the frontend and resulted in raw, unformatted JSON being displayed to the user. This degraded the user experience and made the triage summary difficult to understand.

Finally, our Automatic Speech Recognition (ASR) service had brittle error handling. If the `ffmpeg` dependency was missing on the ML host, the ASR endpoint would leak raw `[Errno 2]` exceptions, providing unhelpful and potentially sensitive internal details to the client, rather than a user-friendly error message.

## Files Modified

- `.env.example`
- `.gitignore`
- `apps/ml/main.py`
- `apps/ml/requirements.txt`
- `apps/ml/routers/asr.py`
- `apps/ml/routers/tts.py`
- `apps/web/app/[locale]/voice/lib/useCloudTTS.ts`
- `apps/web/app/[locale]/voice/page.tsx`
- `apps/web/app/api/chat/route.ts`
- `apps/web/app/api/voice/tts/route.ts`

## Implementation Details

This PR introduces a comprehensive cloud-based Text-to-Speech solution and enhances the robustness of existing ML components.

1.  **New ML Service TTS Router (`apps/ml/routers/tts.py`):**
    - We added a new FastAPI router, `router = APIRouter(prefix="/voice/tts", tags=["voice-tts"])`, which exposes a `POST /voice/tts/generate` endpoint.
    - This endpoint accepts a `TTSRequest` Pydantic model containing `text`, `language_code` (BCP-47, e.g., `en-IN`, `hi-IN`), and an optional `gender` (`MALE`, `FEMALE`, `NEUTRAL`).
    - It primarily uses `google.cloud.texttospeech.TextToSpeechClient` to synthesize audio. A `GOOGLE_VOICES_MAP` is defined to select the highest-quality female voice available for supported Indian languages: `en-IN-Neural2-A` for English, `hi-IN-Neural2-A` for Hindi, `ta-IN-Wavenet-A` for Tamil, `bn-IN-Wavenet-A` for Bengali, `mr-IN-Wavenet-A` for Marathi, and `te-IN-Standard-A` for Telugu.
    - The `AudioConfig` is set to `MP3` encoding with a `speaking_rate` of `0.9` for improved clarity.
    - The synthesized audio content (MP3 bytes) is returned base64-encoded within a `TTSResponse` model.
    - An optional Azure TTS fallback is also implemented via `generate_with_azure` using `requests` to interact with Azure Cognitive Services, configured by `AZURE_TTS_KEY` and `AZURE_TTS_REGION`.
    - On-disk caching is implemented in `/tmp/tts_cache` using an MD5 hash of `text:language_code` as the key to store and retrieve MP3 files, reducing latency and API costs for repeated requests.
    - A `/voice/tts/health` endpoint is included for basic service health checks.
    - The `tts` router is conditionally registered in `apps/ml/main.py` using `include_router_if_available`, making it optional based on `google-cloud-texttospeech` installation and `TTS_PROVIDER` configuration.

2.  **New Web Frontend TTS Proxy (`apps/web/app/api/voice/tts/route.ts`):**
    - A new Next.js API route, `POST /api/voice/tts`, was created to act as a proxy between the frontend and the ML service's `ML_SERVICE_URL/voice/tts/generate` endpoint.
    - This route performs input validation on the incoming `text`, `language_code`, and `gender` parameters.
    - It forwards the request to the ML service, includes a 15-second timeout, and handles structured logging for both success and error scenarios, mirroring the existing `transcribe` handler.
    - The ML service's base64 audio response is directly returned to the client.

3.  **Frontend Integration (`apps/web/app/[locale]/voice/page.tsx` and `apps/web/app/[locale]/voice/lib/useCloudTTS.ts`):**
    - A new React hook, `useCloudTTS`, was developed to encapsulate the logic for playing audio.
    - This hook attempts to use the cloud TTS service via the Next.js API proxy first. If the cloud service is unavailable or fails, it gracefully falls back to the browser's native `speechSynthesis` API.
    - The `Voice Triage` flow in `apps/web/app/[locale]/voice/page.tsx` was updated to utilize this `useCloudTTS` hook, ensuring consistent and high-quality voice output for triage results while maintaining a robust fallback mechanism.
    - The speaking state is synced across the UI to reflect when audio is being played.

4.  **Gemini Structured Output (`apps/web/app/api/chat/route.ts`):**
    - The `chat` API route, responsible for interacting with the Gemini model for voice triage, was modified to enforce structured JSON output.
    - This is achieved by setting `responseMimeType: "application/json"` and providing a `responseSchema` in the Gemini API call.
    - The prompt sent to Gemini was also tightened for brevity and to ensure single-language output, specifically requesting the top-3 recommendations in the specified language. This prevents the model from returning markdown-fenced or mixed-language JSON that previously caused parsing errors.

5.  **ASR Error Handling Improvement (`apps/ml/routers/asr.py`):**
    - The `_transcribe_audio_bytes` function now includes a `try-except FileNotFoundError` block around the `subprocess.run` call for `ffmpeg`.
    - If `ffmpeg` is not found, it logs a specific error message (`ffmpeg executable not found...`) and raises an `HTTPException` with `status_code=503` and a user-friendly `detail="Voice transcription is temporarily unavailable. Please try again later."`.
    - The generic `except Exception as e` block at the end of the function was also updated to return a less verbose and more user-friendly `detail="Oops..! Please try again later."` instead of leaking the internal exception text (`Failed to transcribe audio: {str(e)}`).

6.  **Dependency and Configuration Updates:**
    - `apps/ml/requirements.txt` was updated to include `google-cloud-texttospeech>=2.14.0`.
    - `.env.example` was updated with `TTS_PROVIDER` and `GOOGLE_APPLICATION_CREDENTIALS` variables to configure the TTS service.
    - `.gitignore` was updated to explicitly ignore `**/google-credentials.json` and `test_tts_live.py` to prevent sensitive data and temporary test scripts from being committed.
    - `apps/web/app/[locale]/layout.tsx` received `suppressHydrationWarning` and theme-aware body styling to prevent theme hydration mismatches during Next.js rendering.

## Technical Decisions

1.  **Cloud TTS over Native `speechSynthesis`**: We chose Google Cloud TTS as the primary provider because native `speechSynthesis` offers inconsistent voice quality, limited language support (especially for regional Indian languages), and varying browser compatibility. Cloud TTS provides high-quality, consistent, and natural-sounding voices across all platforms, significantly improving the user experience for our diverse user base.
2.  **Google Cloud TTS as Primary**: Google Cloud TTS was selected due to its robust support for Indian languages, including Neural2 voices for `en-IN` and `hi-IN`, which offer superior naturalness. While Azure TTS is also supported as an optional provider, Google's specific voice offerings for our target languages were a key differentiator.
3.  **Specific Voice Selection**: We prioritized Neural2 voices where available (e.g., `en-IN`, `hi-IN`) for their advanced quality. For languages without Neural2, we opted for WaveNet (e.g., `ta-IN`, `bn-IN`, `mr-IN`), and finally Standard voices (e.g., `te-IN`) as a last resort, ensuring the best possible quality given Google's offerings for each language. A slightly slower `speaking_rate=0.9` was chosen to enhance clarity, especially for complex medical information.
4.  **On-Disk Caching**: Implementing on-disk caching for generated audio files (`/tmp/tts_cache`) was a critical decision to reduce latency for repeated requests and minimize operational costs associated with cloud TTS API calls. This improves responsiveness and makes the service more scalable.
5.  **Next.js API Proxy for TTS**: We opted for a Next.js API route (`/api/voice/tts`) to proxy requests to the ML service. This decision provides several benefits:
    - **Security**: It prevents direct exposure of the ML service URL to the client.
    - **Abstraction**: The frontend interacts with a consistent `/api` endpoint, abstracting away the ML service's internal URL.
    - **Validation & Logging**: Allows for frontend-specific input validation and structured logging at the web layer.
    - **Future Flexibility**: Could enable future enhancements like client-side authentication or rate limiting before hitting the ML service.
6.  **Gemini Structured Output**: The decision to enforce `responseMimeType: "application/json"` and provide a `responseSchema` for Gemini was made to address the recurring bug of malformed or markdown-fenced JSON outputs. This ensures reliable parsing on the frontend, leading to a stable and predictable display of triage results. Tightening the prompt further reinforces the desired output format and content.
7.  **Graceful ASR Error Handling**: Improving `ffmpeg` error handling in `apps/ml/routers/asr.py` was crucial for user experience and system security. Instead of exposing raw system errors, providing a generic `503` (Service Unavailable) message for missing dependencies and a `500` (Internal Server Error) with a generic message for other internal failures prevents information leakage and guides users to try again later, rather than confusing them with technical jargon.
8.  **Optional ML Router Loading**: Making the TTS router optional in `apps/ml/main.py` ensures that the ML service can still boot and operate for other functionalities (like ASR or OCR) even if TTS dependencies are not installed or configured, improving deployment flexibility.

## How To Re-Implement (Contributor Reference)

To re-implement or understand the exact flow of the cloud Text-to-Speech feature and related improvements:

1.  **Set up Google Cloud Credentials**:
    - Create a Google Cloud Project.
    - Enable the "Cloud Text-to-Speech API".
    - Create a Service Account (IAM & Admin -> Service Accounts).
    - Grant the service account the "Cloud Text-to-Speech API User" role.
    - Generate a new JSON key for this service account and download it.
    - Place this JSON file in your `apps/ml` directory, e.g., `apps/ml/google-credentials.json`.
    - Update your `.env` file with `GOOGLE_APPLICATION_CREDENTIALS=apps/ml/google-credentials.json`.

2.  **Install ML Service Dependencies**:
    - Navigate to `apps/ml`.
    - Add `google-cloud-texttospeech>=2.14.0` to `requirements.txt`.
    - Install dependencies: `pip install -r requirements.txt`.

3.  **Create the ML Service TTS Router (`apps/ml/routers/tts.py`)**:
    - Define a FastAPI `APIRouter` with a `/voice/tts` prefix.
    - Implement `TTSRequest` (Pydantic model for `text`, `language_code`, `gender`) and `TTSResponse` (for `audio_base64`, `language_code`, `provider`, `cached`, `character_count`).
    - Define `GOOGLE_VOICES_MAP` (and `AZURE_VOICES_MAP` if supporting Azure) to map BCP-47 language codes to specific high-quality voice names.
    - Initialize `google.cloud.texttospeech.TextToSpeechClient` (and potentially Azure SDK components) based on `TTS_PROVIDER` environment variable.
    - Implement `get_cache_key` and define `CACHE_DIR` for on-disk caching.
    - Create the `POST /generate` endpoint:
        - It should first check the cache for the requested `text` and `language_code`. If found, return the cached base64 audio.
        - If not cached, call `generate_with_google(text, language_code, gender)`:
            - Construct `SynthesisInput(text=text)`.
            - Select `VoiceSelectionParams` using `language_code`, the mapped `name` from `GOOGLE_VOICES_MAP`, and `ssml_gender`.
            - Configure `AudioConfig` for `MP3` encoding and `speaking_rate=0.9`.
            - Call `tts_google_client.synthesize_speech`.
            - Cache the `response.audio_content` to `CACHE_DIR` using the generated cache key.
            - Base64 encode the audio content and return it in `TTSResponse`.
        - Include error handling for unsupported languages and API failures, raising `HTTPException` with appropriate status codes.
    - Add a `/health` endpoint.

4.  **Register TTS Router in ML Service (`apps/ml/main.py`)**:
    - Add `tts_loaded = include_router_if_available(app, "routers.tts", required=False)` to conditionally load the router.
    - Log a warning if TTS routes are disabled.

5.  **Create Web Frontend TTS Proxy (`apps/web/app/api/voice/tts/route.ts`)**:
    - Create a new Next.js API route file.
    - Implement a `POST` handler that receives `text`, `language_code`, `gender` from the client.
    - Validate these inputs.
    - Forward the request to `process.env.ML_SERVICE_URL + "/voice/tts/generate"` using `fetch`.
    - Include a `signal` for a 15-second timeout.
    - Handle the response: if successful, return the ML service's base64 audio; if an error, return a `500` or `503` with a user-friendly message.

6.  **Integrate TTS into Frontend (`apps/web/app/[locale]/voice/lib/useCloudTTS.ts` and `apps/web/app/[locale]/voice/page.tsx`)**:
    - Create a `useCloudTTS` hook:
        - It should expose a `speak` function and a `speaking` state.
        - Inside `speak`, attempt to `fetch` from `/api/voice/tts` with the text and language.
        - If the fetch is successful, decode the base64 audio, create an `Audio` object, and play it. Update `speaking` state accordingly.
        - If the fetch fails, fall back to `window.speechSynthesis.speak` with `SpeechSynthesisUtterance`.
    - In `apps/web/app/[locale]/voice/page.tsx`, import and use the `useCloudTTS` hook to play the triage results.

7.  **Enhance Gemini Interaction (`apps/web/app/api/chat/route.ts`)**:
    - When calling the Gemini API, ensure `responseMimeType: "application/json"` is set in the `GenerateContentRequest`.
    - Provide a `responseSchema` (e.g., a JSON schema defining the expected structure of triage recommendations).
    - Refine the prompt to explicitly request a concise, single-language JSON output with top-3 recommendations.

8.  **Improve ASR Error Handling (`apps/ml/routers/asr.py`)**:
    - Locate the `subprocess.run(["ffmpeg", ...])` call within `_transcribe_audio_bytes`.
    - Wrap this call in a `try-except FileNotFoundError` block.
    - Inside the `except FileNotFoundError`, log a detailed error and raise `HTTPException(status_code=503, detail="Voice transcription is temporarily unavailable. Please try again later.")`.
    - Modify the general `except Exception as e` block to raise `HTTPException(status_code=500, detail="Oops..! Please try again later.")`.

9.  **Update Environment and Git Ignore**:
    - Add `TTS_PROVIDER` (e.g., `google`) and `GOOGLE_APPLICATION_CREDENTIALS` to `.env.example`.
    - Add `**/google-credentials.json` to `.gitignore`.

## Impact on System Architecture

This PR significantly evolves our system architecture, particularly in the ML/AI and frontend layers:

1.  **Enhanced ML Service Capabilities**: The `apps/ml` service now hosts a dedicated, robust Text-to-Speech module. This expands its role beyond just ASR and OCR to include high-quality voice synthesis, making it a more comprehensive AI backend for voice interactions.
2.  **Increased Cloud Dependency**: We are now more reliant on external cloud providers (Google Cloud TTS, potentially Azure TTS) for core functionality. This introduces external service costs and latency considerations, but also leverages their specialized infrastructure for superior results.
3.  **Improved Frontend User Experience**: The frontend (`apps/web`) now delivers a consistent, high-quality voice experience, regardless of the user's device or browser. This is critical for accessibility and user satisfaction, especially for users interacting with the platform in regional Indian languages.
4.  **Robust AI Model Interaction**: By enforcing structured output from the Gemini model, we've made our AI interactions more predictable and reliable. This reduces parsing errors and improves the stability of the voice triage summary display.
5.  **Hardened ML Service Error Handling**: The ASR service is now more resilient to missing dependencies and internal errors, providing better feedback to the client and preventing the leakage of sensitive system information. This improves the overall stability and security posture of the ML backend.
6.  **Clearer API Boundaries**: The Next.js API proxy for TTS establishes a clean interface between the frontend and the ML service, abstracting implementation details and providing a controlled entry point for voice synthesis requests.
7.  **Foundation for Future Voice Features**: This robust TTS infrastructure lays the groundwork for future voice-enabled features, such as proactive health advice, interactive voice assistants, or more complex conversational AI flows, with consistent and high-quality audio output.

## Testing & Verification

The changes introduced in this PR were verified through manual testing across multiple languages and scenarios.

1.  **Voice Triage Flow with Cloud TTS**: We tested the end-to-end voice triage flow by inputting the test string "I have a headache" in various supported languages, including English, Hindi, Tamil, Bengali, Marathi, and Telugu.
    - The system successfully transcribed the spoken input (ASR).
    - The Gemini model processed the input and generated triage recommendations.
    - Crucially, the new cloud TTS system then read these recommendations aloud in the selected regional language with high-quality voices.
    - Screenshots provided in the PR demonstrate the successful voice output for Tamil, Bengali, Marathi, and Telugu, confirming that the cloud TTS integration is functional and provides distinct regional voices. English and Hindi were also transcribed and solutioning was similar.
2.  **Gemini Structured Output**: We verified that the Gemini model's output for triage results was consistently structured JSON, preventing the parsing errors and raw JSON display that occurred previously. This was observed by inspecting the network responses and the on-screen summary.
3.  **ASR Error Handling**: While not explicitly shown in screenshots, the ASR error handling for `ffmpeg` was tested by simulating its absence on the ML host. We confirmed that the ASR endpoint returned a `503` status code with the message "Voice transcription is temporarily unavailable. Please try again later.", instead of leaking internal `ffmpeg` errors.
4.  **Caching Mechanism**: Not documented in this PR.
5.  **Native TTS Fallback**: Not documented in this PR.

Edge cases considered during development include:

- Unsupported languages: The system gracefully handles requests for languages not in `GOOGLE_VOICES_MAP` by raising a `400` error.
- Cloud service unavailability: The frontend is designed to fall back to native `speechSynthesis` if the cloud TTS service or its proxy is unreachable, ensuring a basic level of functionality.
- Missing Google Cloud credentials: The ML service logs a warning and disables Google Cloud TTS if credentials are not found or invalid.
