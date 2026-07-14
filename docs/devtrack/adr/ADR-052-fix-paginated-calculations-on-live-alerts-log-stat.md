# ADR — fix: paginated calculations on Live Alerts Log stats panel (#3001)

> **Date:** 2026-07-14 | **PR:** #3592 | **Status:** Accepted

## Context

The SahiDawa Live Alerts Log displays critical metrics, specifically "Critical / Banned" alerts and "Impacted Areas" counts. Previously, these statistics were calculated client-side over the paginated `allAlerts` array. Consequently, the stats cards only reflected the subset of data loaded on the current page rather than system-wide totals. To provide accurate metrics to rural health workers, the system required a performant, filter-aware method to compute global aggregates without transferring unpaginated datasets to the client.

## Decision

We migrated the statistics calculation from the client to the database layer and updated the API to return these aggregates in the pagination metadata. 

Specifically:
1. **Database RPC:** Created a Postgres RPC `get_alerts_aggregate_stats` that computes both the total critical alerts and distinct impacted regions in a single query over the filtered, unpaginated table.
2. **Concurrent Execution:** Updated the `GET /api/v1/alerts` endpoint to execute the paginated page fetch and the aggregate RPC concurrently using `Promise.all` to minimize API latency.
3. **Graceful Degradation:** Wrapped the RPC execution so that if the stats aggregation fails, the error is logged and the API falls back to returning `0` for the stats, preventing a database timeout or RPC failure from blocking the core alert feed.
4. **Frontend Integration:** Refactored the `useAlerts` hook and the alerts page to read `totalCriticalCount` and `totalImpactedRegionsCount` directly from the API response metadata.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Client-side full fetch** (fetching all unpaginated alert records to calculate stats on the client) | Highly unscalable. As the database grows, transferring the entire dataset would cause severe network latency and memory overhead, which is unacceptable for rural health clinics operating on low-bandwidth connections. |
| **Sequential ORM/Query Builder Aggregates** (running multiple separate count and distinct queries via the Supabase JS client in the API route) | Introduced significant database round-trip latency. Executing multiple sequential queries sequentially slows down the API response compared to a single optimized database-level RPC executed in parallel. |

## Consequences

**Positive:**
- **Data Accuracy:** Stats cards now accurately reflect system-wide totals matching the active search and region filters, regardless of the active page.
- **Performance:** Offloading aggregation to a database RPC and executing it concurrently with the paginated query keeps API response times low.
- **Fault Tolerance:** Failure of the statistics RPC does not crash the endpoint, ensuring the primary alerts list remains functional.

**Trade-offs:**
- **Database Load:** Running aggregate scans (including `DISTINCT` operations) on every paginated request increases database CPU utilization.
- **Schema Maintenance:** Introducing a raw SQL Postgres RPC adds database-level schema complexity that must be managed via migrations (`supabase/migrations`).

## Related Issues & PRs

- PR #3592: fix: paginated calculations on Live Alerts Log stats panel (#3001)
- Issue #3001