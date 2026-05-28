# PR #750 — Feat/structured ai logging

> **Merged:** 2026-05-27 | **Author:** @Subhra-Nandi | **Area:** Frontend | **Impact Score:** 14 | **Closes:** #551

## What Changed

This pull request introduces a standardized, shared utility for structured server-side logging within our Next.js frontend's API routes. We extracted a common `structuredLog` function and its associated `LogEntry` interface into `apps/web/lib/structuredLogger.ts`. This utility now automatically injects a UTC ISO timestamp into every log entry and routes the output to `console.error`, `console.warn`, or `console.info` based on the specified `log_level`. The `apps/web/app/api/chat/route.ts` and `apps/web/app/api/voice/transcribe/route.ts` files were refactored to use this new shared utility, removing duplicate code and ensuring consistent, enriched logging for AI-related operations.

## The Problem Being Solved

Prior to this PR, our AI-related API routes (`/api/chat` and `/api/voice/transcribe`) contained duplicated implementations of a structured logging helper and its `LogEntry` interface. This led to code redundancy, made maintenance difficult, and introduced inconsistencies in log formatting and content. Specifically, timestamps had to be manually added at each log call site, increasing the chance of errors or omissions. The lack of a centralized logging mechanism also made it harder to consistently capture critical metadata like request latency, AI token counts, and detailed error information, hindering our ability to monitor and debug AI service performance and failures effectively. This directly addresses the concerns outlined in issue #551.

## Files Modified

- `apps/web/app/api/chat/route.ts`
- `apps/web/app/api/voice/transcribe/route.ts`
- `apps/web/lib/structuredLogger.ts`

## Implementation Details

The core of this change is the creation of `apps/web/lib/structuredLogger.ts`. This new module exports two key components:

1.  **`LogEntry` Interface:** This TypeScript interface defines the structure for all structured log entries. It includes:
    *   `timestamp: string`: An ISO 8601 formatted timestamp (automatically injected by the `structuredLog` function).
    *   `log_level: "error" | "warn" | "info"`: The severity level of the log.
    *   `route: string`: The API route where the log originated (e.g., `/api/chat`).
    *   `latency_ms?: number`: Optional, the duration of the operation in milliseconds, calculated from `startTime`.
    *   `metrics?: { input_tokens?: number; output_tokens?: number; }`: Optional, for capturing performance metrics specific to AI operations, such as token usage.
    *   `error?: { message: string; code?: number; stack?: string }`: Optional, for detailed error information, including a human-readable message, an HTTP status code, and the error stack trace.
    *   `meta?: Record<string, any>`: Optional, for any additional context-specific metadata relevant to the log entry.

2.  **`structuredLog(entry: Omit<LogEntry, 'timestamp'>)` Function:** This function serves as the central logging utility. It accepts an `entry` object that conforms to the `LogEntry` interface but omits the `timestamp` field. Internally, it automatically adds `timestamp: new Date().toISOString()` to ensure all logs have a consistent, server-generated UTC timestamp. It then uses a `switch` statement on `entry.log_level` to direct the output to the appropriate `console` method (`console.error` for "error", `console.warn` for "warn", or `console.info` for "info"). The entire `LogEntry` object, now including the timestamp, is then `JSON.stringify()`'d and logged, ensuring a machine-readable, structured output.

The existing API routes, `apps/web/app/api/chat/route.ts` and `apps/web/app/api/voice/transcribe/route.ts`, were updated to leverage this new utility:
*   Both files now import `structuredLog` from `@/lib/structuredLogger`.
*   The previously duplicated `LogEntry` interface and `structuredLog` function definitions were removed from these route files.
*   All existing and new log calls were refactored to use the imported `structuredLog` function. This involved removing manual `timestamp` injections, as the utility now handles this automatically.
*   Each route now defines a `ROUTE` constant (e.g., `const ROUTE = "/api/chat";`) at the top of its `POST` handler to ensure consistent `route` field population in logs.
*   `startTime = Date.now()` is now captured at the very beginning of each `POST` handler, and `latency_ms = Date.now() - startTime` is calculated before each `structuredLog` call for both successful responses and error handling. This provides crucial performance insights for every request.
*   Error handling in both routes was enhanced to provide more specific `error.message` values based on HTTP status codes (e.g., 503 for service unavailable, 429 for rate limits) and to include `error.stack` where applicable, improving diagnostic capabilities.
*   Specific `meta` fields were added to log calls to provide context relevant to each route, such as `mode`, `responseLanguage`, `messageCount` for `/api/chat`, and `language`, `fileSizeBytes`, `fileType`, `transcriptLength` for `/api/voice/transcribe`.
*   A minor syntax error in `apps/web/app/api/voice/transcribe/route.ts` within the `!upstreamResponse.ok` error block was also fixed as part of this refactor, improving the robustness of error reporting for transcription failures.

