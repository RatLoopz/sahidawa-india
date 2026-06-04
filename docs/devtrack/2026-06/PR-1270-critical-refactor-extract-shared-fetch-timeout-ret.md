# PR #1270 — [Critical] refactor: extract shared fetch-timeout-retry logic from duplicated Supabase client files

> **Merged:** 2026-06-04 | **Author:** @AnushKamble | **Area:** Backend | **Impact Score:** 18 | **Closes:** #1267

## What Changed

This pull request refactors our backend's Supabase client implementations by extracting duplicated fetch-timeout-and-retry logic into a new shared utility file, `apps/api/src/db/fetchUtils.ts`. We removed redundant constant definitions and function implementations from `apps/api/src/db/client.ts` and `apps/api/src/db/supabase.ts`, which now import and utilize the centralized `fetchWithRetry` function. This change results in a net reduction of 63 lines of code and enhances maintainability.

## The Problem Being Solved

Before this PR, our system suffered from significant code duplication in how it handled HTTP requests to Supabase. Specifically, the files `apps/api/src/db/client.ts` (responsible for our service-role client with connection pooling) and `apps/api/src/db/supabase.ts` (handling our anon-key client with a singleton pattern) both independently defined nearly identical logic for connection timeouts and request retries. This included duplicated constants like `CONNECTION_TIMEOUT_MS`, `MAX_RETRIES`, and `RETRY_DELAY_MS`, as well as the `fetchWithTimeout()` and `fetchWithRetry()` functions.

