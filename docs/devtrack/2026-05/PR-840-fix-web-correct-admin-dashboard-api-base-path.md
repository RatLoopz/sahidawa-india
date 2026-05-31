# PR #840 — fix(web): correct admin dashboard API base path

> **Merged:** 2026-05-29 | **Author:** @Divv1524 | **Area:** Frontend | **Impact Score:** 12 | **Closes:** #650

## What Changed

This pull request introduces a centralized utility for constructing the base path for the admin dashboard API endpoints within our `apps/web` Next.js frontend. We have created a new file, `apps/web/lib/adminApi.ts`, which exports a `buildAdminApiBase` function and a pre-configured `ADMIN_API_BASE` constant. The admin dashboard page (`apps/web/app/[locale]/admin/dashboard/page.tsx`) has been updated to consistently use this new `ADMIN_API_BASE` for all its API calls, ensuring a standardized and robust approach to API endpoint resolution.

## The Problem Being Solved

Prior to this change, the `apps/web/app/[locale]/admin/dashboard/page.tsx` component directly defined its `API_BASE` constant. This constant either explicitly hardcoded `http://localhost:4000/api/v1/admin` or expected the `process.env.NEXT_PUBLIC_API_URL` environment variable to already include the `/api/v1/admin` suffix. This approach led to several issues:
1.  **Inconsistent Configuration:** It forced `NEXT_PUBLIC_API_URL` to be more specific than a bare API origin, contradicting the common practice of defining it as just the domain (e.g., `https://api.sahidawa.example`). This made our `.env.example` potentially misleading.
2.  **Duplication and Error Prone:** Each component or page needing to interact with the admin API would have to manually append or ensure the `/api/v1/admin` path, leading to potential inconsistencies, trailing slash issues, or accidental path duplication.
3.  **Lack of Robustness:** The previous implementation did not gracefully handle edge cases such as `NEXT_PUBLIC_API_URL` being blank, having trailing slashes, or already containing the admin path, which could lead to malformed API requests.
This bug was tracked in issue #650.

## Files Modified

- `apps/web/app/[locale]/admin/dashboard/page.tsx`
- `apps/web/lib/adminApi.ts`
- `apps/web/tests/adminApi.test.ts`

## Implementation Details

We implemented a new utility module at `apps/web/lib/adminApi.ts` to centralize the logic for constructing the admin API base path.

1.  **`apps/web/lib/adminApi.ts`:**
    *   We defined two internal constants: `DEFAULT_API_ORIGIN` set to `"http://localhost:4000"` and `ADMIN_API_PATH` set to `"/api/v1/admin"`. These provide a clear default for local development and the specific API sub-path for admin operations.
    *   The core logic resides in the `export function buildAdminApiBase(apiOrigin = process.env.NEXT_PUBLIC_API_URL): string` function.
        *   It accepts an optional `apiOrigin` parameter, which defaults to the value of `process.env.NEXT_PUBLIC_API_URL`. This allows for both environment-based configuration and explicit overrides if needed.
        *   Inside the function, `apiOrigin` is first trimmed using `.trim()` to remove any leading or trailing whitespace.
        *   The `configuredOrigin` is then normalized: if it's empty after trimming, `DEFAULT_API_ORIGIN` is used. Otherwise, `replace(/\/+$/, "")` is applied to remove any trailing slashes from the origin, ensuring a clean base URL.
        *   A crucial check `if (normalizedOrigin.endsWith(ADMIN_API_PATH))` is performed. This prevents the `ADMIN_API_PATH` from being duplicated if the `apiOrigin` already includes it (e.g., if `NEXT_PUBLIC_API_URL` was set to `http://localhost:4000/api/v1/admin`). In such cases, the `normalizedOrigin` is returned directly.
        *   If the `ADMIN_API_PATH` is not already present, it is appended to the `normalizedOrigin` using a template literal: `` `${normalizedOrigin}${ADMIN_API_PATH}` ``.
    *   Finally, we `export const ADMIN_API_BASE = buildAdminApiBase();`. This constant provides the pre-computed admin API base URL, ready for direct use across the application without needing to call the function repeatedly.

