# PR #3443 — Fix : Sequential per-batch UPDATE queries in medicine expiry alert broadcaster#3442

> **Merged:** 2026-07-11 | **Author:** @hrx01-dev | **Area:** Backend | **Impact Score:** 6 | **Closes:** #3442

## What Changed

This PR modifies the `broadcastExpiryAlerts` function in `apps/api/src/cron/alert-broadcaster.ts` to update the `expiry_broadcasted` flag for batches in chunks of 500 instead of one UPDATE query per batch. This reduces the number of round-trips to Supabase from O(N) to O(N / 500), where N is the number of expiring batches.

## The Problem Being Solved

Before this PR, the system was making a separate UPDATE query for each expiring batch, resulting in a large number of database requests. This was inefficient and could lead to performance issues as the number of expiring batches grows. The problem was specifically related to the sequential per-batch UPDATE queries in the medicine expiry alert broadcaster, which was causing a bottleneck in the system.

## Files Modified

- `apps/api/src/cron/alert-broadcaster.ts`

## Implementation Details

The implementation involves slicing the `expiringBatches` array into chunks of 500 IDs using the `slice` method. Then, for each chunk, it updates the `expiry_broadcasted` flag using a single UPDATE query with the `in` method, which matches any row whose ID is in the given array. The `successfullyMarkedIds` set keeps track of the IDs that were successfully updated. After updating all chunks, it filters the `expiringBatches` array to only include batches whose IDs are in the `successfullyMarkedIds` set and maps each batch to its summary shape.

The key functions used in this implementation are:
- `supabase.from("batches").update({ expiry_broadcasted: true })`: updates the `expiry_broadcasted` flag for the specified batches.
- `slice`: slices the `expiringBatches` array into chunks of 500 IDs.
- `in`: matches any row whose ID is in the given array.
- `filter` and `map`: used to create the `batchSummaries` array.

## Technical Decisions

The decision to use chunks of 500 IDs was made to balance the trade-off between reducing the number of database requests and avoiding overly large UPDATE queries. Using the `in` method instead of `eq` allows for updating multiple batches in a single query, reducing the number of round-trips to Supabase.

## How To Re-Implement (Contributor Reference)

To re-implement this feature from scratch:
1. Identify the batches that need to be updated by querying the `batches` table.
2. Slice the `expiringBatches` array into chunks of 500 IDs using the `slice` method.
3. For each chunk, update the `expiry_broadcasted` flag using a single UPDATE query with the `in` method.
4. Keep track of the IDs that were successfully updated using a set.
5. Filter the `expiringBatches` array to only include batches whose IDs are in the `successfullyMarkedIds` set.
6. Map each batch to its summary shape using the `map` method.

## Impact on System Architecture

This change improves the performance and scalability of the SahiDawa system by reducing the number of database requests. It also makes the system more efficient and reliable, as it can handle a large number of expiring batches without performance issues. This change unlocks future development by allowing the system to handle a larger volume of data without compromising performance.

## Testing & Verification

This change was tested by verifying that the `expiry_broadcasted` flag is correctly updated for the expiring batches. The testing involved checking the database to ensure that the updates were successful and that the `batchSummaries` array is correctly populated. The testing also included edge cases, such as handling batches that fail to update and ensuring that the system can handle a large number of expiring batches. Not documented in this PR is the exact testing methodology used, but it is assumed that the testing was done using a combination of unit tests and integration tests.