# PR #837 — fix(api): configure CORS origins from environment

> **Merged:** 2026-05-29 | **Author:** @Divv1524 | **Area:** Backend | **Impact Score:** 12 | **Closes:** #648

## What Changed

This pull request refactors the Cross-Origin Resource Sharing (CORS) configuration for our `apps/api` Express backend. We have replaced the previously hardcoded list of allowed origins with a dynamic, environment-variable-driven approach. This allows us to configure trusted frontend URLs for production and staging environments without modifying code, while still maintaining secure default origins for local development.

## The Problem Being Solved

Prior to this PR, the `apps/api` Express server's CORS middleware in `apps/api/src/app.ts` used a hardcoded array of `allowedOrigins` (`["http://localhost:3000", "http://localhost:4000", "http://localhost:8000"]`). This setup was sufficient for local development but presented a significant security and deployment challenge for production environments. Deploying the SahiDawa frontend to a domain like `https://sahidawa.org` or a Vercel preview URL would result in CORS errors, as the backend would reject requests from these unknown origins. This necessitated manual code changes for each deployment environment or a less secure wildcard `*` origin, which we wanted to avoid for security reasons. Issue #648 specifically tracked this limitation, highlighting the need for a configurable and secure solution.

## Files Modified

- `.env.example`
- `apps/api/src/app.ts`
- `apps/api/src/config/cors.ts`
- `apps/api/tests/cors.test.ts`

## Implementation Details

The core of this change involves abstracting the CORS origin configuration into a new module, `apps/api/src/config/cors.ts`.

1.  **New CORS Configuration Module (`apps/api/src/config/cors.ts`):**
    *   We introduced a new file, `apps/api/src/config/cors.ts`, to encapsulate the logic for determining allowed CORS origins.
    *   It defines `DEFAULT_ALLOWED_ORIGINS` as `["http://localhost:3000", "http://localhost:4000", "http://localhost:8000"]`, ensuring local development continues to work out-of-the-box.
    *   A helper function `parseAllowedOrigins(value: string | undefined): string[]` was added. This function takes a string (expected to be from an environment variable) and splits it by commas, trims whitespace from each origin, and filters out any empty strings. This robustly handles comma-separated lists of URLs.
    *   The `getAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[]` function is the central logic for compiling the complete list of trusted origins. It combines:
        *   `DEFAULT_ALLOWED_ORIGINS`
        *   Origins parsed from `env.FRONTEND_URL` (which is typically a single URL but handled by `parseAllowedOrigins` for consistency).
        *   Origins parsed from `env.ALLOWED_ORIGINS` (a comma-separated list for additional trusted domains).
        *   A `Set` is used (`[...new Set([...])]`) to automatically remove any duplicate origins, ensuring efficiency and preventing redundant checks.
    *   The `createCorsOptions(env: NodeJS.ProcessEnv = process.env): CorsOptions` function generates the actual `cors` middleware options object.
        *   It retrieves the full list of `allowedOrigins` using `getAllowedOrigins()`.
        *   Crucially, it implements a custom `origin` function for the `cors` middleware. This function takes the `origin` of the incoming request and a `callback`.
        *   If `origin` is `undefined` (common for same-origin requests, server-to-server calls, or health checks), it's immediately allowed (`callback(null, true)`). This is important for internal communication or tools that don't send an `Origin` header.
        *   If the `origin` is present and found within our `allowedOrigins` list, it's allowed (`callback(null, true)`).
        *   Otherwise, if the origin is not in the allowed list, it's explicitly denied (`callback(null, false)`), maintaining a strict security posture.
        *   `credentials: true` is consistently set to allow cookies and authorization headers to be sent with cross-origin requests.

2.  **Integration into Express App (`apps/api/src/app.ts`):**
    *   The hardcoded `allowedOrigins` array and the direct `cors()` call with a static array have been removed.
    *   We now import `createCorsOptions` from the new configuration file: `import { createCorsOptions } from "./config/cors";`.
    *   The `cors` middleware is initialized by calling `app.use(cors(createCorsOptions()));`. This dynamically generates the CORS options based on the current environment variables at application startup.

