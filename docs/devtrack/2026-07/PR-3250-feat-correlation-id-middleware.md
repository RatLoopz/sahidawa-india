# PR #3250 — Feat/correlation id middleware

> **Merged:** 2026-07-07 | **Author:** @Ayush2496 | **Area:** Backend | **Impact Score:** 32 | **Closes:** #3135

## What Changed

We introduced an asynchronous context-propagating correlation ID middleware to our Express backend. This system automatically generates or reuses a unique `x-request-id` header for every incoming HTTP request, stores it in Node.js's native `AsyncLocalStorage`, and automatically injects it into all Winston logs, Morgan HTTP logs, global error handler responses, and downstream HTTP requests made via our new `serviceFetch` utility.

## The Problem Being Solved

In our distributed rural health platform, debugging issues across asynchronous operations, database queries, and downstream service calls (such as our machine learning-based medicine verification engine) was highly inefficient. When multiple users interacted with the platform concurrently, logs from different requests interleaved in our log files. 

Before this PR, we had no reliable way to isolate and trace the lifecycle of a single request from the moment it hit our Nginx proxy to its database transactions, external API calls, and eventual response. Passing the Express `req` object or a manual trace ID through every single controller, service, and utility function would have resulted in massive "prop-drilling" and polluted our business logic. We needed a non-intrusive, thread-safe, and automated mechanism to correlate logs and trace requests end-to-end.

## Files Modified

- `apps/api/src/app.ts`
- `apps/api/src/middleware/errorHandler.ts`
- `apps/api/src/middleware/requestId.ts`
- `apps/api/src/utils/logger.ts`
- `apps/api/src/utils/serviceClient.ts`
- `apps/api/tests/requestId.test.ts`

## Implementation Details

### 1. Context Storage & Middleware (`apps/api/src/middleware/requestId.ts`)
We leveraged Node's native `AsyncLocalStorage` to manage the request context without passing variables through function signatures.
- **`requestContext`**: An instance of `AsyncLocalStorage<RequestContext>` storing a `requestId` string.
- **`requestIdMiddleware`**: 
  - Inspects incoming headers for an existing `x-request-id` (to support tracing initiated by upstream proxies or client applications).
  - If absent, it generates a new UUID v4 using Node's native `crypto.randomUUID()`.
  - Attaches the ID directly to the Express `req` object as `req.requestId` and sets the `x-request-id` header on the outgoing response (`res.setHeader`).
  - Wraps the execution of all downstream middleware and route handlers using `requestContext.run({ requestId }, () => { next(); })`.
- **`getRequestId()`**: A helper function that retrieves the active request ID from the store. It returns `undefined` if called outside an active request context (e.g., during application startup or in background cron jobs).

### 2. Application Integration (`apps/api/src/app.ts`)
We registered `requestIdMiddleware` as the absolute first middleware in `app.ts` (before security headers, rate limiters, and routers) to ensure that every downstream operation is executed within the `AsyncLocalStorage` context. We also updated our Morgan logger configuration to extract the request ID using `getRequestId()` and append it to our HTTP access logs.

### 3. Automated Winston Logging (`apps/api/src/utils/logger.ts`)
We created a custom Winston format called `injectRequestId` that intercepts every log entry:
```typescript
const injectRequestId = winston.format((info) => {
  const requestId = getRequestId();
  if (requestId) {
    info.requestId = requestId;
  }
  return info;
});
```
This format is combined into our Winston configuration. In non-production environments, our custom `logFormat` prints the ID as `[<requestId>]` alongside the timestamp and log level. In production, the ID is automatically serialized into the structured JSON log output. This allows us to call `logger.info("Some message")` anywhere in the codebase, and the log line will automatically be tagged with the correct request ID.

### 4. Error Handler Propagation (`apps/api/src/middleware/errorHandler.ts`)
When an unhandled exception occurs, our global `errorHandler` now retrieves the active request ID using `getRequestId()`. It logs the error with the associated ID and includes the `requestId` in the JSON payload returned to the client. This allows frontend clients or rural health workers to report a specific request ID when they encounter an error, allowing our engineering team to instantly locate the exact backend stack trace.

