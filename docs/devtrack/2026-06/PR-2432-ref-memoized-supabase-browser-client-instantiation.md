# PR #2432 — Ref : Memoized Supabase Browser Client Instantiation to Prevent Memoy Leaks #2363

> **Merged:** 2026-06-24 | **Author:** @hrx01-dev | **Area:** Frontend | **Impact Score:** 18 | **Closes:** #2363

## What Changed

This pull request refactors the instantiation of the Supabase browser client (`createBrowserClient` from `@supabase/ssr`) across several key client-side React components. We now wrap the client creation in the `useMemo` React hook in `Navbar.tsx`, `signup/page.tsx`, `ReportWizard.tsx`, and `AuthProvider.tsx`. This ensures that a single, memoized instance of the Supabase client is reused across component re-renders, rather than being re-instantiated unnecessarily.

## The Problem Being Solved

Prior to this PR, the `createBrowserClient` function was often called directly within component render bodies, `useEffect` hooks, or event handlers without memoization. In React, components can re-render frequently due to state changes, prop updates, or context changes. Each re-render or repeated execution of an effect/handler would potentially create a _new_ instance of the Supabase client. While not always immediately apparent, this repeated instantiation can lead to increased memory consumption, potential memory leaks (if old instances are not properly garbage collected or hold onto resources), and unnecessary overhead, especially in long-lived components or frequently interacted-with UI elements like the `Navbar`. The linked issue #2363 specifically highlighted the concern of memory leaks.

## Files Modified

- `apps/web/app/[locale]/components/Navbar.tsx`
- `apps/web/app/[locale]/signup/page.tsx`
- `apps/web/components/reports/ReportWizard.tsx`
- `apps/web/src/components/AuthProvider.tsx`

## Implementation Details

We have refactored the instantiation of the Supabase browser client in four critical frontend components to leverage React's `useMemo` hook.

1.  **`apps/web/app/[locale]/components/Navbar.tsx`**:
    - The `useMemo` hook was imported: `import React, { useEffect, useRef, useState, useMemo } from "react";`.
    - The Supabase client is now instantiated once at the top level of the `Navbar` functional component:
        ```typescript
        const supabase = useMemo(
            () => createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey()),
            []
        );
        ```
    - The dependency array `[]` ensures that the `createBrowserClient` function is called only once when the component mounts.
    - The `handleLogout` asynchronous function, which previously created its own `supabase` instance, now correctly uses this memoized `supabase` reference for `supabase.auth.signOut()`.

2.  **`apps/web/app/[locale]/signup/page.tsx`**:
    - The `useMemo` hook was imported: `import { useState, useMemo } from "react";`.
    - The Supabase client is now instantiated once at the top level of the `SignUpPage` functional component:
        ```typescript
        const supabase = useMemo(
            () => createBrowserClient(supabaseUrl, supabaseKey),
            [supabaseUrl, supabaseKey]
        );
        ```
    - The dependency array `[supabaseUrl, supabaseKey]` ensures that the `createBrowserClient` function is re-executed only if the `supabaseUrl` or `supabaseKey` environment variables change. In a typical client-side context, these are static after initial load, effectively making it a single instantiation.

3.  **`apps/web/components/reports/ReportWizard.tsx`**:
    - The `useMemo` hook was imported: `import React, { useState, useEffect, useId, useMemo } from "react";`.
    - The Supabase client is now instantiated once at the top level of the `ReportWizard` functional component:
        ```typescript
        const supabase = useMemo(() => {
            if (typeof window !== "undefined") {
                try {
                    return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
                } catch {
                    return null;
                }
            }
            return null;
        }, []);
        ```
    - This `useMemo` callback includes a `typeof window !== "undefined"` check and a `try-catch` block to gracefully handle environments where `window` might not be defined (e.g., during server-side rendering, though this component is client-side) or instantiation errors. It returns `null` if the client cannot be created.
    - The dependency array `[]` ensures single instantiation.
    - The `onSubmit` handler now checks `if (supabase)` before attempting to call `supabase.auth.getSession()`, ensuring it only proceeds if a valid client instance is available.

