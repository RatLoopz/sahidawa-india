# PR #1525 — fix(web): prevent premature Tesseract worker termination in ScanPage (#1395)

> **Merged:** 2026-06-08 | **Author:** @shauryavardhan1307 | **Area:** Frontend | **Impact Score:** 5 | **Closes:** #1395

## What Changed

This PR addresses several frontend issues on the `ScanPage`, primarily preventing the premature termination of the Tesseract OCR Web Worker. It refactors the worker cleanup logic to ensure it only occurs when the component unmounts, stabilizes several React hook references using `useCallback`, and cleans up obsolete references to the `recordScanHistory` function, replacing them with the current `saveScanHistory` or `processVerificationResult` calls.

## The Problem Being Solved

Before this PR, the Tesseract OCR Web Worker, responsible for image-to-text conversion on the `ScanPage`, was being prematurely terminated. This occurred because its cleanup logic was placed within a `useEffect` hook that had `batchInput` as a dependency. Every keystroke in the batch number input field would cause this `useEffect` to re-run, triggering the cleanup and re-initialization of the worker, leading to unnecessary resource consumption and potential performance degradation.

Additionally, the `handleBarcodeScan` and `processVerificationResult` functions were not wrapped in `useCallback`. This meant they were recreated on every render, potentially causing unnecessary re-renders of child components that depended on them and leading to stale closures or incorrect dependency array warnings. Finally, the `ScanPage` still contained references to the deprecated `recordScanHistory` function, which was removed in PR #1469, causing TypeScript compilation errors and using an outdated history logging mechanism.

## Files Modified

- `apps/web/app/[locale]/scan/page.tsx`

## Implementation Details

The core of this change involves refactoring the lifecycle management of the Tesseract OCR Web Worker and stabilizing key functions within the `ScanPage` component.

1.  **Tesseract Worker Lifetime Fix**:
    *   The `ocrWorkerRef.current.terminate()` call was moved from the cleanup function of the `useEffect` hook at `apps/web/app/[locale]/scan/page.tsx:L557-561` (which had `[showResult, verifyError, batchInput, registerRetryCallback, unregisterRetryCallback]` as dependencies) into a *new*, dedicated `useEffect` hook at `apps/web/app/[locale]/scan/page.tsx:L565-574`.
    *   This new `useEffect` has an empty dependency array (`[]`), ensuring its cleanup function (which terminates the worker) runs only once when the `ScanPage` component unmounts. A `console.log("Tesseract worker terminated on ScanPage unmount")` was added for verification.

2.  **Hook Reference Stabilization**:
    *   The `processVerificationResult` async function, responsible for handling the outcome of a verification attempt, was wrapped in a `useCallback` hook at `apps/web/app/[locale]/scan/page.tsx:L586-642`. It was given an empty dependency array (`[]`) to ensure its reference remains stable across renders, preventing unnecessary re-creations.
    *   The `handleVerify` function, which orchestrates the medicine verification process, was already wrapped in `useCallback`. Its dependency array was updated from `[processVerificationResult, recordScanHistory]` to `[processVerificationResult]` at `apps/web/app/[locale]/scan/page.tsx:L772`, reflecting the removal of `recordScanHistory`.
    *   The `handleBarcodeScan` function, which processes detected barcodes, was not explicitly wrapped in `useCallback` in the provided diff, but its internal call to `handleVerify` was updated to remove the `source` parameter at `apps/web/app/[locale]/scan/page.tsx:L874`. The PR description mentions `handleBarcodeScan` was wrapped in `useCallback` to match a dangling dependency array, implying a previous state or an implicit change not fully captured in the diff provided. Based on the diff, `handleVerify`'s signature was changed, which `handleBarcodeScan` now correctly calls.

3.  **Obsolete History Reference Cleanup**:
    *   Imports related to the old local scan history mechanism (`buildLocalScanHistoryEntry`, `saveLocalScanHistoryEntry`, `BuildLocalScanHistoryEntryOptions`, `LocalScanHistorySource`) were removed from `apps/web/app/[locale]/scan/page.tsx:L45-50`.
    *   The type definition for `handleVerifyRef` was updated at `apps/web/app/[locale]/scan/page.tsx:L538-542` to remove the `source` parameter, aligning with the removal of `LocalScanHistorySource`.
    *   All instances where `recordScanHistory` was previously called (e.g., in error handling paths within `handleConfirmScanned`, `handleVerify`, and the OCR processing logic) were replaced with direct calls to `saveScanHistory` or by passing the relevant data to `processVerificationResult`. This also involved removing the `ScanHistoryContext` object parameters that were previously passed to `processVerificationResult` and `recordScanHistory` (e.g., `query`, `source`, `fallbackBrandName`, etc.) as the `saveScanHistory` function now directly accepts the necessary `id`, `timestamp`, `medicineName`, and `status`.

## Technical Decisions

The primary technical decision was to separate the Tesseract Web Worker's termination logic from a `useEffect` hook that had dynamic dependencies. This was crucial because `useEffect` cleanup functions are executed whenever the dependencies change, leading to the worker being terminated and re-initialized unnecessarily. By moving it to a `useEffect` with an empty dependency array (`[]`), we ensure the worker is initialized once and only terminated when the component is completely unmounted, aligning with the intended lifecycle of a background worker. This prevents performance bottlenecks and resource waste.

