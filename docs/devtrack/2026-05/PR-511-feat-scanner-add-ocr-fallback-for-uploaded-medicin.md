# PR #511 — feat(scanner): add OCR fallback for uploaded medicine images

> **Merged:** 2026-05-24 | **Author:** @Abhii-afk | **Area:** Frontend | **Impact Score:** 16 | **Closes:** #354

## What Changed

This pull request significantly enhances our medicine image upload functionality by replacing the previous server-side OCR endpoint with a robust client-side pipeline. We now first attempt barcode detection using ZXing, and if no barcode is found, we fall back to Tesseract.js for client-side optical character recognition (OCR) to extract medicine details. Additionally, we've improved the responsiveness of the "How It Works" page for smaller viewports.

## The Problem Being Solved

Before this change, our system relied on a backend OCR service (`API_BASE/api/v1/scan/extract`) for extracting text from uploaded medicine images. This approach introduced several challenges:

1.  **Backend Dependency and Latency:** Every image upload required a network call to our API, adding latency and increasing the load on our backend services. This could lead to slower user experiences, especially in areas with poor network connectivity, and potential scalability issues for the OCR service itself.
2.  **Lack of Robust Fallback:** If barcode scanning failed for an uploaded image, there was no client-side mechanism to extract information, leading to a dead-end for the user.
3.  **Poor User Feedback:** The previous implementation lacked detailed progress indicators during the scanning and OCR process, leaving users uncertain about the system's activity.
4.  **UI/UX Inconsistencies:** The "How It Works" page exhibited layout issues, specifically `overflow-hidden` causing content clipping and incorrect heading sizes at 320px viewport width, diminishing the user experience on mobile devices.
5.  **Code Duplication and Inefficiency:** Parsing logic for batch numbers and expiry dates was embedded directly within the `scan/page.tsx` component and was not as robust for diverse Indian medicine strip formats, necessitating a more centralized and flexible utility.

## Files Modified

- `apps/web/app/[locale]/how-it-works/page.tsx`
- `apps/web/app/[locale]/scan/page.tsx`
- `apps/web/package.json`
- `apps/web/src/utils/medicineParser.ts`
- `package-lock.json`

## Implementation Details

The core of this change lies within `apps/web/app/[locale]/scan/page.tsx`, which now orchestrates a multi-stage client-side image processing pipeline for uploaded medicine strip images.

1.  **File Upload Handling:**
    - The `handleFileUpload` function is the entry point for processing an uploaded image.
    - It reads the uploaded `File` object into a `dataUrl` using `FileReader`.
    - The `e.target.value = ""` line ensures that the same file can be re-uploaded immediately after an error or retry.

2.  **State Management:**
    - New `useState` variables `ocrStatus` (`idle`, `scanning-barcode`, `extracting-text`, `done`, `error`) and `ocrProgress` (0-100) manage the UI's current state and OCR progress.
    - `ocrWorkerRef = useRef<Tesseract.Worker | null>(null)` is used to persist the Tesseract.js worker instance across renders, ensuring it's created only once.
    - `ocrCancelledRef = useRef(false)` acts as a flag to prevent race conditions or double invocations, especially during component unmount or retry scenarios.

3.  **ZXing Barcode Detection (First Pass):**
    - Upon file upload, `ocrStatus` is set to `"scanning-barcode"`.
    - We dynamically import `@zxing/browser` and `@zxing/library` to minimize the initial bundle size.
    - An instance of `BrowserMultiFormatReader` is created with specific `DecodeHintType.POSSIBLE_FORMATS` (CODE_128, QR_CODE, EAN_13, EAN_8, CODE_39, DATA_MATRIX) and `DecodeHintType.TRY_HARDER` enabled for improved detection.
    - `reader.decodeFromImageUrl(dataUrl)` attempts to find a barcode.
    - If a barcode is successfully detected (`zxingResult.getText().trim()` is not empty), `barcodeFound` is set to `true`, `setBatchInput` is updated, `ocrStatus` is set to `"done"`, a success toast is shown, and `handleVerify` is called with the barcode text. The process then returns, skipping OCR.

4.  **Tesseract.js OCR Fallback (Second Pass):**
    - If `barcodeFound` is `false` (meaning ZXing failed or found no barcode), the system proceeds to OCR.
    - `ocrStatus` is updated to `"extracting-text"`.
    - The `ocrWorkerRef.current` is initialized if it's null. The worker is loaded (`worker.load()`) and the English language pack is loaded (`worker.loadLanguage('eng')`).
    - `worker.recognize(dataUrl)` is called to perform OCR on the uploaded image.
    - A `progress` event listener is attached to the worker to update `ocrProgress` in real-time, providing visual feedback to the user.
    - **Timeout Mechanism:** A `Promise.race` is used to implement a 30-second timeout. If the OCR operation exceeds this duration, the `timeoutPromise` rejects, terminating the Tesseract worker (`ocrWorkerRef.current.terminate()`) and setting the `ocrStatus` to `"error"`. This prevents the UI from getting stuck in a loading state indefinitely.

