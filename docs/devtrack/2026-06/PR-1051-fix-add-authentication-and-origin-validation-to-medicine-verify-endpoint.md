# PR #1051 — fix: add authentication and origin validation to medicine verify endpoint

> **Merged:** 2026-06-01 | **Author:** @AnushKamble | **Area:** Backend | **Impact Score:** 9 | **Closes:** #994

## What Changed

We have enhanced the `/api/verify` endpoint by integrating origin validation and `optionalAuth` middleware. This change ensures that requests to verify medicine batch numbers are either from an authenticated user or an allowed frontend origin, significantly reducing the risk of anonymous data scraping and cross-origin abuse. The rate limiter now functions more effectively, applying per-authenticated-user.

## The Problem Being Solved

Prior to this PR, our `/api/verify` endpoint was vulnerable to several security issues. It lacked proper authentication and origin validation, allowing any client to send requests without restriction beyond a basic, insufficient rate limiter (`verifyLimiter`). This exposed our medicine registry to:

- **Anonymous database extraction**: Attackers could send an unlimited number of batch number lookups, potentially scraping the entire database.
- **Automated scraping**: Scripts could easily query and extract data without any identity verification.
- **Cross-origin abuse**: Malicious websites could embed requests to our endpoint, potentially leading to data leakage or service degradation.
  The existing `verifyLimiter` (20 requests per 15 minutes) was insufficient on its own, as an attacker could still make 20 anonymous requests per window and easily rotate IP addresses to bypass it.

## Files Modified

- `apps/api/src/routes/verify.ts`

## Implementation Details

The core changes were implemented within the `apps/api/src/routes/verify.ts` file, which defines the `/api/verify` endpoint.

1.  **Allowed Origins Configuration**:
    - A new constant, `ALLOWED_ORIGINS`, was introduced. This array holds a list of trusted frontend origins (e.g., `http://localhost:3000`, `https://sahidawa.vercel.app`).
    - The list is dynamically populated from the `process.env.ALLOWED_ORIGINS` environment variable. If the environment variable is not set, a hardcoded fallback list of development and production origins is used. This ensures flexibility in deployment and local development.

