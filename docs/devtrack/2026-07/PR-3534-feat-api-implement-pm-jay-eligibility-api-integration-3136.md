# PR #3534 — feat(api): implement PM-JAY eligibility API integration (#3136)

> **Merged:** 2026-07-12 | **Author:** @sureshsuriya | **Area:** Backend | **Impact Score:** 17 | **Closes:** #3136

## What Changed

We replaced our temporary placeholder PM-JAY eligibility logic with a production-ready integration pointing to the official PM-JAY API. This change introduces structured error handling for upstream failures, network exceptions, timeouts, and authentication issues, backed by strict runtime response validation using Zod schemas. We also preserved our local rule-engine fallback mechanism to ensure the system remains functional if the PM-JAY API is unconfigured or unavailable.

## The Problem Being Solved

Previously, our system relied on static mock logic to determine PM-JAY (Pradhan Mantri Jan Arogya Yojana) eligibility. This prevented rural healthcare workers and beneficiaries from receiving real-time, accurate eligibility statuses from the official government endpoints. Furthermore, our system lacked a resilient integration layer; any direct network calls to external government APIs were vulnerable to unhandled timeouts, rate limits, transient network drops, or unexpected payload schema changes, which could crash the API route or return unhelpful 500 Internal Server Errors to our users.

## Files Modified

- `apps/api/src/routes/eligibility.ts`
- `apps/api/src/services/governmentEligibility.ts`
- `apps/api/tests/eligibility.test.ts`

## Implementation Details

### 1. Custom Error Hierarchy
To handle the unpredictable nature of upstream government APIs, we introduced a structured error hierarchy in `apps/api/src/services/governmentEligibility.ts` extending a base `PmjayError`:
- `PmjayConfigurationError`: Thrown when environment variables are missing.
- `PmjayAuthError`: Thrown on 401/403 responses.
- `PmjayTimeoutError`: Thrown when the API fails to respond within `DEFAULT_TIMEOUT_MS`.
- `PmjayValidationError`: Thrown when the response is not valid JSON or fails the Zod schema validation.
- `PmjayUpstreamError`: Thrown when the upstream server returns a non-transient error (e.g., 4xx client errors or persistent 5xx errors).
- `PmjayNetworkError`: Thrown on low-level socket/network failures.

### 2. Zod Schema Validation & Transformation
We defined strict schemas to validate the incoming payload from the PM-JAY API:
- `pmjaySchemeSchema`: Validates individual scheme objects. It ensures `scheme_name` is a non-empty string and uses `.nullish().transform()` to guarantee that optional or null fields (`description`, `coverage`, `how_to_apply`) default to safe empty strings, and `link` defaults to `"https://beneficiary.nha.gov.in/"`.
- `pmjayResponseSchema`: Validates that the root response contains a `schemes` array matching `pmjaySchemeSchema`.

### 3. Resilient Fetch Implementation
The `fetchPmjayEligibility` function executes the POST request to the configured `PMJAY_BASE_URL`. It wraps the request in a retry loop (`MAX_RETRIES`) and utilizes `fetchWithTimeout`. 
- Transient errors (HTTP status codes 5xx, 408, and 429) trigger a log warning and initiate a retry attempt.
- Non-transient errors (like 401/403 or other 4xx client errors) immediately throw their respective custom errors without wasting retry cycles.

### 4. Route Handler Integration & Fallback
In `apps/api/src/routes/eligibility.ts`, we check if `PMJAY_BASE_URL` and `PMJAY_API_KEY` are configured. 
- **If configured:** We call `fetchPmjayEligibility`. Any caught custom errors are mapped to precise HTTP status codes (e.g., `PmjayAuthError` maps to `401`, while validation, upstream, and network errors map to `502 Bad Gateway` or `504 Gateway Timeout`) with clear error details.
- **If not configured:** We silently fall back to our local rule-engine logic, ensuring zero disruption to existing deployments that do not have active PM-JAY API credentials.

## Technical Decisions