4.  **`apps/web/src/components/AuthProvider.tsx`**:
    - The `useMemo` hook was imported: `import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from "react";`.
    - The Supabase client is now instantiated once at the top level of the `AuthProvider` functional component:
        ```typescript
        const supabase = useMemo(
            () => createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey()),
            []
        );
        ```
    - The dependency array `[]` ensures single instantiation.
    - The `useEffect` hook, responsible for fetching the session, now directly uses this memoized `supabase` instance:
        ```typescript
        useEffect(() => {
            supabase.auth.getSession().then(({ data }) => {
                const s = data.session ?? null;
                setSession(s);
                setIsLoading(false);
            });
            const { data: authListener } = supabase.auth.onAuthStateChange((event, newSession) => {
                setSession(newSession);
            });
            return () => {
                authListener?.unsubscribe();
            };
        }, []); // Dependency array for useEffect remains empty as supabase is stable.
        ```

In all cases, the core functionality of the Supabase client, such as token handling, API requests, and `@supabase/ssr` persistence logic, remains unchanged. The refactor purely optimizes the client's instantiation strategy.

## Technical Decisions

We chose to use React's `useMemo` hook for several reasons:

1.  **Performance Optimization**: `useMemo` is specifically designed for memoizing expensive computations. Instantiating a Supabase client, which involves setting up network connections and potentially internal state, can be considered an "expensive" operation if done repeatedly. By memoizing it, we ensure it's only created once per component instance, reducing CPU cycles and memory allocations on subsequent re-renders.
2.  **Memory Leak Prevention**: Repeatedly creating new objects without proper cleanup can lead to memory leaks, especially in single-page applications that run for extended periods. By ensuring a single instance, we mitigate this risk, aligning with the goal of linked issue #2363.
3.  **Consistency and Predictability**: Using a single, stable instance of the Supabase client throughout a component's lifecycle makes its behavior more predictable. It avoids potential issues where different parts of a component might inadvertently operate on different client instances.
4.  **Idiomatic React**: `useMemo` is the standard React hook for memoizing values. Its use here aligns with best practices for optimizing functional components.
5.  **Minimal Impact on Logic**: This refactor focuses solely on _how_ the client is instantiated, not _what_ it does. This allowed us to achieve the performance and memory benefits without altering the existing authentication or data fetching logic, minimizing the risk of introducing new bugs.

Alternatives considered:

- **Singleton Pattern (outside React)**: We could have implemented a global singleton pattern for the Supabase client. However, this would require managing the client's lifecycle outside of React's component model, potentially complicating server-side rendering (SSR) scenarios where a new client instance might be needed per request. `createBrowserClient` from `@supabase/ssr` is designed to work well within React components and Next.js's architecture, making `useMemo` a more integrated solution.
- **`useRef`**: While `useRef` can also hold a mutable value that persists across renders, `useMemo` is semantically more appropriate for memoizing the _result_ of a computation that should only run when its dependencies change. `useRef` is typically used for mutable values that don't trigger re-renders or for direct DOM manipulation.

## How To Re-Implement (Contributor Reference)

To re-implement the memoized Supabase browser client instantiation:

1.  **Identify Client-Side Components**: Locate any React functional components within `apps/web` that directly call `createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey())` in their render body, `useEffect` hooks, or event handlers.
2.  **Import `useMemo`**: Add `useMemo` to the React import statement:
    ```typescript
    import React, { useState, useEffect, useMemo } from "react";
    ```
3.  **Move Instantiation to `useMemo`**: Extract the `createBrowserClient` call and wrap it within a `useMemo` hook at the top level of your functional component.
    - **For static dependencies**: If `getSupabaseUrl()` and `getSupabaseAnonKey()` are expected to be constant throughout the component's lifecycle (which is typical for environment variables), use an empty dependency array `[]`:
        ```typescript
        const supabase = useMemo(
            () => createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey()),
            []
        );
        ```
    - **For dynamic dependencies**: If the `supabaseUrl` or `supabaseKey` could theoretically change (e.g., if they were props or state), include them in the dependency array:
        ```typescript
        const supabaseUrl = getSupabaseUrl(); // Or from props/state
        const supabaseKey = getSupabaseAnonKey(); // Or from props/state
        const supabase = useMemo(
            () => createBrowserClient(supabaseUrl, supabaseKey),
            [supabaseUrl, supabaseKey]
        );
        ```
4.  **Handle SSR/Window Context (if applicable)**: For components that might be rendered in an SSR context or where `createBrowserClient` might fail, consider adding a `typeof window !== "undefined"` check and a `try-catch` block within the `useMemo` callback, returning `null` if the client cannot be created. Then, ensure subsequent calls to `supabase` methods are guarded (e.g., `if (supabase) { supabase.auth.getSession(); }`).
    ```typescript
    const supabase = useMemo(() => {
        if (typeof window !== "undefined") {
            try {
                return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
            } catch (error) {
                console.error("Failed to create Supabase client:", error);
                return null;
            }
        }
        return null;
    }, []);
    ```
