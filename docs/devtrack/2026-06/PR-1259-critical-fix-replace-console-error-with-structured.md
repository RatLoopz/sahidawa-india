# PR #1259 — [Critical] fix: replace console.error with structured logger in verify.ts and batch.ts

> **Merged:** 2026-06-04 | **Author:** @AnushKamble | **Area:** Backend | **Impact Score:** 9 | **Closes:** #1248

## What Changed

This pull request refactored error logging in two critical backend API route files, `apps/api/src/routes/verify.ts` and `apps/api/src/routes/batch.ts`. We replaced all instances of `console.error()` with calls to our centralized, structured Winston logger (`logger.error()`). This change ensures that all error messages from these routes are consistently formatted with timestamps, log levels, and structured JSON metadata, integrating them into our application's robust logging infrastructure.

## The Problem Being Solved

Prior to this PR, the `apps/api/src/routes/verify.ts` and `apps/api/src/routes/batch.ts` files were using `console.error()` for error logging. This practice bypassed our application's configured Winston logger, which is defined in `apps/api/src/utils/logger.ts`. The consequence was that error logs from these crucial API endpoints were unstructured, lacked timestamps, did not include log levels, and were not subject to our daily log file rotation policies. Crucially, these errors were not being integrated into our centralized error monitoring pipeline, making it difficult to effectively observe, debug, and react to production issues within our Docker deployment. This significantly hindered our ability to gain operational insights and ensure the reliability of the SahiDawa platform.

## Files Modified

- `apps/api/src/routes/batch.ts`
- `apps/api/src/routes/verify.ts`

## Implementation Details

The implementation involved two main steps for each of the affected files:

**1. Importing the Logger:**
In both `apps/api/src/routes/verify.ts` and `apps/api/src/routes/batch.ts`, we added the following import statement at the top of the file to make our structured logger available:

```typescript
import logger from "../utils/logger";
```

**2. Replacing `console.error()` calls with `logger.error()`:**

**For `apps/api/src/routes/verify.ts`:**

- **Line 173:** The call `console.error("Medicine lookup failed:", error)` was replaced with `logger.error({ message: "Medicine lookup failed", error, route: "/api/verify" })`. This logs a structured object containing a human-readable message, the actual `error` object from the database lookup, and the API `route` for context.
- **Line 242:** The call `console.error("Failed to record scan history:", insertError)` was replaced with `logger.error({ message: "Failed to record scan history", error: insertError, route: "/api/verify" })`. Similar to the above, it provides structured context for scan history insertion failures.
- **Line 264:** The call `console.error("Unexpected error in /api/verify:", err)` was replaced with `logger.error({ message: "Unexpected error in /api/verify", error: err, route: "/api/verify" })`. This captures unexpected runtime errors within the `/api/verify` route's `try-catch` block.

**For `apps/api/src/routes/batch.ts`:**

- **Line 118:** The call `console.error("Batch lookup failed:", batchError)` was replaced with `logger.error({ message: "Batch lookup failed", error: batchError, route: "/api/verify/batch" })`. This provides structured logging for failures during batch number lookups.
- **Line 135:** The call `console.error("Medicine fallback lookup failed:", medicineError)` was replaced with `logger.error({ message: "Medicine fallback lookup failed", error: medicineError, route: "/api/verify/batch" })`. This handles structured logging for cases where a fallback medicine lookup fails.
- **Line 261:** The call `console.error("Batch traceability error:", message)` was replaced with `logger.error({ message: "Batch traceability error", error: message, route: "/api/verify/batch" })`. This captures errors related to batch traceability logic within a `try-catch` block.
- **Line 345:** The call `console.error("Failed to insert batch report:", error)` was replaced with `logger.error({ message: "Failed to insert batch report", error, route: "/api/verify/batch/report" })`. This logs structured errors when submitting a batch report fails.
- **Line 356:** The call `console.error("Batch report error:", message)` was replaced with `logger.error({ message: "Batch report error", error: message, route: "/api/verify/batch/report" })`. This captures general errors within the batch report submission `try-catch` block.

