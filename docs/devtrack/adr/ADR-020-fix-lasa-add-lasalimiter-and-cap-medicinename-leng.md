# ADR — fix(lasa): add lasaLimiter and cap medicineName length on /check endpoint

> **Date:** 2024-07-30 | **PR:** #1114 | **Status:** Accepted

## Context

The `POST /api/v1/lasa/check` endpoint was identified as a critical vulnerability for API resource exhaustion. This endpoint triggers `find_lasa_conflicts`, a resource-intensive database operation involving full-text string-distance comparisons across the entire medicines table. Unlike other expensive API endpoints (`/verify`, `/batch`), `/lasa/check` lacked any rate limiting. Furthermore, the `medicineName` input parameter had no length cap, allowing unauthenticated clients to submit arbitrarily long strings, significantly amplifying the database CPU cost per request. This combination could lead to saturation of the Supabase connection pool and degradation of overall API performance.

## Decision

To mitigate the identified resource exhaustion vulnerability, two primary architectural changes were implemented:

1.  **Rate Limiting:** A new `lasaLimiter` was introduced in `apps/api/src/middleware/rateLimit.ts`. This limiter restricts requests to 30 per 15 minutes per IP address for the `POST /api/v1/lasa/check` endpoint. It was applied as middleware to the `/check` route in `apps/api/src/routes/lasa.ts`.
2.  **Input Length Validation:** A `MAX_MEDICINE_NAME_LENGTH` constant was defined as 200 characters. The `POST /api/v1/lasa/check` endpoint now validates the `medicineName` input, rejecting any string exceeding 200 characters with a 400 Bad Request status.

## Alternatives Considered

| Alternative | Why Rejected LASA (Likely to be similar to) is a class of medications that are related to each other in terms of their chemical structure, pharmacological action, or therapeutic use. These medications often have similar side effects and drug interactions.

In the context of SahiDawa, LASA medications are those that are similar enough to cause confusion, leading to potential medication errors. The `/check` endpoint helps identify such conflicts.

## Context

The `POST /api/v1/lasa/check` endpoint was identified as a critical vulnerability for API resource exhaustion. This endpoint triggers `find_lasa_conflicts`, a resource-intensive database operation involving full-text string-distance comparisons across the entire medicines table. Unlike other expensive API endpoints (`/verify`, `/batch`), `/lasa/check` lacked any rate limiting. Furthermore, the `medicineName` input parameter had no length cap, allowing unauthenticated clients to submit arbitrarily long strings, significantly amplifying the database CPU cost per request. This combination could lead to saturation of the Supabase connection pool and degradation of overall API performance.

## Decision

To mitigate the identified resource exhaustion vulnerability, two primary architectural changes were implemented:

1.  **Rate Limiting:** A new `lasaLimiter` was introduced in `apps/api/src/middleware/rateLimit.ts`. This limiter restricts requests to 30 per 15 minutes per IP address for the `POST /api/v1/lasa/check` endpoint. It was applied as middleware to the `/check` route in `apps/api/src/routes/lasa.ts`.
2.  **Input Length Validation:** A `MAX_MEDICINE_NAME_LENGTH` constant was defined as 200 characters. The `POST /api/v1/lasa/check` endpoint now validates the `medicineName` input, rejecting any string exceeding 200 characters with a 400 Bad Request status.

## Alternatives Considered

| Alternative | Why Rejected LASA (Likely to be similar to) is a class of medications that are related to each other in terms of their chemical structure, pharmacological action, or therapeutic use. These medications often have similar side effects and drug interactions.

In the context of SahiDawa, LASA medications are those that are similar enough to cause confusion, leading to potential medication errors. The `/check` endpoint helps identify such conflicts.

## Context

The `POST /api/v1/lasa/check` endpoint was identified as a critical vulnerability for API resource exhaustion. This endpoint triggers `find_lasa_conflicts`, a resource-intensive database operation involving full-text string-distance comparisons across the entire medicines table. Unlike other expensive API endpoints (`/verify`, `/batch`), `/lasa/check` lacked any rate limiting. Furthermore, the `medicineName` input parameter had no length cap, allowing unauthenticated clients to submit arbitrarily long strings, significantly amplifying the database CPU cost per request. This combination could lead to saturation of the Supabase connection pool and degradation of overall API performance.

## Decision

To mitigate the identified resource exhaustion vulnerability, two primary architectural changes were implemented:

1.  **Rate Limiting:** A new `lasaLimiter` was introduced in `apps/api/src/middleware/rateLimit.ts`. This limiter restricts requests to 30 per 15 minutes per IP address for the `POST /api/v1/lasa/check` endpoint. It was applied as middleware to the `/check` route in `apps/api/src/routes/lasa.ts`.
2.  **Input Length Validation:** A `MAX_MEDICINE_NAME_LENGTH` constant was defined as 200 characters. The `POST /api/v1/lasa/check` endpoint now validates the `medicineName` input, rejecting any string exceeding 200 characters with a 400 Bad Request status.

## Alternatives Considered

| Alternative                                                                                     | Why Rejected                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1. Database-level resource management (e.g., connection pooling limits, statement timeouts)** | Rejected because application-level controls offer more granular, endpoint-specific protection and better user feedback (429 vs. generic database error). This approach also would not address the unbounded input length issue directly.                           |
| **2. Implement only input length validation without rate limiting**                             | Rejected because while it mitigates the cost per individual request, it does not prevent resource exhaustion from a high volume of valid-length, moderately expensive requests. Rate limiting is essential for preventing DoS from request volume.                 |
| **3. Implement only rate limiting without input length validation**                             | Rejected because even rate-limited requests could be arbitrarily expensive if `medicineName` strings were unbounded. This would lead to higher per-request resource consumption than necessary, potentially still exhausting resources even within the rate limit. |

## Consequences

**Positive:**

- Enhanced API resilience against Denial-of-Service (DoS) attacks targeting the `lasa/check` endpoint.
- Reduced load on the Supabase database by limiting the frequency and computational cost of expensive full-text search operations.
- Improved overall API stability and consistent performance for other endpoints by preventing connection pool saturation.
- Standardized protection mechanisms across resource-intensive API endpoints, aligning `/lasa/check` with existing patterns for `/verify` and `/batch`.

**Trade-offs:**

- Legitimate clients performing high-volume LASA checks (e.g., automated tools, batch processing UIs) may encounter rate limits (429 Too Many Requests) if they exceed 30 requests per 15 minutes.
- `medicineName` inputs exceeding 200 characters are now rejected, potentially requiring client-side truncation or re-evaluation for valid but exceptionally long medicine names, although real medicine names are typically much shorter.

## Related Issues & PRs

- PR #1114: fix(lasa): add lasaLimiter and cap medicineName length on /check endpoint
- Issue #1105: `POST /api/v1/lasa/check` has no rate limiting or input length cap
