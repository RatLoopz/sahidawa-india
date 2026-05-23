# PR #455 — fix: improve scanner camera permission handling

> **Merged:** 2026-05-22 | **Author:** @Divyanshu3994 | **Area:** Frontend | **Impact Score:** 5 | **Closes:** #382

## What Changed

This pull request significantly enhances the `BarcodeScanner` component in our `apps/web` frontend by implementing robust camera permission handling, recovery mechanisms, and improved scanner stability. We introduced a `retryCount` state and a `handleRetry` function to allow scanner re-initialization without a full page reload, added comprehensive error handling for various camera access failures, and provided user-friendly fallback UIs and messages.

## The Problem Being Solved

Before this PR, the `BarcodeScanner` component experienced issues with camera access, leading to scanner freezes, infinite loading states, and a poor user experience. Specifically, it lacked graceful handling for common camera permission failures (e.g., user denial, camera in use, no device found). The system also required a full page reload to retry camera access after an initial failure or denial, which was inefficient and disruptive. This resulted in an unreliable scanning experience for our users, particularly on devices with strict permission models or when multiple applications contended for camera access, hindering the core functionality of verifying Indian medicines.

## Files Modified

- `apps/web/components/scanner/BarcodeScanner.tsx`

## Implementation Details

The core changes are implemented within the `apps/web/components/scanner/BarcodeScanner.tsx` file, primarily affecting the `BarcodeScanner` functional component.

1.  **New State Variables:**
    *   A `retryCount` state variable was introduced using `useState(0)`. This counter is crucial for triggering re-initialization of the camera stream.

2.  **`handleRetry` Function:**
    *   A new `handleRetry` function was added. When invoked, it resets the `status` state to `"initializing"`, clears any existing `errorMessage`, and increments the `retryCount` state. The increment of `retryCount` is the key mechanism that forces the `useEffect` hook, responsible for camera initialization, to re-execute.

3.  **Browser/Device Capability Check:**
    *   Within the `useEffect` hook, before attempting to call `navigator.mediaDevices.getUserMedia()`, a check `if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)` was added. If these browser APIs are not available (e.g., in an unsupported browser or non-HTTPS context), the `status` is immediately set to `"unavailable"`, and an informative `errorMessage` ("Camera access is not supported by this browser. Please use HTTPS or a compatible browser.") is displayed. This prevents subsequent errors from attempting unsupported operations.

4.  **Enhanced Error Handling in `try-catch` Block:**
    *   The `catch` block surrounding the `getUserMedia` call was significantly expanded to differentiate and handle various `MediaStreamError` types:
        *   **`PermissionDeniedError`**: If the user denies camera access, the `status` is set to `"permission-denied"`, and the `errorMessage` is updated to "Camera access was denied. Please allow camera permissions in your browser settings and try again."
        *   **`NotFoundError`, `DevicesNotFoundError`, `OverconstrainedError`**: These errors indicate that no suitable camera device was found. The `status` is set to `"unavailable"`, and the `errorMessage` becomes "No suitable camera was found on this device."
        *   **`NotReadableError`, `TrackStartError`**: These errors typically occur when the camera is already in use by another application or browser tab. The `status` is set to `"error"`, and the `errorMessage` is "Camera is already in use by another application or tab."
        *   **Generic Errors**: For any other unhandled errors, the `status` is set to `"error"`, and the `errorMessage` defaults to the error's message or a generic "Failed to start the barcode scanner."

5.  **`useEffect` Dependency Array Update:**
    *   The dependency array of the primary `useEffect` hook (which manages camera initialization and cleanup) was updated to include `retryCount` (`[retryCount]`). This ensures that whenever `handleRetry` is called and `retryCount` increments, the effect re-runs, effectively re-attempting camera initialization.

6.  **UI Integration for Retry:**
    *   The "Retry" buttons displayed when `status` is `"permission-denied"` or `"error"` were updated. Their `onClick` handlers now call the new `handleRetry` function instead of the previous `window.location.reload()`, providing a seamless retry experience.

7.  **Camera Stream Cleanup:**
    *   The existing cleanup function within the `useEffect` (`streamRef.current?.getTracks().forEach((track) => track.stop());`) remains crucial. It ensures that all active camera tracks are stopped when the component unmounts or when the `useEffect` re-runs (e.g., due to `retryCount` change), preventing resource leaks and ensuring the camera is released for other applications.

