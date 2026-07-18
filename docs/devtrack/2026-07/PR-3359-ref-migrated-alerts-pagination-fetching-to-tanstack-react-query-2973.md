# PR #3359 — Ref : Migrated Alerts Pagination Fetching to @tanstack/react-query#2973

> **Merged:** 2026-07-08 | **Author:** @hrx01-dev | **Area:** Frontend | **Impact Score:** 23 | **Closes:** #2973

## What Changed

We migrated the safety alerts pagination and search filtering system from a manual, state-heavy `useEffect` implementation to a declarative, robust server-state management model powered by `@tanstack/react-query`. We introduced a global `ReactQueryProvider` to wrap our application layout, refactored the custom `useAlerts` hook to leverage `useInfiniteQuery`, and cleaned up the intersection observer logic within the alerts log page to trigger page fetches natively.

## The Problem Being Solved

Prior to this refactor, our alerts pagination and search filtering logic was highly fragile and prone to synchronization bugs. We relied on manual `useState` and `useEffect` blocks to orchestrate API requests, track page numbers, append data, and handle loading states. This approach suffered from several critical issues:

1. **Race Conditions:** When a user typed rapidly in the brand or region search inputs, multiple asynchronous fetch requests were fired in quick succession. If an earlier request resolved after a later one, the UI would display stale, incorrect search results.
2. **Stale Closures & Complex State Syncing:** Managing `page`, `hasMore`, `loadingMore`, and `refreshTrigger` manually required complex dependency arrays in our `useEffect` hooks, leading to hard-to-debug stale closures and redundant API calls.
3. **Inefficient DOM Monitoring:** The infinite scroll mechanism relied on a `useEffect` that watched the `inView` state of an intersection observer. This triggered unnecessary re-renders and added boilerplate to our UI components.
4. **Lack of Caching:** Every navigation back to the alerts page forced a complete refetch of the data from page one, degrading the user experience and increasing load on our backend API.

## Files Modified

- `apps/web/app/[locale]/alerts/page.tsx`
- `apps/web/app/[locale]/components/ReactQueryProvider.tsx`
- `apps/web/app/[locale]/layout.tsx`
- `apps/web/hooks/useAlerts.ts`
- `apps/web/package.json`
- `package-lock.json`

## Implementation Details

### 1. Global Query Client Setup
We created a new client component, `ReactQueryProvider` (`apps/web/app/[locale]/components/ReactQueryProvider.tsx`), which instantiates a `QueryClient` with optimized default configurations:
```tsx
new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 60 * 1000, // 1 minute cache validity
            refetchOnWindowFocus: false, // Prevents aggressive refetching on tab focus
        },
    },
})
```
This provider was integrated into the root layout (`apps/web/app/[locale]/layout.tsx`) to wrap the entire application tree, enabling React Query's caching context across all routes.

### 2. Refactoring `useAlerts` Hook with `useInfiniteQuery`
We completely rewrote `apps/web/hooks/useAlerts.ts`. We removed all manual state variables (`allAlerts`, `loading`, `loadingMore`, `error`, `page`, `totalCount`, `hasMore`) and replaced them with a single `useInfiniteQuery` call. 

- **Query Key Configuration:** The query key is defined dynamically as `["alerts", debouncedBrandSearch, debouncedRegionSearch]`. React Query monitors these dependencies; whenever the debounced search terms change, it automatically invalidates the cache, cancels any active in-flight requests for the old key, and fetches page 1 for the new key.
- **Fetch Function (`fetchAlertsPage`):** This function receives the `pageParam` (defaulting to 1) and appends it along with the active search terms to construct the API request URL:
  ```typescript
  const fetchAlertsPage = async ({ pageParam = 1 }) => {
      let url = `${API_BASE}/api/v1/alerts?page=${pageParam}&limit=50`;
      if (debouncedBrandSearch) url += `&brand=${encodeURIComponent(debouncedBrandSearch)}`;
      if (debouncedRegionSearch) url += `&region=${encodeURIComponent(debouncedRegionSearch)}`;
      // Fetch and return data...
  };
  ```

