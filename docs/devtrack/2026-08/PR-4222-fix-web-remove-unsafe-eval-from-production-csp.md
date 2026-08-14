# PR #4222 — fix(web): remove unsafe-eval from production CSP

> **Merged:** 2026-08-08 | **Author:** @Shreya-nipunge | **Area:** Frontend | **Impact Score:** 25 | **Closes:** #4219

## What Changed

We removed the `'unsafe-eval'` directive from our production Content Security Policy (CSP) configuration. To accommodate this change, we isolated the OpenCV.js library, which requires `'unsafe-eval'` for its operation, within a sandboxed iframe. This ensures that the main application's CSP remains strict while still allowing the necessary functionality for packaging detection.

## The Problem Being Solved

Before this PR, our production CSP allowed `'unsafe-eval'`, which poses a security risk as it can be exploited for malicious script execution. The inclusion of `'unsafe-eval'` was necessary due to the use of OpenCV.js, which internally uses `new Function()` for WASM/JavaScript interoperation. However, this compromised the security posture of our application. By isolating OpenCV.js in a sandboxed iframe, we can maintain a stricter CSP for the main application while still supporting the required functionality.

## Files Modified

- `apps/web/components/scanner/usePackagingHint.ts`
- `apps/web/lib/vision/detectPackaging.ts`
- `apps/web/lib/vision/loadOpenCv.ts`
- `apps/web/next.config.mjs`
- `apps/web/proxy.ts`
- `apps/web/public/opencv/sandbox.html`
- `apps/web/tests/e2e/csp-unsafe-eval.spec.ts`

## Implementation Details

The key to this implementation is the isolation of OpenCV.js within a sandboxed iframe. The `loadOpenCv.ts` file now creates a sandboxed iframe and waits for it to signal readiness before proceeding with packaging detection requests. The iframe is created with the `allow-scripts` sandbox attribute but without `allow-same-origin`, ensuring it has its own CSP context where `'unsafe-eval'` can be permitted without compromising the main page's security. Communication between the main page and the sandboxed iframe is handled through `postMessage`, with each request correlated by a unique ID to prevent stale or spoofed responses from resolving the wrong request.

## Technical Decisions

We chose to use a sandboxed iframe to isolate OpenCV.js because it provides a secure way to execute scripts that require `'unsafe-eval'` without weakening the main application's CSP. This approach was preferred over alternatives like using a different computer vision library that does not require `'unsafe-eval'` or relaxing the CSP for the entire application, as it balances security with functional requirements. The use of `postMessage` for communication ensures that the interaction between the main page and the sandbox is controlled and secure.

## How To Re-Implement (Contributor Reference)

1. **Create a Sandbox**: Implement a function to create a sandboxed iframe with `allow-scripts` but without `allow-same-origin`. This iframe will host the OpenCV.js library.
2. **Wait for Readiness**: Establish a mechanism for the sandboxed iframe to signal its readiness. This can be done through `postMessage` once the iframe's inline script has executed.
3. **Implement Request/Response Mechanism**: Use `postMessage` to send detection requests to the sandbox and receive results. Implement request ID correlation to ensure responses match the correct requests.
4. **Handle Errors and Timeouts**: Implement error handling and timeouts for requests to the sandbox to ensure the application remains responsive.
5. **Test Thoroughly**: Verify the functionality and security of the implementation through comprehensive testing, including edge cases and potential security vulnerabilities.

## Impact on System Architecture

This change enhances the security posture of the SahiDawa application by removing `'unsafe-eval'` from the production CSP, reducing the risk of malicious script execution. It demonstrates a pattern for securely integrating third-party libraries that require relaxed security policies, allowing for the continued development of features that depend on such libraries without compromising the application's overall security. This approach can be applied to similar challenges in the future, promoting a more secure and maintainable architecture.

## Testing & Verification

Testing for this change involved verifying that the packaging detection functionality works as expected while ensuring the production CSP no longer includes `'unsafe-eval'`. This was achieved through a combination of unit tests, integration tests, and end-to-end tests, including the addition of a Playwright E2E regression test (`csp-unsafe-eval.spec.ts`) to prevent `'unsafe-eval'` from being reintroduced into the production CSP in the future. The tests cover various scenarios, including successful detection, error handling, and security-related edge cases.