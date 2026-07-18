# PR #2004 — fix(api): verify Twilio webhook signatures on notification route

> **Merged:** 2026-06-17 | **Author:** @shashank03-dev | **Area:** Backend | **Impact Score:** 16 | **Closes:** #1965

## What Changed

We implemented robust security for our Twilio webhook endpoint by adding signature verification. This change introduces a new middleware, `verifyTwilioSignature`, which validates the `X-Twilio-Signature` header on incoming `POST /twilio-webhook` requests. It ensures that only legitimate requests from Twilio can trigger changes to a subscriber's `is_active` status, preventing unauthorized opt-in/opt-out actions.

## The Problem Being Solved

Before this PR, our `POST /twilio-webhook` endpoint was vulnerable to forged requests. An attacker could send a crafted `POST` request to this endpoint, mimicking Twilio's expected `From` and `Body` parameters, and arbitrarily change a user's `is_active` status in our `notification_subscribers` table. This posed a critical security risk, allowing malicious actors to unsubscribe users from vital health alerts or re-subscribe them without consent, directly impacting the reliability and trustworthiness of the SahiDawa platform's notification system (issue #1965).

## Files Modified

- `apps/api/src/middleware/twilioSignature.ts`
- `apps/api/src/routes/notifications.ts`
- `apps/api/tests/notifications.test.ts`
- `apps/api/tests/twilioWebhookSignature.test.ts`

## Implementation Details

The core of this change is the new `apps/api/src/middleware/twilioSignature.ts` file, which defines the logic for Twilio webhook signature verification.

1.  **`computeTwilioSignature(authToken: string, url: string, params: Record<string, unknown>): string`**: This function is responsible for re-calculating the expected Twilio signature. It takes the `TWILIO_AUTH_TOKEN`, the full request URL, and the POST parameters (`req.body`). It constructs a data string by concatenating the URL with all POST parameters, sorted alphabetically by key, with no separators (e.g., `urlkey1value1key2value2`). For array values, it uses `toFormUrlEncodedParam` to de-duplicate and sort them before concatenation, mirroring Twilio's specific serialization. Finally, it computes an HMAC-SHA1 hash of this data string, using the `authToken` as the key, and returns the base64-encoded digest.

2.  **`toFormUrlEncodedParam(name: string, value: unknown): string`**: A helper function that serializes individual parameters into the `name + value` format required by Twilio for signature generation. It specifically handles array values by converting them to a `Set` to remove duplicates, sorting them, and then recursively processing each element.

3.  **`signaturesMatch(expected: string, provided: string): boolean`**: This function performs a constant-time comparison of the expected and provided base64 signatures using Node.js's `crypto.timingSafeEqual`. This prevents timing attacks where an attacker could infer information about the signature by measuring response times. It first checks for length mismatches, returning `false` immediately if lengths differ.

4.  **`buildCandidateUrls(req: Request): string[]`**: This internal function addresses the challenge of reconstructing the exact URL Twilio used to sign the request, especially when the API is behind a proxy (e.g., Nginx terminating TLS).
    - If `process.env.TWILIO_WEBHOOK_PUBLIC_URL` is set, it's used as the definitive base URL. This is the most reliable method.
    - Otherwise, it reconstructs the URL using `req.get("host")` and `req.originalUrl`. To account for proxies potentially changing the `req.protocol` (e.g., `https` externally becoming `http` internally), it generates candidate URLs trying `req.protocol`, `https`, and `http` schemes. This ensures that even if the internal protocol differs, the correct external URL (which Twilio signed) can be matched.

5.  **`verifyTwilioSignature(req: Request, res: Response, next: NextFunction): void`**: This is the Express middleware.
    - It first checks if `process.env.TWILIO_AUTH_TOKEN` is configured. If not, it logs an error and responds with `403 Forbidden`, failing closed to prevent unverified access.
    - It then retrieves the `X-Twilio-Signature` header. If missing, it logs a warning and responds with `403 Forbidden`.
    - It extracts the POST parameters from `req.body` (requiring `express.urlencoded` to run beforehand).
    - It calls `buildCandidateUrls` to get potential URLs.
    - It iterates through these candidate URLs, computing a signature for each using `computeTwilioSignature` and comparing it against the provided `X-Twilio-Signature` using `signaturesMatch`.
    - If any candidate URL yields a matching signature, the request is considered valid, and `next()` is called to proceed to the route handler.
    - If no candidate yields a match, it logs a warning with the candidate URLs and responds with `403 Forbidden`.

The `apps/api/src/routes/notifications.ts` file was updated to integrate this middleware into the `POST /twilio-webhook` route. The middleware is placed after `express.urlencoded({ extended: true })` to ensure `req.body` is populated with the form parameters before signature verification.