This duplication, which spanned over 60 lines in each file, arose because the files were created independently to serve distinct purposes, yet both required resilient HTTP request handling. The primary issues caused by this were:
1.  **Divergence Risk:** The duplicated code had already begun to diverge, with `client.ts` including debug `console.error()` calls in its fetch wrappers that `supabase.ts` lacked, and slightly different error messages ("Database request timed out" vs "Supabase request timed out").
2.  **Maintenance Burden:** Any future updates or bug fixes to the timeout or retry strategy would require changes in two separate locations, increasing the risk of inconsistencies if one file was updated and the other forgotten.
3.  **Increased Technical Debt:** The redundant code made the codebase less DRY (Don't Repeat Yourself) and harder to reason about.

This refactoring directly addresses and closes issue #1267 by centralizing this critical logic.

## Files Modified

-   `apps/api/src/db/client.ts`
-   `apps/api/src/db/fetchUtils.ts`
-   `apps/api/src/db/supabase.ts`

## Implementation Details

The core of this change involves creating a new utility file and refactoring existing client files to consume it.

1.  **New File: `apps/api/src/db/fetchUtils.ts`**
    *   This file now serves as the single source of truth for Supabase fetch resilience logic.
    *   It exports three constants:
        *   `CONNECTION_TIMEOUT_MS`: Set to `2_000` milliseconds (2 seconds), defining the maximum time to wait for a single fetch request to complete.
        *   `MAX_RETRIES`: Set to `3`, specifying the maximum number of times a failed fetch request will be retried.
        *   `RETRY_DELAY_MS`: Set to `500` milliseconds, serving as the base delay before the first retry.
    *   It exports `fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response>`:
        *   This asynchronous function wraps the native `fetch` API.
        *   It utilizes an `AbortController` to implement a request timeout. A `setTimeout` call is scheduled to invoke `controller.abort()` after `CONNECTION_TIMEOUT_MS`.
        *   If the `fetch` request throws an `AbortError` (indicating a timeout), it re-throws a custom `Error` with the message `Supabase request timed out after ${CONNECTION_TIMEOUT_MS}ms`.
        *   A `finally` block ensures `clearTimeout(timeout)` is called to prevent resource leaks.
    *   It exports `fetchWithRetry(input: RequestInfo | URL, init?: RequestInit, retries = MAX_RETRIES): Promise<Response>`:
        *   This function implements a retry mechanism for fetch requests.
        *   It iterates up to `MAX_RETRIES` (or the `retries` parameter if provided).
        *   In each `attempt`, it calls `fetchWithTimeout(input, init)`. If successful, the response is returned immediately.
        *   If `fetchWithTimeout` throws an error:
            *   It checks if the current `attempt` is the `isLast` retry.
            *   If it's the last attempt, `logger.error` is used to log the failure: `Supabase fetch failed after ${retries} attempts: ${msg}`, and the error is re-thrown.
            *   If it's not the last attempt, `logger.warn` is used to log the retry: `Supabase fetch attempt ${attempt}/${retries} failed: ${msg}. Retrying in ${RETRY_DELAY_MS * attempt}ms...`.
            *   A `new Promise` combined with `setTimeout` introduces a linear backoff delay of `RETRY_DELAY_MS * attempt` milliseconds before the next retry.
        *   The `logger` utility is imported from `../utils/logger` for structured logging.

2.  **Refactoring `apps/api/src/db/client.ts`**
    *   The previously defined local constants `CONNECTION_TIMEOUT_MS`, `MAX_RETRIES`, `RETRY_DELAY_MS` were removed.
    *   The local implementations of `fetchWithTimeout()` and `fetchWithRetry()` were removed.
    *   A new import statement was added: `import { CONNECTION_TIMEOUT_MS, MAX_RETRIES, RETRY_DELAY_MS, fetchWithRetry } from "./fetchUtils";`.
    *   The `pooledFetch()` function, which is unique to this service-role client for managing concurrency via the `ConnectionPool` semaphore, was updated to call the newly imported `fetchWithRetry()` instead of its previously local version.
    *   The `ConnectionPool` class and `gracefulShutdown()` function, which are specific to this client's connection pooling and lifecycle management, remain untouched.
    *   The `console.error()` calls that were present in the old `fetchWithTimeout` and `fetchWithRetry` implementations within `client.ts` were removed, as the centralized `fetchWithRetry` now uses `logger.error()` for more robust error reporting.

3.  **Refactoring `apps/api/src/db/supabase.ts`**
    *   The previously defined local constants `CONNECTION_TIMEOUT_MS`, `MAX_RETRIES`, `RETRY_DELAY_MS` were removed.
    *   The local implementations of `fetchWithTimeout()` and `fetchWithRetry()` were removed.
    *   A new import statement was added: `import { CONNECTION_TIMEOUT_MS, MAX_RETRIES, RETRY_DELAY_MS, fetchWithRetry } from "./fetchUtils";`.
    *   The `getSupabaseClient()` function, which implements a singleton pattern for the anon-key Supabase client, was updated. Its `global.fetch` override now utilizes the imported `fetchWithRetry()` function to ensure all Supabase SDK requests made through this client benefit from the centralized timeout and retry logic.
    *   The singleton pattern logic itself remains unchanged.

This refactoring ensures that both Supabase clients now share the exact same, consistent, and well-tested fetch resilience logic, while retaining their unique functionalities.

## Technical Decisions

1.  **Extraction to `fetchUtils.ts`:** We chose to extract the common logic into a dedicated `fetchUtils.ts` file to adhere to the DRY (Don't Repeat Yourself) principle. This centralizes the logic, making it easier to maintain, update, and reason about. It also prevents future inconsistencies that could arise from independent modifications to duplicated code.
2.  **`AbortController` for Timeout:** The `AbortController` API is the standard and most robust way to implement request timeouts in modern JavaScript environments. It allows for clean cancellation of `fetch` requests, ensuring that resources are not tied up indefinitely by unresponsive network calls.
3.  **Retry Mechanism:** Implementing a retry mechanism is crucial for resilience in distributed systems. It helps our application gracefully handle transient network issues, temporary Supabase service unavailability, or intermittent API errors, improving the overall stability and user experience.
4.  **Linear Backoff Strategy:** The `fetchWithRetry` function employs a linear backoff strategy (`RETRY_DELAY_MS * attempt`). While exponential backoff is often preferred, linear backoff provides a simpler, predictable increase in delay between retries, which is sufficient for the current needs of handling transient Supabase connection issues. This approach balances responsiveness with not overwhelming the Supabase service during recovery.
5.  **Structured Logging with `logger`:** Instead of simple `console.error()` calls, we utilize our `logger` utility (`../utils/logger`) for all warnings and errors within the retry logic. This ensures consistent, structured logging across our API, making it easier to monitor, debug, and analyze issues in production environments. The removal of `console.error()` from the refactored files eliminates redundant and less effective logging.
6.  **Internal Module Scope:** The `fetchUtils.ts` file is placed within the `apps/api/src/db/` directory and is not exported for external use. This decision was made because the utility is specifically tailored for Supabase client interactions within our database module, not as a general-purpose HTTP utility for the entire API. This maintains clear module boundaries and prevents unintended external dependencies.

## How To Re-Implement (Contributor Reference)

Should a contributor need to re-implement or understand the exact flow of this feature, they would follow these steps:

1.  **Identify Duplication:** Recognize that common HTTP request handling logic (timeout, retry, error logging) is being duplicated across multiple Supabase client instances (e.g., service-role and anon-key clients).
2.  **Create Shared Utility File:** Create a new file, `apps/api/src/db/fetchUtils.ts`, to house the shared logic.
3.  **Define Constants:** Within `fetchUtils.ts`, define and export the key configuration constants:
    ```typescript
    export const CONNECTION_TIMEOUT_MS = 2_000; // Example value
    export const MAX_RETRIES = 3;             // Example value
    export const RETRY_DELAY_MS = 500;        // Example value
    ```
4.  **Implement `fetchWithTimeout`:** Create an asynchronous function `fetchWithTimeout` that takes `RequestInfo | URL` and `RequestInit` as arguments.
    *   Initialize an `AbortController`.
    *   Set a `setTimeout` to call `controller.abort()` after `CONNECTION_TIMEOUT_MS`.
    *   Wrap the `fetch` call in a `try...catch...finally` block, passing `controller.signal` in `RequestInit`.
    *   In the `catch` block, specifically check for `AbortError` (`(err as Error).name === "AbortError"`) and throw a descriptive timeout error.
    *   In the `finally` block, clear the `setTimeout` to prevent memory leaks.
    *   Export this function.
5.  **Implement `fetchWithRetry`:** Create an asynchronous function `fetchWithRetry` that takes `RequestInfo | URL`, `RequestInit`, and an optional `retries` count (defaulting to `MAX_RETRIES`).
    *   Implement a `for` loop to iterate through the retry attempts.
    *   Inside the loop, call the `fetchWithTimeout` function. If successful, return the response.
    *   If `fetchWithTimeout` throws an error, log it using the `logger` utility (imported from `../utils/logger`).
    *   Check if it's the last attempt. If so, log an `error` and re-throw the exception.
    *   If not the last attempt, log a `warn` message indicating a retry and the delay.
    *   Implement a linear backoff delay using `await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));`.
    *   Export this function.
6.  **Refactor Client Files:**
    *   In `apps/api/src/db/client.ts` and `apps/api/src/db/supabase.ts`:
        *   Remove the local definitions of `CONNECTION_TIMEOUT_MS`, `MAX_RETRIES`, `RETRY_DELAY_MS`, `fetchWithTimeout`, and `fetchWithRetry`.
        *   Add an import statement at the top: `import { CONNECTION_TIMEOUT_MS, MAX_RETRIES, RETRY_DELAY_MS, fetchWithRetry } from "./fetchUtils";`.
        *   Update any existing functions that previously called the local `fetchWithRetry` (e.g., `pooledFetch` in `client.ts` or the `global.fetch` override in `supabase.ts`) to now call the imported `fetchWithRetry`.
    *   Ensure that unique logic to each client (like `ConnectionPool` and `gracefulShutdown` in `client.ts`, or the singleton `getSupabaseClient` in `supabase.ts`) remains intact and functional.

This process centralizes the logic, ensuring consistency and ease of maintenance for all Supabase interactions within our API.

## Impact on System Architecture

This change significantly improves the modularity and maintainability of our `apps/api/src/db` module.

*   **Enhanced Modularity:** By extracting shared concerns into `fetchUtils.ts`, we've created a cleaner separation of responsibilities. The Supabase client files (`client.ts` and `supabase.ts`) can now focus solely on their unique functionalities (connection pooling, graceful shutdown, singleton pattern) without being burdened by duplicated network resilience logic.
*   **Reduced Technical Debt:** The removal of over 120 lines of duplicated code directly reduces technical debt, making the codebase easier to understand, audit, and extend.
*   **Consistent Resilience:** All Supabase HTTP requests, regardless of whether they originate from the service-role client or the anon-key client, now benefit from the exact same, consistent timeout and retry strategy. This eliminates potential behavioral discrepancies and ensures a uniform level of resilience against network fluctuations or Supabase service interruptions.
*   **Simplified Maintenance and Evolution:** Any future modifications or enhancements to our fetch timeout or retry logic (e.g., changing constants, implementing a different backoff strategy, or adding circuit breaker patterns) can now be done in a single location (`fetchUtils.ts`), drastically reducing the effort and risk of introducing regressions.
*   **No Functional Change to External API:** Crucially, this refactoring is purely structural. It does not alter the external behavior or API contracts of the SahiDawa platform. The system continues to interact with Supabase and respond to client requests identically, but with a more robust and maintainable internal implementation.

This refactoring lays a stronger foundation for future development by making our core database interaction layer more robust and easier to evolve.

## Testing & Verification

This change is purely a structural refactor and does not introduce new functionality or alter existing behavior. The primary verification method for this PR was ensuring that the refactored Supabase clients continued to operate identically to their pre-refactor state.

*   **Existing Integration Tests:** We rely on our existing suite of integration tests that interact with the Supabase service-role and anon-key clients. These tests implicitly verify that the `fetchWithRetry` logic, now centralized in `fetchUtils.ts`, correctly handles Supabase requests, including successful responses and error conditions that might trigger retries or timeouts.
*   **Manual Verification:** Not documented in this PR.
*   **Functional Equivalence:** The PR description explicitly states, "Both client files continue to work identically — the change is purely structural." This implies that the core functionality of connecting to Supabase, executing queries, and handling responses remains unchanged.
*   **Edge Cases Addressed by Logic:** The `fetchWithTimeout` and `fetchWithRetry` functions inherently address several edge cases:
    *   **Network Latency/Slow Responses:** Handled by `CONNECTION_TIMEOUT_MS` and the `AbortController`.
    *   **Transient Network Failures:** Handled by `MAX_RETRIES` and the linear backoff `RETRY_DELAY_MS * attempt`.
    *   **Supabase Service Unavailability:** Also handled by the retry mechanism, allowing the system to recover once the service becomes available again.
    *   **Immediate Connection Refusal:** Would trigger the retry logic.

No new dedicated unit tests for `fetchUtils.ts` were added as part of this PR, as its functionality is covered by the integration tests of the consuming Supabase clients.