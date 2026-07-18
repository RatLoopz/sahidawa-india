# PR #3647 — perf(alerts): implement redis cache-aside for aggregate stats RPC

> **Merged:** 2026-07-17 | **Author:** @yogita-mehta | **Area:** Backend | **Impact Score:** 9 | **Closes:** #3602

## What Changed

We introduced a Redis cache-aside layer for the `get_alerts_aggregate_stats` RPC call to prevent real-time database bottlenecks. This change allows our system to fetch aggregate stats concurrently with paginated data, reducing the load on our database. The cache-aside pattern ensures that our system remains responsive even when Redis is unreachable.

## The Problem Being Solved

Before this PR, our system was experiencing performance issues due to the heavy load of database queries for aggregate stats. The `get_alerts_aggregate_stats` RPC call was scanning the entire table, causing bottlenecks and slowing down our API responses. This change addresses the issue by introducing a caching layer that reduces the number of database queries.

## Files Modified

- `apps/api/src/routes/alerts.ts`

## Implementation Details

We implemented a cache-aside pattern using Redis to store aggregate stats. The `getCachedStats` function is responsible for handling the cache logic. It first attempts to fetch the cached data from Redis using a deterministic cache key built from `brand`, `region`, and `batch_number` filters. If the cache is hit, it returns the cached data. If the cache is missed or Redis is unreachable, it executes the `get_alerts_aggregate_stats` RPC call and saves the result to Redis with a 15-minute TTL. The `Promise.all` structure is preserved to ensure that paginated data and cached stats are fetched concurrently.

## Technical Decisions

We chose to use Redis as our caching layer due to its high performance and ease of integration with our existing tech stack. The cache-aside pattern was selected to ensure that our system remains responsive even when Redis is unreachable. We also decided to use a 15-minute TTL to balance the trade-off between cache freshness and database load reduction. The `try-catch` blocks were used to handle Redis errors and ensure that our system degrades gracefully.

## How To Re-Implement (Contributor Reference)

To re-implement this feature, follow these steps:
1. Install the Redis client library and import it in `alerts.ts`.
2. Create a `getCachedStats` function that takes no arguments and returns a promise that resolves with the cached stats.
3. Inside `getCachedStats`, build a deterministic cache key using `brand`, `region`, and `batch_number` filters.
4. Attempt to fetch the cached data from Redis using the cache key.
5. If the cache is missed or Redis is unreachable, execute the `get_alerts_aggregate_stats` RPC call and save the result to Redis with a 15-minute TTL.
6. Use `Promise.all` to fetch paginated data and cached stats concurrently.
7. Handle Redis errors using `try-catch` blocks to ensure graceful degradation.

## Impact on System Architecture

This change reduces the load on our database and improves the responsiveness of our API. It also unlocks future development opportunities, such as introducing more advanced caching strategies or using Redis for other use cases. The cache-aside pattern ensures that our system remains scalable and performant even under high traffic conditions.

## Testing & Verification

This change was tested by verifying that the cache is correctly populated and expired. We also tested the system's behavior when Redis is unreachable, ensuring that it degrades gracefully and falls back to direct database queries. Edge cases, such as cache key collisions and Redis connection errors, were also considered and handled accordingly. Not documented in this PR are the specific test scripts used to verify this change.