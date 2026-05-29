# ADR — Fix/admin dashboard auth

> **Date:** 2026-05-29 | **PR:** #834 | **Status:** Accepted

## Context

The SahiDawa platform's admin dashboard lacked robust, multi-layered authentication and authorization, allowing unauthenticated users to potentially access administrative routes and UI components. This represented a critical security vulnerability, as sensitive platform management features could be exposed or inferred. The existing authentication setup did not adequately prevent access at the route level before UI rendering.

## Decision

A multi-layered security approach was implemented to protect the admin dashboard (`/[locale]/admin/*`) using Next.js middleware and server-side rendering capabilities with `@supabase/ssr`.

1.  **Middleware-level Authentication:** Next.js middleware, integrated into the existing `proxy.ts` file, was configured to intercept all requests to `/[locale]/admin/*` routes. It utilizes `@supabase/ssr` to verify the presence of an active user session. If no session is found, the user is immediately redirected to the `/[locale]/login` page, preventing any rendering of admin UI.
2.  **Server-side Authorization Guard:** A dedicated server-side layout guard (`apps/web/app/[locale]/admin/layout.tsx`) was introduced. This guard performs a granular authorization check *after* middleware authentication. It retrieves the user's role (from `session.user.app_metadata` or `session.user.user_metadata`) and strictly verifies if it is either `admin` or `moderator`. If the user's role does not meet these requirements, a 403 "Access Denied" error component is rendered instead of the admin dashboard content.
3.  **Secure Session Cookie Handling:** The login page (`apps/web/app/[locale]/login/page.tsx`) was updated to use `createBrowserClient` from `@supabase/ssr`. This ensures that `HTTPOnly` session cookies are correctly set upon successful login, enabling the middleware and server components to securely read and manage user sessions.
4.  **Next.js 16 Compatibility:** Build type errors related to Next.js 16 routing `params` were resolved by properly wrapping them in a `Promise`.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Client-side route protection only | This approach would rely solely on client-side JavaScript to check user authentication/authorization and redirect. It is easily bypassable by malicious users manipulating client-side code or directly accessing routes, offering no true security against unauthorized access to sensitive UI or data. |
| API-only authorization | While essential for protecting backend data and actions, this alternative would only secure the API endpoints. It would still allow unauthenticated or unauthorized users to load and render the admin dashboard UI, even if subsequent API calls failed. This provides a poor user experience and exposes the structure of the admin interface. |
| Custom authentication logic without `@supabase/ssr` | Implementing manual session verification and role checks by directly parsing cookies or interacting with the raw Supabase client. This would introduce significant custom code, increasing the likelihood of security vulnerabilities, maintenance burden, and complexity compared to leveraging the officially supported and robust `@supabase/ssr` library. |

## Consequences

**Positive:**
-   Significantly enhanced security for the admin dashboard by implementing a multi-layered defense strategy (middleware + server-side layout guard).
-   Prevented unauthenticated and unauthorized users from accessing or rendering any part of the admin UI, improving data integrity and system security.
-   Improved user experience for unauthorized users by providing immediate redirection to login or a clear "Access Denied" message.
-   Leveraged the robust and secure session management capabilities of `@supabase/ssr`, reducing custom code and potential vulnerabilities.
-   Consolidated middleware logic into `proxy.ts`, improving code organization and maintainability.

**Trade-offs:**
-   Increased complexity in the Next.js application's middleware and server component logic due to the multi-layered authentication and authorization checks.
-   Introduced a tighter coupling to the `@supabase/ssr` library for authentication and session management within the Next.js frontend.
-   Minor performance overhead due to server-side session and role verification on every request to an admin route.

## Related Issues & PRs

-   PR #834: Fix/admin dashboard auth
-   Issue #800