### Zod for Runtime Type Safety
We chose Zod to parse the external API response because TypeScript types are discarded at runtime. Since government APIs are prone to undocumented payload changes, validating the schema at the boundary prevents malformed data from propagating deeper into our application layers and causing unexpected runtime crashes.

### Granular HTTP Status Mapping
Instead of returning a generic `500 Internal Server Error` for all integration failures, we mapped specific errors to `502 Bad Gateway` and `504 Gateway Timeout`. This architectural decision allows client applications (such as our mobile app used by rural health workers) to distinguish between a failure in SahiDawa's core infrastructure versus a temporary outage or timeout from the government's upstream servers.

### Decoupled Configuration Check
By checking `process.env.PMJAY_BASE_URL` dynamically inside the route handler, we avoid hard dependencies on external services during local development and testing. This keeps our local development environment lightweight and decoupled.

## How To Re-Implement (Contributor Reference)

If you need to re-implement or extend this integration pattern for another government health scheme, follow these steps:

1. **Define Custom Errors:** Create specific error classes extending a base integration error class in your service file to represent configuration, authentication, timeout, validation, upstream, and network failures.
2. **Define Zod Schemas:** Create a Zod schema matching the external API's expected response. Use `.nullish().transform()` to handle missing or null fields gracefully so your internal application code can always rely on consistent types.
3. **Implement the Fetch Wrapper:**
   ```typescript
   // Ensure you check for configuration first
   if (!baseUrl || !apiKey) {
       throw new ConfigurationError("Service not configured");
   }
   ```
   Implement a loop that retries on transient status codes (500, 502, 503, 504, 408, 429) up to a maximum limit, but immediately throws on authentication (401, 403) or client validation errors.
4. **Integrate into the Router:**
   In your Express router, wrap the service call in a try-catch block:
   ```typescript
   try {
       const results = await fetchServiceEligibility(input);
       res.status(200).json({ results });
   } catch (err) {
       if (err instanceof AuthError) {
           return res.status(401).json({ error: "Unauthorized", details: err.message });
       }
       if (err instanceof TimeoutError) {
           return res.status(504).json({ error: "Gateway Timeout", details: err.message });
       }
       // Handle other custom errors...
   }
   ```
5. **Preserve Fallbacks:** Always ensure that if the service is unconfigured, the router catches this state early and falls back to local rule-based processing.

## Impact on System Architecture

- **Resilience:** Upstream API failures are now isolated. A failure in the PM-JAY API will no longer crash the eligibility route; instead, it returns structured error responses that client applications can gracefully display to users.
- **Extensibility:** This implementation establishes a standardized design pattern for all future external API integrations (such as state-specific health cards or ABDM registry lookups) within the SahiDawa ecosystem.
- **Maintainability:** By decoupling the API calling logic (`governmentEligibility.ts`) from the routing logic (`eligibility.ts`), we can easily update the API endpoint structure or authentication mechanism without modifying our HTTP request-response handlers.

## Testing & Verification

We verified this implementation with a comprehensive test suite in `apps/api/tests/eligibility.test.ts` covering the following scenarios:
- **Successful Integration:** Mocking a valid PM-JAY API response and verifying that the API returns a `200 OK` with the validated schemes.
- **Fallback Behavior:** Verifying that the system falls back to the local rule engine when `PMJAY_BASE_URL` or `PMJAY_API_KEY` are undefined.
- **Authentication Failures:** Simulating `401` and `403` responses from the upstream API and verifying that the route returns `401 Unauthorized`.
- **Timeouts:** Simulating slow responses that exceed `DEFAULT_TIMEOUT_MS` and verifying that the route returns `504 Gateway Timeout`.
- **Validation Failures:** Mocking malformed JSON or responses missing required fields to verify that Zod catches the schema mismatch and the route returns `502 Bad Gateway`.
- **Upstream Server Errors:** Simulating persistent `5xx` errors to verify that the retry mechanism executes up to `MAX_RETRIES` before returning `502 Bad Gateway`.