3.  **Environment Variable Example (`.env.example`):**
    *   The `.env.example` file has been updated to include `ALLOWED_ORIGINS=http://localhost:3000,http://localhost:4000,http://localhost:8000`. This provides a clear example for developers on how to configure additional origins and also serves as a default for local development if `FRONTEND_URL` is not explicitly set. Note that `FRONTEND_URL` was already present and is also considered.

4.  **Dedicated Test Suite (`apps/api/tests/cors.test.ts`):**
    *   A new, comprehensive test file `apps/api/tests/cors.test.ts` was added to validate the `getAllowedOrigins` and `createCorsOptions` functions.
    *   It uses `jest` to test various scenarios:
        *   Default local origins are included.
        *   `FRONTEND_URL` and `ALLOWED_ORIGINS` are correctly parsed and added.
        *   Duplicates are handled (removed by `Set`).
        *   Whitespace and empty entries in environment variables are gracefully ignored.
        *   Requests from explicitly allowed origins are permitted.
        *   Requests without an `Origin` header (e.g., server-to-server) are permitted.
        *   Requests from unknown/unconfigured origins are denied, including variations like different schemes, ports, trailing slashes, and case mismatches.
    *   The `resolveOrigin` helper function within the test suite simulates the `cors` middleware's `origin` callback mechanism, making the tests clear and focused.

## Technical Decisions

1.  **Environment Variable-Driven Configuration:** We chose environment variables (`FRONTEND_URL`, `ALLOWED_ORIGINS`) as the primary mechanism for configuring CORS origins. This is a standard and secure practice for deploying applications, allowing different environments (development, staging, production) to have distinct configurations without requiring code changes or rebuilding the application. This aligns with the 12-Factor App methodology.
2.  **Custom `origin` Function for `cors` Middleware:** Instead of passing a simple array to the `cors` middleware, we opted for a custom function for the `origin` property. This provides fine-grained control over origin validation. It allows us to:
    *   Dynamically check against a list derived from multiple environment variables.
    *   Explicitly allow requests with an `undefined` origin (crucial for non-browser clients, server-to-server communication, and health checks) without resorting to a wildcard.
    *   Maintain a strict deny-by-default policy for any origin not explicitly listed.
3.  **Dedicated Configuration File (`apps/api/src/config/cors.ts`):** Separating the CORS logic into its own file promotes modularity and maintainability. It keeps `apps/api/src/app.ts` cleaner and makes the CORS configuration easier to locate, understand, and test independently.
4.  **Robust Parsing of `ALLOWED_ORIGINS`:** The `parseAllowedOrigins` function handles comma-separated values, trimming whitespace, and filtering out empty entries. This makes the configuration more user-friendly and resilient to minor formatting errors in the `.env` files.
5.  **Set for Deduplication:** Using a `Set` when combining origins in `getAllowedOrigins` ensures that duplicate URLs are automatically removed. This simplifies the logic and prevents potential issues or inefficiencies if the same origin is specified in both `FRONTEND_URL` and `ALLOWED_ORIGINS`.
6.  **Comprehensive Unit Tests:** The decision to add a dedicated test suite (`apps/api/tests/cors.test.ts`) was critical. CORS configurations can be subtle and have significant security implications. Thorough testing ensures that the parsing logic, origin matching, and denial of unknown origins work as expected across various edge cases, providing confidence in the security and correctness of the implementation.

## How To Re-Implement (Contributor Reference)

To re-implement or understand the flow of configurable CORS origins in SahiDawa's API, follow these steps:

