# PR #834 — Fix/admin dashboard auth

> **Merged:** 2026-05-29 | **Author:** @Suyash2527 | **Area:** Frontend | **Impact Score:** 16 | **Closes:** #800

## What Changed

This PR significantly enhances the security of our SahiDawa admin dashboard by implementing a robust, multi-layered authentication and authorization system. We introduced Next.js middleware to prevent unauthenticated access to `/[locale]/admin/*` routes, redirecting users to the login page. Additionally, a server-side route guard was added within the admin layout to enforce role-based access, ensuring only users with `admin` or `moderator` roles can view the dashboard content, otherwise rendering an access denied message.

## The Problem Being Solved

Prior to this PR, the admin dashboard routes (`/[locale]/admin/*`) lacked strict, server-side authentication and authorization checks. An unauthenticated user could potentially navigate directly to these routes, leading to unauthorized access to sensitive administrative interfaces. While some client-side checks might have existed, they are insufficient for true security. The core problem was a missing, robust, server-side mechanism to verify user sessions and roles *before* rendering any part of the admin UI, leaving a critical security vulnerability (tracked in #800).

## Files Modified

- `apps/web/app/[locale]/admin/layout.tsx`
- `apps/web/app/[locale]/login/page.tsx`
- `apps/web/package.json`
- `apps/web/proxy.ts`
- `package-lock.json`

## Implementation Details

The implementation introduces a two-pronged approach to secure the admin dashboard:

1.  **Next.js Middleware for Authentication (`apps/web/proxy.ts`):**
    *   We integrated the authentication logic directly into our existing `next-intl` middleware file, `apps/web/proxy.ts`, to avoid duplicate middleware files and ensure internationalization and authentication run in sequence.
    *   The `middleware` function now first processes the `next-intl` routing via `intlMiddleware(req)`.
    *   We then initialize a Supabase client using `@supabase/ssr`'s `createServerClient` function. This client is configured to read and set cookies from the incoming `NextRequest` and the outgoing `NextResponse` (which is `res` from `intlMiddleware`). This ensures secure, `HTTPOnly` session cookie management on the server.
    *   Environment variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are used, with fallbacks to `http://localhost:54321` and `local-development-key` for local development environments.
    *   `supabase.auth.getSession()` is called to retrieve the user's session.
    *   A regular expression `(/^\/[a-z]{2}\/admin\//.test(pathname) || /^\/[a-z]{2}\/admin$/.test(pathname))` is used to match all admin routes (e.g., `/en/admin`, `/en/admin/dashboard`).
    *   If a request targets an admin route and `session` is `null` (meaning the user is unauthenticated), we construct a redirect `NextResponse` to `/${locale}/login`, effectively preventing access.
    *   If the user is authenticated or the route is not an admin route, the original `res` from the `next-intl` middleware is returned.

2.  **Server-Side Layout Guard for Authorization (`apps/web/app/[locale]/admin/layout.tsx`):**
    *   A new `AdminLayout` component was created to wrap all admin pages. This component is an `async` Server Component.
    *   It receives `children` (the page content) and `params` (including `locale`). A critical fix for Next.js 16 build type errors was applied here by typing `params` as `Promise<{ locale: string }>`, and then `await`ing `resolvedParams = await params`.
    *   Similar to the middleware, `createServerClient` is used with `cookies()` from `next/headers` to securely access and manage session cookies on the server.
    *   It first checks if a `session` exists. If not, it uses `redirect()` from `next/navigation` to send the user to `/${resolvedParams.locale}/login`. This acts as a secondary, more immediate authentication check within the UI rendering flow.
    *   If a session exists, it then extracts the user's `role` from `session.user.app_metadata?.role` or `session.user.user_metadata?.role`.
    *   An authorization check is performed: `if (role !== "admin" && role !== "moderator")`.
    *   If the user's role is neither `admin` nor `moderator`, a custom "Access Denied" UI is rendered, providing a clear message and a link back to the home page. This prevents unauthorized roles from seeing any admin content.
    *   Only if the user is authenticated *and* has the correct role (`admin` or `moderator`) are the `children` (the actual admin page content) rendered.

3.  **Supabase Browser Client Update (`apps/web/app/[locale]/login/page.tsx`):**
    *   The `LoginPage` component was updated to use `@supabase/ssr`'s `createBrowserClient` instead of `@supabase/supabase-js`'s `createClient`.
    *   This change is crucial because `createBrowserClient` is designed to work seamlessly with `HTTPOnly` session cookies managed by the server-side `createServerClient` and middleware. It ensures that after a successful login, the session cookies are correctly set and accessible by the middleware and server components.
    *   Fallback environment variables are also added here for consistency.

4.  **Dependency Update (`apps/web/package.json`, `package-lock.json`):**
    *   The `@supabase/ssr` package (version `0.10.3`) was added as a dependency to `apps/web/package.json` to enable the server-side rendering and middleware capabilities for Supabase authentication.
    *   `package-lock.json` was updated accordingly to reflect this new dependency and its transitive dependencies.

## Technical Decisions

1.  **Choice of `@supabase/ssr`:** We opted for `@supabase/ssr` because it provides first-class support for Next.js Server Components and middleware, enabling secure, server-side session management using `HTTPOnly` cookies. This is critical for preventing client-side script access to session tokens, significantly enhancing security compared to client-side storage. It also simplifies the integration of Supabase authentication across both server and client environments in a Next.js application.
2.  **Layered Security (Middleware + Layout Guard):** We implemented both a Next.js middleware and a server-side layout guard for the admin routes.
    *   The **middleware** acts as the first line of defense, intercepting requests *before* any page component rendering begins. Its primary role is to quickly redirect unauthenticated users, minimizing resource usage for unauthorized requests.
    *   The **layout guard** in `apps/web/app/[locale]/admin/layout.tsx` provides a second, more granular layer. It performs the role-based authorization check and renders a custom "Access Denied" UI, offering a better user experience than a generic redirect if authentication passes but authorization fails. This separation of concerns (authentication in middleware, authorization/custom UI in layout) makes the system robust and maintainable.
3.  **Merging Middleware into `proxy.ts`:** Instead of creating a separate `middleware.ts` file, we merged the authentication logic into the existing `apps/web/proxy.ts` file, which handles `next-intl` routing. This decision was made to avoid potential conflicts or complex ordering issues that could arise from having multiple middleware files. By combining them, we ensure that internationalization and authentication logic are processed sequentially within a single middleware chain.
4.  **Handling Next.js 16 `params` as `Promise`:** The decision to wrap `params` in `Promise<{ locale: string }>` within `apps/web/app/[locale]/admin/layout.tsx` was a direct response to a build type error encountered with Next.js 16. This indicates a change in how Next.js 16 handles dynamic route parameters in Server Components, requiring them to be awaited. This ensures compatibility and correct type inference.
5.  **Environment Variable Fallbacks:** Providing fallback values for Supabase environment variables (`"http://localhost:54321"`, `"local-development-key"`) in both `createServerClient` and `createBrowserClient` calls is a best practice. It ensures that the application can run seamlessly in local development environments even if these variables are not explicitly set, improving developer experience.

## How To Re-Implement (Contributor Reference)

To re-implement or extend this secure admin dashboard pattern, follow these steps:

1.  **Install `@supabase/ssr`:**
    ```bash
    npm install @supabase/ssr
    # or yarn add @supabase/ssr
    ```
    Ensure `package.json` and `package-lock.json` are updated.

2.  **Update Login Page to use `createBrowserClient`:**
    Modify `apps/web/app/[locale]/login/page.tsx` (or your equivalent login page) to initialize Supabase using `createBrowserClient` from `@supabase/ssr`. This is crucial for `HTTPOnly` cookie management.
    ```typescript
    import { createBrowserClient } from "@supabase/ssr";
    // ... other imports
    
    export default function LoginPage() {
        // ...
        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321",
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "local-development-key"
        );
        // ... rest of your login logic
    }
    ```

3.  **Implement Next.js Middleware for Authentication:**
    Integrate the authentication check into your main `middleware.ts` or `proxy.ts` file.
    ```typescript
    // apps/web/proxy.ts (or middleware.ts)
    import createMiddleware from 'next-intl/middleware';
    import { routing } from './i18n/routing'; // Adjust path as needed
    import { createServerClient } from '@supabase/ssr';
    import { NextResponse } from 'next/server';
    import type { NextRequest } from 'next/server';
    
    const intlMiddleware = createMiddleware(routing); // If using next-intl
    
    export default async function middleware(req: NextRequest) {
      let res = intlMiddleware(req); // Run next-intl middleware first
      
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "local-development-key",
        {
          cookies: {
            getAll() { return req.cookies.getAll(); },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
              cookiesToSet.forEach(({ name, value, options }) =>
                res.cookies.set(name, value, options)
              );
            },
          },
        }
      );
      
      const { data: { session } } = await supabase.auth.getSession();
      const { pathname } = req.nextUrl;
      
      // Define your protected routes pattern
      if (/^\/[a-z]{2}\/admin\//.test(pathname) || /^\/[a-z]{2}\/admin$/.test(pathname)) {
        if (!session) {
          const locale = pathname.split("/")[1] ?? "en"; // Extract locale from path
          return NextResponse.redirect(new URL(`/${locale}/login`, req.url));
        }
      }
    
      return res;
    }
    
    export const config = {
      matcher: ['/', '/(ta|en|bn|te|mr|gu|ur|od|hi|kn|pa)/:path*'] // Adjust matcher as needed
    };
    ```
    **Gotcha:** Ensure `res.cookies.set` is used to propagate cookie changes back to the client.

4.  **Create a Server-Side Layout Guard for Authorization:**
    Create a `layout.tsx` file within your protected route segment (e.g., `apps/web/app/[locale]/admin/layout.tsx`).
    ```typescript
    // apps/web/app/[locale]/admin/layout.tsx
    import { createServerClient } from "@supabase/ssr";
    import { cookies } from "next/headers";
    import { redirect } from "next/navigation";
    import { ShieldAlert } from "lucide-react"; // Or your preferred icon
    import Link from "next/link";
    
    export default async function AdminLayout({
      children,
      params, // Important: type as Promise for Next.js 16+
    }: {
      children: React.ReactNode;
      params: Promise<{ locale: string }>; // Fix for Next.js 16 build errors
    }) {
      const resolvedParams = await params; // Await params
      const cookieStore = await cookies();
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "local-development-key",
        {
          cookies: {
            getAll() { return cookieStore.getAll(); },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieStore.set(name, value, options)
                );
              } catch {
                // Ignored in Server Component - cookies are read-only after first render
              }
            },
          },
        }
      );
      const { data: { session } } = await supabase.auth.getSession();
    
      if (!session) {
        redirect(`/${resolvedParams.locale}/login`); // Redirect if not authenticated
      }
    
      const role = session.user.app_metadata?.role || session.user.user_metadata?.role;
    
      if (role !== "admin" && role !== "moderator") {
        // Render access denied UI if unauthorized role
        return (
          <div className="flex min-h-screen items-center justify-center bg-slate-50 font-sans">
            {/* ... your access denied UI ... */}
            <h1 className="mb-2 text-xl font-bold text-slate-900">Access Denied</h1>
            <p className="mb-6 text-sm text-slate-500">
              You do not have the required permissions to view the admin dashboard.
              Must be an admin or moderator.
            </p>
            <Link href={`/${resolvedParams.locale}/`} className="inline-flex w-full justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800">
              Return to Home
            </Link>
          </div>
        );
      }
    
      return <>{children}</>; // Render children if authenticated and authorized
    }
    ```
    **Gotcha:** The `cookies.setAll` in a Server Component `createServerClient` might throw an error because cookies are read-only after the initial render. The `try...catch` block handles this gracefully, as the primary cookie setting happens in the middleware.

## Impact on System Architecture

This change significantly strengthens the security posture of the SahiDawa platform, particularly for administrative functions.
1.  **Enhanced Security:** By implementing server-side authentication and role-based authorization, we have closed a critical vulnerability, ensuring that sensitive admin areas are protected against unauthorized access. This aligns with best practices for web application security.
2.  **Standardized Auth Pattern:** We have established a clear and robust pattern for protecting routes in Next.js using `@supabase/ssr` with both middleware and layout guards. This pattern can now be easily replicated for other protected areas of the application, such as user profiles or specific feature dashboards.
3.  **Leveraging Next.js Features:** The solution effectively utilizes Next.js's powerful features like middleware, Server Components, and dynamic routing, demonstrating a mature approach to application development within the framework.
4.  **Improved Maintainability:** By centralizing authentication logic in the middleware and authorization logic in the layout, we've created a more modular and maintainable codebase. Future changes to authentication or authorization rules can be managed in these specific locations.
5.  **Foundation for Future Features:** This secure foundation unlocks the ability to develop more complex administrative tools and features with confidence, knowing that the underlying access control is robust.

## Testing & Verification

The changes were thoroughly tested and verified as follows:

1.  **Unauthenticated Access Redirection:**
    *   An unauthenticated browser attempting to navigate to `/en/admin/dashboard` (or any `/[locale]/admin/*` route) was successfully redirected to `/en/login`. This was confirmed via browser network logs and visual inspection, as demonstrated by the provided screenshot showing the login page after attempting to access the admin dashboard.
2.  **Authenticated, Unauthorized Role Access:**
    *   A user authenticated with a role other than `admin` or `moderator` (e.g., a regular `user` role) attempting to access `/[locale]/admin/*` routes was presented with the custom "Access Denied" UI, as implemented in `apps/web/app/[locale]/admin/layout.tsx`. This verified the role-based authorization check.
3.  **Authenticated, Authorized Role Access:**
    *   A user authenticated with an `admin` or `moderator` role was able to successfully access and view the admin dashboard content, confirming that authorized users are not blocked.
4.  **Build Process Verification:**
    *   The `next build` command was executed successfully, as shown in the provided terminal logs, indicating that the Next.js 16 type errors related to `params` in `layout.tsx` were resolved and the application compiles without issues.
5.  **Local Development Environment:**
    *   The application was run locally, and the fallback environment variables for Supabase were confirmed to allow the application to function correctly without explicit `.env` configuration for Supabase keys.

**Edge Cases:**
*   **Missing Session Data:** Handled by redirecting to login.
*   **Missing Role Data:** If `session.user.app_metadata?.role` and `session.user.user_metadata?.role` are both undefined, the user will be treated as unauthorized and shown the "Access Denied" page, which is the desired secure-by-default behavior.
*   **Locale Handling:** The locale is correctly extracted from the URL for redirects, ensuring users are sent to the login page in their preferred language.