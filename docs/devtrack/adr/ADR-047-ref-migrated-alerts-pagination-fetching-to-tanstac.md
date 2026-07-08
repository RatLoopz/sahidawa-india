# ADR — Ref : Migrated Alerts Pagination Fetching to @tanstack/react-query#2973

> **Date:** 2026-07-08 | **PR:** #3359 | **Status:** Accepted

## Context

The SahiDawa alerts page displays critical drug recalls, counterfeit warnings, and banned formulations. Previously, pagination, infinite scrolling, and search filtering were managed manually using React's `useState` and multiple `useEffect` hooks in `useAlerts.ts` and `page.tsx`. 

This manual implementation was prone to race conditions (especially when typing quickly in search filters), stale closures, complex state synchronization, and redundant API calls. Additionally, an Intersection Observer was monitored via a `useEffect` hook to increment page numbers, which added fragile side-effect chains and made the codebase difficult to maintain.

## Decision

We migrated the alerts fetching and pagination logic to `@tanstack/react-query` using the `useInfiniteQuery` hook. 

Specifically, we:
- Replaced manual state tracking (`allAlerts`, `loading`, `loadingMore`, `hasMore`, `refreshTrigger`, `page`) with React Query's native state management (`data.pages`, `isLoading`, `isFetchingNextPage`, `hasNextPage`, `refetch`).
- Configured the query key as `["alerts", debouncedBrandSearch, debouncedRegionSearch]`. This leverages React Query's automatic query invalidation and refetching when search inputs change, eliminating manual page resets.
- Leveraged React Query's built-in request cancellation and deduplication to prevent race conditions from rapid keystrokes.
- Refactored the infinite scroll trigger by moving the page-fetching logic directly into the `onChange` callback of the `useInView` hook, removing the secondary `useEffect` block.
- Integrated `ReactQueryProvider` at the application root level to manage the query client lifecycle.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Manual AbortController & State Guards** | High maintenance overhead. Writing custom logic to handle race conditions, caching, and pagination states is error-prone and duplicates features already optimized in established libraries. |
| **SWR (`useSWRInfinite`)** | While lightweight, SWR lacks some of the robust out-of-the-box devtools, mutation handling, and granular query key dependency tracking features provided by TanStack Query, which are critical for SahiDawa's scaling architecture. |

## Consequences

**Positive:**
- Eliminated race conditions and stale closures during rapid search filter changes.
- Simplified codebase by removing multiple fragile `useEffect` hooks and manual state variables.
- Improved UX with automatic request cancellation for stale in-flight search queries.
- Standardized data fetching patterns by introducing React Query to the application architecture.

**Trade-offs:**
- Introduced a new external dependency (`@tanstack/react-query`) and increased the initial bundle size.
- Requires wrapping the application layout in a `ReactQueryProvider`, adding a layer of provider nesting.

## Related Issues & PRs

- PR #3359: Ref : Migrated Alerts Pagination Fetching to @tanstack/react-query#2973
- Issue #2973