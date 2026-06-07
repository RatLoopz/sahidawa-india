# PR #1288 — [Critical] fix(scan): replace silent catch blocks with logger.warn calls

> **Merged:** 2026-06-04 | **Author:** @AnushKamble | **Area:** Frontend | **Impact Score:** 5 | **Closes:** #1286

## What Changed

This PR addresses a critical debugging issue in `apps/web/app/[locale]/scan/page.tsx` by replacing three silent `catch {}` blocks with explicit `logger.warn()` calls. We now log detailed error messages and contextual information when barcode detection (ZXing), batch verification, or fuzzy brand matching operations fail, ensuring that errors are visible in logs while preserving existing fallback mechanisms.

## The Problem Being Solved

Previously, our `scan/page.tsx` component contained three empty `catch` blocks at lines 834, 907-908, and 930. These blocks silently swallowed any errors that occurred during critical operations like barcode detection using `@zxing/browser`, API calls for batch verification, or fuzzy brand matching. This made it extremely difficult for developers to diagnose issues, as failures (e.g., network errors, unexpected ZXing exceptions, module loading failures) were completely invisible in both development and production environments. Users also received no specific feedback when these underlying processes failed, leading to a poor experience and opaque debugging.

## Files Modified

- `apps/web/app/[locale]/scan/page.tsx`

## Implementation Details

The core of this implementation involved modifying `apps/web/app/[locale]/scan/page.tsx`.

1.  **Import `structuredLog`:** We added `import { structuredLog as logger } from "@/lib/structuredLogger";` at line 47 to make our standardized logging utility available within the component.
2.  **Modify Barcode Detection Catch Block:** At approximately line 834, the `catch` block surrounding the ZXing barcode detection logic was updated.
    *   Original: `} catch { // ZXing failed — continue to OCR fallback }`
    *   New: `} catch (error) { logger.warn("[scan] Barcode detection (ZXing) failed, falling back to OCR", { error: error instanceof Error ? error.message : String(error), }); }`
    This ensures that if `@zxing/browser` encounters an error (beyond just "no barcode found"), it is logged as a warning before the system proceeds with the OCR fallback.
3.  **Modify Batch Verification Catch Block:** At approximately line 907, the `catch` block handling potential failures during the batch verification API call was updated.
    *   Original: `} catch { // Silent fallback }`
    *   New: `} catch (error) { logger.warn("[scan] Batch verification failed, trying brand match", { batch: parsedBatchNum, error: error instanceof Error ? error.message : String(error), }); }`
    Here, `parsedBatchNum` is included in the log context to provide specific details about which batch lookup failed, before falling back to fuzzy brand matching.
4.  **Modify Fuzzy Brand Match Catch Block:** At approximately line 930, the `catch` block for the fuzzy brand matching logic was updated.
    *   Original: `} catch { // Silent fallback }`
    *   New: `} catch (error) { logger.warn("[scan] Fuzzy brand match verification failed", { brand: medName, error: error instanceof Error ? error.message : String(error), }); }`
    This logs any errors encountered during the fuzzy brand matching process, including the `medName` for context, allowing the system to continue gracefully without completely halting.

In all cases, we capture the `error` object, and if it's an instance of `Error`, we log its `message`; otherwise, we convert it to a string for consistent structured logging.

## Technical Decisions

The primary technical decision was to leverage our existing `structuredLog` utility (aliased as `logger`) from `apps/web/lib/structuredLogger.ts`. We chose `logger.warn()` specifically because these are not critical application-halting errors but rather expected failure paths where a fallback mechanism is in place. Using `warn` allows us to record these events for debugging and monitoring without treating them as fatal errors that would trigger higher-severity alerts. The alternative of simply re-throwing the error was rejected because it would break the intended fallback behavior (e.g., if ZXing fails, we *want* to try OCR). The previous approach of completely silent `catch` blocks was deemed unacceptable due to the severe debugging challenges it presented. By including contextual information (like `batch` number or `brand` name) in the structured log, we ensure that the logged warnings are immediately actionable and provide sufficient detail for root cause analysis without requiring further investigation into the code.

## How To Re-Implement (Contributor Reference)

To re-implement this pattern for similar silent error handling:

