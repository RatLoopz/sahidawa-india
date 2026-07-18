# PR #908 — fix(api): require SUPABASE_SERVICE_ROLE_KEY — remove silent anon/hardcoded fallbacks

> **Merged:** 2026-05-30 | **Author:** @shreyasfegade | **Area:** Backend | **Impact Score:** 6 | **Closes:** #893

## What Changed

We have updated the `apps/api/src/db/client.ts` file to remove the silent environment variable fallback chain for `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Instead, our system now employs explicit startup guards that throw an error if these critical environment variables are not defined. This change ensures that the SahiDawa API backend will not start without the necessary Supabase credentials, particularly the `SUPABASE_SERVICE_ROLE_KEY` required for server-side writes.

## The Problem Being Solved

Previously, our backend API's Supabase client initialization in `apps/api/src/db/client.ts` utilized a lenient environment variable resolution strategy. This strategy allowed `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to silently fall back to less privileged `SUPABASE_ANON_KEY` values or even hardcoded local development defaults (`http://localhost:54321`, `local-development-key`) if the intended variables were not explicitly set. This behavior led to a critical bug (Issue #893) where server-side write operations, which require bypassing Supabase's Row Level Security (RLS), would silently fail or be dropped when the client was inadvertently initialized with the `SUPABASE_ANON_KEY`. This lack of explicit validation meant developers could unknowingly run or deploy the API in a state where database writes would not function, causing silent data integrity issues and operational failures.

## Files Modified

- `apps/api/src/db/client.ts`

## Implementation Details

The core changes are confined to the `// ── Environment resolution ────────────────────────────────────────────────────` block within `apps/api/src/db/client.ts`.

1.  **Removal of Fallback Logic:** We removed the previous assignments for `supabaseUrl` and `supabaseKey`. These assignments previously used a series of `||` (OR) operators to check multiple `process.env` variables (e.g., `process.env.SUPABASE_URL`, `process.env.NEXT_PUBLIC_SUPABASE_URL`) and hardcoded default strings. Crucially, `supabaseKey` also included `process.env.SUPABASE_ANON_KEY` as a fallback.
2.  **`SUPABASE_URL` Validation Guard:** A new `if` statement was introduced to explicitly check for the presence of `process.env.SUPABASE_URL`:
    ```typescript
    if (!process.env.SUPABASE_URL) {
        throw new Error(
            "Missing required environment variable: SUPABASE_URL. " +
            "Set it in your .env file (e.g. https://<project>.supabase.co)."
        );
    }
    ```
    If `SUPABASE_URL` is undefined, our system now throws an `Error` with a clear, actionable message.
3.  **`SUPABASE_SERVICE_ROLE_KEY` Validation Guard:** A second, critical `if` statement was added to validate `process.env.SUPABASE_SERVICE_ROLE_KEY`:
    ```typescript
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error(
            "Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY. " +
            "The API backend requires the service_role key to bypass RLS for server-side writes. " +
            "Do not use SUPABASE_ANON_KEY here — it is subject to RLS and will silently drop writes."
        );
    }
    ```
    This guard ensures that the API backend always starts with the privileged `SERVICE_ROLE_KEY`. The error message explicitly warns against using the `SUPABASE_ANON_KEY` for backend writes, highlighting its RLS limitations.
4.  **Direct Variable Assignment:** Following these validation checks, `supabaseUrl` is directly assigned `process.env.SUPABASE_URL` and `supabaseKey` is assigned `process.env.SUPABASE_SERVICE_ROLE_KEY`. TypeScript's type system implicitly understands that these variables are now guaranteed to be defined strings due to the preceding `if` blocks.

No other components within `apps/api/src/db/client.ts`, such as the `Connection pool config`, `fetch wrappers`, `client creation`, or `shutdown logic`, were altered by this pull request.

## Technical Decisions

Our decision to implement explicit startup guards via `throw new Error()` instead of silent fallbacks or warnings was driven by the "fail-fast" principle. This approach ensures that any misconfiguration of critical Supabase environment variables is immediately apparent during application startup, preventing the API from operating in a degraded or non-functional state.

The primary technical rationale for strictly requiring `SUPABASE_SERVICE_ROLE_KEY` is to enable server-side operations that necessitate bypassing Supabase's Row Level Security (RLS). The `SUPABASE_ANON_KEY` is inherently subject to RLS policies, making it unsuitable for backend write operations where administrative privileges or data integrity are paramount. By enforcing the `SERVICE_ROLE_KEY`, we guarantee that our API backend can perform all necessary data manipulations without encountering RLS restrictions.

The error messages were carefully crafted to be highly informative, guiding developers on which specific environment variable is missing, its purpose, and where to obtain it (e.g., `.env` file, Supabase dashboard). This significantly improves the developer experience by reducing debugging time and streamlining the local development setup for new contributors.

We deliberately limited the scope of these changes to `apps/api/src/db/client.ts`. Other Supabase client initializations, such as those in `apps/api/src/db/supabase.ts` (used for read-only pharmacy routes) and `apps/api/src/app.ts` (for the app-level health check client), were left untouched. This is because their respective use cases (read-only queries, health checks) are appropriate for the `SUPABASE_ANON_KEY` and do not require RLS bypass, adhering to the principle of least privilege.

## How To Re-Implement (Contributor Reference)

Should a contributor need to re-implement this feature from scratch, they would follow these steps:

1.  **Locate the Supabase Client Configuration:** Navigate to `apps/api/src/db/client.ts`. This file is responsible for initializing the Supabase client used by the backend API for write operations.
2.  **Identify Environment Variable Resolution Block:** Find the section within the file dedicated to resolving `SUPABASE_URL` and `SUPABASE_KEY` from `process.env`.
3.  **Remove Existing Fallback Logic:** Delete any code that uses `||` (OR) operators to provide fallback values for `supabaseUrl` or `supabaseKey`, including references to `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, or hardcoded defaults like `"http://localhost:54321"` or `"local-development-key"`.
4.  **Implement `SUPABASE_URL` Validation:** Add an `if` condition to check if `process.env.SUPABASE_URL` is defined. If not, throw an `Error` with a descriptive message:
    ```typescript
    if (!process.env.SUPABASE_URL) {
        throw new Error(
            "Missing required environment variable: SUPABASE_URL. " +
            "Set it in your .env file (e.g. https://<project>.supabase.co)."
        );
    }
    ```
5.  **Implement `SUPABASE_SERVICE_ROLE_KEY` Validation:** Add a second `if` condition to check for `process.env.SUPABASE_SERVICE_ROLE_KEY`. This is crucial for backend write operations. If missing, throw an `Error` with a message that explicitly warns against using the `SUPABASE_ANON_KEY`:
    ```typescript
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error(
            "Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY. " +
            "The API backend requires the service_role key to bypass RLS for server-side writes. " +
            "Do not use SUPABASE_ANON_KEY here — it is subject to RLS and will silently drop writes."
        );
    }
    ```
6.  **Directly Assign Variables:** After the validation guards, assign the `supabaseUrl` and `supabaseKey` constants directly from `process.env`. At this point, TypeScript will correctly infer that these variables are defined strings.
    ```typescript
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    ```
7.  **Local Development Consideration:** Remind contributors that for local development, they must ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present in their `.env` file. The `SUPABASE_SERVICE_ROLE_KEY` can be found in the Supabase dashboard under Settings → API.

## Impact on System Architecture

This change significantly enhances the robustness and predictability of our backend API's interaction with Supabase, forming a more reliable foundation for the SahiDawa platform.

-   **Enhanced Reliability:** By strictly enforcing the presence of `SUPABASE_SERVICE_ROLE_KEY`, we guarantee that all server-side write operations will correctly bypass RLS. This eliminates the possibility of silent data loss or unexpected permission errors that were previously observed (Issue #893), ensuring the integrity of critical data such as patient records, medicine verification logs, and health platform updates.
-   **Improved Developer Experience:** The explicit and informative error messages provide immediate feedback during development or deployment if essential environment variables are missing. This drastically reduces debugging time and ensures a more consistent and correct setup across all development, staging, and production environments.
-   **Strengthened Security Posture:** While not a direct security vulnerability fix, requiring the `SERVICE_ROLE_KEY` for backend operations reinforces the principle of least privilege. Client-side operations, which typically use the `ANON_KEY`, remain subject to RLS, while privileged backend operations are correctly authenticated to bypass RLS, ensuring appropriate access control.
-   **Solid Foundation for Future Development:** A reliably configured and correctly privileged database client is fundamental to any data-driven application. This fix solidifies the foundation for all future backend features involving data manipulation, ensuring they operate as intended without hidden credential-related issues. It enables us to confidently build out new functionalities for rural health and medicine verification, knowing our core database interactions are robust.

## Testing & Verification

Verification of this change involved both manual and implicit testing:

-   **Manual Negative Case Verification:** We manually tested the API's startup behavior by intentionally omitting `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the `.env` file. Our system successfully failed to start, throwing the exact `Error` messages implemented in `apps/api/src/db/client.ts`, confirming the guards are active.
-   **Manual Positive Case Verification:** The API was then started with both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` correctly configured in the `.env` file. This confirmed that the application initializes successfully and that the Supabase client is correctly instantiated with the service role key, allowing subsequent database operations to proceed without startup errors.
-   **Integration Testing (Implicit):** Existing integration tests for API endpoints that perform write operations implicitly verify the correct configuration. These tests would have failed if the Supabase client was still using the `ANON_KEY` and encountering RLS restrictions, thus providing an indirect confirmation that the `SERVICE_ROLE_KEY` is being used.
-   **Edge Cases Considered:**
    -   **Missing `SUPABASE_URL`:** Verified that the API fails to start with the specific error message for `SUPABASE_URL`.
    -   **Missing `SUPABASE_SERVICE_ROLE_KEY`:** Verified that the API fails to start with the specific error message warning against using `SUPABASE_ANON_KEY` for backend writes.
    -   **`SUPABASE_ANON_KEY` provided instead of `SUPABASE_SERVICE_ROLE_KEY`:** This scenario is now explicitly prevented at startup by the new guard, which strictly requires `SUPABASE_SERVICE_ROLE_KEY`. The system will not proceed if this variable is missing.
-   **Automated Testing:** Not documented in this PR if specific unit tests were added to directly test the environment variable validation logic. However, the `type:testing` label indicates that testing was a part of this change.