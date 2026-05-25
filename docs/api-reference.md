# API Endpoint Reference

This document provides a comprehensive reference for the HTTP endpoints that power **SahiDawa**.

The platform runs three HTTP services during local development:

| Service    | Technology                 | Port   | Base URL                |
| ---------- | -------------------------- | ------ | ----------------------- |
| `apps/web` | Next.js App Router + proxy | `3000` | `http://localhost:3000` |
| `apps/api` | Express (Node.js)          | `4000` | `http://localhost:4000` |
| `apps/ml`  | FastAPI (Python)           | `8000` | `http://localhost:8000` |

---

# Table of Contents

- [apps/web — Next.js Web App Routes](#appsweb--nextjs-web-app-routes-port-3000)
    - [POST /api/voice/transcribe](#post-apivoicetranscribe)
- [apps/api — Express Service](#appsapi--express-service-port-4000)
    - [GET /](#get-)
    - [GET /health](#get-health)
    - [POST /api/verify](#post-apiverify)
    - [Recall Push Notifications](#recall-push-notifications)
- [apps/ml — FastAPI ML Service](#appsml--fastapi-ml-service-port-8000)
    - [GET /](#get--1)
    - [GET /health](#get-health-1)
    - [POST /ocr/extract](#post-ocrextract)
    - [WS /asr/stream](#ws-asrstream)
    - [POST /asr/transcribe](#post-asrtranscribe)
- [Error Codes Summary](#error-codes-summary)
- [Notes for Contributors](#notes-for-contributors)

---

# apps/web — Next.js Web App Routes (Port 3000)

## POST /api/voice/transcribe

Server-side proxy used by the Voice Triage page. The browser records audio,
uploads it to this route, and the web app forwards the file to the ML service
at `/asr/transcribe`. This route remains the fallback path when realtime
WebSocket streaming cannot complete.

| Field         | Details                         |
| ------------- | ------------------------------- |
| Method        | `POST`                          |
| Path          | `/api/voice/transcribe`         |
| Auth Required | No                              |
| Content-Type  | `multipart/form-data`           |
| Upstream      | `ML_SERVICE_URL/asr/transcribe` |

### Request Body

| Field      | Type     | Required | Description                                               |
| ---------- | -------- | -------- | --------------------------------------------------------- |
| `file`     | `file`   | Yes      | Recorded audio blob from the Voice Triage page            |
| `language` | `string` | No       | Optional BCP-47 hint such as `en-IN`, `ta-IN`, or `bn-IN` |

### Example Request (cURL)

```bash
curl -X POST http://localhost:3000/api/voice/transcribe \
  -F "file=@voice-query.wav;type=audio/wav" \
  -F "language=en-IN"
```

### Example Response — `200 OK`

```json
{
    "transcript": "I have fever and cough",
    "language": "en",
    "languageConfidence": 0.84
}
```

### Example Response — `400 Bad Request`

```json
{
    "error": "Audio file is required."
}
```

### Example Response — `502 Bad Gateway`

```json
{
    "error": "Transcription service returned an invalid response."
}
```

### Example Response — `503 Service Unavailable`

```json
{
    "error": "Could not reach the transcription service."
}
```

### Example Response — `504 Gateway Timeout`

```json
{
    "error": "Transcription service timed out."
}
```

### Streaming Note

The preferred realtime path for Voice Triage now connects the browser directly
to `WS /asr/stream` on the ML service using `NEXT_PUBLIC_ML_SERVICE_URL`. The
HTTP proxy above is still used as the graceful fallback path.

---

# apps/api — Express Service (Port 4000)

## GET /

Root check endpoint. Confirms the API service is running.

| Field         | Details |
| ------------- | ------- |
| Method        | `GET`   |
| Path          | `/`     |
| Auth Required | No      |
| Request Body  | None    |

### Example Response — `200 OK`

```json
{
    "message": "SahiDawa API is running",
    "version": "1.0.0"
}
```

---

## GET /health

Health check endpoint. Used by monitoring tools and Docker to verify service health.

| Field         | Details   |
| ------------- | --------- |
| Method        | `GET`     |
| Path          | `/health` |
| Auth Required | No        |
| Request Body  | None      |

### Example Response — `200 OK`

```json
{
    "status": "ok",
    "uptime": 3200,
    "timestamp": "2026-05-10T10:00:00.000Z"
}
```

---

## POST /api/verify

> ⚠️ **Pending implementation** — This endpoint will be available once Issue #11: **[Backend] Implement POST /api/verify Route for Medicine Verification** is completed.

Verifies whether a medicine is genuine by checking its batch number against the CDSCO database.

| Field         | Details            |
| ------------- | ------------------ |
| Method        | `POST`             |
| Path          | `/api/verify`      |
| Auth Required | No                 |
| Content-Type  | `application/json` |

### Request Body

| Field          | Type     | Required | Description                                    |
| -------------- | -------- | -------- | ---------------------------------------------- |
| `batch_number` | `string` | ✅ Yes   | The batch number printed on the medicine strip |
| `brand_name`   | `string` | No       | Optional brand name for additional validation  |

### Example Request

```json
{
    "batch_number": "BN20240512XYZ",
    "brand_name": "Paracetamol 500mg"
}
```

### Example Response — `200 OK` (Verified)

```json
{
    "verified": true,
    "batch_number": "BN20240512XYZ",
    "brand_name": "Paracetamol 500mg",
    "manufacturer": "ABC Pharma Ltd.",
    "expiry_date": "2026-12-01",
    "status": "genuine"
}
```

### Example Response — `200 OK` (Suspicious)

```json
{
    "verified": false,
    "batch_number": "BN20240512XYZ",
    "status": "suspicious",
    "message": "Batch number not found in CDSCO records. Please report this medicine."
}
```

### Example Response — `422 Unprocessable Entity`

```json
{
    "error": "Validation failed",
    "details": "batch_number is required and must be at least 4 characters"
}
```

---

## Recall Push Notifications

Browser recall alerts are exposed under `/api/notifications`.

| Method   | Path                                      | Purpose                                                     |
| -------- | ----------------------------------------- | ----------------------------------------------------------- |
| `GET`    | `/api/notifications/vapid-public-key`     | Returns the public VAPID key and whether push is configured |
| `POST`   | `/api/notifications/subscriptions`        | Stores a browser Push API subscription                      |
| `DELETE` | `/api/notifications/subscriptions`        | Removes a subscription by endpoint                          |
| `GET`    | `/api/notifications/recalls/mock`         | Returns the mock CDSCO recall feed                          |
| `POST`   | `/api/notifications/recalls/mock/trigger` | Sends a recall notification to stored subscriptions         |

Subscription payload:

```json
{
    "endpoint": "https://push.example.test/subscription/1",
    "keys": {
        "p256dh": "browser-public-key",
        "auth": "browser-auth-secret"
    }
}
```

Recall trigger payloads include `medicineName` and `reason`; the push payload
returns them as `medicineName` and `recallReason` so the service worker can show
the safety alert clearly.

---

# apps/ml — FastAPI ML Service (Port 8000)

## GET /

Root check endpoint. Confirms the ML service is running.

| Field         | Details |
| ------------- | ------- |
| Method        | `GET`   |
| Path          | `/`     |
| Auth Required | No      |
| Request Body  | None    |

### Example Response — `200 OK`

```json
{
    "message": "SahiDawa ML service is running",
    "version": "1.0.0"
}
```

---

## GET /health

Health check endpoint for the ML service.

| Field         | Details   |
| ------------- | --------- |
| Method        | `GET`     |
| Path          | `/health` |
| Auth Required | No        |
| Request Body  | None      |

### Example Response — `200 OK`

```json
{
    "status": "ok",
    "models_loaded": true,
    "timestamp": "2026-05-10T10:00:00.000Z"
}
```

---

## POST /ocr/extract

> ⚠️ **Pending implementation** — This endpoint will be available once Issue #15: **[ML] Implement POST /ocr/extract Endpoint for Medicine Strip OCR** is completed.

Extracts text from an image of a medicine strip using OCR. Returns the detected batch number, expiry date, and other printed text.

| Field         | Details               |
| ------------- | --------------------- |
| Method        | `POST`                |
| Path          | `/ocr/extract`        |
| Auth Required | No                    |
| Content-Type  | `multipart/form-data` |

### Request Body

| Field   | Type   | Required | Description                                              |
| ------- | ------ | -------- | -------------------------------------------------------- |
| `image` | `file` | ✅ Yes   | Image file of the medicine strip (`JPEG`, `PNG`, `WEBP`) |

### Example Request (cURL)

```bash
curl -X POST http://localhost:8000/ocr/extract \
  -F "image=@medicine_strip.jpg"
```

### Example Response — `200 OK`

```json
{
    "success": true,
    "extracted_text": "Paracetamol 500mg\nBatch: BN20240512XYZ\nMfg: 2024-05-01\nExp: 2026-12-01\nABC Pharma Ltd.",
    "fields": {
        "batch_number": "BN20240512XYZ",
        "expiry_date": "2026-12-01",
        "manufacture_date": "2024-05-01",
        "brand_name": "Paracetamol 500mg",
        "manufacturer": "ABC Pharma Ltd."
    },
    "confidence": 0.94
}
```

### Example Response — `422 Unprocessable Entity`

```json
{
    "success": false,
    "error": "Could not extract text. Image may be blurry or unsupported format."
}
```

## POST /asr/transcribe

ML service endpoint used by the web proxy above. This route accepts uploaded audio, normalizes it to a Whisper-friendly format, and returns the raw transcription payload.

Speech-to-text endpoint used by Voice Triage. It accepts recorded browser audio,
normalizes it to 16kHz mono WAV with FFmpeg, runs Faster-Whisper, and returns
the transcript plus detected language metadata.

| Field         | Details               |
| ------------- | --------------------- |
| Method        | `POST`                |
| Path          | `/asr/transcribe`     |
| Auth Required | No                    |
| Content-Type  | `multipart/form-data` |

### Request Body

| Field      | Type     | Required | Description                                                                                                 |
| ---------- | -------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| `file`     | `file`   | Yes      | Audio file (`WAV`, `MP3`, `OGG`, `WEBM`, `MP4`, `FLAC`)                                                     |
| `language` | `string` | No       | Optional language hint. BCP-47 values such as `ta-IN` are normalized to `ta` before being passed to Whisper |

### Example Request (cURL)

```bash
curl -X POST http://localhost:8000/asr/transcribe \
  -F "file=@query.webm;type=audio/webm" \
  -F "language=hi-IN"
```

### Example Response — `200 OK`

```json
{
    "transcription": "इस दवाई का बैच नंबर क्या है",
    "language": "hi",
    "language_probability": 0.97,
    "filename": "query.webm"
}
```

### Example Response — `422 Unprocessable Entity`

```json
{
    "detail": "Could not process audio file. Ensure it is a valid, non-corrupted audio recording."
}
```

## WS /asr/stream

Realtime ASR endpoint used by the Voice Triage page for progressive
transcription updates while the citizen is still speaking.

| Field         | Details                 |
| ------------- | ----------------------- |
| Method        | `WS`                    |
| Path          | `/asr/stream`           |
| Auth Required | No                      |
| Transport     | WebSocket binary + JSON |

### Client Messages

Start message:

```json
{
    "type": "start",
    "mimeType": "audio/webm",
    "language": "hi-IN"
}
```

Binary frames:

- Audio chunks from `MediaRecorder.ondataavailable`

Stop message:

```json
{
    "type": "stop"
}
```

### Server Messages

Ready:

```json
{
    "type": "ready"
}
```

Partial:

```json
{
    "type": "partial",
    "transcript": "I have fever",
    "language": "en",
    "languageConfidence": 0.72
}
```

Final:

```json
{
    "type": "final",
    "transcript": "I have fever and cough",
    "language": "en",
    "languageConfidence": 0.91
}
```

Error:

```json
{
    "type": "error",
    "error": "Expected start message before audio chunks."
}
```

---

# Error Codes Summary

| HTTP Status | Meaning                                                     |
| ----------- | ----------------------------------------------------------- |
| `200`       | Success                                                     |
| `400`       | Bad Request — malformed request syntax                      |
| `404`       | Not Found — endpoint does not exist                         |
| `422`       | Unprocessable Entity — validation failed                    |
| `429`       | Too Many Requests — rate limit exceeded                     |
| `502`       | Bad Gateway — upstream service returned invalid data        |
| `503`       | Service Unavailable — upstream service could not be reached |
| `504`       | Gateway Timeout — upstream ASR timed out                    |
| `500`       | Internal Server Error — something went wrong on the server  |

---

# Notes for Contributors

- The web Voice Triage flow now prefers direct browser WebSocket streaming to `/asr/stream`, falls back to `/api/voice/transcribe` if the realtime path fails, and only falls back to browser speech recognition when recording support itself is unavailable.
- The FastAPI ASR service is configurable through `WHISPER_MODEL_SIZE`, `WHISPER_DEVICE`, `WHISPER_COMPUTE_TYPE`, `WHISPER_BEAM_SIZE`, and `WHISPER_PRELOAD_ON_STARTUP`.
- For CPU-first deployments, the recommended baseline is `WHISPER_MODEL_SIZE=tiny`, `WHISPER_DEVICE=cpu`, `WHISPER_COMPUTE_TYPE=int8`, `WHISPER_BEAM_SIZE=5`, and `WHISPER_PRELOAD_ON_STARTUP=true`.
- Cold-start strategy matters: preload the Whisper model at service startup and keep the Hugging Face model cache warm or baked into the image so the first citizen request does not pay model download time.
- The Express API (`apps/api`) uses **Zod** for request validation — always validate inputs before processing.
- The FastAPI ML service uses **FastAPI**, multipart uploads, and configurable Faster-Whisper settings for the ASR path.
- Endpoints marked ⚠️ are designed/spec'd but not yet implemented. Do not call them in production until the linked issues are closed.
- Rate limiting is applied on all routes. See `apps/api/src/middleware/rateLimit.ts` for configuration.