5.  **Medicine Detail Parsing:**
    - After successful OCR, the extracted raw text is passed to utility functions from the newly created `src/utils/medicineParser.ts`.
    - `extractMedicineName(ocrResult.data.text)`, `extractBatchNumber(ocrResult.data.text)`, and `extractExpiryDate(ocrResult.data.text)` use specific regex patterns to robustly identify and extract these key pieces of information from the OCR output, tailored for common Indian medicine strip formats.
    - The extracted `parsedBatch` and `parsedExpiry` are then used to update the UI and initiate the `handleVerify` process.

6.  **Worker Lifecycle and Error Handling:**
    - A `useEffect` hook ensures that the Tesseract worker is terminated (`ocrWorkerRef.current.terminate()`) when the `ScanPage` component unmounts. This prevents memory leaks.
    - Error handling in the `catch` block for both ZXing and Tesseract operations ensures that `ocrStatus` is set to `"error"`, the worker is terminated, and a descriptive error message is displayed, along with a "Retry" button.

7.  **UI Updates:**
    - The `LoadingSkeleton` component now accepts `ocrStatus` and `ocrProgress` props. It dynamically displays messages like "Scanning barcode..." or "Extracting text with OCR... XX%" along with a progress bar, providing clear user feedback.
    - The four UI states (`idle`, `loading` (via `scanning-barcode`/`extracting-text`), `success`, `error`) are fully implemented to guide the user through the scanning process.

8.  **"How It Works" Page Fixes:**
    - In `apps/web/app/[locale]/how-it-works/page.tsx`, the `main` element's `overflow-hidden` class was changed to `overflow-x-hidden`. This specifically addresses horizontal overflow issues without affecting vertical scrolling.
    - The `h1` element's `text-5xl` class was updated to `text-4xl sm:text-5xl md:text-7xl` to ensure proper scaling and prevent text overflow on smaller screens (e.g., 320px viewport).

9.  **Code Cleanup:**
    - Removed `API_BASE` import and several unused, less robust parsing functions (`parseBatchNumber`, `parseExpiryDate`, `extractBrandCandidate`, `extractBatchFromOcrText`) from `apps/web/app/[locale]/scan/page.tsx`.

## Technical Decisions

1.  **Client-Side OCR Adoption:** We decided to move the OCR processing for uploaded images entirely to the client-side. This decision was driven by the need to reduce reliance on our backend infrastructure, improve response times for users, and potentially enable functionality in environments with intermittent connectivity. It shifts computational load from our servers to the user's device, which is a common pattern for performance-critical frontend features.
2.  **ZXing First, Tesseract.js Fallback:** The choice to prioritize barcode scanning with ZXing before resorting to Tesseract.js OCR is strategic. Barcode scanning is generally faster and more accurate for structured identifiers. Tesseract.js provides a robust, albeit more computationally intensive, fallback for images where barcodes are absent, unreadable, or not present. This hybrid approach maximizes both speed and reliability.
3.  **Tesseract.js Worker Management:** Using `useRef` to manage the Tesseract.js worker instance ensures that the worker is initialized only once and reused for subsequent OCR attempts within the component's lifecycle. This minimizes the overhead of worker creation and language loading. The `useEffect` cleanup and `ocrCancelledRef` are critical for preventing memory leaks and ensuring proper resource management, especially when users navigate away or retry scans.
4.  **Pure Regex for `medicineParser.ts`:** For extracting specific data points like expiry dates, batch numbers, and medicine names, we opted for a pure regex-based utility (`src/utils/medicineParser.ts`). This approach is lightweight, performant, and highly customizable for the specific patterns found on Indian medicine strips. While more advanced NLP libraries exist, regex is sufficient and more efficient for this well-defined extraction task, avoiding unnecessary overhead.
5.  **30-Second OCR Timeout:** Implementing a strict 30-second timeout using `Promise.race` for the OCR operation is a crucial UX decision. OCR on complex or blurry images can be time-consuming or even get stuck. This timeout prevents indefinite loading states, providing a clear error path and a retry option, which significantly improves user satisfaction.
6.  **Dynamic UI States:** The explicit definition and management of four UI states (`idle`, `loading`, `success`, `error`) with dynamic messages and progress bars (`LoadingSkeleton`) were chosen to provide transparent and intuitive feedback to the user throughout the potentially lengthy scanning process.
7.  **Responsive Design Fixes:** The specific Tailwind CSS class adjustments in `apps/web/app/[locale]/how-it-works/page.tsx` (`overflow-x-hidden`, `text-4xl sm:text-5xl md:text-7xl`) were chosen to adhere to modern responsive design principles, ensuring our platform is accessible and visually appealing across a wide range of devices, particularly on smaller mobile screens.