## Technical Decisions

1.  **`retryCount` for Controlled Re-initialization:** We opted to use a `retryCount` state variable as a dependency for the `useEffect` hook. This is a standard and idiomatic React pattern for forcing an effect to re-run in response to a user action (like clicking "Retry") without resorting to a full page reload. This approach provides a much smoother and faster user experience compared to `window.location.reload()`, which would incur significant overhead.
2.  **Granular `MediaStreamError` Handling:** Instead of a single generic error message, we made the technical decision to parse specific `MediaStreamError` names (`PermissionDeniedError`, `NotFoundError`, `NotReadableError`, `TrackStartError`). This allows us to provide highly specific and actionable error messages to the user, guiding them on how to resolve the issue (e.g., "allow camera permissions in your browser settings" or "Camera is already in use"). This significantly improves user comprehension and reduces frustration.
3.  **Proactive Browser Capability Check:** The early check for `navigator.mediaDevices` and `navigator.mediaDevices.getUserMedia` was a deliberate choice to fail fast and gracefully in environments that do not support camera access. This prevents runtime errors and provides a clear "unsupported" message, rather than a cryptic browser error, enhancing the robustness of the component across diverse user agents.
4.  **Native API Preference:** We continue to leverage the native `navigator.mediaDevices.getUserMedia()` API for camera access. This avoids introducing additional third-party libraries for fundamental browser capabilities, keeping our bundle size lean and reducing external dependencies.

## How To Re-Implement (Contributor Reference)

To re-implement or deeply understand the camera permission handling in `BarcodeScanner.tsx`, follow these steps:

1.  **Component Setup:**
    *   Start with a React functional component, e.g., `BarcodeScanner`.
    *   Initialize `useState` hooks for `status` (e.g., `"initializing"`, `"ready"`, `"permission-denied"`, `"unavailable"`, `"error"`), `errorMessage`, `hasTorch`, `torchOn`, and crucially, `retryCount` (defaulting to `0`).
    *   Use `useRef` for `videoRef` (to attach the video stream to a `<video>` element) and `streamRef` (to hold the `MediaStream` object for direct manipulation and cleanup).

2.  **Implement `handleRetry`:**
    *   Define an `handleRetry` function that sets `setStatus("initializing")`, `setErrorMessage("")`, and `setRetryCount((prev) => prev + 1)`. This function will be called when the user attempts to re-initialize the scanner.

3.  **Camera Initialization `useEffect`:**
    *   Create a `useEffect` hook. Its dependency array must include `[retryCount]` to ensure re-initialization on retry attempts.
    *   Inside the effect, define an `async` function (e.g., `initializeScanner`) to encapsulate the camera setup logic.
    *   **Cleanup Function:** The `useEffect` must return a cleanup function. This function is critical for releasing camera resources: `streamRef.current?.getTracks().forEach((track) => track.stop());`. This prevents resource leaks and ensures the camera is available for other applications.

4.  **Browser Capability Check:**
    *   Within `initializeScanner`, add an initial check:
        ```typescript
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setStatus("unavailable");
            setErrorMessage("Camera access is not supported by this browser. Please use HTTPS or a compatible browser.");
            return;
        }
        ```

5.  **Acquire Camera Stream (`getUserMedia`):**
    *   Wrap the `getUserMedia` calls in a `try-catch` block.
    *   Attempt to acquire the rear camera first: `navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })`.
    *   If that fails, fall back to any available camera: `navigator.mediaDevices.getUserMedia({ video: true })`.
    *   Assign the resulting `MediaStream` to `streamRef.current` and `videoRef.current.srcObject`.
    *   Once the stream is acquired, set `setStatus("ready")`.

