# PR #1114 — fix(lasa): add lasaLimiter and cap medicineName length on /check endpoint

> **Merged:** 2026-06-02 | **Author:** @anshul23102 | **Area:** Backend | **Impact Score:** 16 | **Closes:** #1105

## What Changed

This pull request implements crucial security and performance safeguards for the `POST /api/v1/lasa/check` endpoint. We have introduced a new `lasaLimiter` using the `express-rate-limit` library, restricting requests to 30 per 15 minutes per IP address. Concurrently, we now enforce a maximum length of 200 characters for the `medicineName` parameter, rejecting any longer inputs with a `400 Bad Request` status before they can trigger expensive database operations.

## The Problem Being Solved

Before this change, the `POST /api/v1/lasa/check` endpoint was a significant vulnerability point in our API. It was the only endpoint that triggered a resource-intensive database operation (`find_lasa_conflicts`, which performs full-text string-distance comparisons across the entire medicines table) without any rate limiting or input length validation. Other expensive endpoints, such as `/verify` and `/batch`, already had dedicated rate limiters (`verifyLimiter` and `batchLimiter`, respectively).

This exposed our system to potential denial-of-service (DoS) attacks. A single unauthenticated IP address could send a continuous stream of requests to `/api/v1/lasa/check`, potentially with arbitrarily long `medicineName` strings. Such an attack could quickly saturate our Supabase connection pool, leading to degraded performance or complete unavailability of the entire SahiDawa API for all users. The lack of a length cap on `medicineName` further amplified the CPU cost for each request, making the attack more efficient and resource-intensive.

## Files Modified

- `apps/api/src/middleware/rateLimit.ts`
- `apps/api/src/routes/lasa.ts`

## Implementation Details

