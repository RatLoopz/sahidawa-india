# ADR — feat(ocr): bridge Next.js scanner UI with FastAPI ML microservice via…

> **Date:** 2026-05-18 | **PR:** #229 | **Status:** Accepted

## Context

The SahiDawa platform required real-time Optical Character Recognition (OCR) capabilities for medicine verification. Previously, the Next.js frontend scanner UI displayed hardcoded mock results for image uploads. A dedicated FastAPI ML microservice existed for OCR processing but lacked a connection layer to the frontend. The problem was to establish a robust, secure, and scalable communication bridge between the Next.js UI and the FastAPI ML service to enable genuine OCR extraction.

## Decision

An Express API Gateway (`apps/api`) was implemented as the intermediary for handling image uploads and proxying requests to the FastAPI ML OCR service.

1.  **File Handling**: `multer` was installed in the Express API Gateway to process multi-part image uploads, storing files in memory (`multer.memoryStorage()`) to facilitate forwarding.
2.  **Proxy Endpoint**: A new POST endpoint, `/api/v1/scan/extract`, was added to the Express Gateway. This endpoint receives image files from the frontend.
3.  **Request Forwarding**: The Express Gateway constructs a `FormData` object from the received image file (as a Blob from `req.file.buffer`) and forwards it to the FastAPI OCR service at a configurable `ML_SERVICE_URL/ocr/extract`. A 30-second timeout was configured for this upstream request.
4.  **Frontend Integration**: The Next.js scanner modal (`scan/page.tsx`) was updated to send `FormData` POST requests containing the image file directly to the new Express Gateway endpoint.
5.  **Error Handling**: Graceful fallback was implemented in the Express Gateway to return a 503 status and a user-friendly message if the ML OCR service is unreachable or returns an error. The frontend displays a warning toast in such cases.
6.  **Network Configuration**: `ML_SERVICE_URL` routing was configured within the Docker Compose network to ensure proper service discovery and communication.
7.  **UI Feedback**: An interactive "OCR Extracted Text Debug Log" panel was added to the frontend to dynamically display raw OCR output and confidence scores.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Direct Client-to-ML Service Communication** | Exposes the ML service directly to the public internet, bypassing the existing API Gateway's security, authentication, authorization, rate limiting, and logging infrastructure. Introduces CORS complexities and tightly couples the frontend to the ML service's network location. |
| **Integrating OCR Logic into Express Gateway** | Violates separation of concerns by embedding specialized ML processing within the general-purpose API Gateway. Express/Node.js is not optimized for ML workloads, which are better handled by Python/FastAPI. This would increase the Gateway's complexity, resource usage, and hinder independent scaling and deployment of the ML service. |

## Consequences

**Positive:**
- Enabled real-time, genuine OCR extraction, replacing mock data and significantly enhancing platform utility.
- Maintained a clear separation of concerns by leveraging a specialized FastAPI ML service for OCR, while the Express Gateway handles API routing and security.
- Centralized API management (logging, error handling, potential future authentication/authorization) through the Express Gateway.
- Decoupled the Next.js frontend from the ML service's direct network access, improving security and maintainability.
- Provided immediate and dynamic user feedback through the "OCR Extracted Text Debug Log" and graceful error toasts.

**Trade-offs:**
- Introduced an additional network hop (Express Gateway) between the frontend and the ML service, potentially adding marginal latency.
- Increased the Express Gateway's operational responsibility and resource usage by handling multi-part file uploads in memory (`multer.memoryStorage()`).
- Added `multer` as a new dependency to the Express Gateway, increasing the project's dependency footprint.

## Related Issues & PRs

- PR #229: feat(ocr): bridge Next.js scanner UI with FastAPI ML microservice via…
- Issue #213