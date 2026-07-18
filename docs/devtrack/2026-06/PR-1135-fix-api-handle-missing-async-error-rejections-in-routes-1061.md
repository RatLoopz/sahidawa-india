# PR #1135 — fix(api): handle missing async error rejections in routes (#1061)

> **Merged:** 2026-06-02 | **Author:** @Adi-Marathe | **Area:** Backend | **Impact Score:** 36 | **Closes:** #1061

## What Changed

This PR significantly enhances the robustness of our backend API by implementing comprehensive error handling for asynchronous Supabase database operations across several critical Express routes. We have introduced `try-catch` blocks around Supabase queries and added explicit `res.status(500)` responses to ensure that unhandled promise rejections no longer crash the Node.js process, instead returning a graceful HTTP 500 error to the client.

## The Problem Being Solved

Prior to this change, several Express API routes that performed asynchronous operations with Supabase (e.g., database lookups, insertions, updates) lacked proper error handling for potential promise rejections. If an unexpected error occurred during these operations—such as a network timeout, a database connection issue, or an internal Supabase error—the unhandled promise rejection would propagate up the call stack, ultimately leading to an `UnhandledPromiseRejectionWarning` and terminating the entire Node.js server process. This caused critical server crashes, resulting in service unavailability and a poor user experience for SahiDawa users attempting to verify medicines, report counterfeits, or scan products.

## Files Modified

- `apps/api/src/routes/alerts.ts`
- `apps/api/src/routes/reports.ts`
- `apps/api/src/routes/scan.ts`
- `apps/api/src/routes/verify.ts`

## Implementation Details

We have systematically added error handling to asynchronous Supabase operations within the affected API routes:

1.  **`apps/api/src/routes/alerts.ts`**:
    - In the `alertsRouter.get("/")` route, the entire Supabase query `await query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);` is now wrapped within a `try-catch` block.
    - If the Supabase call itself throws an unexpected error (e.g., network issue), the `catch (err)` block logs the error using `console.error("Unexpected error in GET /api/alerts:", err);` and sends a generic `res.status(500).json({ error: "An unexpected error occurred" });` to the client.

2.  **`apps/api/src/routes/reports.ts`**:
    - **`reportsRouter.post("/")`**: The `await supabase.from("counterfeit_reports").insert(...).select().single();` operation is now enclosed in a `try-catch` block. The `catch (err)` logs `console.error("Unexpected error in POST /api/reports:", err);` and responds with `res.status(500).json({ error: "An unexpected error occurred" });`.
    - **`reportsRouter.get("/mine")`**: The `await supabase.from("counterfeit_reports").select(...).eq("reporter_id", userId).order(...);` query is similarly wrapped in a `try-catch` block. The `catch (err)` logs `console.error("Unexpected error in GET /api/reports/mine:", err);` and sends `res.status(500).json({ error: "An unexpected error occurred" });`.
    - **`reportsRouter.get("/")` (admin-only)**: The `await supabase.from("counterfeit_reports").select("*").order(...);` query is now within a `try-catch` block. The `catch (err)` logs `console.error("Unexpected error in GET /api/reports:", err);` and responds with `res.status(500).json({ error: "An unexpected error occurred" });`.
    - **`reportsRouter.patch("/:id/status")`**: The `await supabase.from("counterfeit_reports").update({ status }).eq("id", req.params.id).select().single();` operation is also wrapped in a `try-catch` block. The `catch (err)` logs `console.error("Unexpected error in PATCH /api/reports/:id/status:", err);` and sends `res.status(500).json({ error: "An unexpected error occurred" });`.
    - In all `reports.ts` routes, existing `if (error)` checks (for Supabase-returned errors) continue to send specific `res.status(500).json({ error: "Failed to..." });` messages. The new `try-catch` blocks handle errors _outside_ of the Supabase `error` object, such as network failures or other unexpected exceptions during the `await` call.