## Technical Decisions

1.  **HMAC-SHA1 for Signature Verification**: We chose HMAC-SHA1 because it is the algorithm specified by Twilio for their webhook signatures. Adhering to their standard ensures compatibility and proper verification.
2.  **Constant-Time Signature Comparison**: The `signaturesMatch` function uses `crypto.timingSafeEqual`. This is a critical security decision to prevent timing attacks. Without it, an attacker could potentially deduce parts of the secret `TWILIO_AUTH_TOKEN` by observing subtle differences in response times based on how many bytes of the signature matched before a mismatch was found.
3.  **Handling Proxy-Induced URL Scheme Discrepancies**: The `buildCandidateUrls` function was introduced to address a common deployment challenge where an API server might receive requests via HTTP internally, even if the external client (Twilio) sent them over HTTPS. This is typical when a reverse proxy (like Nginx) handles TLS termination. By trying both `https` and `http` schemes, and prioritizing a `TWILIO_WEBHOOK_PUBLIC_URL` environment variable, we ensure the system can correctly reconstruct the URL Twilio signed, regardless of proxy configuration, without leaking sensitive information as the HMAC key remains secret.
4.  **Fail Closed Principle**: The `verifyTwilioSignature` middleware implements a "fail closed" approach. If the `TWILIO_AUTH_TOKEN` environment variable is not configured, the middleware explicitly rejects all requests with a `403 Forbidden` status. This prevents the system from silently trusting unverified webhook requests in a misconfigured environment, which would reintroduce the security vulnerability.
5.  **Placement of Middleware**: The `verifyTwilioSignature` middleware is placed _after_ `express.urlencoded({ extended: true })` in `apps/api/src/routes/notifications.ts`. This is a deliberate choice because Twilio's signature includes the POST body parameters, which are only available in `req.body` after the body parser has processed the request.

## How To Re-Implement (Contributor Reference)

To re-implement this Twilio webhook signature verification feature, a contributor would follow these steps:

1.  **Define Signature Computation Logic**:
    - Create a new file, e.g., `apps/api/src/middleware/twilioSignature.ts`.
    - Implement `toFormUrlEncodedParam(name: string, value: unknown): string` to serialize parameters as `name + String(value)`, handling arrays by de-duplicating, sorting, and concatenating.
    - Implement `computeTwilioSignature(authToken: string, url: string, params: Record<string, unknown>): string`. This function should:
        - Sort the keys of the `params` object alphabetically.
        - Iterate through the sorted keys, using `toFormUrlEncodedParam` to append `key + value` to the `url` string.
        - Use Node.js's `crypto.createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64")` to generate the signature.

2.  **Implement Secure Signature Comparison**:
    - Implement `signaturesMatch(expected: string, provided: string): boolean`.
    - Convert both `expected` and `provided` signatures to `Buffer` objects (e.g., `Buffer.from(signature, "utf-8")`).
    - Crucially, use `crypto.timingSafeEqual(expectedBuf, providedBuf)` for comparison to prevent timing attacks. Ensure a length check is performed first.

3.  **Address URL Reconstruction for Proxies**:
    - Implement `buildCandidateUrls(req: Request): string[]`.
    - Check for an environment variable like `process.env.TWILIO_WEBHOOK_PUBLIC_URL`. If present, use it as the base for `url + req.originalUrl`.
    - If not present, construct candidate URLs using `req.get("host")` and `req.originalUrl`, trying both `https` and `http` schemes (and `req.protocol`) to account for proxy behavior.

4.  **Create the Express Middleware**:
    - Implement `verifyTwilioSignature(req: Request, res: Response, next: NextFunction): void`.
    - **Configuration Check**: Retrieve `TWILIO_AUTH_TOKEN` from `process.env`. If it's missing, log an error and send a `403 Forbidden` response. This is the "fail closed" mechanism.
    - **Header Check**: Retrieve the `X-Twilio-Signature` header from `req.get("X-Twilio-Signature")`. If it's missing, log a warning and send a `403 Forbidden` response.
    - **Parameter Extraction**: Ensure `req.body` contains the parsed POST parameters (this means the middleware must run after a body parser like `express.urlencoded`).
    - **Verification Loop**: Call `buildCandidateUrls(req)`. For each candidate URL, call `computeTwilioSignature` and then `signaturesMatch` against the received `X-Twilio-Signature`.
    - **Decision**: If any candidate matches, call `next()`. Otherwise, log a warning and send a `403 Forbidden` response.

