# ADR — feat(api): implement PM-JAY eligibility API integration (#3136)

> **Date:** 2026-07-12 | **PR:** #3136 | **Status:** Accepted

## Context

SahiDawa requires a reliable method to verify user eligibility for the Pradhan Mantri Jan Arogya Yojana (PM-JAY) national health insurance scheme. Previously, the platform relied on placeholder logic and a local rule-engine. To provide accurate, real-time eligibility checks, the system needed to integrate with the official PM-JAY external API. However, external government APIs can be unstable, slow, or subject to schema changes. The integration required strict response validation, granular error handling, and a resilient fallback mechanism to prevent upstream failures from degrading the core application's availability.

## Decision

We integrated a dedicated PM-JAY eligibility service with the following architectural patterns:

1. **Strict Schema Validation:** Implemented Zod schemas to validate external API responses at the boundary, ensuring runtime type safety before data propagates through the application.
2. **Custom Structured Error Handling:** Introduced specific error classes (`PmjayAuthError`, `PmjayTimeoutError`, `PmjayValidationError`, `PmjayUpstreamError`, `PmjayNetworkError`) to map upstream failures to precise HTTP status codes (e.g., `401 Unauthorized` for auth failures, `504 Gateway Timeout` for timeouts, and `502 Bad Gateway` for validation or upstream errors).
3. **Graceful Fallback:** Preserved the existing local rule-engine as a fallback. If the PM-JAY environment variables (`PMJAY_BASE_URL`, `PMJAY_API_KEY`) are unconfigured, the system silently defaults to the local rule-engine.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Direct Integration without Zod Validation** | Rejected because upstream government API payloads are prone to undocumented changes. Lacking strict validation would cause silent runtime failures or unhandled exceptions deeper in the application stack. |
| **Fail-Fast Strategy (No Rule-Engine Fallback)** | Rejected because rural health platforms must maintain high availability. Completely blocking eligibility checks during upstream API outages or misconfigurations degrades user experience compared to providing estimated eligibility via the local rule-engine. |

## Consequences

**Positive:**
- **Resilience:** The API remains operational during upstream outages by falling back to the local rule-engine when unconfigured.
- **Maintainability:** Custom error classes isolate external API issues, simplifying debugging and client-side error propagation.
- **Data Integrity:** Zod validation guarantees that only correctly structured data from the external API is processed by the backend.

**Trade-offs:**
- **Complexity:** Added multiple custom error classes and conditional routing logic in the eligibility controller.
- **Performance Overhead:** Parsing and validating external JSON payloads with Zod introduces a minor CPU overhead per request.

## Related Issues & PRs

- PR #3136: feat(api): implement PM-JAY eligibility API integration
- Issue #3136