We have enhanced `apps/api/src/middleware/rateLimit.ts` by introducing a new exported constant, `lasaLimiter`. This limiter is an instance of `express-rate-limit` configured with a `windowMs` of `15 * 60 * 1000` (15 minutes) and a `max` request count of `30` within that window for each unique IP address. It uses `standardHeaders: true` to include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` in responses, while `legacyHeaders: false` ensures modern header practices. A custom `handler` function is provided to return a `429 Too Many Requests` status with a JSON payload `{ error: "Too many LASA check requests. Please try again later." }` when the limit is exceeded. The accompanying comment clarifies that `find_lasa_conflicts` is an expensive operation, necessitating this throttling to prevent Supabase connection pool exhaustion.

In `apps/api/src/routes/lasa.ts`, we first imported the `lasaLimiter` from `../middleware/rateLimit`. We then defined a new constant, `MAX_MEDICINE_NAME_LENGTH`, set to `200`. This constant is accompanied by a comment explaining its purpose: to prevent excessively long strings from amplifying database CPU costs, given that real medicine names are typically much shorter. The `lasaLimiter` middleware was then applied directly to the `router.post("/check", lasaLimiter, async ...)` route definition, ensuring it is executed for every incoming request to this endpoint before the main route handler logic.

Inside the asynchronous route handler for `POST /check`, after the initial validation for `medicineName` being a non-empty string, we added a new conditional check: `if (medicineName.length > MAX_MEDICINE_NAME_LENGTH)`. If this condition evaluates to true, the request is immediately terminated. We respond with `res.status(400).json({ error: "medicineName must not exceed ${MAX_MEDICINE_NAME_LENGTH} characters" })` and `return;`, effectively preventing oversized `medicineName` strings from being passed to the computationally expensive `detectLasaConflicts` service.

## Technical Decisions

We opted to utilize the existing `express-rate-limit` library for implementing the `lasaLimiter`. This decision was driven by the desire for consistency across our `apps/api` service, as `express-rate-limit` is already a proven and integrated dependency for other rate-limited endpoints like `/verify` and `/batch`. This approach avoids introducing new dependencies and leverages a familiar, well-tested solution.

The specific rate limit of `30` requests per `15` minutes for `lasaLimiter` was chosen after careful consideration. It provides a slightly more generous allowance compared to the `verifyLimiter` (20 requests/15 minutes) to accommodate potential legitimate batch UI workflows that might involve multiple LASA checks, while still being restrictive enough to prevent rapid-fire abuse. The 15-minute window is a common and effective duration for API rate limits, offering a reasonable reset period.

The `MAX_MEDICINE_NAME_LENGTH` was set to `200` characters. This value was chosen as a robust upper bound. While typical real medicine names are around 100 characters, a limit of 200 provides a generous buffer for legitimate, longer, or more complex names. Crucially, it prevents attackers from sending kilobyte-scale payloads, which would directly and significantly amplify the CPU cost of the `find_lasa_conflicts` RPC due to its string-distance comparison nature. Placing this validation early in the request processing pipeline ensures that expensive database operations are not initiated for invalid or malicious inputs.

## How To Re-Implement (Contributor Reference)

To re-implement a similar rate limiting and input length validation feature from scratch, a contributor would typically follow these steps:

1.  **Define a new rate limiter in `apps/api/src/middleware/rateLimit.ts`:**
    - Import `rateLimit` from `express-rate-limit`.
    - Declare and export a new constant, e.g., `export const newFeatureLimiter = rateLimit({ ... });`.
    - Configure `windowMs` (e.g., `15 * 60 * 1000` for 15 minutes) and `max` (e.g., `30` requests per window).
    - Set `standardHeaders: true` and `legacyHeaders: false`.
    - Implement a custom `handler` function to return a `429 Too Many Requests` status with a JSON error message, for example:
        ```typescript
        handler: (_req, res) => {
            res.status(429).json({
                error: "Too many requests for this feature. Please try again later.",
            });
        },
        ```
    - Add a clear comment explaining the purpose and configuration of the new limiter.

2.  **Apply the rate limiter to the target route in its respective route file (e.g., `apps/api/src/routes/yourFeature.ts`):**
    - Import the newly created limiter: `import { newFeatureLimiter } from "../middleware/rateLimit";`.
    - Insert the limiter as middleware in the route definition, ensuring it is placed before the main asynchronous handler function:
        ```typescript
        router.post(
            "/your-endpoint",
            newFeatureLimiter,
            async (req: Request, res: Response): Promise<void> => {
                // ... existing route logic
            }
        );
        ```

3.  **Implement input length validation within the route handler:**
    - Within the same route file, define a constant for the maximum allowed length for the specific input parameter, e.g.:
        ```typescript
        const MAX_INPUT_PARAM_LENGTH = 200; // Add an explanatory comment about the rationale
        ```
    - Inside the route handler function, after extracting the input parameter from `req.body` and performing any initial type or presence checks, add an `if` condition to validate its length:

        ```typescript
        const { inputParam } = req.body;

        // Existing validation for type and presence (if applicable)
        if (typeof inputParam !== "string" || inputParam.trim() === "") {
            res.status(400).json({
                error: "inputParam is required and must be a non-empty string",
            });
            return;
        }

        // New length validation
        if (inputParam.length > MAX_INPUT_PARAM_LENGTH) {
            res.status(400).json({
                error: `inputParam must not exceed ${MAX_INPUT_PARAM_LENGTH} characters`,
            });
            return;
        }

        // Proceed with resource-intensive operations only if validation passes
        // ... call service functions
        ```

    - Ensure this length check is performed _before_ any computationally expensive operations that would process the input parameter.

## Impact on System Architecture

This change significantly bolsters the resilience and security posture of the SahiDawa API, particularly for our backend services. By addressing a critical denial-of-service vulnerability on the `POST /api/v1/lasa/check` endpoint, we have ensured the stability of our Supabase connection pool and protected the overall API from being overwhelmed by abusive or malformed requests targeting expensive operations.

Architecturally, this reinforces our "defense in depth" strategy by adding a crucial layer of protection at the API gateway level. This complements existing database-level optimizations and ensures that resource consumption for computationally intensive tasks is controlled and predictable. This enhancement sets a valuable precedent for implementing similar robust protections on any future endpoints that involve high computational cost or interaction with external services, thereby contributing to a more reliable and resilient platform for our rural health initiatives.

## Testing & Verification

The effectiveness of this change was thoroughly verified through a series of tests covering both the rate limiting and input length validation functionalities:

- **Rate Limiting Verification:**
    - **Requests within Limit:** We simulated multiple requests (e.g., 29 requests) to `POST /api/v1/lasa/check` from the same IP address within a 15-minute window. All these requests successfully passed through and returned a `200 OK` status, as expected.
    - **Exceeding Limit:** A 31st request from the same IP within the 15-minute window was sent. This request was correctly rejected with a `429 Too Many Requests` status and the custom error message: `{ error: "Too many LASA check requests. Please try again later." }`.
    - **Limit Reset:** After the 15-minute window elapsed, subsequent requests from the same IP were verified to pass through successfully, confirming that the rate limit correctly resets.

- **Input Length Validation Verification:**
    - **Valid Length:** A `medicineName` string containing exactly 200 characters was sent in the request body. This request was processed successfully by the endpoint, returning a `200 OK` status.
    - **Exceeding Length:** A `medicineName` string with 201 characters was sent. This request was correctly rejected with a `400 Bad Request` status and the specific error message: `{ error: "medicineName must not exceed 200 characters" }`.
    - **Existing Validation:** Requests with a missing `medicineName` parameter or a `medicineName` that was not a string (e.g., `null`, a number) were confirmed to still return a `400 Bad Request` status, ensuring that the new length validation did not interfere with pre-existing input type and presence checks.

These comprehensive tests confirm that both the `lasaLimiter` and the `MAX_MEDICINE_NAME_LENGTH` validation are functioning precisely as intended, delivering the desired security and performance enhancements to the SahiDawa API.