## How To Re-Implement (Contributor Reference)

To re-implement this client-side OCR fallback feature, a contributor would follow these steps:

1.  **Install Tesseract.js:**
    - Navigate to the `apps/web` directory.
    - Run `npm install tesseract.js@^7.0.0` to add the Tesseract.js library as a dependency.

2.  **Create `medicineParser.ts` Utility:**
    - Create a new file `apps/web/src/utils/medicineParser.ts`.
    - Implement pure regex-based functions within this file:
        - `extractExpiryDate(text: string): string | null`: Should identify patterns like `EXP MM/YYYY`, `MM/YY`, `BB MM/YYYY`, handling common date formats.
        - `extractBatchNumber(text: string): string | null`: Should look for patterns like `BATCH NO. XXXXX`, `B.NO. YYYY`, `LOT ZZZZ`, and common alphanumeric sequences.
        - `extractMedicineName(text: string): string | null`: Not documented in this PR, but typically would involve heuristics to find prominent text lines not matching other patterns.

3.  **Modify `apps/web/app/[locale]/scan/page.tsx`:**
    - **Imports:**
        - Remove `API_BASE` import.
        - Import `useState`, `useCallback`, `useRef`, `useEffect` from `react`.
        - Import `Tesseract` from `tesseract.js`.
        - Import `extractExpiryDate`, `extractBatchNumber`, `extractMedicineName` from `../src/utils/medicineParser`.
    - **State and Refs:**
        - Add `ocrStatus` (`"idle" | "scanning-barcode" | "extracting-text" | "done" | "error"`) and `ocrProgress` (`number`) to `useState`.
        - Add `ocrWorkerRef = useRef<Tesseract.Worker | null>(null)` and `ocrCancelledRef = useRef(false)`.
    - **Worker Cleanup (`useEffect`):**
        - Implement a `useEffect` hook that returns a cleanup function to terminate `ocrWorkerRef.current` when the component unmounts or `ocrCancelledRef.current` is true.
    - **Update `LoadingSkeleton`:**
        - Modify the `LoadingSkeleton` component to accept `ocrStatus` and `ocrProgress` as props.
        - Implement conditional rendering to display "Scanning barcode...", "Extracting text with OCR... XX%" messages, and a progress bar based on these props.
    - **Refactor `handleFileUpload`:**
        - Read the uploaded file into a `dataUrl` asynchronously.
        - Set `setIsScanning(true)`, `setShowResult(false)`, clear previous parsed data.
        - Set `ocrCancelledRef.current = false`.
        - **ZXing Barcode Scan:**
            - Set `setOcrStatus("scanning-barcode")`.
            - Dynamically import `BrowserMultiFormatReader` and `DecodeHintType`, `BarcodeFormat` from `@zxing/browser` and `@zxing/library` respectively.
            - Initialize `BrowserMultiFormatReader` with appropriate hints (e.g., `DecodeHintType.POSSIBLE_FORMATS`, `DecodeHintType.TRY_HARDER`).
            - Call `reader.decodeFromImageUrl(dataUrl)`.
            - If a barcode is found, update `batchInput`, `setOcrStatus("done")`, show a success toast, call `handleVerify(barcodeText)`, and `return`.
        - **Tesseract.js OCR Fallback:**
            - If no barcode is found or ZXing fails, set `setOcrStatus("extracting-text")`.
            - Initialize `ocrWorkerRef.current` if null, then call `worker.load()` and `worker.loadLanguage('eng')`.
            - Wrap `worker.recognize(dataUrl)` in a `Promise.race` with a 30-second timeout.
            - Attach a `progress` event listener to the worker to update `setOcrProgress`.
            - On successful OCR, use `extractMedicineName`, `extractBatchNumber`, `extractExpiryDate` from `medicineParser.ts` to parse the `ocrResult.data.text`.
            - Update `setParsedBatch`, `setParsedExpiry`, and `setMedicineName`.
            - Call `handleVerify(parsedBatch)`.
        - **Error Handling:**
            - In the `catch` block for both ZXing and Tesseract, set `setOcrStatus("error")`, terminate `ocrWorkerRef.current`, and display an error message.
    - **Remove Old Code:**
        - Delete the `parseExpiryDate`, `parseBatchNumber`, `extractBrandCandidate`, `extractBatchFromOcrText` functions.
        - Remove the `API_BASE` import.