## Technical Decisions

We chose to implement a custom structured logging utility rather than integrating a full-fledged logging library for several reasons:

1.  **Lightweight and Focused:** For server-side Next.js API routes, a full logging framework might introduce unnecessary overhead and increase bundle size. Our specific needs were for structured JSON output with automatic timestamps and level-based console routing. A custom utility provides exactly this functionality without introducing external dependencies or bloat.
2.  **Control and Customization:** This approach gives us complete control over the log entry schema (`LogEntry` interface), allowing us to tailor it precisely to SahiDawa's operational and debugging requirements. This includes specific fields for AI metrics (like `input_tokens`, `output_tokens`), request latency, and detailed error information, which are critical for our platform.
3.  **Consistency:** By centralizing the `structuredLog` function, we enforce a consistent logging format across all API routes that use it. This consistency is crucial for easier parsing by log aggregation systems and for human readability during debugging sessions.
4.  **Improved Developer Experience:** Automatically injecting the timestamp reduces boilerplate code for developers and eliminates a common source of error. The clear `LogEntry` interface guides developers on what information to include, promoting best practices.
5.  **Addressing Review Comments:** This implementation directly addresses maintainer feedback regarding code duplication and the need for automatic timestamp injection, demonstrating our commitment to code quality and maintainability.
6.  **Future Extensibility:** While currently using `console.log`, this structured approach makes it trivial to later integrate with external log aggregation services (e.g., ELK stack, Datadog, Grafana Loki) by simply modifying the `structuredLog` function's internal implementation to send logs to an API endpoint or a different stream, without requiring any changes at the numerous call sites throughout our application.

## How To Re-Implement (Contributor Reference)

To implement a similar structured logging pattern for a new or existing API route, follow these steps:

1.  **Ensure `structuredLogger.ts` exists:**
    Verify that `apps/web/lib/structuredLogger.ts` exists and contains the `LogEntry` interface and `structuredLog` function as defined in this PR. If not, create it with the following structure:

    ```typescript
    // apps/web/lib/structuredLogger.ts
    export interface LogEntry {
        timestamp: string;
        log_level: "error" | "warn" | "info";
        route: string;
        latency_ms?: number;
        metrics?: {
            input_tokens?: number;
            output_tokens?: number;
            // Add other relevant metrics as needed
        };
        error?: {
            message: string;
            code?: number;
            stack?: string;
        };
        meta?: Record<string, any>;
    }

    export function structuredLog(entry: Omit<LogEntry, 'timestamp'>) {
        const fullEntry: LogEntry = {
            ...entry,
            timestamp: new Date().toISOString(),
        };
        const logMessage = JSON.stringify(fullEntry);

        switch (entry.log_level) {
            case "error":
                console.error(logMessage);
                break;
            case "warn":
                console.warn(logMessage);
                break;
            case "info":
                console.info(logMessage);
                break;
            default:
                console.log(logMessage); // Fallback for undefined log_level
        }
    }
    ```

2.  **Integrate into your API Route file (e.g., `apps/web/app/api/your-new-feature/route.ts`):**

    *   **Import the logger:**
        At the top of your route file, add the import statement:
        ```typescript
        import { structuredLog } from "@/lib/structuredLogger";
        ```

    *   **Define the route constant:**
        Inside your `POST` (or `GET`, `PUT`, etc.) handler function, define a constant for the current route path. This ensures consistency in your logs.
        ```typescript
        export async function POST(req: Request) {
            const ROUTE = "/api/your-new-feature";
            // ... rest of your handler
        }
        ```

    *   **Capture request start time:**
        Immediately after defining the `ROUTE` constant, capture the start time to calculate latency:
        ```typescript
        export async function POST(req: Request) {
            const ROUTE = "/api/your-new-feature";
            const startTime = Date.now();
            // ... rest of your handler
        }
        ```

    *   **Log successful operations:**
        When an operation completes successfully, calculate the `latency_ms` and call `structuredLog` with `log_level: "info"`. Include relevant `metrics` (e.g., AI token counts) and `meta` data specific to the operation.
        ```typescript
        // Example: successful response
        const latency_ms = Date.now() - startTime;
        structuredLog({
            log_level: "info",
            route: ROUTE,
            latency_ms,
            meta: {
                operation: "data_processed",
                recordId: "abc-123",
            },
        });
        return NextResponse.json({ success: true });
        ```

    *   **Log warnings:**
        For non-critical issues or expected conditions that don't halt the request but are noteworthy, use `log_level: "warn"`.
        ```typescript
        // Example: missing optional parameter
        if (!optionalParam) {
            structuredLog({
                log_level: "warn",
                route: ROUTE,
                meta: { reason: "optional_param_missing", paramName: "optionalParam" },
            });
        }
        ```

    *   **Log errors:**
        In `catch` blocks or when handling failed upstream responses, calculate `latency_ms`, determine an appropriate `statusCode`, and call `structuredLog` with `log_level: "error"`. Provide a detailed `error` object including `message`, `code` (typically the HTTP status code), and `stack` if available.
        ```typescript
        // Example: error handling in a try-catch block
        try {
            // ... perform some operation that might throw ...
        } catch (error: any) {
            const latency_ms = Date.now() - startTime;
            const statusCode: number = error?.status || 500;
            structuredLog({
                log_level: "error",
                route: ROUTE,
                latency_ms,
                error: {
                    message: statusCode === 400 ? "Invalid request data" : "Internal server error",
                    code: statusCode,
                    stack: error instanceof Error ? error.stack : undefined,
                },
                meta: { originalErrorType: error?.name },
            });
            return NextResponse.json({ error: "Operation failed" }, { status: statusCode });
        }
        ```

    *   **Gotchas:**
        *   Always ensure `startTime` is captured at the very beginning of the request handler to get accurate `latency_ms` for the entire request lifecycle.
        *   Remember to remove any manual `timestamp: new Date().toISOString()` fields from your log calls, as the `structuredLog` utility handles this automatically.
        *   Be mindful of sensitive data when adding information to the `meta` fields in logs. Avoid logging personally identifiable information (PII) or confidential system details directly.