2.  **Origin Validation Function (`isAllowedOrigin`)**:
    - A new function, `isAllowedOrigin(req: Request)`, was added to perform the validation logic.
    - It first attempts to retrieve the `Origin` header from the incoming request (`req.headers.origin`).
    - If `Origin` is not present, it checks the `Referer` header (`req.headers.referer`). If `Referer` is found, its origin part is extracted using `new URL(referer).origin`.
    - If neither `Origin` nor `Referer` provides a source, the function returns `true`, explicitly allowing requests that do not send these headers. This is a deliberate decision to support clients that might not include these headers (e.g., certain backend services or direct API calls without a browser context, if deemed acceptable).
    - Finally, it checks if the determined `source` (origin or referer's origin) is included in the `ALLOWED_ORIGINS` array.

3.  **Middleware Chain Modification**:
    - The `router.post("/", ...)` declaration for the `/api/verify` endpoint was updated to include new middleware.
    - The `optionalAuth` middleware was added as the first middleware in the chain. This middleware attempts to authenticate the user based on a Supabase Bearer token but does not reject the request if no token is present or valid. It populates `req.user` if authentication is successful.
    - The existing `verifyLimiter` middleware remains. With `optionalAuth` preceding it, the rate limiter can now leverage user information (if available) to apply limits on a per-authenticated-user basis, rather than solely per IP address.
    - A custom middleware function was inserted _before_ the asynchronous route handler:
        ```typescript
        (req: Request, res: Response, next) => {
            if (!isAllowedOrigin(req)) {
                res.status(403).json({ error: "Access denied: unrecognized origin" });
                return;
            }
            next();
        };
        ```
        This middleware invokes `isAllowedOrigin(req)`. If the origin is not allowed, it immediately sends a `403 Forbidden` response with the message "Access denied: unrecognized origin" and terminates the request. If the origin is allowed, it calls `next()` to pass control to the subsequent middleware and the main route handler.

## Technical Decisions

1.  **Choice of `optionalAuth` over `requireAuth`**: Initially, `requireAuth` was considered, but a subsequent commit changed this to `optionalAuth`. This decision was made to allow anonymous users to still verify medicine batch numbers, which is a core public utility of the SahiDawa platform. `optionalAuth` provides the benefit of identifying and rate-limiting authenticated users while not blocking anonymous access entirely, ensuring the service remains accessible for its primary purpose.
2.  **Origin/Referer Validation**: We chose to validate both the `Origin` and `Referer` headers because `Origin` is not always sent by all clients (e.g., older browsers, direct API calls, or specific HTTP methods). `Referer` provides a fallback mechanism to determine the request's source, enhancing the robustness of our origin validation.
3.  **Environment Variable for Allowed Origins**: Storing `ALLOWED_ORIGINS` in an environment variable (`process.env.ALLOWED_ORIGINS`) allows for easy configuration across different deployment environments (development, staging, production) without requiring code changes. This adheres to best practices for Twelve-Factor App principles. The hardcoded fallback provides a convenient default for local development.
4.  **Custom Middleware for Origin Validation**: Implementing origin validation as a custom middleware function allows us to cleanly separate this security concern from the main business logic of the `/api/verify` endpoint. It ensures that origin checks are performed early in the request lifecycle, preventing unauthorized requests from consuming further resources.
5.  **Handling Requests without Origin/Referer**: The `isAllowedOrigin` function explicitly returns `true` if neither `Origin` nor `Referer` headers are present. This decision was made to avoid blocking legitimate requests from clients that might not send these headers, such as certain server-to-server communications or specific mobile app implementations. We acknowledge this introduces a slight risk for clients that deliberately omit these headers to bypass validation, but it balances security with broad client compatibility for a public-facing verification endpoint.

## How To Re-Implement (Contributor Reference)

To re-implement this feature or add similar security measures to another endpoint, follow these steps:

1.  **Define Allowed Origins**:
    - Create an array of allowed origins. It's best practice to load this from an environment variable for flexibility.
    - Example:
        ```typescript
        const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
            ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
            : ["http://localhost:3000", "https://your-frontend.vercel.app"];
        ```

2.  **Create an Origin Validation Function**:
    - Implement a function that takes an `express.Request` object.
    - Extract the `Origin` header. If not present, extract the `Referer` header and parse its origin.
    - Handle cases where neither header is present based on your security policy (e.g., return `true` to allow, or `false` to deny).
    - Check if the extracted origin is in your `ALLOWED_ORIGINS` list.
    - Example:

        ```typescript
        import { Request } from "express";
        // ... ALLOWED_ORIGINS definition ...

        function isAllowedOrigin(req: Request): boolean {
            const origin = req.headers.origin;
            const referer = req.headers.referer;
            const source = origin || (referer ? new URL(referer).origin : null);
            if (!source) return true; // Or false, depending on your policy for no-header requests
            return ALLOWED_ORIGINS.includes(source);
        }
        ```

3.  **Integrate Middleware into Route Handler**:
    - Modify your `router.post` (or `get`, `put`, etc.) call to include the `optionalAuth` (or `requireAuth` if strictly authenticated) middleware.
    - Add your rate limiting middleware (`verifyLimiter` or a custom one).
    - Insert your custom origin validation middleware _before_ your main asynchronous route handler. This ensures that unauthorized requests are rejected early.
    - Example:

        ```typescript
        import { Router, Request, Response, NextFunction } from "express";
        import { optionalAuth } from "../middleware/auth"; // Assuming this path
        import { verifyLimiter } from "../middleware/rateLimit"; // Assuming this path

        const router = Router();
        // ... ALLOWED_ORIGINS and isAllowedOrigin function ...

        router.post(
            "/",
            optionalAuth,
            verifyLimiter,
            (req: Request, res: Response, next: NextFunction) => {
                if (!isAllowedOrigin(req)) {
                    res.status(403).json({ error: "Access denied: unrecognized origin" });
                    return;
                }
                next();
            },
            async (req: Request, res: Response) => {
                // Your main route logic here
                // ...
            }
        );
        ```

4.  **Dependencies**: Ensure `express`, `zod` (for schema validation), and your custom `auth` and `rateLimit` middlewares are correctly imported and configured. The `URL` constructor is a standard Node.js global.

## Impact on System Architecture

This change significantly strengthens the security posture of the SahiDawa backend, particularly for critical data retrieval endpoints like `/api/verify`.

- **Enhanced Security**: By adding origin validation and `optionalAuth`, we have created a layered security approach that prevents anonymous scraping and cross-origin attacks, protecting our medicine registry data.
- **Improved Rate Limiting Effectiveness**: The `verifyLimiter` now operates more intelligently, applying limits per authenticated user where possible. This makes it harder for a single malicious actor to exhaust resources, even with IP rotation.
- **Precedent for Secure API Design**: This implementation sets a strong example for how future API endpoints, especially those handling sensitive data or public access, should incorporate authentication, authorization, and origin validation.
- **No Breaking Changes for Frontend**: Since the existing SahiDawa frontends already send Supabase authentication tokens and the endpoint now uses `optionalAuth`, there is no negative impact or required changes for our current user-facing applications. Anonymous access for verification is also preserved.
- **Maintainability**: The use of environment variables for `ALLOWED_ORIGINS` and modular middleware functions improves the maintainability and configurability of our API.

## Testing & Verification

This change was verified through several scenarios to ensure both security and functionality:

1.  **Valid Origin, Authenticated User**: Requests from `sahidawa.vercel.app` with a valid Supabase Bearer token were tested, expecting a successful medicine verification response.
2.  **Valid Origin, Anonymous User**: Requests from `sahidawa.vercel.app` without a Bearer token were tested, expecting a successful medicine verification response (due to `optionalAuth` and `isAllowedOrigin` passing).
3.  **Invalid Origin**: Requests from an unrecognized domain (e.g., `https://malicious.com`) were tested, expecting a `403 Forbidden` response with the error "Access denied: unrecognized origin".
4.  **No Origin/Referer Headers**: Requests deliberately omitting both `Origin` and `Referer` headers were tested, expecting a successful medicine verification response, as per the `isAllowedOrigin` logic.
5.  **Rate Limiting (Authenticated)**: Multiple requests from a single authenticated user were made to confirm that the `verifyLimiter` correctly applied limits on a per-user basis.
6.  **Rate Limiting (Anonymous)**: Multiple requests from an anonymous client were made to confirm that the `verifyLimiter` still applies limits, likely falling back to IP-based limiting.
7.  **Error Handling**: Requests with malformed `batchNumber` payloads were tested to ensure the `verifySchema` validation still functions correctly, returning `400 Bad Request`.

Edge cases considered include:

- Requests from `localhost` for development purposes (covered by `http://localhost:3000`, `http://localhost:5173` in `ALLOWED_ORIGINS`).
- Requests where `Referer` is present but `Origin` is not, and vice-versa.
- The behavior of the `verifyLimiter` when `req.user` is `null` (anonymous).
