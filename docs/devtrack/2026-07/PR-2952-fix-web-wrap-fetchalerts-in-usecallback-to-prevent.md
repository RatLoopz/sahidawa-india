# PR #2952 — fix(web): wrap fetchAlerts in useCallback to prevent pagination stale closure(closes #2777)

> **Merged:** 2026-07-02 | **Author:** @shauryavardhan1307 | **Area:** Frontend | **Impact Score:** 5 | **Closes:** #2777

## What Changed

We wrapped the `fetchAlerts` data-fetching function inside a `useCallback` hook within the alerts log page component. This ensures that the function reference remains stable across renders unless the underlying search filters change. Additionally, we updated the dependency array of the initial data-loading `useEffect` hook to depend on this memoized `fetchAlerts` function and the `refreshTrigger`, resolving stale closure issues during infinite scroll pagination.

## The Problem Being Solved

In our medicine verification platform, rural health workers rely on the alerts log page to track counterfeit or substandard drug notices. This page uses infinite scroll pagination combined with debounced search filters for medicine brands and geographic regions. 

Before this PR, `fetchAlerts` was recreated on every render. Because of this:
1. We could not safely include `fetchAlerts` in our `useEffect` dependency arrays without causing infinite re-render loops.
2. When the infinite scroll intersection observer triggered a page increment, the asynchronous execution context of the pagination handler suffered from a stale closure. It captured outdated references of the search parameters (`debouncedBrandSearch` and `debouncedRegionSearch`).
3. This resulted in race conditions and query mismatches, where scrolling down would fetch subsequent pages using empty or outdated search filters, polluting the active search results with unrelated alerts.

## Files Modified

- `apps/web/app/[locale]/alerts/page.tsx`

## Implementation Details

### 1. Memoizing the Fetcher with `useCallback`
We wrapped the `fetchAlerts` function in a `useCallback` hook. The function accepts `pageNum` (number) and an optional `append` flag (boolean):

```typescript
const fetchAlerts = useCallback(
    async (pageNum: number, append = false) => {
        try {
            let url = `${API_BASE}/api/v1/alerts?page=${pageNum}&limit=50`;
            if (debouncedBrandSearch)
                url += `&brand=${encodeURIComponent(debouncedBrandSearch)}`;
            if (debouncedRegionSearch)
                url += `&region=${encodeURIComponent(debouncedRegionSearch)}`;

            const res = await fetch(url);
            if (!res.ok) {
                setError(true);
                return;
            }
            const data = await res.json();

            if (append) {
                setAllAlerts((prev) => [...prev, ...(data.data || [])]);
            } else {
                setAllAlerts(data.data || []);
            }

            setTotalCount(data.totalCount || 0);
            setHasMore(pageNum * 50 < (data.totalCount || 0));
        } catch {
            setError(true);
        }
    },
    [debouncedBrandSearch, debouncedRegionSearch]
);
```

By declaring `[debouncedBrandSearch, debouncedRegionSearch]` as the dependency array, React only instantiates a new reference of `fetchAlerts` when the user stops typing and the debounced search terms actually change.

### 2. Streamlining the Initial Load Effect
We refactored the initial load `useEffect` to depend on the memoized `fetchAlerts` reference rather than tracking the raw debounced strings directly:

```typescript
useEffect(() => {
    const loadData = () => {
        setPage(1);
        fetchAlerts(1, false);
    };

    const timer = setTimeout(loadData, 400);
    return () => clearTimeout(timer);
}, [fetchAlerts, refreshTrigger]);
```

This guarantees that whenever a user modifies a filter, the debounced value updates, generating a new `fetchAlerts` reference, which cleanly triggers a reset to page 1 and fetches fresh data.

## Technical Decisions

- **Why `useCallback`?** 
  We chose `useCallback` to maintain referential integrity. In React, passing non-memoized functions into `useEffect` dependency arrays is an anti-pattern that leads to unstable execution loops. Memoizing the function at the source allows us to satisfy the `react-hooks/exhaustive-deps` ESLint rule safely.
- **Debounced Dependencies over Raw Inputs:**
  We explicitly bound the memoization to `debouncedBrandSearch` and `debouncedRegionSearch` rather than the raw input states. This prevents unnecessary function redeclarations and API requests on every single keystroke, which is critical for maintaining low data usage and high performance on low-tier mobile devices in rural areas.

## How To Re-Implement (Contributor Reference)

If you need to implement a similar infinite-scroll search page within the SahiDawa frontend, follow this pattern:

1. **Define State and Debounced Values:**
   Set up state hooks for your search inputs, and wrap them in a debouncing hook (e.g., `useDebounce`) to delay state updates.
2. **Implement the Memoized Fetcher:**
   Write your API fetch function inside a `useCallback`. Ensure that any state variable read inside this function (like debounced search terms or API base URLs) is declared in its dependency array.
3. **Handle Reset on Filter Change:**
   Use a `useEffect` that listens to your memoized fetcher. When the fetcher reference changes (meaning the filters changed), reset your page state to `1` and call the fetcher with `pageNum = 1` and `append = false`.
4. **Handle Infinite Scroll Append:**
   Use an Intersection Observer to detect when the user reaches the bottom of the list. When triggered, increment the page state. Use a separate `useEffect` that listens to the page state changes to call the memoized fetcher with `append = true`.

## Impact on System Architecture

This change stabilizes our client-side data fetching layer. By eliminating stale closures, we prevent out-of-order API responses from corrupting the UI state. This reduces redundant backend queries on our `/api/v1/alerts` endpoint, saving server CPU cycles and database read operations under heavy concurrent usage.

## Testing & Verification

- **Build Verification:** The Next.js production build compiled successfully using Turbopack in 11.4 seconds, and static page generation completed without any TypeScript or linting errors.
- **Behavioral Testing:** We verified that typing in the brand and region search inputs correctly resets the pagination to page 1, and scrolling down dynamically appends page 2 and beyond using the correct, active search parameters without fetching duplicate records.