### 3. Streamlining the UI and Intersection Observer
In `apps/web/app/[locale]/alerts/page.tsx`, we removed the manual `useEffect` that watched the intersection observer's `inView` state. Instead, we utilized the `onChange` callback option of `useInView` to trigger the fetch directly:
```typescript
const { ref: inViewRef } = useInView({
    triggerOnce: false,
    threshold: 0.1,
    rootMargin: "0px 0px 100px 0px",
    onChange: (inView) => {
        if (inView && !loadingMore && hasNextPage && !loading) {
            fetchNextPage();
        }
    },
});
```
We also removed manual page-resetting logic (`setPage(1)`) from the search input `onChange` handlers, as React Query handles key-based resets automatically. The manual refresh trigger state was replaced with React Query's native `refetch` function.

## Technical Decisions

- **React Query (`@tanstack/react-query`):** We chose React Query because it is the industry standard for managing server state in React applications. It natively solves the problem of out-of-order network responses by discarding results from queries that do not match the currently active `queryKey`.
- **Infinite Query Pattern:** Using `useInfiniteQuery` allows us to manage paginated lists as a structured array of pages (`data.pages`), which we can easily flatten for rendering. It natively exposes helper states like `hasNextPage` and `isFetchingNextPage` (mapped to `loadingMore`), eliminating manual boolean flag management.
- **Intersection Observer `onChange` Callback:** Moving the page-increment logic into the `onChange` callback of `react-intersection-observer` keeps our component declarative and prevents the execution of an extra React render cycle that was previously caused by reacting to state changes inside a `useEffect`.

## How To Re-Implement (Contributor Reference)

If you need to implement a similar infinite scroll pagination pattern for another resource (e.g., medicine logs, verification history) in our system, follow these steps:

1. **Ensure Provider Wrap:** Verify that your component is rendered within the `ReactQueryProvider` context (already configured globally in `layout.tsx`).
2. **Define the Query Key:** Always include all dynamic filters, search queries, and sorting parameters in your query key array. For example: `["resource", debouncedSearch, filterCategory]`.
3. **Implement `useInfiniteQuery`:**
   ```typescript
   const {
       data,
       fetchNextPage,
       hasNextPage,
       isFetchingNextPage,
       isLoading,
       error,
       refetch
   } = useInfiniteQuery({
       queryKey: ["resource", debouncedSearch],
       queryFn: ({ pageParam = 1 }) => fetchResource({ page: pageParam, search: debouncedSearch }),
       initialPageParam: 1,
       getNextPageParam: (lastPage) => {
           // Return the next page number, or undefined if there are no more pages
           return lastPage.nextPage ?? undefined;
       }
   });
   ```
4. **Flatten Pages for Rendering:** In your component, flatten the nested pages array to render the list:
   ```typescript
   const items = data?.pages.flatMap(page => page.data) ?? [];
   ```
5. **Bind to Intersection Observer:** Use `react-intersection-observer` with the `onChange` callback to trigger `fetchNextPage()` when the loader element enters the viewport:
   ```typescript
   const { ref } = useInView({
       onChange: (inView) => {
           if (inView && hasNextPage && !isFetchingNextPage) {
               fetchNextPage();
           }
       }
   });
   ```

## Impact on System Architecture

This migration shifts SahiDawa's frontend architecture away from imperative, client-side state synchronization toward a declarative, cache-first server-state model. 

- **Reduced Network Overhead:** By caching query results for 1 minute (`staleTime`), we prevent redundant API calls when users navigate back and forth between the alerts page and individual alert details.
- **Resilience to Network Latency:** Slow or out-of-order network responses from rural or low-bandwidth connections are now handled gracefully by React Query's built-in request cancellation and query key tracking, ensuring the UI never displays out-of-sync data.
- **Cleaner Codebase:** We eliminated over 50 lines of manual state management, dependency arrays, and effect hooks, making the codebase significantly easier to maintain and extend.

## Testing & Verification

- **Race Condition Testing:** We simulated high-latency network connections (Slow 3G) in browser developer tools and typed rapidly in the brand and region search inputs. We verified that only the results corresponding to the final search query were rendered, and all intermediate, stale requests were ignored.
- **Infinite Scroll Verification:** We verified that scrolling to the bottom of the alerts list triggers the intersection observer, calls `fetchNextPage()`, and smoothly appends the next 50 alerts without resetting scroll position or causing UI flickers.
- **Manual Refetching:** We verified that clicking the "Refresh alerts" button successfully triggers the `refetch()` method and updates the cached data.