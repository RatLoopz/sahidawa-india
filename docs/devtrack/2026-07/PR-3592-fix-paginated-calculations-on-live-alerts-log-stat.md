# PR #3592 — fix: paginated calculations on Live Alerts Log stats panel (#3001)

> **Merged:** 2026-07-14 | **Author:** @yogita-mehta | **Area:** Frontend | **Impact Score:** 34 | **Closes:** #3001

## What Changed

We shifted the computation of the "Critical / Banned" and "Impacted Areas" statistics from client-side calculations over paginated data to a server-side Postgres RPC (`get_alerts_aggregate_stats`). The `GET /api/v1/alerts` endpoint was updated to execute this RPC concurrently with the paginated query using `Promise.all`. Finally, we updated the `useAlerts` hook and the React frontend to consume these system-wide aggregates directly from the API response metadata.

## The Problem Being Solved

Previously, the stats cards on the Live Alerts Log page (displaying critical/banned alerts and unique impacted regions) were calculated client-side by filtering and mapping over the `allAlerts` array. Because the alerts list uses infinite scrolling/pagination, `allAlerts` only contains the subset of records that have been loaded into the client's memory so far (e.g., the first 10 or 20 items). 

This resulted in highly inaccurate, misleading statistics that changed dynamically as the user scrolled down, failing to represent the true system-wide scale of critical alerts and impacted states across India.

## Files Modified

- `apps/api/src/routes/alerts.ts`
- `apps/api/tests/alertsPagination.test.ts`
- `apps/web/app/[locale]/alerts/page.tsx`
- `apps/web/hooks/useAlerts.ts`
- `supabase/migrations/20260713120000_add_alerts_aggregate_stats_rpc.sql`

## Implementation Details

### Database Layer
We introduced a new migration file `20260713120000_add_alerts_aggregate_stats_rpc.sql` which defines the Postgres RPC `get_alerts_aggregate_stats`. This function accepts optional filters (`p_brand`, `p_region`, `p_batch_number`) and returns an aggregate record containing `totalCriticalCount` and `totalImpactedRegionsCount` calculated over the entire filtered table.

### API Layer (`apps/api/src/routes/alerts.ts`)
We modified the `GET /` route handler in `alertsRouter`. Instead of just querying the paginated alerts, we now use `Promise.all` to run the paginated query and the `supabase.rpc("get_alerts_aggregate_stats", ...)` call concurrently:

```typescript
const [pageResult, statsResult] = await Promise.all([
    query.order("created_at", { ascending: false }).range(offset, offset + limit - 1),
    supabase.rpc("get_alerts_aggregate_stats", {
        p_brand: brand || null,
        p_region: region || null,
        p_batch_number: batchNumber || null,
    }),
]);
```

If the RPC fails, we log the error using our `logger.error` utility but do not crash the request. We default the stats to `0` and still return the paginated alert list, ensuring graceful degradation.

### React Hook (`apps/web/hooks/useAlerts.ts`)
We updated the `useAlerts` hook (which wraps `@tanstack/react-query`'s `useInfiniteQuery`) to extract `totalCriticalCount` and `totalImpactedRegionsCount` from the first page of the response metadata (`data?.pages[0]`) and expose them to the consuming components.

### Frontend UI (`apps/web/app/[locale]/alerts/page.tsx`)
We removed the client-side `.filter()` and `Set` mapping logic (`criticalCount` and `uniqueRegionsCount`). We replaced them with the values returned by `useAlerts`:

```typescript
const {
    allAlerts,
    loading,
    totalCount,
    totalCriticalCount,
    totalImpactedRegionsCount,
    // ...
} = useAlerts({ debouncedBrandSearch, debouncedRegionSearch });
```

## Technical Decisions

- **Postgres RPC over Multiple Queries:** We chose to implement a single database RPC (`get_alerts_aggregate_stats`) to compute both aggregates in a single pass over the table. This avoids making multiple roundtrips to the database or executing heavy client-side JS.
- **Concurrent Execution (`Promise.all`):** To minimize API latency, we execute the paginated query and the RPC concurrently. Since they are independent operations, running them in parallel prevents head-of-line blocking.
- **Graceful Degradation:** The stats panel is a secondary visual aid. If the RPC fails due to database load or a transient issue, we must not block the user from seeing the actual alert log. Thus, we catch RPC errors, log them, and fallback to `0` for stats.

## How To Re-Implement (Contributor Reference)

If you need to implement a similar system-wide stats panel for another paginated resource, follow these steps:

1. **Write the SQL Migration:** Define a Postgres RPC that accepts your filter parameters and returns the aggregated counts. Ensure it handles null values for filters gracefully.
2. **Update the API Route:** Inside the GET route handler, extract query parameters and pass them to the RPC call.
3. **Execute Concurrently:** Wrap the paginated query and the RPC call in `Promise.all`. Handle potential errors from the RPC independently so they don't reject the entire promise chain.
4. **Return Metadata:** Return the aggregated counts in the JSON response payload alongside pagination metadata.
5. **Update the Hook:** Update the frontend hook to read these new fields from the API response and return them.
6. **Update the Component:** Update the React component to display these values directly, removing any client-side array manipulation.

## Impact on System Architecture

- **Performance:** Shifts computational load from the client's browser to the database, which is highly optimized for aggregate operations.
- **Consistency:** Establishes a pattern for handling system-wide statistics on paginated dashboards within SahiDawa, ensuring that UI metrics remain accurate regardless of pagination state.

## Testing & Verification

We added 3 new test cases in `apps/api/tests/alertsPagination.test.ts` using `supertest` and `jest`:

1. **System-wide Totals:** Verifies that system-wide totals are correctly returned from the RPC even when the page size is small.
2. **Filter Pass-through:** Verifies that filters (brand, region, batch number) are correctly passed through to the RPC.
3. **Graceful Degradation:** Verifies that the API degrades gracefully to zero counts when the RPC fails, ensuring the main alert list still loads.

All 19 tests in `alertsPagination.test.ts` pass, and `tsc --noEmit` runs clean on both `apps/api` and `apps/web`.