5.  **Replace Existing Calls**: Ensure all previous direct calls to `createBrowserClient` within the component (e.g., inside `useEffect` or event handlers) are replaced with the new `supabase` constant.
6.  **Review `useEffect` Dependencies**: If the `supabase` instance was previously created inside a `useEffect`, ensure that the `useEffect`'s dependency array is updated. If the `supabase` instance is now memoized with `[]`, it becomes a stable reference and typically does not need to be included in `useEffect` dependency arrays unless other dependencies require it.

**Gotchas**:

- Ensure the dependency array for `useMemo` is correct. An empty array `[]` means the value is computed once. Including dependencies means it recomputes only when those dependencies change.
- Be mindful of server-side rendering. `createBrowserClient` is intended for client-side use. If a component can render on the server, the `typeof window !== "undefined"` guard is crucial.
- `createBrowserClient` errors: While `ReportWizard.tsx` includes a `try-catch` block, other components do not. For maximum robustness, consider adding error handling within the `useMemo` callback for all client instantiations.

## Impact on System Architecture

This change primarily impacts the frontend performance and resource management within the `apps/web` Next.js application.

- **Improved Performance and Stability**: By reducing redundant object instantiations, we decrease the computational load on the client, potentially leading to smoother user experiences and reduced chances of memory-related performance degradation over long usage sessions. This is particularly important for core components like `Navbar` and `AuthProvider` that are always present or frequently interacted with.
- **Reduced Memory Footprint**: Preventing the creation of multiple Supabase client instances helps in maintaining a lower memory footprint for the application, especially on devices with limited resources, which is relevant for our rural health platform users.
- **Enhanced Code Maintainability**: The code becomes cleaner and more idiomatic React, making it easier for new contributors to understand the intended lifecycle of the Supabase client.
- **No Change to Backend or API**: This refactor is purely client-side. It does not alter how our application interacts with the Supabase backend API, nor does it change the authentication flow or data persistence mechanisms provided by `@supabase/ssr`. The `supabase.auth.getSession()` and `supabase.auth.signOut()` calls continue to function identically, just using a more efficiently managed client instance.
- **Foundation for Future Optimizations**: Establishing this pattern for resource management sets a precedent for how other expensive client-side resources should be handled, promoting a more robust and performant frontend architecture.

## Testing & Verification

The PR description states that the impacted components render successfully without crashes, and that component functions like `supabase.auth.signOut()` or `supabase.auth.getSession()` continue to point to the cached `useMemo` reference, keeping the internal `@supabase/ssr` persistence logic flawlessly intact.

Specific verification steps would have included:

1.  **Manual UI Testing**: Navigating through the application to ensure `Navbar` functionality (e.g., logout), `signup` page submission, and `ReportWizard` interactions (e.g., form submission requiring session token) work as expected.
2.  **Browser Developer Tools**: Monitoring memory usage in the browser's developer tools to observe if the memory footprint remains stable or decreases over time, especially after repeated component re-renders or interactions.
3.  **Console Logs**: Checking for any errors or warnings related to Supabase client instantiation or usage in the browser console.
4.  **Authentication Flow**: Verifying that user login, session retrieval, and logout processes function correctly, indicating that the memoized Supabase client is correctly managing authentication state.

**Edge Cases**:

- **Environment Variable Changes**: While unlikely in a client-side context, if `supabaseUrl` or `supabaseKey` were to dynamically change during runtime, the `useMemo` with `[supabaseUrl, supabaseKey]` dependency array in `signup/page.tsx` would correctly re-instantiate the client. For components using `[]`, a full page reload would be required to pick up new environment variables.
- **SSR Context**: The `ReportWizard.tsx` component explicitly handles `typeof window !== "undefined"`, which is a good practice for components that might be rendered on the server, even if primarily client-side. Other components implicitly assume a browser environment for `createBrowserClient`.
- **`createBrowserClient` Errors**: The `ReportWizard.tsx` also includes a `try-catch` block, making it more resilient to potential errors during client instantiation. Other components do not explicitly catch errors during `createBrowserClient` calls within `useMemo`, assuming successful instantiation.
