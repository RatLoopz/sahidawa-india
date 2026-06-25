# PR #2568 — fix(#2557): rate limit and validate Overpass proxy requests

> **Merged:** 2026-06-25 | **Author:** @Shreya-nipunge | **Area:** Frontend | **Impact Score:** 8 | **Closes:** #2557

## What Changed

We implemented robust input validation and rate limiting for the `/api/overpass` endpoint in `apps/web/app/api/overpass/route.ts`. This change introduces checks for malformed JSON request bodies, ensures the `query` parameter is a non-empty string, and enforces a maximum query length of 10,000 characters. Additionally, we integrated our existing per-IP rate limiting mechanism to prevent abuse of the Overpass proxy.

## The Problem Being Solved

Prior to this PR, the `/api/overpass` endpoint was vulnerable to various forms of abuse and instability. Without input validation, malformed or excessively large queries could be passed directly to upstream Overpass mirrors, potentially leading to unnecessary load on these external services, increased network traffic, and higher operational costs for our system. A lack of rate limiting also meant that a single client could flood the endpoint with requests, impacting service availability for other users and potentially triggering rate limits on the upstream Overpass mirrors, leading to service degradation. Issue #2557 specifically highlighted these security and performance concerns.

## Files Modified

- `apps/web/app/api/overpass/route.ts`
- `apps/web/tests/overpass-route.test.ts`

## Implementation Details

The core changes are within the `POST` handler of `apps/web/app/api/overpass/route.ts`.

1.  **Rate Limiting:**
    -   We import the shared `rateLimit` utility from ` "@/lib/rateLimit"`.
    -   The client's IP address is extracted from request headers, prioritizing `x-forwarded-for` (handling proxies/load balancers), then `x-real-ip`, and defaulting to `127.0.0.1` if neither is present.
    -   `await rateLimit.limit(ip)` is called. If the `success` property of the returned object is `false`, a `NextResponse.json` with a `429 Too Many Requests` status and an appropriate error message is returned immediately, preventing further processing or upstream calls.

2.  **JSON Body Parsing and Validation:**
    -   The `req.json()` call is now wrapped in a `try-catch` block. If `req.json()` fails (indicating malformed JSON, e.g., `body: "invalid json"`), a `NextResponse.json` with a `400 Bad Request` status and an "Invalid JSON body" error is returned.
    -   After successful parsing, the `query` property is destructured from the `body` object.

3.  **Query Parameter Validation:**
    -   We perform two checks on the extracted `query`:
        -   **Type and Emptiness:** `if (typeof query !== "string" || query.trim() === "")` ensures that `query` is a string and, after trimming whitespace, is not empty. If this condition is met, a `400 Bad Request` is returned with "Missing or invalid query".
        -   **Length Limit:** A new constant `MAX_QUERY_LENGTH` is defined with a value of `10000`. `if (query.length > MAX_QUERY_LENGTH)` checks if the query string exceeds this length. If it does, a `400 Bad Request` is returned with "Query exceeds maximum length".

4.  **Preserved Logic:** If all validation and rate limiting checks pass, the original logic for querying the `OVERPASS_MIRRORS` in parallel using `Promise.race` and `AbortController` remains unchanged, ensuring that valid requests continue to benefit from the mirror failover mechanism.

## Technical Decisions

1.  **Reuse of `rateLimit` utility:** We opted to reuse the existing `rateLimit` utility (`@/lib/rateLimit`) rather than implementing a new rate limiting mechanism. This decision was made to maintain consistency across our API endpoints, leverage a proven and tested solution, and reduce code duplication. It ensures a unified rate limiting policy and simplifies maintenance.
2.  **Early Exit on Validation Failure:** The design prioritizes early exit for invalid requests (e.g., malformed JSON, invalid query parameters, rate limit exceeded). This approach minimizes resource consumption by preventing unnecessary processing, such as parsing the full request body or initiating upstream calls, for requests that are clearly invalid or abusive.
3.  **Specific Error Messages and Status Codes:** We chose to return specific HTTP status codes (e.g., `400 Bad Request` for validation errors, `429 Too Many Requests` for rate limiting) and descriptive error messages. This provides clear feedback to clients about the nature of their request issues, aiding in debugging and proper API usage.
4.  **`MAX_QUERY_LENGTH` Constant:** Defining `MAX_QUERY_LENGTH` as a constant (`10000`) makes the limit explicit, easily configurable, and improves code readability. The chosen length is a reasonable balance to allow complex queries while preventing excessively large payloads that could strain our proxy or upstream services.

## How To Re-Implement (Contributor Reference)

To re-implement this feature, a contributor would follow these steps:

1.  **Identify the Target Endpoint:** Locate the `POST` handler for the `/api/overpass` route in `apps/web/app/api/overpass/route.ts`.
2.  **Import Rate Limiter:** Add `import { rateLimit } from "@/lib/rateLimit";` at the top of the file.
3.  **Define Query Length Limit:** Declare `const MAX_QUERY_LENGTH = 10000;` (or an appropriate value) near the top of the file, perhaps below `OVERPASS_MIRRORS`.
4.  **Extract Client IP:** At the beginning of the `POST` function, implement IP extraction logic:
    ```typescript
    const forwardedFor = req.headers.get("x-forwarded-for");
    const realIp = req.headers.get("x-real-ip");
    const ip = forwardedFor?.split(",")[0]?.trim() || realIp || "127.0.0.1";
    ```