3.  **`apps/api/src/routes/scan.ts`**:
    - In the `router.post("/extract")` route, within the OCR processing logic, we identified several points where database lookups could fail without sending a response.
    - Specifically, inside the `if (dbError)` block for fetching medicines (`supabase.from("medicines").select(...)`), we added `res.status(500).json({ error: "Database error fetching medicines" });` followed by `return;` to ensure the request is terminated gracefully.
    - Similarly, inside the `catch (dbErr)` block for fetching brand/generic names, we added `res.status(500).json({ error: "Database error fetching medicines" });` and `return;`.
    - For the database lookup of matched names (`supabase.from("medicines").select(...).eq("brand_name", matchedName).maybeSingle()`), both the `if (lookupError)` and the `catch (lookupErr)` blocks now explicitly send `res.status(500).json({ error: "Database lookup error for matched medicine" });` and `return;`. This prevents the request from hanging indefinitely if a database lookup fails during OCR post-processing.

4.  **`apps/api/src/routes/verify.ts`**:
    - In the `router.post("/")` route, the core medicine lookup `await supabase.from("medicines").select(...).ilike("batch_number", escaped).limit(1).maybeSingle();` is now enveloped in a `try-catch` block.
    - The `catch (err)` block logs `console.error("Unexpected error in /api/verify:", err);` and sends `res.status(500).json({ verified: false, message: "An unexpected error occurred" });` to the client, ensuring a consistent response structure even for unexpected errors.

## Technical Decisions

The primary technical decision was to adopt a robust, localized `try-catch` pattern for all asynchronous Supabase operations within our Express route handlers.

- **`try-catch` for Async Operations**: We chose `try-catch` blocks as the standard and most explicit way to handle potential errors that might arise during `await` calls to external services like Supabase. This pattern directly addresses `UnhandledPromiseRejectionWarning` by catching rejected promises and allowing us to manage the error gracefully.
- **Explicit `res.status(500)` Responses**: For every caught error, we ensure an `res.status(500)` HTTP response is sent. This is the standard HTTP status code for internal server errors, clearly indicating to the client that a server-side issue occurred.
- **Generic Error Messages to Client**: The error messages sent to the client (e.g., "An unexpected error occurred", "Database lookup failed") are intentionally generic. This is a security best practice to avoid leaking sensitive internal server details, stack traces, or database schema information that could be exploited.
- **`console.error` for Server-Side Logging**: We use `console.error` to log the full error details on the server. This is crucial for debugging and monitoring, allowing our operations team to investigate the root cause of failures without exposing internal details to end-users.
- **Immediate `return` after `res.status()`**: After sending an error response, we explicitly add `return;` to prevent further execution of the route handler. This ensures that no subsequent code attempts to send another response or modify headers after the response has already been sent, which would lead to "Headers already sent" errors.

While a global error handling middleware could also catch some unhandled rejections, this PR focuses on explicit, localized handling at the point of potential failure, providing more granular control over the error response and logging specific to the operation being performed. This approach complements any potential future global error handling by ensuring that immediate database-related failures are caught and handled gracefully at the source.

## How To Re-Implement (Contributor Reference)

To implement robust error handling for asynchronous Supabase operations in an Express route, follow this pattern:

1.  **Identify Asynchronous Supabase Calls**: Locate any `await supabase.from(...).<operation>(...)` calls within your Express route handler (`async (req, res) => { ... }`).