In all replacements, we adopted a consistent pattern of passing a structured object to `logger.error()`. This object includes a `message` string for a concise description, an `error` property containing the actual error object (or its message if it's an unknown type), and a `route` property to explicitly identify the API endpoint where the error originated. This approach leverages Winston's ability to log rich, queryable JSON objects.

## Technical Decisions

Our primary technical decision was to standardize error logging across the SahiDawa backend by fully adopting the existing Winston logger configured in `apps/api/src/utils/logger.ts`. We chose this approach because:

1.  **Consistency**: Other critical API routes (e.g., `alerts.ts`, `medicines.ts`, `analytics.ts`) already utilize this structured logger. Extending its use to `verify.ts` and `batch.ts` ensures a uniform logging pattern across the entire API.
2.  **Observability**: The Winston logger is configured to provide essential features for production environments, including JSON formatting, automatic timestamps, log level filtering, and daily file rotation. These features are critical for effective monitoring, debugging, and operational insights in our Dockerized deployment. `console.error()` lacks all these capabilities.
3.  **Structured Data**: By passing a structured object `{ message: "...", error: ..., route: "..." }` to `logger.error()`, we enable powerful log aggregation and analysis. The `route` property, in particular, was added to provide immediate context, allowing for quick filtering and identification of error sources within our API endpoints. This is significantly more valuable than plain string output from `console.error()`.
4.  **Centralized Error Handling**: Using `logger.error()` ensures that all critical errors are routed through our centralized logging infrastructure, which can be integrated with external monitoring and alerting systems, providing a single source of truth for application health.

No viable alternatives were considered for this fix, as the project already has a well-established and robust logging solution that simply needed to be consistently applied.

## How To Re-Implement (Contributor Reference)

To implement structured error logging in a new or existing SahiDawa API route file, follow these steps:

1.  **Import the Logger**: At the top of your TypeScript file (e.g., `apps/api/src/routes/your-new-route.ts`), add the import statement for our shared logger utility:

    ```typescript
    import logger from "../utils/logger";
    ```

    Ensure the relative path to `../utils/logger.ts` is correct for your file's location.

2.  **Identify Error Logging Points**: Scan your code for any `console.error()` calls or any points where an error might occur and needs to be logged (e.g., within `catch` blocks, after database operations that return an error, or when validating input).

3.  **Replace with `logger.error()`**: For each identified error logging point, replace the `console.error()` call with `logger.error()`, passing a structured object. The object should contain:
    - `message`: A concise string describing the error event (e.g., "User creation failed", "Data validation error").
    - `error`: The actual error object (e.g., `err`, `dbError`, `validationError`). If the error is an unknown type or a simple string, ensure it's wrapped or clearly identified. For example, if `err` is `unknown`, you might use `error: err instanceof Error ? err : new Error(String(err))`.
    - `route`: The specific API endpoint or a clear identifier for the code path where the error occurred (e.g., `"/api/users/create"`, `"/api/data/process"`). This is crucial for filtering and context in log aggregation tools.

    **Example Pattern:**

    ```typescript
    try {
        // ... some operation that might fail
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
        logger.error({
            message: "Failed to perform critical operation",
            error: err, // Pass the original error object for stack traces
            route: "/api/your-endpoint",
        });
        // Respond to the client with an appropriate error status
        res.status(500).json({ error: "Internal server error" });
    }
    ```

    For database errors (e.g., from Supabase client), where the error object is directly returned:

    ```typescript
    const { data, error } = await supabase.from("table").insert(...);
    if (error) {
        logger.error({
            message: "Database insertion failed",
            error: error, // The Supabase PostgrestError object
            route: "/api/your-endpoint"
        });
        res.status(500).json({ error: "Failed to insert data" });
        return;
    }
    ```

4.  **Verify Locally**: Run your application in a development environment. Trigger the error conditions you've modified. Observe the console output; you should see structured, colorized log entries (if your development logger is configured as such) for the errors.

5.  **Test in Staging/Production**: Deploy to a staging environment and verify that the errors are correctly captured by your log aggregation system (e.g., appearing in ELK, Grafana Loki, or cloud logging services) with the expected JSON structure, timestamps, and metadata.

## Impact on System Architecture

This change has a significant positive impact on the SahiDawa system architecture, particularly in terms of observability, reliability, and maintainability.

1.  **Enhanced Observability**: By routing all critical errors through our structured Winston logger, we now have a complete and consistent stream of error data. This enables easier integration with external log aggregation and monitoring tools, allowing us to build more comprehensive dashboards, set up precise alerts, and gain real-time insights into application health.
2.  **Improved Debugging and Troubleshooting**: Structured logs with consistent metadata (timestamps, log levels, `message`, `error` object, and `route`) make it dramatically faster to search, filter, and analyze error patterns. This reduces the time required to identify root causes of issues in production, leading to quicker resolutions.
3.  **Increased System Reliability**: A clearer picture of error frequency and types allows us to proactively identify and address recurring problems, potential bottlenecks, or vulnerabilities, thereby enhancing the overall stability and robustness of the SahiDawa platform.
4.  **Standardization and Best Practices**: This PR reinforces a critical engineering best practice for logging, setting a clear pattern for all future backend development. It ensures that all new API routes and services will adhere to the same high standards for error reporting.
5.  **Foundation for Future Features**: Centralized, structured logging is a foundational component for advanced features like automated error reporting, performance monitoring, and audit trails, which can be built upon this improved logging infrastructure.

## Testing & Verification

Verification of this change involved several steps to ensure that error logging was correctly transitioned from `console.error()` to `logger.error()` and that the new structured logs were being generated as expected.

1.  **Local Development Testing**:
    - We manually triggered error conditions for both `/api/verify` and `/api/verify/batch` endpoints. For example, by attempting to verify a non-existent medicine or batch number, or by simulating a database connection error.
    - We observed the local console output to confirm that `console.error()` messages were no longer appearing, and instead, structured log entries from `logger.error()` were visible. These entries were expected to show the configured development-friendly format (e.g., colorized output) with the `message`, `error` details, and `route` information.

2.  **API Endpoint Specific Testing**:
    - **`/api/verify`**: We tested scenarios like a failed medicine lookup (triggering line 173), a failure to record scan history (line 242), and an unexpected runtime error within the route handler (line 264).
    - **`/api/verify/batch`**: We tested scenarios such as a failed batch lookup (line 118), a failed medicine fallback lookup (line 135), and general batch traceability errors (line 261).
    - **`/api/verify/batch/report`**: We tested failures during batch report insertion (line 345) and general batch report errors (line 356).

3.  **Log File Inspection (Staging/Production Environment)**:
    - In a staging environment, after deploying the changes, we would trigger the same error conditions.
    - We would then inspect the generated log files (specifically `error-%DATE%.log` and `combined-%DATE%.log` as configured by Winston) to verify that the error entries were present, in JSON format, included timestamps, and contained the `message`, `error`, and `route` properties as intended. The `error` property was checked to ensure it correctly captured the underlying error object or message.

4.  **Integration with Monitoring Tools**:
    - If integrated with a log aggregation system (e.g., an ELK stack or cloud logging service), we would confirm that the new structured error logs were correctly ingested and parsed. This would allow us to perform queries and filters based on the `message`, `error`, and `route` fields, validating the enhanced observability.

**Edge Cases Considered:**

- **Database Errors**: The PR specifically handles `PostgrestError` objects returned by Supabase client calls. We ensured these objects are correctly passed to `logger.error()` so that Winston's `winston.format.errors()` can extract stack traces and other relevant details.
- **Unknown Error Types**: For `catch (err: unknown)` blocks, the code correctly extracts the `message` if `err` is an `Error` instance, or defaults to "Unknown error" if not. The `error` property in the structured log object still receives the original `err` value, allowing for full context.
- **Rate Limiting**: While the rate limiters (`batchLimiter`, `verifyLimiter`) are middleware and not directly modified, any errors _within_ the route handlers after the rate limiters are now correctly logged. Errors originating from the rate limiter middleware itself would be handled by a higher-level error middleware, if configured.
