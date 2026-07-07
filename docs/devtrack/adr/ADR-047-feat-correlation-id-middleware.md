# ADR — Feat/correlation id middleware

> **Date:** 2026-07-07 | **PR:** #3250 | **Status:** Accepted

## Context

In SahiDawa's multi-service architecture, tracing a single request's lifecycle across asynchronous operations, database queries, and downstream service calls was difficult. Logs were disconnected, and when errors occurred in production, there was no reliable way to correlate client-side error responses with server-side log entries. Manually passing a request identifier through every function signature was highly invasive and unsustainable. The platform required a non-intrusive, automated mechanism to correlate logs and propagate a unique transaction identifier across all execution contexts and downstream network calls.

## Decision

We implemented a request correlation ID mechanism using Node.js's native `AsyncLocalStorage` to manage request-scoped context without thread-local storage limitations. 

Specifically, we:
1. **Created a Request Context Store:** Implemented `requestIdMiddleware` using `AsyncLocalStorage` to store a `RequestContext` containing a unique `requestId` (either extracted from the incoming `x-request-id` header or generated via `crypto.randomUUID()`).
2. **Wired Middleware Early:** Registered this middleware as the very first handler in `app.ts` to ensure all downstream middlewares, routers, and error handlers execute within the context.
3. **Automated Log Enrichment:** Integrated `getRequestId()` directly into the Winston logger configuration and Morgan HTTP logging middleware to automatically inject the `requestId` into every log line without manual developer intervention.
4. **Exposed IDs in Errors:** Updated the global `errorHandler` to append the active `requestId` to both the internal error logs and the JSON payload returned to the client.
5. **Propagated Downstream:** Introduced `serviceFetch` utilities that automatically retrieve the active `requestId` from context and forward it as an `x-request-id` header in all outbound HTTP requests to downstream services.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Manual Parameter Passing** | Required refactoring hundreds of function signatures across the codebase to pass a `requestId` parameter. This is highly error-prone, pollutes business logic, and increases maintenance overhead. |
| **Third-Party CLS Libraries (e.g., `cls-hooked`)** | These libraries rely on older, unofficial Node.js APIs. Using the native, officially supported `AsyncLocalStorage` from the `async_hooks` module provides better performance, stability, and long-term compatibility. |

## Consequences

**Positive:**
- **End-to-End Traceability:** Developers can trace a single transaction across HTTP access logs, application logs, error boundaries, and downstream microservices using a single ID.
- **Zero-Friction Logging:** Loggers automatically resolve and append the active request context, removing the cognitive load of manually logging metadata.
- **Faster Incident Resolution:** Production error payloads returned to clients now contain a `requestId`, allowing support teams to instantly locate the exact stack trace in the log aggregator.

**Trade-offs:**
- **Performance Overhead:** `AsyncLocalStorage` introduces a minor execution overhead due to tracking asynchronous resource lifecycles, though negligible for our current scale.
- **Context Loss Risk:** If asynchronous boundaries are broken (e.g., using legacy callback-based libraries or failing to await Promises properly), the context store can lose track of the active request ID.

## Related Issues & PRs

- PR #3250: Feat/correlation id middleware
- Issue #3135