### 5. Downstream Propagation (`apps/api/src/utils/serviceClient.ts`)
To maintain the trace across service boundaries, we implemented `serviceFetch` and `serviceFetchWithTimeout`. These utilities wrap the global `fetch` API. They automatically extract the active `requestId` from `AsyncLocalStorage` and inject it as an `x-request-id` header into outgoing HTTP requests to downstream services, ensuring distributed tracing remains intact.

## Technical Decisions

### Why `AsyncLocalStorage`?
We chose `AsyncLocalStorage` over manual request-object passing because it keeps our service layers, database helpers, and utility classes completely decoupled from Express. It allows us to implement logging and tracing as a cross-cutting concern with zero refactoring of our existing business logic signatures.

### Why Native `crypto.randomUUID()`?
Instead of adding external dependencies like `uuid` or `nanoid`, we opted for Node's native `crypto.randomUUID()`. This reduces our dependency footprint, minimizes security vulnerabilities, and leverages highly optimized, cryptographically secure native code for ID generation.

### Why Wrap `fetch` in `serviceFetch`?
We chose to write a thin wrapper around the native `fetch` API rather than using heavy interceptor libraries (like Axios interceptors). This keeps our bundle size small, aligns with modern Node.js standards, and gives us fine-grained control over timeouts and abort signals via `AbortController`.

## How To Re-Implement (Contributor Reference)

If you need to re-implement or extend this correlation ID system in a new microservice or module, follow these steps:

1. **Define the Context and Middleware**:
   Create a middleware file that instantiates `AsyncLocalStorage`.
   ```typescript
   import { Request, Response, NextFunction } from "express";
   import crypto from "crypto";
   import { AsyncLocalStorage } from "async_hooks";

   interface RequestContext {
       requestId: string;
   }
   const requestContext = new AsyncLocalStorage<RequestContext>();

   export function getRequestId(): string | undefined {
       return requestContext.getStore()?.requestId;
   }

   export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
       const id = (req.headers["x-request-id"] as string) || crypto.randomUUID();
       (req as any).requestId = id;
       res.setHeader("x-request-id", id);
       requestContext.run({ requestId: id }, () => {
           next();
       });
   }
   ```

2. **Mount Early**:
   In your main application entry point (e.g., `app.ts`), import and mount the middleware before any other middleware or routing logic:
   ```typescript
   app.use(requestIdMiddleware);
   ```

3. **Configure the Logger**:
   Add a custom format to your Winston logger configuration to extract the ID from the context and append it to the log metadata. Ensure this format runs before your final string or JSON formatter.

4. **Propagate Outgoing Requests**:
   Always use the `serviceFetch` utility instead of raw `fetch` or `axios` when communicating with external APIs or other SahiDawa services. This ensures the `x-request-id` header is forwarded:
   ```typescript
   const response = await serviceFetch("https://api.sahidawa.org/v1/verify", {
       method: "POST",
       body: JSON.stringify({ medicineId }),
   });
   ```

## Impact on System Architecture

- **Observability**: This change elevates our backend observability to production-grade standards. We can now trace a single request's journey across our entire system, including database queries, error handlers, and external API calls.
- **Microservice Readiness**: By propagating the `x-request-id` header via `serviceFetch`, we have laid the groundwork for a distributed microservices architecture. If we split our medicine verification or scheduling services into dedicated microservices, our log aggregation tools (e.g., ELK stack, Grafana Loki) will be able to stitch together the entire lifecycle of a request across physical network boundaries.
- **Improved Supportability**: Rural health clinics often suffer from intermittent connectivity. If an API call fails, the client application can cache and display the returned `requestId`. When connectivity is restored, support staff can use this ID to pinpoint the exact failure in our centralized logging system.

## Testing & Verification

We added comprehensive unit tests in `apps/api/tests/requestId.test.ts` to verify the robustness of this middleware:
- **UUID Generation**: Verified that a valid UUID v4 is generated when no incoming `x-request-id` header is provided.
- **Header Preservation**: Verified that if an upstream proxy passes an `x-request-id`, our system preserves and reuses it instead of generating a new one.
- **Response Header Echoing**: Verified that the active request ID is always returned in the response headers.
- **Context Isolation**: Tested concurrent asynchronous operations to ensure that `AsyncLocalStorage` successfully isolates request IDs across concurrent, interleaved requests without leaking context.
- **Propagation Verification**: Verified that `serviceFetch` correctly extracts the ID from the active context and injects it into outgoing request headers.