6.  **Detailed Error Handling:**
    *   In the `catch (error)` block of `getUserMedia`:
        *   Cast `error` to `DOMException` or `MediaStreamError` for specific `name` property checks.
        *   **Permission Denied:** `if (error.name === "PermissionDeniedError")`: Set `setStatus("permission-denied")` and `setErrorMessage("Camera access was denied. Please allow camera permissions in your browser settings and try again.")`.
        *   **No Camera Found:** `else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError" || error.name === "OverconstrainedError")`: Set `setStatus("unavailable")` and `setErrorMessage("No suitable camera was found on this device.")`.
        *   **Camera In Use:** `else if (error.name === "NotReadableError" || error.name === "TrackStartError")`: Set `setStatus("error")` and `setErrorMessage("Camera is already in use by another application or tab.")`.
        *   **Generic Error:** `else`: Set `setStatus("error")` and `setErrorMessage(error.message || "Failed to start the barcode scanner.")`.

7.  **UI Conditional Rendering:**
    *   Based on the `status` state, conditionally render different UI elements:
        *   `status === "initializing"`: Show a loading spinner.
        *   `status === "ready"`: Render the `<video>` element (attached to `videoRef`) and any scanner controls (e.g., torch toggle).
        *   `status === "permission-denied"` or `status === "error"` or `status === "unavailable"`: Display the `errorMessage` and a "Retry" button whose `onClick` handler calls `handleRetry`.

8.  **Torch Control (if applicable):**
    *   Implement a `toggleTorch` function that checks `streamRef.current.getVideoTracks()[0].getCapabilities().torch` and uses `applyConstraints({ advanced: [{ torch: !torchOn }] })` to control the camera's torch.

## Impact on System Architecture

This PR significantly enhances the robustness and user experience of the `BarcodeScanner` component, which is a critical part of our SahiDawa platform for verifying Indian medicines.

1.  **Improved Reliability and Stability:** By gracefully handling a wider array of camera-related failures and providing robust recovery mechanisms, the system's overall reliability is substantially improved. This reduces the likelihood of scanner freezes or unresponsive states, leading to a more consistent and dependable user experience.
2.  **Enhanced User Experience (UX):** The introduction of clear, actionable error messages and a non-page-reload retry mechanism drastically improves the user's interaction with the scanner. Users can now understand the problem and attempt to resolve it without losing context or enduring a full page refresh, which is particularly beneficial in rural areas with potentially unstable network conditions or varying device capabilities.
3.  **Reduced Frontend Fragility:** The explicit checks for `navigator.mediaDevices` and the granular error handling make the frontend more resilient to diverse browser environments, device configurations, and permission models. This aligns with SahiDawa's goal of broad accessibility and functionality across a wide range of user devices.
4.  **Foundation for Future Features:** A stable and reliable barcode scanner component is foundational. This improvement ensures that any future features relying on barcode scanning (e.g., advanced inventory management, patient-specific medicine tracking, or integration with other health services) can be built upon a solid, predictable, and user-friendly base, reducing development friction and potential technical debt.

## Testing & Verification

**Manual Testing:**
*   **Successful Initialization:** Verified that the scanner initializes correctly and begins scanning on various desktop and mobile devices (Android, iOS) across supported browsers (Chrome, Firefox, Safari).
*   **Camera Permission Denial:** Tested scenarios where the user explicitly denies camera permission. The system correctly displayed the "Camera access was denied. Please allow camera permissions in your browser settings and try again." message and presented a "Retry" button.
*   **Retry Functionality:** Confirmed that clicking the "Retry" button after a permission denial or other error successfully re-initializes the scanner without requiring a full page reload, prompting for permissions again if necessary.
*   **No Camera Device:** Tested on devices without a camera or with disabled cameras. The system correctly displayed "No suitable camera was found on this device."
*   **Camera In Use:** Verified the handling when the camera was already in use by another application or browser tab. The system displayed "Camera is already in use by another application or tab."
*   **Unsupported Browser/Environment:** Tested in environments where `navigator.mediaDevices` is not available (e.g., older browsers or non-HTTPS contexts in some browsers). The system correctly rendered the fallback UI with the message "Camera access is not supported by this browser. Please use HTTPS or a compatible browser."
*   **Stream Cleanup:** Verified that navigating away from the scanner page or component unmounts properly released the camera resource, allowing other applications to access it.

**Edge Cases:**
*   User denies permission, then later grants it via browser settings, then retries.
*   Camera becomes unavailable mid-scan (e.g., another app takes over).
*   Rapid mounting/unmounting of the component to test cleanup robustness.

**Unit Tests:** Not documented in this PR.
**Integration Tests:** Not documented in this PR.