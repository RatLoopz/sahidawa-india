# ADR — fix(api): handle missing async error rejections in routes (#1061)

> **Date:** 2026-06-02 | **PR:** #1061 | **Status:** Accepted

## Context

The SahiDawa API, built with Express and interacting with Supabase, experienced critical server instability. Several asynchronous API routes lacked proper error handling for Supabase operations. When external factors like network timeouts or database failures occurred, these unhandled promise rejections would terminate the Node.js process, leading to server crashes and service unavailability. This posed a significant risk to the platform's reliability and user experience.

## Decision

Robust error handling was implemented for asynchronous operations within critical Express API routes. This involved:

- Wrapping `supabase` database calls and other asynchronous operations in `try-catch` blocks within affected route handlers (`apps/api/src/routes/verify.ts`, `apps/api/src/routes/reports.ts`, `apps/api/src/routes/scan.ts`, `apps/api/src/routes/alerts.ts`).
- Explicitly catching unexpected errors (e.g., network issues, database connection failures) that would otherwise result in unhandled promise rejections.
- Responding to clients with a standardized HTTP 500 status code and a generic error message (e.g., "An unexpected error occurred" or "Failed to fetch alerts") instead of allowing the server to crash or the request to hang indefinitely.
- Logging unexpected errors on the server side for debugging and monitoring purposes.

## Alternatives Considered

| Alternative                                                                     | Why Rejected                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Global Unhandled Rejection Handler (`process.on('unhandledRejection')`)         | While it catches unhandled rejections, it's a last-resort mechanism for logging and doesn't provide per-request context-specific error responses or prevent the underlying error from occurring. It doesn't guarantee a graceful HTTP response to the client for the specific request that caused the rejection.                                                                                      |
| Express Error-Handling Middleware (`app.use((err, req, res, next) => { ... })`) | This middleware is effective for synchronous errors or errors explicitly passed via `next(err)`. However, it does not automatically catch unhandled promise rejections from `async` route handlers unless each handler is explicitly modified to call `next(err)` in its `catch` block, which would essentially replicate the chosen `try-catch` pattern but with an additional layer of indirection. |

## Consequences

**Positive:**

- Significantly improved API stability and resilience against external dependency failures (e.g., Supabase outages, network issues).
- Eliminated server crashes caused by unhandled promise rejections, preventing service downtime.
- Provided consistent HTTP 500 error responses to clients for internal server errors, improving API predictability and client-side error handling.
- Enhanced developer experience by preventing unexpected Node.js process terminations during development and testing.
- Added server-side logging for unexpected errors, aiding in debugging and monitoring.

**Trade-offs:**

- Increased boilerplate code in individual API routes due to repetitive `try-catch` blocks around asynchronous operations.
- Potential for slight inconsistencies in error messages returned to the client if not carefully standardized across all `catch` blocks.

## Related Issues & PRs

- PR #1061: fix(api): handle missing async error rejections in routes (#1061)
- Issue #1061