1.  **Identify Silent Catch Blocks:** Scan the codebase for `try...catch` blocks where the `catch` block is empty or only contains a generic comment without any logging or error handling.
    Example:
    ```typescript
    try {
        // Some operation that might fail
    } catch {
        // Fallback or ignore
    }
    ```
2.  **Import `structuredLog`:** If not already present, import the `structuredLog` utility at the top of the file.
    ```typescript
    import { structuredLog as logger } from "@/lib/structuredLogger";
    ```
3.  **Replace Silent Catch with `logger.warn`:** Modify the `catch` block to capture the error and log it using `logger.warn()`.
    *   Pass a descriptive message as the first argument, indicating what operation failed and what the system is doing next (e.g., "falling back").
    *   Pass a structured object as the second argument, including the `error` itself (formatted for consistency) and any relevant contextual data.
    ```typescript
    try {
        // Operation: e.g., `await someApiCall(data)`
    } catch (error) {
        logger.warn("[context] Operation X failed, falling back to Y", {
            contextualData: someVariable, // e.g., `data` from the operation
            error: error instanceof Error ? error.message : String(error),
        });
        // Continue with fallback logic
    }
    ```
    Ensure that `error instanceof Error ? error.message : String(error)` is used to consistently log the error message.
4.  **Verify Fallback Behavior:** Confirm that adding the `logger.warn` call does not inadvertently alter the intended fallback or recovery logic within the `catch` block. The goal is to add visibility, not change behavior.

## Impact on System Architecture

This change significantly improves the observability and maintainability of the SahiDawa frontend, particularly for the critical `scan` functionality. By making previously silent errors visible, we enhance our ability to:
*   **Debug:** Developers can now quickly identify the root cause of issues related to barcode scanning, batch verification, and brand matching, reducing debugging time.
*   **Monitor:** In production, these `logger.warn` calls will be captured by our error tracking and logging systems (e.g., Sentry, CloudWatch), providing valuable insights into the frequency and types of failures users encounter. This allows us to proactively address systemic issues or improve fallback mechanisms.
*   **Reliability:** While the functional behavior remains unchanged (fallbacks still occur), the increased visibility allows us to build a more robust system by understanding *why* fallbacks are being triggered.
This PR establishes a best practice for error handling in the frontend, promoting explicit logging over silent error swallowing, which can be easily adopted across other parts of the platform. It doesn't introduce new architectural layers but reinforces the use of existing logging infrastructure for better system health visibility.

## Testing & Verification

This change primarily affects logging and error visibility, not core functional behavior.

**Verification Steps:**

1.  **Local Development Testing:**
    *   We manually tested the `scan` page in a development environment.
    *   We simulated failures for each of the three scenarios:
        *   **Barcode Detection:** By intentionally corrupting a barcode image or ensuring a non-barcode image was presented, we verified that the `logger.warn("[scan] Barcode detection (ZXing) failed...")` message appeared in the browser console.
        *   **Batch Verification:** By temporarily modifying the batch verification API endpoint to return an error (e.g., 500 status code) or simulating a network failure, we verified that `logger.warn("[scan] Batch verification failed...")` appeared in the console, along with the `parsedBatchNum`.
        *   **Fuzzy Brand Match:** By providing an input that would cause the fuzzy matching logic to throw an error (e.g., malformed input if the logic was not robust), we verified that `logger.warn("[scan] Fuzzy brand match verification failed...")` appeared, including the `medName`.
2.  **Production Log Monitoring:** Post-deployment, we will monitor our production logging systems (e.g., Sentry, CloudWatch logs) for the new `[scan]` warning messages to ensure they are being captured correctly and to observe their frequency in real-world usage.

**Edge Cases:**

*   **Non-Error Throws:** The `error instanceof Error ? error.message : String(error)` pattern handles cases where non-Error objects (e.g., strings, numbers) might be thrown, ensuring that something meaningful is always logged.
*   **Network Partitioning:** If the `structuredLog` utility itself were to fail (e.g., due to an issue with the underlying logging service), the application would still continue its fallback behavior, but the warning might not be recorded. This is an acceptable trade-off as the primary goal is local debugging and general production visibility.
*   **Performance Impact:** The impact of adding `logger.warn` calls is negligible, as logging is typically an asynchronous and low-overhead operation, especially for warnings that only occur on failure paths.