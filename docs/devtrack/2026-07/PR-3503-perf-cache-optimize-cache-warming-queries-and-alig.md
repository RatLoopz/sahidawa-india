# PR #3503 — perf(cache): optimize cache warming queries and align unit tests

> **Merged:** 2026-07-12 | **Author:** @Avinash-sdbegin | **Area:** Backend | **Impact Score:** 8 | **Closes:** #3482

## What Changed

We optimized the cache warming routine in our system by replacing two sequential Supabase queries with a single database query using PostgREST logical `OR` filters. This change reduces the number of database queries, improving performance. Additionally, we updated the related unit tests to validate the new query flow while preserving the existing cache warming behavior.

## The Problem Being Solved

Before this PR, our cache warming process executed two separate queries to fetch medicines by generic name and brand name, resulting in increased database load and slower cache warming times. This inefficiency led to performance issues, particularly when dealing with a large number of medicines.

## Files Modified

- `apps/api/src/services/cache.service.ts`
- `apps/api/tests/cache.service.test.ts`

## Implementation Details

In `cache.service.ts`, we modified the `warmCache` function to use a single Supabase query with an `OR` filter to fetch medicines that match either the generic name or the brand name. We achieved this by creating a formatted string for the `OR` filter using the `genericNames` and `brandNames` arrays. The `supabase.or` method is then used to execute the query with the formatted filter. We also deduplicated the fetched medicines by their `id` before populating the Redis cache.

The `TTL_TIERS` object was updated to calculate the `VOICE` cache TTL in seconds, defaulting to 30 days if the `VOICE_CACHE_TTL_SECONDS` environment variable is not set. The `getCacheStats` function was modified to fetch cache statistics, including hits, misses, and tiered hits, in a single Redis transaction using `Promise.all`.

In `cache.service.test.ts`, we updated the unit tests for the `warmCache` function to validate the new query implementation. We used `mockSupabase.or` to mock the Supabase query with the `OR` filter and verified that the correct filter is applied.

## Technical Decisions

We chose to use a single Supabase query with an `OR` filter to reduce the number of database queries and improve performance. This approach allows us to fetch all matching medicines in a single query, reducing the load on the database and improving cache warming times. We also used `Promise.all` to fetch cache statistics in a single Redis transaction, reducing the number of Redis queries and improving performance.

## How To Re-Implement (Contributor Reference)

To re-implement this feature, follow these steps:

1. Modify the `warmCache` function in `cache.service.ts` to use a single Supabase query with an `OR` filter.
2. Create a formatted string for the `OR` filter using the `genericNames` and `brandNames` arrays.
3. Use the `supabase.or` method to execute the query with the formatted filter.
4. Deduplicate the fetched medicines by their `id` before populating the Redis cache.
5. Update the `TTL_TIERS` object to calculate the `VOICE` cache TTL in seconds.
6. Modify the `getCacheStats` function to fetch cache statistics in a single Redis transaction using `Promise.all`.
7. Update the unit tests in `cache.service.test.ts` to validate the new query implementation.

## Impact on System Architecture

This change improves the performance of our cache warming process, reducing the load on the database and improving overall system efficiency. It also simplifies the cache warming logic, making it easier to maintain and extend in the future. Additionally, the use of `Promise.all` to fetch cache statistics reduces the number of Redis queries, improving performance and scalability.

## Testing & Verification

We tested this change by verifying that the cache warming process executes a single Supabase query with the correct `OR` filter. We also verified that the fetched medicines are deduplicated correctly and that the Redis cache is populated with the correct data. The updated unit tests in `cache.service.test.ts` validate the new query implementation and ensure that the cache warming process works as expected.