2.  **`apps/web/app/[locale]/admin/dashboard/page.tsx`:**
    *   The previous `const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1/admin";` declaration was removed.
    *   We added an import statement: `import { ADMIN_API_BASE } from "@/lib/adminApi";`.
    *   All `fetch` calls within the component that previously used `${API_BASE}/...` were updated to use `${ADMIN_API_BASE}/...`. This includes calls for fetching reports, fetching medicines, handling report actions, and adding new medicines. For example, `fetch(`${API_BASE}/reports`, ...)` became `fetch(`${ADMIN_API_BASE}/reports`, ...)`.

## Technical Decisions

Our primary technical decision was to centralize the construction of API base paths for specific application areas.
1.  **Centralization:** By creating `apps/web/lib/adminApi.ts`, we moved the logic for determining the admin API base path out of the individual component (`page.tsx`) and into a reusable utility. This promotes the DRY (Don't Repeat Yourself) principle, reduces the chance of errors due to manual string concatenation, and makes future changes to the admin API path easier to manage.
2.  **Robustness and Edge Case Handling:** We explicitly decided to handle several common configuration pitfalls:
    *   **Blank `NEXT_PUBLIC_API_URL`:** The `buildAdminApiBase` function defaults to `DEFAULT_API_ORIGIN` if `NEXT_PUBLIC_API_URL` is empty or whitespace-only, ensuring the application remains functional in development environments without explicit configuration.
    *   **Trailing Slashes:** The `.replace(/\/+$/, "")` ensures that `NEXT_PUBLIC_API_URL` can be provided with or without trailing slashes, and the resulting base path will always be correctly formed without double slashes.
    *   **Pre-existing Admin Path:** The `endsWith(ADMIN_API_PATH)` check prevents the `/api/v1/admin` segment from being duplicated if `NEXT_PUBLIC_API_URL` already includes it, making the utility resilient to varied environment configurations.
3.  **Clarity for `NEXT_PUBLIC_API_URL`:** This change clarifies that `NEXT_PUBLIC_API_URL` should ideally represent the bare origin of our API (e.g., `https://api.sahidawa.example`), rather than including specific sub-paths. This aligns with standard environment variable practices and simplifies our `.env.example` configuration.
4.  **Unit Testing:** The decision to add comprehensive unit tests for `buildAdminApiBase` in `apps/web/tests/adminApi.test.ts` was crucial. This ensures the robustness of the path construction logic across various scenarios and prevents regressions.

## How To Re-Implement (Contributor Reference)

To re-implement a similar pattern for another API sub-path (e.g., a public API or a specific ML service API) within the `apps/web` frontend, a contributor would follow these steps:

1.  **Identify the API Sub-Path:** Determine the specific API sub-path that needs a consistent base URL (e.g., `/api/v1/public`, `/ml/predict`).
2.  **Create a New Utility File:** In `apps/web/lib/`, create a new TypeScript file, for example, `publicApi.ts`.
3.  **Define Constants:** Inside `publicApi.ts`, define:
    *   `const DEFAULT_API_ORIGIN = "http://localhost:4000";` (or another appropriate default for local development).
    *   `const PUBLIC_API_PATH = "/api/v1/public";` (using your identified sub-path).
4.  **Implement `buildYourApiBase` Function:** Create an exported function similar to `buildAdminApiBase`:
    ```typescript
    export function buildPublicApiBase(apiOrigin = process.env.NEXT_PUBLIC_API_URL): string {
        const configuredOrigin = apiOrigin?.trim();
        const normalizedOrigin = (configuredOrigin || DEFAULT_API_ORIGIN).replace(/\/+$/, "");

        if (normalizedOrigin.endsWith(PUBLIC_API_PATH)) {
            return normalizedOrigin;
        }

        return `${normalizedOrigin}${PUBLIC_API_PATH}`;
    }
    ```
5.  **Export a Constant:** Export the pre-computed base URL:
    ```typescript
    export const PUBLIC_API_BASE = buildPublicApiBase();
    ```
6.  **Update Consuming Components/Pages:** In any component or page that needs to interact with this API (e.g., `apps/web/app/[locale]/some-public-page/page.tsx`):
    *   Remove any existing hardcoded or manually constructed API base URLs.
    *   Import the new constant: `import { PUBLIC_API_BASE } from "@/lib/publicApi";`.
    *   Replace all `fetch` calls that previously used a manual base path with the new `PUBLIC_API_BASE`. For example, `fetch(`/api/v1/public/data`, ...)` becomes `fetch(`${PUBLIC_API_BASE}/data`, ...)`.
7.  **Add Unit Tests:** Create a corresponding test file in `apps/web/tests/`, e.g., `publicApi.test.ts`. Write comprehensive Jest tests for `buildPublicApiBase`, covering all the edge cases handled by `buildAdminApiBase`:
    *   No `NEXT_PUBLIC_API_URL` configured (uses default).
    *   `NEXT_PUBLIC_API_URL` set to a bare origin.
    *   Blank or whitespace `apiOrigin`.
    *   `apiOrigin` with trailing slashes.
    *   `apiOrigin` already containing the `PUBLIC_API_PATH`.
    *   `apiOrigin` already containing the `PUBLIC_API_PATH` with a trailing slash.

## Impact on System Architecture

This change significantly improves the maintainability and robustness of our frontend API interaction layer.
1.  **Improved Maintainability:** By centralizing API path construction, we create a single source of truth for the admin API base URL. This makes it easier to update API versions or change deployment strategies without modifying numerous files.
2.  **Enhanced Developer Experience:** Developers no longer need to remember or manually construct the full admin API path. They can simply import `ADMIN_API_BASE`, leading to cleaner and more readable code in components. It also clarifies the expected format of `NEXT_PUBLIC_API_URL` in our environment configuration.
3.  **Scalability:** This pattern establishes a clear architectural guideline for handling different API sub-paths. As SahiDawa grows and introduces more specialized APIs (e.g., for ML services, public data, or partner integrations), we can easily create similar utility modules, ensuring consistency across the entire frontend.
4.  **Reduced Configuration Errors:** The robust handling of edge cases (trailing slashes, blank origins, pre-existing paths) significantly reduces the likelihood of deployment-related API connectivity issues caused by misconfigured environment variables.

## Testing & Verification

This change was thoroughly tested with unit tests and verified through the build process.
1.  **Unit Tests:** A new test file, `apps/web/tests/adminApi.test.ts`, was created specifically for the `buildAdminApiBase` function. This test suite includes 7 distinct test cases:
    *   Verifying the default local API origin when `NEXT_PUBLIC_API_URL` is not set.
    *   Confirming correct usage of `NEXT_PUBLIC_API_URL` when it is defined.
    *   Testing the fallback to the default origin when `NEXT_PUBLIC_API_URL` is blank.
    *   Ensuring the admin API path is correctly appended to a bare API origin.
    *   Validating that trailing slashes on the API origin are normalized before appending the path.
    *   Confirming that the admin API path is not duplicated if it's already part of the configured origin.
    *   Verifying that the admin API path is not duplicated even if it's already part of the configured origin with a trailing slash.
2.  **Verification:** The provided proof of work shows that `npm.cmd run test -w web -- adminApi.test.ts` was executed, and all 7 tests passed successfully. This confirms the correct behavior of the `buildAdminApiBase` utility under various configuration scenarios.
3.  **Integration (Implicit):** By updating `apps/web/app/[locale]/admin/dashboard/page.tsx` to use `ADMIN_API_BASE`, the change was integrated into the live admin dashboard. While not explicitly documented as a manual UI test, the successful build and merge imply that the dashboard's API calls would now correctly resolve using the new utility.