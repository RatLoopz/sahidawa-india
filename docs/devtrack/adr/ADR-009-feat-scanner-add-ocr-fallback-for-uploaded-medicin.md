# ADR — feat(scanner): add OCR fallback for uploaded medicine images

> **Date:** 2026-05-24 | **PR:** #511 | **Status:** Accepted

## Context

The existing server-side OCR endpoint (`API_BASE/api/v1/scan/extract`) for processing uploaded medicine images presented limitations, including potential latency, increased server load, and dependency on external API calls. This approach hindered the goal of providing a fast and reliable user experience for extracting medicine information, especially when barcodes were absent or unreadable. A more robust and responsive solution was required to ensure medicine details could be extracted directly from images uploaded by users.

## Decision

The server-side OCR endpoint was deprecated and replaced with a fully client-side processing pipeline for uploaded medicine images. This pipeline first attempts barcode decoding using `ZXing.decodeFromImageUrl`. If barcode detection fails, `Tesseract.js` is utilized as a fallback to perform Optical Character Recognition (OCR) directly within the user's browser.

Key implementation details include:

- Removal of the `API_BASE/api/v1/scan/extract` call.
- Creation of `src/utils/medicineParser.ts` for robust regex-based extraction of expiry dates, batch numbers, and medicine names from OCR text.
- Implementation of `Tesseract.js` worker lifecycle management, including single worker instantiation, reuse, and termination on unmount or error.
- A 30-second `Promise.race` timeout to prevent stalled OCR operations.
- Development of a detailed progress UI, indicating barcode scanning and OCR progress.
- Comprehensive handling of `idle`, `loading`, `success`, and `error` UI states.

## Alternatives Considered

| Alternative                                            | Why Rejected                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Continue using a server-side OCR endpoint**          | This approach was prone to network latency, increased server load, and potential API costs. Offloading processing to the client improves responsiveness and reduces infrastructure burden.                                                                                                                                                             |
| **Implement client-side OCR without barcode fallback** | Barcode scanning is generally faster and more accurate for structured data. Relying solely on OCR would introduce unnecessary processing time and potential errors for images that contain scannable barcodes.                                                                                                                                         |
| **Use a different client-side OCR library or service** | `Tesseract.js` is a mature, open-source, and widely adopted library that runs entirely in the browser, offering a good balance of performance, features, and minimal additional dependencies (`tesseract.js@^7.0.0` was the only new dependency). Other options might have introduced higher bundle sizes, licensing costs, or less community support. |

## Consequences

**Positive:**

- **Improved User Experience:** Faster initial barcode scanning and a reliable fallback for images without barcodes, with clear progress indicators, leading to a more responsive application.
- **Reduced Server Load and Cost:** Computationally intensive OCR processing is offloaded from the backend API to the client's browser, significantly reducing server resource consumption and operational costs.
- **Enhanced Reliability:** The client-side pipeline is less susceptible to network latency or server-side outages for OCR processing, making the scanning feature more robust.
- **Code Simplification:** Removal of `API_BASE` dependency and associated dead code streamlines the frontend codebase.

**Trade-offs:**

- **Increased Client-Side Resource Usage:** OCR processing can be CPU and memory intensive, potentially impacting performance on older or less powerful client devices.
- **Larger Frontend Bundle Size:** The inclusion of `tesseract.js` adds to the overall JavaScript bundle size that must be downloaded by the client.
- **OCR Accuracy Variability:** Client-side OCR accuracy can vary based on image quality and device processing power, and may not always match the precision of a dedicated, highly optimized server-side ML service.

## Related Issues & PRs

- PR #511: feat(scanner): add OCR fallback for uploaded medicine images
- Issue #354
