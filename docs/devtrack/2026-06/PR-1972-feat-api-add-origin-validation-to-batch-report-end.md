# PR #1972 — feat(api): add origin validation to batch report endpoint Closes #1937

> **Merged:** 2026-06-17 | **Author:** @nimkarprachi17 | **Area:** Backend | **Impact Score:** 24 | **Closes:** #1937

## What Changed

This pull request refactors our API's origin validation logic by extracting the `isAllowedOrigin` function into a new shared utility file, `apps/api/src/utils/originCheck.ts`. We then applied this centralized origin validation to the `POST /api/verify/batch/report` endpoint in `apps/api/src/routes/batch.ts`, ensuring that only requests from explicitly allowed origins can submit batch reports. This brings the batch reporting endpoint's security posture in line with our existing `/api/verify` endpoint.

## The Problem Being Solved

Prior to this PR, the `POST /api/verify/batch/report` endpoint lacked origin validation, making it susceptible to Cross-Site Request Forgery (CSRF) attacks or unauthorized data submissions from unapproved external sources. The logic for determining allowed origins and validating requests was duplicated and inconsistently applied across API routes; specifically, it existed within `apps/api/src/routes/verify.ts` but was missing from the batch reporting functionality. This inconsistency posed a security risk and violated the DRY (Don't Repeat Yourself) principle, making future maintenance and security updates more complex. Issue #1937 specifically tracked this security vulnerability and the need for consistent origin validation.

## Files Modified

- `apps/api/src/routes/batch.ts`
- `apps/api/src/routes/verify.ts`
- `apps/api/src/utils/originCheck.ts`

## Implementation Details

The core of this change involved centralizing our origin validation logic.

1.  **New Utility File (`apps/api/src/utils/originCheck.ts`):**
    - We created a new file, `apps/api/src/utils/originCheck.ts`, to house the shared origin validation logic.
    - This file exports a constant array, `ALLOWED_ORIGINS`, which is populated from the `process.env.ALLOWED_ORIGINS` environment variable. If the environment variable is not set, it defaults to a predefined list of trusted origins, including `http://localhost:3000`, `http://localhost:5173`, `https://sahidawa.vercel.app`, `https://sahidawa-india.vercel.app`, and `https://sahidawa.goswav.in`. The environment variable is expected to be a comma-separated string of origins.
    - It also exports the `isAllowedOrigin(req: Request)` function. This function inspects the `Origin` header of the incoming request. If the `Origin` header is absent, it falls back to extracting the origin from the `Referer` header. If neither header provides a source, the function returns `true`, allowing requests without explicit origin/referer headers (e.g., non-browser clients, server-to-server calls). Finally, it checks if the determined `source` is present in the `ALLOWED_ORIGINS` array.

2.  **Refactoring `apps/api/src/routes/verify.ts`:**
    - The previously inline `ALLOWED_ORIGINS` constant and `isAllowedOrigin` function definitions were removed from this file.
    - The `isAllowedOrigin` function is now imported from the new `../utils/originCheck` utility, ensuring that the `/api/verify` endpoint utilizes the centralized logic.

3.  **Applying Validation to `apps/api/src/routes/batch.ts`:**
    - The `isAllowedOrigin` function is imported from `../utils/originCheck`.
    - Within the `router.post("/report", ...)` handler, an `if (!isAllowedOrigin(req))` check was introduced at the very beginning of the function body.
    - If the origin validation fails (i.e., `isAllowedOrigin(req)` returns `false`), the system immediately responds with a `403 Forbidden` status code and a JSON error message: `{ error: "Access denied: unrecognized origin" }`. The `return` statement ensures that no further processing of the unauthorized request occurs.

## Technical Decisions

1.  **Centralization of Logic:** We chose to extract the `isAllowedOrigin` function and `ALLOWED_ORIGINS` constant into a dedicated utility file (`apps/api/src/utils/originCheck.ts`) to promote code reusability and maintainability. This ensures a single source of truth for origin validation, making it easier to apply consistent security policies across all relevant API endpoints and simplifying future updates to the allowed origins list or validation logic.
2.  **Environment Variable Configuration:** The `ALLOWED_ORIGINS` list is configurable via `process.env.ALLOWED_ORIGINS`. This decision provides flexibility for deployment environments, allowing administrators to easily specify trusted origins without modifying application code. The inclusion of a default list ensures that the application remains functional in development environments or when the environment variable is not explicitly set.
3.  **Handling Missing Origin/Referer Headers:** The `isAllowedOrigin` function explicitly allows requests that do not include `Origin` or `Referer` headers (`if (!source) return true;`). This decision was made to accommodate non-browser clients, server-to-server communications, or other legitimate API consumers that might not send these headers, preventing unintended blocking of valid traffic.
4.  **Early Exit on Validation Failure:** Implementing the origin check at the very beginning of the `POST /report` handler in `apps/api/src/routes/batch.ts` with an immediate `return` on failure is a security best practice. This "fail-fast" approach minimizes the processing of potentially malicious requests, conserving server resources and reducing the attack surface.

## How To Re-Implement (Contributor Reference)

To re-implement this feature or apply similar origin validation to a new endpoint, follow these steps:

1.  **Create/Verify `originCheck.ts` Utility:**
    - Ensure the file `apps/api/src/utils/originCheck.ts` exists and contains the `ALLOWED_ORIGINS` constant and `isAllowedOrigin` function as defined:

        ```typescript
        // apps/api/src/utils/originCheck.ts
        import { Request } from "express";

        export const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
            ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
            : [
                  "http://localhost:3000",
                  "http://localhost:5173",
                  "https://sahidawa.vercel.app",
                  "https://sahidawa-india.vercel.app",
                  "https://sahidawa.goswav.in",
              ];

        export function isAllowedOrigin(req: Request): boolean {
            const origin = req.headers.origin;
            const referer = req.headers.referer;
            // Prioritize Origin header, fallback to Referer's origin
            const source = origin || (referer ? new URL(referer).origin : null);
            // Allow requests with no Origin/Referer header (e.g., non-browser clients)
            if (!source) return true;
            return ALLOWED_ORIGINS.includes(source);
        }
        ```

    - **Dependency:** This utility relies on the `express` `Request` type and the native Node.js `URL` object.

2.  **Refactor Existing Endpoints (if applicable):**
    - If an endpoint previously had its own `ALLOWED_ORIGINS` or `isAllowedOrigin` definition (like `apps/api/src/routes/verify.ts` did), remove those local definitions.
    - Import the shared utility:
        ```typescript
        // In apps/api/src/routes/verify.ts (or similar)
        import { isAllowedOrigin } from "../utils/originCheck";
        ```

3.  **Apply to Target Endpoint:**
    - Navigate to the API route file where you want to enforce origin validation (e.g., `apps/api/src/routes/batch.ts`).
    - Import the `isAllowedOrigin` function:
        ```typescript
        // In apps/api/src/routes/batch.ts (or your target route file)
        import { isAllowedOrigin } from "../utils/originCheck";
        ```
    - Inside the specific route handler function (e.g., `router.post("/report", ...)`), add the validation check at the very beginning:

        ```typescript
        router.post("/report", batchLimiter, async (req: Request, res: Response) => {
            // Origin validation check
            if (!isAllowedOrigin(req)) {
                res.status(403).json({ error: "Access denied: unrecognized origin" });
                return; // Crucial: stop further processing
            }

            // ... rest of your existing route handler logic ...
            const parsed = reportBatchSchema.safeParse(req.body);
            // ...
        });
        ```

4.  **Environment Configuration:**
    - Ensure that in your deployment environment, the `ALLOWED_ORIGINS` environment variable is set correctly with a comma-separated list of all trusted frontend origins (e.g., `ALLOWED_ORIGINS=https://your-frontend.com,https://another-frontend.org`). Incorrect configuration will lead to legitimate requests being blocked.

## Impact on System Architecture

This change has a significant positive impact on our system architecture:

1.  **Enhanced Security Posture:** By enforcing origin validation on critical data submission endpoints like `POST /api/verify/batch/report`, we have significantly hardened our API against CSRF attacks and unauthorized data injection. This ensures that only our trusted frontends or explicitly approved clients can interact with these sensitive functionalities.
2.  **Improved Code Maintainability and Consistency:** The extraction of `isAllowedOrigin` into a shared utility creates a single, authoritative source for origin validation logic. This eliminates code duplication, simplifies future security audits, and ensures that any changes to our allowed origins or validation rules are applied consistently across all relevant API endpoints. This pattern promotes a more modular and maintainable backend.
3.  **Foundation for Future Security Features:** This establishes a clear and reusable pattern for implementing similar request-level security checks across other API endpoints. It encourages a proactive approach to security by making it easier to integrate robust validation mechanisms into new and existing features.
4.  **Clearer Configuration Management:** The explicit reliance on `process.env.ALLOWED_ORIGINS` reinforces our strategy for environment-specific configuration, making the API adaptable to various deployment contexts (development, staging, production) without requiring code modifications.

## Testing & Verification

The author performed initial verification steps:

- Zero TypeScript errors were reported in the changed files.
- `git diff --stat main` confirmed that only the three intended files were modified, ensuring strict adherence to the PR's scope.

Beyond these initial checks, the standard verification process for this feature would involve:

1.  **Positive Testing (Allowed Origin):**
    - Sending a `POST` request to `/api/verify/batch/report` from an origin explicitly listed in `ALLOWED_ORIGINS` (e.g., `http://localhost:3000` during development, or `https://sahidawa.vercel.app` in a deployed environment). The request should be processed successfully, and the batch report should be submitted as expected.
2.  **Negative Testing (Disallowed Origin):**
    - Sending a `POST` request to `/api/verify/batch/report` from an origin _not_ listed in `ALLOWED_ORIGINS` (e.g., using a tool like Postman with a custom `Origin` header set to `http://malicious-site.com`). The system should respond with a `403 Forbidden` status code and the error message `{"error": "Access denied: unrecognized origin"}`.
3.  **Edge Case Testing (Missing Headers):**
    - Sending a `POST` request to `/api/verify/batch/report` without any `Origin` or `Referer` headers. As per the `isAllowedOrigin` logic, such requests should be allowed to proceed, and the batch report should be processed successfully. This covers scenarios involving non-browser clients or internal service calls.

**Existing Edge Cases (Not documented in this PR):**

- The current implementation performs a case-sensitive comparison of origins. While standard practice dictates origins are typically lowercase, inconsistent casing in `ALLOWED_ORIGINS` or incoming headers could lead to unexpected blocks.
- The `ALLOWED_ORIGINS.includes(source)` check requires an exact match. This means `https://sub.example.com` would not be allowed if only `https://example.com` is listed, and vice-versa. This is the intended behavior for strict origin matching.