## Impact on System Architecture

This change significantly improves the observability and maintainability of our AI-powered features within the SahiDawa platform.

1.  **Standardized Observability:** By enforcing a consistent structured logging format across critical API routes, we lay the groundwork for easier integration with external log aggregation and monitoring tools. This will allow us to quickly identify performance bottlenecks, track AI model usage (token counts), and diagnose errors across our AI services more efficiently.
2.  **Reduced Technical Debt:** Eliminating duplicate logging code reduces the overall codebase size and complexity, making it easier for new contributors to understand and extend our API routes without introducing inconsistent logging patterns.
3.  **Enhanced Debugging:** The rich, structured log entries, including request latency, specific error codes, and contextual metadata, provide a much clearer picture of what transpired during a request. This drastically speeds up debugging cycles for AI-related issues and general API failures.
4.  **Foundation for AI Monitoring:** The inclusion of `input_tokens` and `output_tokens` in the `metrics` field for AI generation logs provides a crucial foundation for future AI cost monitoring and performance analysis. This is vital for managing our operational expenses and optimizing model usage.
5.  **Improved Reliability:** More robust and detailed error logging helps us proactively identify and address issues with upstream AI services or our own integration logic, leading to a more stable and reliable platform for our users. This also enables quicker incident response by providing immediate context for alerts.

## Testing & Verification

Not documented in this PR. However, based on the nature of the changes, verification would typically involve:

1.  **Local Development Environment Testing:** Running the Next.js application locally and making various requests to the `/api/chat` and `/api/voice/transcribe` endpoints.
2.  **Console Output Inspection:** Meticulously inspecting the server console output to verify that:
    *   Structured JSON logs are consistently produced for all scenarios.
    *   `log_level` correctly reflects the severity (e.g., `info` for success, `warn` for non-critical issues, `error` for failures).
    *   The `timestamp` field is automatically present and correctly formatted as an ISO 8601 string in every log entry.
    *   `latency_ms`, `route`, `metrics`, `error` (including `message`, `code`, `stack`), and `meta` fields contain the expected and accurate values for each specific log event.
3.  **Scenario-Based Testing:**
    *   **Success Paths:** Verify logs for successful AI chat responses and voice transcription.
    *   **Warning Paths:** Verify logs for conditions like empty message text in chat requests or missing audio files in transcription requests.
    *   **Error Paths:** Intentionally trigger various error conditions, such as:
        *   Simulating upstream AI service unavailability (e.g., by temporarily blocking access to the AI provider).
        *   Simulating upstream AI rate limits.
        *   Simulating invalid responses or timeouts from the ML transcription service.
        *   Testing general unexpected errors within the API route logic.
    *   For each error, ensure the `error` object in the log contains a descriptive `message`, an appropriate `code` (HTTP status), and a `stack` trace if available.

Edge cases that exist and were specifically addressed by the enhanced logging in this PR include:
*   Empty message text provided to `/api/chat`.
*   Missing audio file in the request to `/api/voice/transcribe`.
*   Upstream Google AI service unavailability (HTTP 503) or rate limits (HTTP 429).
*   Invalid or malformed responses from the ML transcription service (HTTP 502).
*   Non-OK status codes from the ML transcription service, with detailed error messages.
*   Timeouts when communicating with the ML transcription service (HTTP 504).
*   General network or application-level errors preventing communication with external services (HTTP 503).