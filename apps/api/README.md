# Sahidawa India — API Reference Catalog

> **Version:** 1.0.0  
> **Base URL:** `https://<your-domain>/`  
> **Content-Type (default):** `application/json`

---

## Table of Contents

1. [Endpoints Overview](#endpoints-overview)
2. [Core Verification — `POST /api/verify`](#1-core-verification--post-apiverify)
3. [Scan — `POST /api/scan`](#2-scan--post-apiscan)
4. [System Health — `GET /health`](#3-system-health--get-health)
5. [Error Response Format](#error-response-format)
6. [Authentication](#authentication)

---

## Endpoints Overview

| # | Method | Route | Description | Auth Required |
|---|--------|-------|-------------|---------------|
| 1 | `POST` | `/api/verify` | Verify a batch by batch number | No |
| 2 | `POST` | `/api/scan` | Upload an image/document for scanning | No |
| 3 | `GET` | `/health` | Check system health status | No |

---

## 1. Core Verification — `POST /api/verify`

Verifies the authenticity and status of a product batch using its batch number.

### Request

| Property | Value |
|----------|-------|
| **Method** | `POST` |
| **URL** | `/api/verify` |
| **Content-Type** | `application/json` |

#### Request Body

```json
{
  "batchNumber": "BATCH123"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `batchNumber` | `string` | ✅ Yes | The unique batch identifier to verify |

#### Example cURL

```bash
curl -X POST https://<your-domain>/api/verify \
  -H "Content-Type: application/json" \
  -d '{"batchNumber": "BATCH123"}'
```

---

### Response

#### `200 OK` — Successful Verification

```json
{
  "success": true,
  "status": "verified",
  "batchNumber": "BATCH123",
  "product": {
    "name": "Product Name",
    "category": "Category",
    "manufacturingDate": "2024-01-15",
    "expiryDate": "2026-01-15",
    "origin": "India"
  },
  "manufacturer": {
    "id": "MFG-001",
    "name": "Manufacturer Name",
    "licenseNumber": "LIC-2024-XXXX",
    "address": "123 Factory Road, City, State - 000000"
  },
  "verifiedAt": "2025-05-19T10:30:00.000Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | `true` when verification succeeds |
| `status` | `string` | `"verified"` \| `"unverified"` \| `"expired"` |
| `batchNumber` | `string` | Echo of the queried batch number |
| `product.name` | `string` | Product display name |
| `product.category` | `string` | Product category/type |
| `product.manufacturingDate` | `string` (ISO 8601) | Date of manufacture |
| `product.expiryDate` | `string` (ISO 8601) | Expiry/best-before date |
| `product.origin` | `string` | Country or region of origin |
| `manufacturer.id` | `string` | Internal manufacturer identifier |
| `manufacturer.name` | `string` | Registered manufacturer name |
| `manufacturer.licenseNumber` | `string` | Government-issued license number |
| `manufacturer.address` | `string` | Registered address |
| `verifiedAt` | `string` (ISO 8601) | Timestamp of the verification check |

#### `404 Not Found` — Batch Not Found

```json
{
  "success": false,
  "status": "not_found",
  "message": "No batch found with number: BATCH123"
}
```

#### `422 Unprocessable Entity` — Validation Error

```json
{
  "success": false,
  "status": "validation_error",
  "message": "batchNumber is required and must be a non-empty string"
}
```

---

## 2. Scan — `POST /api/scan`

Accepts a multipart form-data upload (image or document) and returns extracted/parsed information from the scan.

### Request

| Property | Value |
|----------|-------|
| **Method** | `POST` |
| **URL** | `/api/scan` |
| **Content-Type** | `multipart/form-data` |

#### Form Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | `File` (binary) | ✅ Yes | The image or document to scan (JPEG, PNG, PDF, WEBP) |
| `scanType` | `string` | No | Hint for scan mode: `"barcode"` \| `"qr"` \| `"label"` \| `"auto"` (default: `"auto"`) |

#### Accepted File Types

| MIME Type | Extension | Max Size |
|-----------|-----------|----------|
| `image/jpeg` | `.jpg`, `.jpeg` | 10 MB |
| `image/png` | `.png` | 10 MB |
| `image/webp` | `.webp` | 10 MB |
| `application/pdf` | `.pdf` | 10 MB |

#### Example cURL

```bash
curl -X POST https://<your-domain>/api/scan \
  -F "file=@/path/to/product-label.jpg" \
  -F "scanType=auto"
```

#### Example JavaScript (Fetch API)

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('scanType', 'auto');

const response = await fetch('/api/scan', {
  method: 'POST',
  body: formData,
});
const result = await response.json();
```

---

### Response

#### `200 OK` — Scan Successful

```json
{
  "success": true,
  "scanType": "qr",
  "extractedData": {
    "batchNumber": "BATCH123",
    "rawValue": "https://sahidawa.in/verify/BATCH123",
    "confidence": 0.98
  },
  "file": {
    "originalName": "product-label.jpg",
    "mimeType": "image/jpeg",
    "sizeBytes": 204800
  },
  "scannedAt": "2025-05-19T10:35:00.000Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | `true` when scan processing succeeds |
| `scanType` | `string` | Detected or used scan type (`"barcode"`, `"qr"`, `"label"`, `"auto"`) |
| `extractedData.batchNumber` | `string` | Batch number extracted from scan (if found) |
| `extractedData.rawValue` | `string` | Raw decoded string from barcode/QR |
| `extractedData.confidence` | `number` | Confidence score `0.0–1.0` |
| `file.originalName` | `string` | Original uploaded filename |
| `file.mimeType` | `string` | Detected MIME type |
| `file.sizeBytes` | `integer` | File size in bytes |
| `scannedAt` | `string` (ISO 8601) | Timestamp of the scan operation |

#### `400 Bad Request` — No File Uploaded

```json
{
  "success": false,
  "message": "No file was uploaded. Please attach a file using the 'file' field."
}
```

#### `415 Unsupported Media Type`

```json
{
  "success": false,
  "message": "Unsupported file type: application/zip. Accepted types: image/jpeg, image/png, image/webp, application/pdf"
}
```

#### `422 Unprocessable Entity` — Scan Failed / No Data Found

```json
{
  "success": false,
  "message": "Scan completed but no readable barcode or QR code was detected.",
  "scanType": "auto",
  "extractedData": null
}
```

---

## 3. System Health — `GET /health`

Returns the current operational status of the API and its dependent services. Use this endpoint for uptime monitoring, load-balancer health checks, and CI/CD readiness probes.

### Request

| Property | Value |
|----------|-------|
| **Method** | `GET` |
| **URL** | `/health` |
| **Content-Type** | N/A |

#### Example cURL

```bash
curl https://<your-domain>/health
```

---

### Response

#### `200 OK` — System Healthy

```json
{
  "status": "ok",
  "uptime": 48320.5,
  "timestamp": "2025-05-19T10:40:00.000Z",
  "services": {
    "database": {
      "status": "ok",
      "responseTimeMs": 3
    },
    "storage": {
      "status": "ok",
      "responseTimeMs": 12
    }
  },
  "version": "1.0.0"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | `string` | Overall status: `"ok"` \| `"degraded"` \| `"down"` |
| `uptime` | `number` | Server uptime in seconds |
| `timestamp` | `string` (ISO 8601) | Time of the health check |
| `services.database.status` | `string` | DB connectivity: `"ok"` \| `"error"` |
| `services.database.responseTimeMs` | `integer` | DB ping latency in milliseconds |
| `services.storage.status` | `string` | File storage status: `"ok"` \| `"error"` |
| `services.storage.responseTimeMs` | `integer` | Storage ping latency in milliseconds |
| `version` | `string` | Deployed API version |

#### `503 Service Unavailable` — Degraded or Down

```json
{
  "status": "degraded",
  "uptime": 48320.5,
  "timestamp": "2025-05-19T10:40:00.000Z",
  "services": {
    "database": {
      "status": "error",
      "responseTimeMs": null,
      "error": "Connection timeout"
    },
    "storage": {
      "status": "ok",
      "responseTimeMs": 14
    }
  },
  "version": "1.0.0"
}
```

---

## Error Response Format

All error responses follow a consistent structure:

```json
{
  "success": false,
  "message": "Human-readable error description",
  "code": "ERROR_CODE"
}
```

### Common HTTP Status Codes

| Code | Meaning | When It Occurs |
|------|---------|----------------|
| `200` | OK | Request succeeded |
| `400` | Bad Request | Missing required fields or malformed request body |
| `404` | Not Found | Resource (e.g., batch number) does not exist |
| `413` | Payload Too Large | Uploaded file exceeds the 10 MB limit |
| `415` | Unsupported Media Type | File type not accepted by `/api/scan` |
| `422` | Unprocessable Entity | Validation failed or scan yielded no result |
| `500` | Internal Server Error | Unexpected server-side failure |
| `503` | Service Unavailable | One or more dependent services are down |

---

## Authentication

Currently, all endpoints are **publicly accessible** (no authentication required). If token-based auth is introduced in future iterations, requests will need to include:

```
Authorization: Bearer <token>
```

---

*Last updated: May 2025 — GSSoC Issue #301*