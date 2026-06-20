# PR #2141 — perf(api): fix OOM risk and N+1 query in alert broadcaster cron

> **Merged:** 2026-06-20 | **Author:** @PremSahith | **Area:** Backend | **Impact Score:** 6 | **Closes:** #2140

## What Changed

This pull request significantly refactors the `alert-broadcaster.ts` cron job within our API service. We have introduced cursor-based pagination for database queries fetching notification subscribers, implemented concurrent processing of notifications in batches, and optimized the data fetching logic to eliminate N+1 query patterns, specifically within the `broadcastExpiryAlerts` function. These changes aim to improve the scalability, reliability, and performance of our critical alert broadcasting system.

## The Problem Being Solved

Before this change, our `alert-broadcaster.ts` cron job faced several critical scalability issues that posed a risk to the stability and performance of the SahiDawa platform, especially as our user base grows:

1.  **Out-of-Memory (OOM) Risk:** The `notification_subscribers` table was queried without pagination. For a large number of subscribers (e.g., hundreds of thousands or millions), fetching all records into memory at once would consume excessive RAM, leading to Out-of-Memory errors and crashing the cron job. This was particularly problematic in `broadcastDistrictAlerts` and `broadcastDrugAlerts`, and also in `broadcastExpiryAlerts` where all active subscribers were fetched.
2.  **N+1 Query Problem:** In the `broadcastExpiryAlerts` function, the system was fetching *all* active notification subscribers for *each individual expiring batch*. If there were `M` expiring batches and `N` subscribers, this resulted in `M` separate database queries to fetch subscribers, leading to `M * N` total notification dispatches, which is highly inefficient and resource-intensive.
3.  **Inefficient Network I/O and Timeouts:** The `sendNotificationToSubscriber` calls were executed sequentially within loops. For a large number of subscribers or expiring batches, this synchronous processing meant that the cron job would take an extremely long time to complete, potentially exceeding execution limits or causing significant delays in alert delivery. The PR description specifically noted this could take "8+ minutes on large user bases."

These issues collectively threatened the timely and reliable delivery of critical health alerts (counterfeit, recall, expiry) to our users, which is a core function of the SahiDawa platform.

## Files Modified

-   `apps/api/src/cron/alert-broadcaster.ts`

## Implementation Details

We have made targeted modifications to the `apps/api/src/cron/alert-broadcaster.ts` file to address the identified performance bottlenecks.

1.  **Introduction of Constants:**
    *   `PAGE_SIZE` is introduced with a value of `1000`. This constant defines the number of notification subscriber records to fetch in a single database query page.
    *   `NOTIFICATION_CHUNK_SIZE` is introduced with a value of `50`. This constant determines how many `sendNotificationToSubscriber` calls will be processed concurrently using `Promise.allSettled()`.

2.  **Cursor-Based Pagination for Subscriber Fetching:**
    *   In `broadcastDistrictAlerts`, `broadcastDrugAlerts`, and `broadcastExpiryAlerts`, the unpaginated `supabase.from("notification_subscribers").select("*")` calls have been replaced with a `while (hasMore)` loop structure.
    *   Inside this loop, we now use `.range(from, to)` on the Supabase query. `from` and `to` are initialized to `0` and `PAGE_SIZE - 1` respectively, and are incremented by `PAGE_SIZE` in each iteration (`from += PAGE_SIZE; to += PAGE_SIZE;`).
    *   The `hasMore` flag is set to `false` when the number of subscribers returned in a page is less than `PAGE_SIZE`, indicating that all records have been fetched.
    *   This ensures that subscribers are fetched in manageable chunks, preventing OOM errors.

3.  **Concurrent Notification Dispatching:**
    *   After fetching a page of subscribers, we now iterate through them in chunks of `NOTIFICATION_CHUNK_SIZE`.
    *   For each chunk, we create an array of promises by mapping each subscriber to a `sendNotificationToSubscriber` call.
    *   `Promise.allSettled(promises)` is then used to execute these notification dispatches concurrently. This drastically reduces the total time taken for sending notifications by leveraging parallel execution. `Promise.allSettled` ensures that even if some individual notification dispatches fail, the entire batch processing continues without interruption.