5.  **Apply Rate Limiting:** Immediately after IP extraction, integrate the rate limiting check:
    ```typescript
    const { success } = await rateLimit.limit(ip);
    if (!success) {
        return NextResponse.json(
            { error: "Too many requests. Please try again in a few moments." },
            { status: 429 }
        );
    }
    ```
6.  **Handle Malformed JSON:** Wrap the `req.json()` call in a `try-catch` block to gracefully handle invalid JSON payloads:
    ```typescript
    let body;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { query } = body; // Destructure 'query' after successful parsing
    ```
7.  **Validate Query Parameter:** Implement checks for the `query` parameter's type, emptiness, and length:
    ```typescript
    if (typeof query !== "string" || query.trim() === "") {
        return NextResponse.json({ error: "Missing or invalid query" }, { status: 400 });
    }
    if (query.length > MAX_QUERY_LENGTH) {
        return NextResponse.json({ error: "Query exceeds maximum length" }, { status: 400 });
    }
    ```
8.  **Ensure Existing Logic:** Verify that the subsequent logic for making requests to `OVERPASS_MIRRORS` is still reachable and functions as intended for valid, non-rate-limited requests.
9.  **Add Comprehensive Tests:** Create a new test file `apps/web/tests/overpass-route.test.ts`.
    -   Mock the `@/lib/rateLimit` module using `jest.mock` to control its behavior during tests.
    -   Create a helper function `buildRequest` to simplify creating `NextRequest` objects.
    -   Write test cases for:
        -   Valid requests (expect `200 OK`).
        -   Invalid JSON body (expect `400 Bad Request`).
        -   Missing `query` parameter (expect `400 Bad Request`).
        -   Non-string `query` parameter (expect `400 Bad Request`).
        -   Empty/whitespace-only `query` parameter (expect `400 Bad Request`).
        -   `query` exceeding `MAX_QUERY_LENGTH` (expect `400 Bad Request`).
        -   Rate limit exceeded (expect `429 Too Many Requests`).
    -   Use `jest.spyOn(global, 'fetch')` to mock upstream API calls and assert that they are (or are not) called based on validation outcomes.

## Impact on System Architecture

This change significantly improves the robustness and security of our frontend's interaction with external Overpass services.

1.  **Enhanced Security:** By validating inputs and rate-limiting requests, we mitigate potential denial-of-service attacks or abuse vectors targeting our Overpass proxy. This protects both our infrastructure and the upstream Overpass mirrors from malicious or accidental overload.
2.  **Improved Performance and Stability:** Rejecting invalid requests early reduces unnecessary processing load on our Next.js server and network bandwidth, leading to more efficient resource utilization. It also prevents our system from being blacklisted by Overpass mirrors due to excessive or malformed requests, ensuring continued access to critical geographic data.
3.  **Maintainability:** The reuse of the existing `rateLimit` utility promotes a consistent approach to API security across the platform, simplifying future development and maintenance efforts.
4.  **Foundation for Future Features:** A more resilient and secure Overpass proxy allows us to confidently build new features that rely on geographic data, such as advanced search capabilities for rural health centers or medicine distribution points, without worrying about the underlying proxy's stability.

## Testing & Verification

This change was thoroughly tested with a new dedicated test file: `apps/web/tests/overpass-route.test.ts`.
The tests cover the following critical scenarios:

-   **Valid Requests:** Confirmed that a well-formed request with a valid query successfully proceeds to call the upstream Overpass mirrors and returns a `200 OK` response.
-   **Invalid JSON Body:** Verified that requests with malformed JSON payloads are rejected with a `400 Bad Request` and an "Invalid JSON body" error, without attempting to call upstream mirrors.
-   **Missing/Invalid Query:** Tested cases where the `query` field is missing, not a string, or an empty string (including whitespace-only), ensuring they are rejected with a `400 Bad Request` and "Missing or invalid query".
-   **Oversized Queries:** Confirmed that queries exceeding the `MAX_QUERY_LENGTH` of 10,000 characters are rejected with a `400 Bad Request` and "Query exceeds maximum length".
-   **Rate Limiting:** A mock `rateLimit` implementation was used to simulate exceeding the request limit (10 requests per IP within a 60-second window). The tests verified that after 10 successful requests, subsequent requests from the same IP within the reset window receive a `429 Too Many Requests` response. It also confirmed that upstream `fetch` calls are only made for the successful, non-rate-limited requests (10 successful requests * 5 mirrors = 50 `fetch` calls).

Edge cases considered and covered by tests include:
-   Different IP extraction scenarios (e.g., `x-forwarded-for`, `x-real-ip`, or fallback to `127.0.0.1`).
-   Various forms of invalid `query` input (e.g., `null`, `number`, empty string, string with only spaces).
-   The interaction between validation failures and the rate limiter (validation errors should prevent rate limit consumption for that specific request, but the rate limit check happens first).