4.  **Modify `apps/web/app/[locale]/how-it-works/page.tsx`:**
    - Change the `className` of the `main` element from `overflow-hidden` to `overflow-x-hidden`.
    - Update the `className` of the `h1` element from `text-5xl` to `text-4xl sm:text-5xl md:text-7xl`.

## Impact on System Architecture

This change significantly impacts our system architecture by shifting a critical image processing workload from the backend to the frontend.

1.  **Decoupling from Backend OCR Service:** We have completely removed the dependency on a dedicated backend OCR endpoint (`API_BASE/api/v1/scan/extract`). This reduces the complexity of our `apps/api` service, lowers its computational load, and eliminates potential bottlenecks or costs associated with running a server-side OCR solution.
2.  **Enhanced Frontend Autonomy:** The `apps/web` application now possesses greater autonomy for image analysis. This makes the scanning feature more resilient to backend service outages and potentially allows for future offline capabilities for the initial scanning phase (though final verification still requires API calls).
3.  **Improved Scalability and Cost Efficiency:** By offloading OCR to client devices, we inherently scale the processing power with our user base without incurring additional server infrastructure costs for OCR.
4.  **Reduced Network Latency:** Performing OCR directly in the browser eliminates the round-trip network latency to the backend for image processing, leading to a faster and more responsive user experience, especially crucial in rural health settings where network conditions can be unreliable.
5.  **Increased Frontend Bundle Size:** The primary architectural trade-off is an increase in the JavaScript bundle size for `apps/web` due to the inclusion of `tesseract.js`. We mitigate this by dynamically importing ZXing libraries, but the Tesseract.js worker and language data still contribute to the overall download size.
6.  **Foundation for Client-Side ML/AI:** This establishes a precedent and a working pattern for integrating other client-side machine learning or AI models directly into our frontend, opening doors for future features like local image enhancement, object detection, or more advanced text analysis without backend intervention.

## Testing & Verification

This change was thoroughly tested through a combination of manual verification and automated checks.

**Automated Checks:**

- `npx tsc --noEmit`: Confirmed zero TypeScript errors, ensuring type safety and correct module resolution.
- `npx eslint .`: Confirmed zero ESLint errors, maintaining our code quality and adherence to style guides.
- `npm install tesseract.js@^7.0.0`: Verified successful dependency installation and audit.

**Manual Verification (Verification Matrix):**

- **Upload image with valid barcode:** Tested by uploading images containing clear barcodes. The system correctly identified the barcode using ZXing, displayed the result, and did not proceed to OCR, confirming the priority of barcode scanning.
- **Upload image without barcode:** Tested with images lacking barcodes or having unreadable ones. The OCR fallback activated as expected, displaying the "Extracting text with OCR... XX%" progress, and successfully extracted text.
- **Upload blurry/unreadable image:** Tested with intentionally poor-quality images. The system correctly transitioned to an error state with a descriptive message and a "Retry" button, demonstrating robust error handling.
- **Click Retry after OCR error:** After encountering an OCR error, clicking "Retry" successfully reset the worker and restarted the scan process cleanly, confirming proper worker lifecycle management.
- **Navigate away mid-scan:** Tested by initiating a scan and then quickly navigating to another page. No console errors were observed, and no memory leaks were detected, validating the `useEffect` cleanup and `ocrCancelledRef` logic.
- **320px viewport on "How It Works":** Verified the "How It Works" page on Chrome DevTools at 320px width. The layout was correct, with no horizontal overflow and the hero heading (`h1`) displayed at the appropriate size, confirming the responsive design fixes.

**Edge Cases:**

- **OCR Timeout:** The 30-second timeout mechanism was implicitly tested by observing that very long OCR operations (e.g., on extremely large or complex images, or simulated network delays) would eventually lead to the error state, preventing indefinite loading.
- **Concurrent Scans:** While not explicitly documented, the `ocrCancelledRef` and worker termination logic help manage scenarios where a user might attempt multiple uploads rapidly or navigate away during a scan, preventing conflicts or resource exhaustion.
- **Language Support:** Currently, Tesseract.js is configured for the `eng` language pack. This covers our primary use case but implies that OCR for non-English medicine strips would require additional language pack loading and potentially more complex parsing logic.