4.  **N+1 Query Fix in `broadcastExpiryAlerts`:**
    *   Previously, the `supabase.from("notification_subscribers").select("*").eq("is_active", true)` query was inside the `for (const batch of expiringBatches)` loop.
    *   We have refactored this. Now, the `expiringBatches` are fetched once at the beginning.
    *   Then, the subscriber fetching loop (with pagination and chunking) runs *independently*.
    *   Inside the subscriber chunk processing loop (`for (const sub of chunk)`), we now iterate through *all* `expiringBatches` and create a `sendNotificationToSubscriber` call for each batch for the current subscriber. This means for a chunk of `NOTIFICATION_CHUNK_SIZE` subscribers, and `X` expiring batches, we generate `NOTIFICATION_CHUNK_SIZE * X` notification promises, which are then processed concurrently. This effectively reverses the N+1 problem by fetching subscribers once (in pages) and then processing all relevant batches for each subscriber chunk, rather than fetching subscribers repeatedly for each batch.
    *   The `logger.info` message for expiry alerts was also updated to reflect the overall processing of multiple batches.

5.  **Minor Localization Corrections:**
    *   A small typo was corrected in the Assamese (`as`) localization for recall alerts: "কাম" was added.
    *   A small typo was corrected in the Tamil (`ta`) localization for expiry alerts: "காலாவதி" was corrected.

## Technical Decisions

1.  **Cursor-Based Pagination (`.range(from, to)`)**: We chose cursor-based pagination over offset-based pagination for fetching subscribers. While both can prevent OOM, cursor-based pagination (using `range` with `from` and `to` indices) is generally more robust and performant for very large datasets, especially in scenarios where data might be added or deleted concurrently. Offset-based pagination can sometimes skip or duplicate records if the underlying data changes between pages. A `PAGE_SIZE` of `1000` was selected as a balance between reducing database round trips and keeping individual query result sets manageable in memory.
2.  **Concurrent Processing with `Promise.allSettled()`**: To address the slow sequential notification dispatch, we opted for concurrent execution using `Promise.allSettled()`.
    *   `Promise.allSettled()` was chosen over `Promise.all()` because it allows all promises in the array to settle (either fulfill or reject) without short-circuiting if one promise rejects. This is crucial for notification systems, as we want to attempt sending all notifications in a batch, even if a few individual sends fail, rather than stopping the entire batch.
    *   A `NOTIFICATION_CHUNK_SIZE` of `50` was chosen to balance the benefits of concurrency with the overhead of managing too many concurrent operations. Sending too many requests simultaneously could overwhelm our notification provider or the Supabase backend, leading to rate limiting or connection issues. `50` provides a good sweet spot for parallel execution without excessive resource consumption.
3.  **N+1 Query Resolution Strategy**: For `broadcastExpiryAlerts`, the decision was made to fetch all expiring batches first, and then iterate through paginated chunks of subscribers. For each subscriber chunk, we then iterate through *all* previously fetched expiring batches to generate the notifications. This strategy ensures that the database query for subscribers is performed only once per page, significantly reducing the total number of database calls compared to fetching subscribers for each batch. This is a common and effective pattern for optimizing many-to-many relationships in batch processing.
4.  **Supabase Client Usage**: We continue to leverage the existing `supabase` client instance, ensuring consistency with our current data access layer.

## How To Re-Implement (Contributor Reference)

To re-implement or apply similar performance optimizations for batch processing and notification dispatch in other parts of our system, follow these patterns:

1.  **Define Pagination and Concurrency Constants**:
    ```typescript
    const PAGE_SIZE = 1000; // Or an appropriate number based on data size and memory
    const NOTIFICATION_CHUNK_SIZE = 50; // Or an appropriate number for concurrent operations
    ```