5.  **Integrate Middleware into Route**:
    - In `apps/api/src/routes/notifications.ts` (or the relevant route file), import `verifyTwilioSignature`.
    - Add `verifyTwilioSignature` to the `POST /twilio-webhook` route handler, ensuring it is placed _after_ `express.urlencoded({ extended: true })`.
        ```typescript
        router.post(
            "/twilio-webhook",
            express.urlencoded({ extended: true }),
            verifyTwilioSignature, // <-- Add this here
            async (req, res) => {
                // ... existing logic ...
            }
        );
        ```

6.  **Environment Configuration**:
    - Ensure `TWILIO_AUTH_TOKEN` is set in the deployment environment. Optionally, set `TWILIO_WEBHOOK_PUBLIC_URL` for explicit URL reconstruction.

7.  **Testing**:
    - Write a dedicated test suite (`apps/api/tests/twilioWebhookSignature.test.ts`) to cover:
        - Correct signature computation against known Twilio test vectors.
        - Successful processing of valid signatures.
        - Rejection of forged signatures.
        - Rejection of requests with tampered bodies.
        - Rejection of requests missing the `X-Twilio-Signature` header.
        - Behavior when `TWILIO_AUTH_TOKEN` is not configured (fails closed).
    - Update existing route tests (`apps/api/tests/notifications.test.ts`) to include a valid `X-Twilio-Signature` header in their `supertest` requests, ensuring they continue to pass through the new security layer.

## Impact on System Architecture

This change significantly enhances the security posture of the SahiDawa backend, specifically for our critical notification system. By introducing signature verification for Twilio webhooks, we've added a robust layer of authentication for incoming messages that can alter user subscription statuses.

- **Increased Security**: The `POST /twilio-webhook` endpoint, which directly interacts with our `notification_subscribers` database, is now protected against unauthorized modifications. This prevents malicious actors from manipulating user opt-in/opt-out preferences.
- **Reliability of Notification System**: Users can trust that their subscription status for SahiDawa alerts is only changed by legitimate interactions with Twilio, improving the overall reliability and integrity of our communication platform.
- **Maintainability**: The new `twilioSignature.ts` middleware centralizes the Twilio-specific signature logic, making it reusable and easier to maintain if other Twilio webhooks are added in the future.
- **Operational Robustness**: The "fail closed" design ensures that even if `TWILIO_AUTH_TOKEN` is accidentally unset in a production environment, the system defaults to a secure state, rejecting all Twilio webhook requests rather than processing them unverified.
- **No Direct Database Schema Changes**: This change is purely an API-level security enhancement and does not alter our database schema or core business logic for handling notifications, only the gatekeeping mechanism for those actions.

This enhancement is foundational for any system relying on third-party webhooks for critical state changes, setting a precedent for secure integration practices within SahiDawa.

## Testing & Verification

The changes were thoroughly tested and verified through a dedicated test suite and integration tests:

1.  **Unit/Integration Tests (`apps/api/tests/twilioWebhookSignature.test.ts`)**: A new test file was created specifically to validate the `twilioSignature` middleware and its helper functions. This suite includes:
    - A test confirming that our `computeTwilioSignature` function produces a signature identical to Twilio's published test vector, ensuring byte-for-byte compatibility.
    - A test verifying that a request carrying a valid `X-Twilio-Signature` is successfully processed (i.e., `next()` is called).
    - Tests to ensure that requests with forged signatures, tampered request bodies (after signing), or missing `X-Twilio-Signature` headers are correctly rejected with a `403 Forbidden` status.
    - A critical test to confirm the "fail closed" behavior: if `TWILIO_AUTH_TOKEN` is not configured in the environment, all Twilio webhook requests are rejected with a `403 Forbidden` status.

2.  **Existing Route Tests (`apps/api/tests/notifications.test.ts`)**: The existing tests for the `/twilio-webhook` endpoint were updated. Specifically, the test for "handles twilio webhook opt-out (STOP command)" now explicitly calculates a valid Twilio signature using the new `computeTwilioSignature` function and includes it in the `X-Twilio-Signature` header of the `supertest` request. This ensures that the existing functionality continues to work correctly _through_ the new security middleware.

3.  **Full API Suite**: The PR description confirms that the full API test suite remained green, indicating no regressions were introduced by this change.

Edge cases considered and covered by tests include:

- Missing `TWILIO_AUTH_TOKEN` environment variable.
- Missing `X-Twilio-Signature` header.
- Incorrectly formatted or forged `X-Twilio-Signature`.
- Tampering with `req.body` parameters after the signature was generated by Twilio.
- Variations in the request URL scheme (`http` vs `https`) due to proxy configurations.

The use of `crypto.timingSafeEqual` addresses the timing attack edge case for signature comparison.