2.  **Wrap in `try-catch`**: Enclose the entire Supabase operation (or a logical group of operations) within a `try-catch` block.

    ```typescript
    import { Request, Response } from "express";
    import { supabase } from "../lib/supabase"; // Assuming supabase client is imported

    // Example: A route that fetches data
    yourRouter.get("/your-resource", async (req: Request, res: Response) => {
        try {
            // Your Supabase query
            const { data, error } = await supabase.from("your_table").select("*").limit(10);

            // Handle Supabase-specific errors (e.g., invalid query, permission issues)
            if (error) {
                console.error("Supabase query failed:", error);
                res.status(500).json({ error: "Failed to fetch resource from database" });
                return;
            }

            // If successful, send the data
            res.json({ data });
        } catch (err) {
            // Handle unexpected errors (e.g., network issues, database connection loss,
            // or any other exception thrown during the await call)
            console.error("Unexpected error in GET /api/your-resource:", err);
            res.status(500).json({ error: "An unexpected server error occurred" });
            return; // Crucial to prevent further execution
        }
    });
    ```

3.  **Handle Supabase `error` Object**: Inside the `try` block, immediately after the `await` call, check the `error` property returned by Supabase. If `error` is present, log it and send a specific `res.status(500)` response.

4.  **Handle Unexpected `catch` Errors**: In the `catch (err)` block, log the `err` object using `console.error` for internal debugging. Send a generic `res.status(500)` response to the client to avoid exposing internal details.

5.  **Ensure `return`**: Always include `return;` after sending `res.status(...)` to prevent "Headers already sent" errors and ensure the request cycle terminates cleanly.

This pattern ensures that both Supabase-reported errors and broader system-level errors during asynchronous database interactions are handled gracefully, preventing server crashes and providing clear feedback to the client.

## Impact on System Architecture

This change has a profound positive impact on the overall stability and reliability of the SahiDawa backend system.

- **Enhanced Stability**: By preventing server crashes due to unhandled promise rejections, the SahiDawa API becomes significantly more stable and resilient to external failures (e.g., Supabase outages, network issues). This directly translates to higher uptime and availability for our rural health platform.
- **Improved User Experience**: Users will no longer experience hanging requests or complete service unavailability when a backend database operation fails. Instead, they will receive a consistent HTTP 500 error, allowing client applications to handle the failure gracefully (e.g., display an error message, retry the operation).
- **Reduced Operational Burden**: Our engineering team will experience fewer urgent alerts related to server crashes, allowing us to focus more on feature development and less on incident response. The detailed `console.error` logs will also aid in quicker diagnosis of underlying issues.
- **Standardized Error Handling**: This PR establishes a clear and consistent pattern for handling asynchronous errors in Express routes, setting a precedent for future development and making the codebase more predictable and maintainable.
- **Foundation for Future Resilience**: This foundational improvement in error handling paves the way for more advanced resilience patterns, such as circuit breakers or retry mechanisms, as the system grows.

This is a critical step towards building a robust and enterprise-grade backend for SahiDawa, ensuring that our platform can reliably serve the vital needs of Indian medicine verification and rural health.

## Testing & Verification

The changes introduced in this PR were thoroughly tested and verified locally by the author.

1.  **Local Test Execution**: The command `npm run test` was executed in the `apps/api` directory.
2.  **Test Suite Coverage**: All existing test suites passed successfully, including:
    - `tests/gracefulShutdown.test.ts`
    - `tests/alertsPagination.test.ts`
    - `tests/ml.test.ts`
    - `tests/verify.test.ts`
    - `tests/lasa.service.test.ts`
3.  **Simulated Database Errors**: The primary verification involved simulating database errors to confirm that the server gracefully handles these failures. This was achieved by intentionally causing Supabase operations to fail (e.g., by temporarily misconfiguring database credentials or network access).
4.  **Observed Behavior**: Instead of crashing with an `UnhandledPromiseRejectionWarning`, the server now correctly returns a standard HTTP 500 JSON response to the client when a database error occurs. This confirms that the `try-catch` blocks and explicit `res.status(500)` calls are functioning as intended.
5.  **Edge Cases**: The added `try-catch` blocks specifically address the edge case of unexpected exceptions during `await` calls, which are not caught by Supabase's own `error` object. The `scan.ts` changes also ensure that requests do not hang indefinitely if internal database lookups fail during OCR processing.
