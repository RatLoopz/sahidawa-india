# API Endpoint Reference

This document provides a comprehensive reference for all API endpoints in the **SahiDawa** system.

The platform runs three service surfaces:

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
    - [POST /asr/transcribe](#post-asrtranscribe)

- [Error Codes Summary](#error-codes-summary)
- [Notes for Contributors](#notes-for-contributors)

---

# apps/web — Next.js Web App Routes (Port 3000)

## POST /api/voice/transcribe

Server-side proxy used by the Voice Triage page. The browser records audio,
uploads it to this route, and the web app forwards the file to the ML service
at `/asr/transcribe`.

| Field         | Details                 |
| ------------- | ----------------------- |
| Method        | `POST`                  |
| Path          | `/api/voice/transcribe` |
| Auth Required | No                      |
| Content-Type  | `multipart/form-data`   |

### Request Body

| Field      | Type     | Required | Description                                    |
| ---------- | -------- | -------- | ---------------------------------------------- |
| `file`     | `file`   | Yes      | Recorded audio clip to transcribe              |
| `language` | `string` | No       | Selected browser speech locale such as `ta-IN` |

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

| Field         | Details               |
| ------------- | --------------------- |
| Method        | `POST`                |
| Path          | `/asr/transcribe`     |
| Auth Required | No                    |
| Content-Type  | `multipart/form-data` |

---

# Error Codes Summary

| HTTP Status | Meaning                                                        |
| ----------- | -------------------------------------------------------------- |
| `200`       | Success                                                        |
| `400`       | Bad Request — malformed request syntax                         |
| `404`       | Not Found — endpoint does not exist                            |
| `422`       | Unprocessable Entity — validation failed                       |
| `429`       | Too Many Requests — rate limit exceeded                        |
| `502`       | Bad Gateway — upstream service returned an invalid payload     |
| `503`       | Service Unavailable — upstream dependency could not be reached |
| `500`       | Internal Server Error — something went wrong on the server     |

---

# Notes for Contributors

- The Express API (`apps/api`) uses **Zod** for request validation — always validate inputs before processing.
- The FastAPI ML service (`apps/ml`) uses **Pydantic** models for request/response schemas.
- Endpoints marked ⚠️ are designed/spec'd but not yet implemented. Do not call them in production until the linked issues are closed.
- Rate limiting is applied on all routes. See `apps/api/src/middleware/rateLimit.ts` for configuration.