Wrapping `processVerificationResult` in `useCallback` was a decision to optimize React's rendering performance. Functions defined within a component are recreated on every render. If these functions are passed as props to child components or are dependencies of other `useCallback` or `useMemo` hooks, their constant re-creation can trigger unnecessary re-renders or re-computations. `useCallback` memoizes the function, ensuring a stable reference unless its own dependencies change, leading to more efficient component updates.

The removal of `recordScanHistory` references was a necessary cleanup. This function was deprecated and removed in a previous PR (#1469) in favor of a more robust `saveScanHistory` mechanism that interacts with our local database. Maintaining references to obsolete code would lead to compilation errors, confusion, and technical debt.

## How To Re-Implement (Contributor Reference)

To re-implement these changes or similar lifecycle management for Web Workers and function memoization in React:

1.  **Web Worker Lifecycle Management**:
    *   When using Web Workers (like Tesseract.js), initialize them once, typically in a `useRef` to maintain a mutable reference across renders without triggering re-renders.
    *   For cleanup, use a `useEffect` hook with an empty dependency array (`[]`). The `return` function of this `useEffect` will act as the `componentWillUnmount` equivalent. Inside this cleanup, call `workerRef.current.terminate()` to properly shut down the worker.
    *   Example pattern:
        ```typescript
        const ocrWorkerRef = useRef<Worker | null>(null);

        useEffect(() => {
            // Initialize worker here if needed, or ensure it's initialized elsewhere
            // ocrWorkerRef.current = new Worker(...);
            return () => {
                if (ocrWorkerRef.current) {
                    ocrWorkerRef.current.terminate();
                    ocrWorkerRef.current = null;
                }
            };
        }, []); // Empty dependency array ensures cleanup only on unmount
        ```
    *   Avoid placing worker termination in `useEffect` hooks with dynamic dependencies if the worker should persist across those dependency changes.

2.  **Function Memoization with `useCallback`**:
    *   Identify functions that are passed as props to child components, or are dependencies of other `useCallback`/`useMemo` hooks, or are computationally expensive.
    *   Wrap these functions in `useCallback`.
    *   Carefully define the dependency array for `useCallback`. If the function relies on state, props, or other functions, include them in the dependency array. An empty array `[]` means the function never changes its reference.
    *   Example:
        ```typescript
        const processVerificationResult = useCallback(async (result: VerifyResult, fallbackBrandName?: string) => {
            // ... logic ...
            void saveScanHistory({ /* ... */ });
        }, []); // Dependencies for processVerificationResult
        ```

3.  **API Migration and Cleanup**:
    *   When an API or utility function is deprecated or removed (e.g., `recordScanHistory` replaced by `saveScanHistory`), ensure all references throughout the codebase are updated.
    *   Remove obsolete imports and type definitions associated with the old API.
    *   Update function signatures and call sites to match the new API's requirements. For instance, `handleVerify`'s signature was simplified from `(batch: string, source: LocalScanHistorySource)` to `(batch: string)` because the `source` parameter was no longer needed by the new history saving mechanism.

## Impact on System Architecture

This change significantly improves the stability and performance of the `ScanPage`, which is a critical user-facing component for verifying Indian medicines. By preventing premature Tesseract worker termination, we reduce CPU and memory overhead, leading to a smoother user experience, especially for users who frequently type batch numbers or navigate the page. This also reduces the likelihood of OCR-related bugs due to an improperly managed worker lifecycle.

The `useCallback` additions contribute to overall frontend performance by optimizing React's rendering cycle, making the `ScanPage` more efficient and less prone to unnecessary re-renders. The cleanup of obsolete `recordScanHistory` references ensures that the codebase remains consistent with the latest data persistence architecture (`saveScanHistory`), reducing technical debt and improving maintainability. This change reinforces our commitment to robust, performant, and maintainable frontend development practices for SahiDawa.

## Testing & Verification

The following verification steps were performed:

1.  **TypeScript Verification**: The modified file `apps/web/app/[locale]/scan/page.tsx` was compiled using `npx tsc --noEmit`, confirming zero TypeScript errors. This validated the removal of obsolete `recordScanHistory` references and the updated function signatures.
2.  **Local Test Output**: Existing Jest tests for scan history (`tests/localScanHistory.test.ts` and `tests/localScanHistoryList.test.tsx`) were run successfully, indicating that the changes to history saving logic did not introduce regressions.
    ```bash
    $ npx jest tests/localScanHistory.test.ts tests/localScanHistoryList.test.tsx
    PASS tests/localScanHistoryList.test.tsx
    PASS tests/localScanHistory.test.ts

    Test Suites: 2 passed, 2 total
    Tests:       3 passed, 3 total
    Snapshots:   0 total
    Time:        1.367 s
    ```
3.  **Worker Lifetime Verification Log**: A `console.log` statement was added to the new unmount-only `useEffect` hook:
    ```typescript
        useEffect(() => {
            return () => {
                console.log("Tesseract worker terminated on ScanPage unmount");
                if (ocrWorkerRef.current) {
                    ocrWorkerRef.current.terminate();
                    ocrWorkerRef.current = null;
                }
            };
        }, []);
    ```
    When navigating away from the `ScanPage`, the console correctly displayed `Tesseract worker terminated on ScanPage unmount`, confirming that the worker termination now occurs only upon component unmount, as intended.

Edge cases considered include rapid input changes in the batch number field (which previously triggered premature termination) and quick navigation away from the page. The new worker management ensures that the worker remains active during user interaction and is cleanly terminated only when the component is no longer needed.