# API Endpoint Reference

This document provides a comprehensive reference for all API endpoints in the **SahiDawa** system.

The platform runs two backend services:

| Service    | Technology        | Port   | Base URL                |
| ---------- | ----------------- | ------ | ----------------------- |
| `apps/api` | Express (Node.js) | `4000` | `http://localhost:4000` |
| `apps/ml`  | FastAPI (Python)  | `8000` | `http://localhost:8000` |

---

# Table of Contents

* [apps/api — Express Service](#appsapi--express-service-port-4000)

  * [GET /](#get-)
  * [GET /health](#get-health)
  * [POST /api/verify](#post-apiverify)
* [apps/ml — FastAPI ML Service](#appsml--fastapi-ml-service-port-8000)

  * [GET /](#get--1)
  * [GET /health](#get-health-1)
  * [POST /ocr/extract](#post-ocrextract)
  * [POST /voice/transcribe](#post-voicetranscribe)
* [Error Codes Summary](#error-codes-summary)
* [Notes for Contributors](#notes-for-contributors)

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
| `batch_number` | `string` | ✅ Yes    | The batch number printed on the medicine strip |
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
| `image` | `file` | ✅ Yes    | Image file of the medicine strip (`JPEG`, `PNG`, `WEBP`) |

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

---

## POST /voice/transcribe

> ⚠️ **Pending implementation** — This endpoint will be available once Issue #16: **[ML] Add Voice Transcription Endpoint using OpenAI Whisper (Local)** is completed.

Transcribes a voice query using a locally hosted Whisper model. Supports all 22 Indian scheduled languages.

| Field         | Details               |
| ------------- | --------------------- |
| Method        | `POST`                |
| Path          | `/voice/transcribe`   |
| Auth Required | No                    |
| Content-Type  | `multipart/form-data` |

### Request Body

| Field      | Type     | Required | Description                                                    |
| ---------- | -------- | -------- | -------------------------------------------------------------- |
| `audio`    | `file`   | ✅ Yes    | Audio file recorded from browser (`WAV`, `MP3`, `WEBM`, `OGG`) |
| `language` | `string` | No       | BCP-47 language code hint (e.g. `hi`, `ta`, `bn`)              |

### Example Request (cURL)

```bash
curl -X POST http://localhost:8000/voice/transcribe \
  -F "audio=@query.webm" \
  -F "language=hi"
```

### Example Response — `200 OK`

```json
{
  "success": true,
  "transcript": "इस दवाई का बैच नंबर क्या है",
  "detected_language": "hi",
  "language_name": "Hindi",
  "confidence": 0.97,
  "duration_seconds": 3.2
}
```

### Example Response — `422 Unprocessable Entity`

```json
{
  "success": false,
  "error": "Audio file is too short or silent. Please record at least 1 second of speech."
}
```

---

# Error Codes Summary

| HTTP Status | Meaning                                                    |
| ----------- | ---------------------------------------------------------- |
| `200`       | Success                                                    |
| `400`       | Bad Request — malformed request syntax                     |
| `404`       | Not Found — endpoint does not exist                        |
| `422`       | Unprocessable Entity — validation failed                   |
| `429`       | Too Many Requests — rate limit exceeded                    |
| `500`       | Internal Server Error — something went wrong on the server |

---

# Notes for Contributors

* The Express API (`apps/api`) uses **Zod** for request validation — always validate inputs before processing.
* The FastAPI ML service (`apps/ml`) uses **Pydantic** models for request/response schemas.
* Endpoints marked ⚠️ are designed/spec'd but not yet implemented. Do not call them in production until the linked issues are closed.
* Rate limiting is applied on all routes. See `apps/api/src/middleware/rateLimit.ts` for configuration.