1.  **Define Environment Variables:**
    *   In your `.env` file (or environment variables for deployment), define `FRONTEND_URL` for your primary frontend application's URL.
    *   Define `ALLOWED_ORIGINS` as a comma-separated string of any additional trusted origins.
    *   Example:
        ```
        FRONTEND_URL=https://app.sahidawa.org
        ALLOWED_ORIGINS=https://admin.sahidawa.org,https://preview.sahidawa.org
        ```
    *   Ensure these are documented in `.env.example`.

2.  **Create CORS Configuration Module:**
    *   Create a new file, e.g., `apps/api/src/config/cors.ts`.
    *   Inside this file, define `DEFAULT_ALLOWED_ORIGINS` as an array of local development URLs:
        ```typescript
        const DEFAULT_ALLOWED_ORIGINS = [
            "http://localhost:3000",
            "http://localhost:4000",
            "http://localhost:8000",
        ];
        ```
    *   Implement `parseAllowedOrigins` to handle comma-separated string inputs:
        ```typescript
        function parseAllowedOrigins(value: string | undefined): string[] {
            if (!value) {
                return [];
            }
            return value
                .split(",")
                .map((origin) => origin.trim())
                .filter(Boolean);
        }
        ```
    *   Implement `getAllowedOrigins` to combine defaults and environment variables, ensuring deduplication:
        ```typescript
        export function getAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
            const configuredOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
            const frontendOrigin = parseAllowedOrigins(env.FRONTEND_URL);
            return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...frontendOrigin, ...configuredOrigins])];
        }
        ```
    *   Implement `createCorsOptions` to return the `cors` middleware options object, using a custom `origin` function for dynamic validation:
        ```typescript
        import { CorsOptions } from "cors"; // Assuming 'cors' library is installed

        export function createCorsOptions(env: NodeJS.ProcessEnv = process.env): CorsOptions {
            const allowedOrigins = getAllowedOrigins(env);
            return {
                origin(origin, callback) {
                    if (!origin || allowedOrigins.includes(origin)) {
                        callback(null, true); // Allow requests with no origin or from an allowed origin
                        return;
                    }
                    callback(null, false); // Deny all other origins
                },
                credentials: true, // Important for session cookies, auth tokens
            };
        }
        ```

3.  **Integrate into Express Application:**
    *   In your main Express application file (e.g., `apps/api/src/app.ts`), import the `cors` library and your `createCorsOptions` function:
        ```typescript
        import cors from "cors";
        import { createCorsOptions } from "./config/cors";
        ```
    *   Apply the CORS middleware using the generated options:
        ```typescript
        // ... other middleware
        app.use(cors(createCorsOptions()));
        // ... rest of your app setup
        ```
    *   Ensure this middleware is applied early in your middleware chain, typically after basic security middleware but before route handlers.

4.  **Add Comprehensive Tests:**
    *   Create a dedicated test file (e.g., `apps/api/tests/cors.test.ts`).
    *   Import `createCorsOptions` and `getAllowedOrigins`.
    *   Write tests for:
        *   `getAllowedOrigins`: Verify it correctly combines defaults, `FRONTEND_URL`, and `ALLOWED_ORIGINS`, handles duplicates, and parses comma-separated strings with whitespace.
        *   `createCorsOptions`: Simulate incoming requests with various `Origin` headers (allowed, denied, undefined) and assert that the `origin` callback behaves as expected (allowing or denying). Use a helper function like `resolveOrigin` from the PR's test file to simplify testing the callback.

This pattern ensures a secure, flexible, and testable CORS configuration for your Express API.

## Impact on System Architecture

This change significantly improves the deployability and security posture of the SahiDawa `apps/api` backend.

