# PR #3316 — feat(api): inject x-request-id into global winston logging context #3286

> **Merged:** 2026-07-07 | **Author:** @Avinash-sdbegin | **Area:** Backend | **Impact Score:** 6 | **Closes:** #3286

## What Changed

We integrated our existing `getRequestId()` utility into the global Winston logger configuration within `apps/api/src/utils/logger.ts`. This allows the logger to automatically extract the unique `x-request-id` from the active asynchronous execution context and inject it into every log entry. Additionally, we standardized the file's code formatting to use double quotes and consistent 4-space indentation.

## The Problem Being Solved

In a concurrent backend environment like SahiDawa, tracing a single API request's lifecycle across multiple log statements is extremely difficult without a correlation identifier. Previously, our logs lacked unified context unless developers manually extracted the request ID and passed it as metadata to every single `logger.info()` or `logger.error()` call. This manual approach was error-prone, cluttered the codebase, and made debugging production issues—such as failed medicine verifications or slow rural health platform queries—highly inefficient. We needed a non-intrusive, automated way to correlate logs belonging to the same HTTP request.

## Files Modified

- `apps/api/src/utils/logger.ts`

## Implementation Details

We modified the global Winston logger configuration to automatically capture and append the request ID to all log outputs:

1. **Context Extraction**: We imported `getRequestId` from `../middleware/requestId`. This utility leverages Node's `AsyncLocalStorage` to retrieve the unique request ID associated with the current asynchronous execution path.
2. **Custom Winston Format**: We defined a custom Winston format middleware named `injectRequestId`:
   ```typescript
   const injectRequestId = winston.format((info) => {
       const requestId = getRequestId();
       if (requestId) {
           info.requestId = requestId;
       }
       return info;
   });
   ```
   This interceptor runs on every log invocation, mutating the log's `info` object to include the `requestId` if it is available in the current context.
3. **Log Formatting**: We updated our console-friendly `logFormat` (using Winston's `printf`) to check for the presence of `requestId`. If present, it formats it as ` [requestId]` immediately after the log level:
   ```typescript
   const logFormat = printf(({ level, message, timestamp, stack, requestId }) => {
       const reqIdTag = requestId ? ` [${requestId}]` : "";
       if (stack) {
           return `${timestamp} ${level}:${reqIdTag} ${message}\n${stack}`;
       }
       return `${timestamp} ${level}:${reqIdTag} ${message}`;
   });
   ```
4. **Logger Configuration**: We registered `injectRequestId()` into the global Winston format chain:
   ```typescript
   const logger = winston.createLogger({
       level: process.env.LOG_LEVEL || "info",
       format: combine(
           errors({ stack: true }),
           timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
           injectRequestId(),
           process.env.NODE_ENV === "production" ? json() : combine(colorize(), logFormat)
       ),
       transports: [new winston.transports.Console(), errorTransport, combinedTransport],
   });
   ```
   In production environments (`process.env.NODE_ENV === 'production'`), the logger outputs structured JSON. Because `injectRequestId` adds `requestId` directly to the `info` object, the field is automatically serialized into the JSON payload, making it easily indexable by log aggregators.

## Technical Decisions

- **Winston Custom Format Middleware**: We chose to implement a custom Winston format instead of wrapper functions. This ensures that all existing `logger.info()`, `logger.warn()`, and `logger.error()` calls across the entire codebase automatically benefit from request ID injection without requiring any refactoring of caller sites.
- **AsyncLocalStorage Integration**: By leveraging the existing `AsyncLocalStorage`-backed `getRequestId()` utility, we avoid passing the Express `req` object down through our service layers, maintaining a clean separation of concerns between our transport layer and business logic.
- **Environment-Specific Output**: We preserved the distinction between local development (colorized, human-readable text with `[requestId]` tags) and production (structured JSON containing the `requestId` field) to ensure optimal developer experience locally and machine-readability in production log aggregators.

## How To Re-Implement (Contributor Reference)

If you need to re-implement or extend this logging behavior in another service, follow these steps:

1. **Ensure Context Middleware is Active**: Ensure you have an active Express middleware that generates or forwards an `x-request-id` header, stores it in an `AsyncLocalStorage` instance, and exposes a getter function (e.g., `getRequestId()`).
2. **Define the Format Interceptor**: In your logger configuration file, import the getter and define the Winston format:
   ```typescript
   const injectRequestId = winston.format((info) => {
       const requestId = getRequestId();
       if (requestId) {
           info.requestId = requestId;
       }
       return info;
   });
   ```
3. **Update the Printf Formatter**: Ensure your console formatter checks for the `requestId` property on the Winston `info` object and appends it to the output string:
   ```typescript
   const logFormat = printf(({ level, message, timestamp, stack, requestId }) => {
       const reqIdTag = requestId ? ` [${requestId}]` : "";
       return `${timestamp} ${level}:${reqIdTag} ${message}${stack ? `\n${stack}` : ""}`;
   });
   ```
4. **Order the Format Chain**: When calling `winston.createLogger`, place `injectRequestId()` *before* the final formatting step (like `json()` or your custom `logFormat`) in the `combine` array. This ensures the mutated metadata is available to the final serializer.
5. **Gotcha**: Always ensure that `getRequestId()` handles cases where no context is active (e.g., during application bootstrap, cron jobs, or queue workers) by returning `undefined` gracefully, preventing null-pointer exceptions in the logging pipeline.

## Impact on System Architecture

- **Zero-Touch Correlation**: This change introduces zero-overhead, automatic correlation tracking across our entire backend API.
- **Decoupled Logging**: Our logging infrastructure is now completely decoupled from Express request handlers. Background tasks, database queries, and external API calls executed within the request lifecycle automatically inherit the request ID in their logs.
- **Observability Readiness**: This lays the groundwork for robust distributed tracing and structured log aggregation, which is critical as SahiDawa scales to handle more rural health clinics and medicine verification requests.

## Testing & Verification

- **Compilation**: Verified that `apps/api/src/utils/logger.ts` compiles successfully with the new imports and formatting.
- **Context Verification**: Confirmed that when an API request is processed, the console logs output the request ID in the format `[timestamp] [level]: [request-id] [message]`.
- **Fallback Verification**: Verified that when no request context is active (e.g., during application startup or background initialization), the logger gracefully omits the request ID tag without throwing errors or leaving empty brackets.
- **Scope Check**: Confirmed that no other application files were modified, ensuring zero regression risk for existing log calls.