2.  **Implement Cursor-Based Pagination for Data Fetching**:
    When fetching a large number of records from Supabase (or any database), use a `while` loop with `range()`:
    ```typescript
    let from = 0;
    let to = PAGE_SIZE - 1;
    let hasMore = true;
    const allRecords: YourRecordType[] = []; // If you need to aggregate all records first

    while (hasMore) {
        const { data, error } = await supabase
            .from("your_table")
            .select("*")
            .eq("some_field", "some_value") // Add your filters
            .range(from, to);

        if (error) {
            logger.error({ message: "Failed to fetch records", error });
            break; // Or handle error appropriately
        }

        if (!data || data.length === 0) {
            break; // No more records
        }

        allRecords.push(...data); // If aggregating, otherwise process data directly

        if (data.length < PAGE_SIZE) {
            hasMore = false; // Last page
        } else {
            from += PAGE_SIZE;
            to += PAGE_SIZE;
        }
    }
    // Now 'allRecords' contains all paginated data, or you processed it chunk by chunk
    ```

3.  **Implement Concurrent Batch Processing**:
    When you have a list of items (`subscribers` in this case) and need to perform an asynchronous operation for each, process them in chunks concurrently:
    ```typescript
    // Assuming 'subscribers' is an array of items to process
    for (let i = 0; i < subscribers.length; i += NOTIFICATION_CHUNK_SIZE) {
        const chunk = subscribers.slice(i, i + NOTIFICATION_CHUNK_SIZE);
        const promises = chunk.map(async (item) => {
            // Your async operation here, e.g., sendNotificationToSubscriber(item, ...)
            // Ensure this function returns a Promise
            return yourAsyncOperation(item);
        });
        await Promise.allSettled(promises); // Wait for all in the chunk to complete
        // Optional: Add a small delay here if external API rate limits are a concern
    }
    ```

4.  **Avoid N+1 Queries**:
    If you have two sets of data (e.g., `batches` and `subscribers`) and need to process combinations, fetch the larger or more frequently accessed set once (or in pages), then iterate through the smaller set (or the other set) within the processing loop. For example, in `broadcastExpiryAlerts`, we fetched `expiringBatches` once, then iterated through paginated `subscribers`, and for each subscriber chunk, iterated through *all* `expiringBatches` to generate notifications. This avoids repeatedly querying for subscribers.

## Impact on System Architecture

This change significantly enhances the robustness and scalability of SahiDawa's backend alert broadcasting system.

1.  **Improved Scalability**: The system can now handle a much larger number of notification subscribers and expiring medicine batches without encountering Out-of-Memory errors or excessive execution times. This is crucial for our growth trajectory and expanding reach in rural health.
2.  **Enhanced Reliability**: By preventing OOM conditions and timeouts, the cron job is more reliable in delivering critical alerts (counterfeit, recall, expiry) to users in a timely manner. `Promise.allSettled` further ensures that partial failures do not halt the entire broadcasting process.
3.  **Reduced Database Load**: The elimination of N+1 queries and the introduction of pagination drastically reduce the number of database queries and the amount of data transferred in each query, thereby lowering the load on our Supabase backend.
4.  **Foundation for Future Growth**: This refactoring establishes a robust pattern for handling large-scale batch processing and external API interactions, which can be applied to other parts of the SahiDawa platform as new features requiring similar operations are developed.
5.  **Maintainability**: The code is now more structured and easier to understand, with clear constants for configuration, improving maintainability for future contributors.

## Testing & Verification

Verification for this backend and architecture refactor involved the following:

*   **TypeScript Compilation**: The project successfully passed TypeScript compilation (`npx tsc --noEmit`), ensuring no type errors or syntax issues were introduced by the changes.
*   **Logical Flow Verification**: The refactored loops were manually reviewed to ensure they correctly aggregate data payloads before concurrent dispatch. This includes verifying that pagination logic correctly fetches all records and that notification promises are correctly generated and settled.
*   **No UI Changes**: As this is a purely backend change, no user interface modifications were expected or observed.
*   **Implicit Performance Improvement**: While specific performance benchmarks were not provided in the PR, the architectural changes (pagination, N+1 fix, concurrency) inherently address the described performance issues. Future monitoring of cron job execution times and resource usage will serve as ongoing verification of the performance improvements.
*   **Edge Cases**: The pagination logic handles cases where there are no subscribers or fewer subscribers than `PAGE_SIZE`. `Promise.allSettled` handles individual notification failures gracefully. The N+1 fix ensures that all relevant batches are considered for each subscriber.