1.  **Enhanced Security:** By moving from hardcoded origins to environment-variable-driven configuration with a custom `origin` function, we enforce a strict whitelist approach. Only explicitly allowed origins can make cross-origin requests, mitigating risks associated with open CORS policies or accidental exposure. This is a direct security fix (as indicated by the `type:security` label).
2.  **Improved Deployability:** The API can now be deployed to any environment (staging, production, preview deployments) without requiring code changes to update the allowed frontend URLs. Developers simply need to set the `FRONTEND_URL` and `ALLOWED_ORIGINS` environment variables appropriate for that deployment. This streamlines our CI/CD pipelines and reduces the chance of deployment-related CORS issues.
3.  **Increased Flexibility:** The ability to specify multiple `ALLOWED_ORIGINS` via a comma-separated list provides flexibility for scenarios where SahiDawa might have multiple frontend applications (e.g., a main web app, an admin panel, a mobile app's web view) or different deployment stages (e.g., `staging.sahidawa.org`, `preview-branch.vercel.app`).
4.  **Maintainability:** Centralizing the CORS logic in `apps/api/src/config/cors.ts` makes the configuration easier to understand, modify, and audit in the future, separating concerns from the main `app.ts` file.
5.  **Foundation for Multi-Region/Multi-Tenant Deployments:** While not directly implementing multi-region or multi-tenant features, this configurable CORS setup lays a robust foundation. Future deployments requiring different frontend URLs per region or tenant can leverage this mechanism without architectural overhauls.

Overall, this PR makes our API more robust, secure, and adaptable to evolving deployment requirements.

## Testing & Verification

This change was thoroughly tested using a dedicated Jest test suite located at `apps/api/tests/cors.test.ts`.

**Verification Steps:**

1.  **Unit Tests:** The `npm.cmd exec -w sahidawa-api jest -- tests/cors.test.ts` command was executed, resulting in "16 passed, 16 total" tests. This output confirms that all defined test cases for the CORS configuration logic passed successfully.
2.  **`getAllowedOrigins` Function Tests:**
    *   Verification that `getAllowedOrigins({})` correctly returns the `DEFAULT_ALLOWED_ORIGINS` (`http://localhost:3000`, `http://localhost:4000`, `http://localhost:8000`).
    *   Tests confirmed that `FRONTEND_URL` and `ALLOWED_ORIGINS` are correctly parsed and appended to the default list, with duplicates removed (e.g., `https://sahidawa-india-web.vercel.app`, `https://preview-sahidawa.vercel.app`, `https://staging.sahidawa.org`).
    *   Edge cases for parsing, such as empty entries, leading/trailing whitespace, and multiple commas in `ALLOWED_ORIGINS`, were tested to ensure they are ignored or trimmed correctly.
    *   Tests confirmed that if an origin is duplicated across `FRONTEND_URL` and `ALLOWED_ORIGINS`, it only appears once in the final list.
3.  **`createCorsOptions` Function Tests (Origin Callback Logic):**
    *   **Allowed Origins:** Tests confirmed that requests from `http://localhost:3000`, `http://localhost:4000`, `http://localhost:8000` (defaults), and origins specified in `FRONTEND_URL` or `ALLOWED_ORIGINS` are successfully allowed (`result.allowed` is `true`, `result.error` is `null`).
    *   **Undefined Origin:** A specific test case verified that requests with an `undefined` `Origin` header (typical for server-to-server calls or health checks) are allowed.
    *   **Denied Origins (Edge Cases):**
        *   Requests from completely unknown domains (e.g., `https://unknown.example.com`) are denied.
        *   Requests from the same domain but with a different scheme (e.g., `http://sahidawa-india-web.vercel.app` when `https` is allowed) are denied.
        *   Requests from the same domain but a different port (e.g., `http://localhost:3001` when `3000` is allowed) are denied.
        *   Requests with case-mismatched origins (e.g., `https://SAHIDAWA-INDIA-WEB.vercel.app`) are denied, as origin matching is case-sensitive.
        *   Requests with trailing slashes (e.g., `https://sahidawa-india-web.vercel.app/`) are denied if the allowed origin does not also include the trailing slash, demonstrating strict matching.

This comprehensive testing approach ensures that the CORS configuration is both secure (denying unauthorized origins) and functional (allowing legitimate origins and internal requests) across expected and edge-case scenarios.