# ADR — Ref : Memoized Supabase Browser Client Instantiation to Prevent Memoy Leaks #2363

> **Date:** 2026-06-24 | **PR:** #2363 | **Status:** Accepted

## Context

The Supabase browser client (`createBrowserClient`) was being instantiated directly within the render body or event handlers of several client-side React components. This led to new client instances being created on every re-render or function call, causing potential memory leaks and unnecessary performance overhead due to repeated object creation. This pattern was inefficient and could lead to an accumulation of unreferenced client objects in memory.

## Decision

The Supabase browser client instantiation was refactored to utilize React's `useMemo` hook in all affected client-side components (`Navbar.tsx`, `signup/page.tsx`, `ReportWizard.tsx`, `AuthProvider.tsx`, `login/page.tsx`). The `createBrowserClient` call is now wrapped within `useMemo`, with an empty dependency array (or stable dependencies like `supabaseUrl` and `supabaseKey`) to ensure the client instance is created only once per component lifecycle and reused across subsequent re-renders. This change ensures that all Supabase operations within a component consistently use the same cached client instance.

## Alternatives Considered

| Alternative                           | Why Rejected                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Centralized Supabase Context/Provider | While effective for global state, this approach would have required a more significant architectural change to wrap the entire application or relevant subtrees in a new provider component. The `useMemo` approach was a more targeted and less intrusive fix for existing component-level instantiations.                            |
| Custom Hook with `useRef`             | A custom hook encapsulating `useRef` to store the client instance would achieve similar memoization. However, `useMemo` is a standard React hook for memoizing values, making its intent clear and directly applicable to this use case without introducing an additional abstraction layer for a relatively simple value memoization. |

## Consequences

**Positive:**

- Prevented potential memory leaks by ensuring Supabase client instances are reused instead of repeatedly created.
- Improved application performance by reducing unnecessary object instantiation on component re-renders.
- Ensured consistency of the Supabase client state across re-renders within affected components.
- Maintained the integrity of the `@supabase/ssr` persistence logic, as the client instance itself remained unchanged.

**Trade-offs:**

- Introduced `useMemo` boilerplate to each component where the Supabase client is used, requiring explicit memoization.

## Related Issues & PRs

- PR #2363: Ref : Memoized Supabase Browser Client Instantiation to Prevent Memoy Leaks #2363
- Issue #2363
