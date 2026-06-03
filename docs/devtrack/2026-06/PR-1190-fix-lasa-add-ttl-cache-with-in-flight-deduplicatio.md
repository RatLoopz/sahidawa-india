# PR #1190 — fix(lasa): add TTL cache with in-flight deduplication to prevent TOCTOU race

> **Merged:** 2026-06-03 | **Author:** @anshul23102 | **Area:** Backend | **Impact Score:** 8 | **Closes:** #1181

## What Changed

This pull request introduces an in-process, time-to-live (TTL) cache with in-flight request deduplication to the `detectLasaConflicts` function within `apps/api/src/services/lasa.service.ts`. This enhancement ensures that expensive `supabase.rpc` calls for LASA (Look-Alike, Sound-Alike) conflict detection are only executed once per unique medicine name within a 5-minute window, and that concurrent requests for the same medicine name share a single RPC call, preventing redundant database queries and connection exhaustion.

## The Problem Being Solved

Prior to this change, our `detectLasaConflicts` function directly invoked the `supabase.rpc("find_lasa_conflicts", ...)` on every single request. This RPC performs computationally intensive string-distance comparisons across our entire `medicines` table. Under concurrent load, multiple API requests for the same medicine name would simultaneously trigger identical `supabase.rpc` calls. This led to several issues:
1.  **Wasted Supabase Connections:** Each redundant RPC call consumed a valuable connection from our Supabase pool, leading to potential connection exhaustion and degraded service availability under high traffic.
2.  **Increased Latency:** Every request incurred the full latency of the database RPC, even for recently queried or identical medicine names.
3.  **Time-of-Check to Time-of-Use (TOCTOU) Race Condition:** Without a mechanism to coordinate concurrent requests, two requests for the same medicine name could both "check" if a result was available (finding none) and then both proceed to "use" (initiate) a new RPC call. This race condition resulted in inefficient duplicate work.

## Files Modified

-   `apps/api/src/services/lasa.service.ts`

## Implementation Details

The core of this change resides within `apps/api/src/services/lasa.service.ts`, specifically enhancing the `detectLasaConflicts` function.

We introduced several new components to manage the caching and deduplication:

1.  **Constants and Interfaces:**
    *   `CACHE_TTL_MS`: A constant set to `5 * 60 * 1000` (5 minutes) defining the expiration time for cached entries.
    *   `CacheEntry` interface: Defines the structure for a cached item, containing `value: LasaMatch[]` (the actual result) and `expiresAt: number` (a Unix timestamp indicating when the entry becomes stale).

2.  **Cache Storage:**
    *   `cache`: A `Map<string, CacheEntry>` instance. This map stores the resolved `LasaMatch[]` results, keyed by the normalized medicine name, along with their expiration timestamp. This serves as our in-process TTL cache.
    *   `inFlight`: A `Map<string, Promise<LasaMatch[]>>` instance. This map stores a `Promise` for each medicine name that currently has an RPC call in progress. The key is the normalized medicine name. This is crucial for in-flight deduplication.

3.  **Cache Utility Functions:**
    *   `getCached(key: string): LasaMatch[] | null`: This helper function retrieves an entry from the `cache` map. It first checks if an entry exists. If it does, it then verifies if `Date.now()` is less than `entry.expiresAt`. If the entry has expired, it is deleted from the `cache` map, and `null` is returned. Otherwise, the `value` of the valid `CacheEntry` is returned.
    *   `setCached(key: string, value: LasaMatch[]): void`: This helper function stores a new entry in the `cache` map. It calculates `expiresAt` by adding `CACHE_TTL_MS` to `Date.now()` and stores the `value` and `expiresAt` within a `CacheEntry` object.

4.  **`detectLasaConflicts` Function Flow:**
    *   The input `medicineName` is first `trim()`med to `targetName`.
    *   An early exit `if (!targetName) return [];` handles empty inputs.
    *   A `cacheKey` is derived by converting `targetName` to `toLowerCase()`. This ensures case-insensitive caching.
    *   **Cache Check:** The function first attempts to retrieve a result from the `cache` using `getCached(cacheKey)`. If a valid, non-expired cached result is found, it is immediately returned, bypassing any RPC call.
    *   **In-Flight Deduplication Check:** If no valid cached result is found, the function then checks the `inFlight` map using `inFlight.get(cacheKey)`. If an `existing` Promise is found, it means another request for the exact same `cacheKey` is already in progress. The current request then `await`s this `existing` Promise, effectively joining the ongoing operation instead of initiating a new one. This directly addresses the TOCTOU race condition.
    *   **RPC Execution and Caching:** If neither a cached result nor an in-flight promise exists, a new asynchronous operation is initiated:
        *   An immediately invoked async function expression (IIFE) is created to encapsulate the RPC call and subsequent logic.
        *   Inside this IIFE, `supabase.rpc("find_lasa_conflicts", { target_name: targetName })` is called.
        *   Error handling is performed: if `error` is returned from `supabase.rpc`, an `Error` is thrown.
        *   The `data` received from the RPC (or an empty array if `data` is null) is mapped into the `LasaMatch[]` interface, setting `name`, `type`, and `score` (1.0 for "sound-alike", 0.85 otherwise).
        *   On successful completion, the `result` is stored in the `cache` using `setCached(cacheKey, result)`.
        *   A `finally` block is crucial: `inFlight.delete(cacheKey)` is called here. This ensures that the `Promise` is removed from the `inFlight` map regardless of whether the RPC succeeded or failed, preventing future requests for this key from being permanently blocked.
    *   **Storing and Returning the Promise:** Before the IIFE resolves, its `promise` is stored in the `inFlight` map using `inFlight.set(cacheKey, promise)`. This allows subsequent concurrent requests to await this specific promise. Finally, this `promise` is returned.

## Technical Decisions

1.  **In-Process Caching:** We opted for an in-process cache (`Map`) rather than a distributed cache (e.g., Redis). This decision was made because the `detectLasaConflicts` function is a high-frequency, performance-critical path, and an in-process cache offers the lowest possible latency for cache hits, avoiding network overhead. Given that LASA conflicts change infrequently (only when the underlying medicines dataset is updated), a local cache provides significant benefits without complex distributed cache invalidation strategies.
2.  **Time-to-Live (TTL):** A 5-minute TTL (`CACHE_TTL_MS`) was chosen. This duration is a balance between providing substantial performance gains and ensuring that the cached data does not become excessively stale. Since LASA conflict lists are relatively static and only change with dataset updates, a short TTL is safe and effective.
3.  **In-Flight Request Deduplication:** The use of the `inFlight` `Map` to store `Promise` objects is a critical design choice. This pattern effectively prevents the TOCTOU race condition where multiple concurrent requests for the same resource would all miss the cache and then all proceed to initiate duplicate expensive operations. By having subsequent requests `await` an existing `Promise`, we guarantee that only one `supabase.rpc` call is made for a given medicine name at any point in time, significantly reducing load on Supabase.
4.  **`finally` Block for `inFlight` Cleanup:** Placing `inFlight.delete(cacheKey)` within a `finally` block is a robust decision. This guarantees that the `inFlight` map is cleared for a given key regardless of whether the underlying `supabase.rpc` call succeeds or fails. This prevents a failed RPC from permanently blocking all future requests for that medicine name, ensuring system resilience.
5.  **Cache Key Normalization:** Normalizing the `medicineName` to `toLowerCase()` for the `cacheKey` ensures that variations in casing (e.g., "Aspirin" vs. "aspirin") are treated as the same entry, maximizing cache hit rates. Trimming whitespace (`trim()`) further standardizes the key.

## How To Re-Implement (Contributor Reference)

To re-implement this caching and deduplication mechanism from scratch, a contributor would follow these steps:

1.  **Define `LasaMatch` and `LasaMatchType`:** Ensure the necessary interfaces for the return type of the LASA conflict detection are defined, as they are used in the cache.
2.  **Establish Cache Configuration:**
    *   Declare a constant `CACHE_TTL_MS` (e.g., `5 * 60 * 1000` for 5 minutes).
    *   Define an interface `CacheEntry` with `value: LasaMatch[]` and `expiresAt: number`.
3.  **Initialize Cache Stores:**
    *   Create a `Map<string, CacheEntry>` instance named `cache` to hold the TTL-based results.
    *   Create a `Map<string, Promise<LasaMatch[]>>` instance named `inFlight` to manage concurrent requests.
4.  **Implement `getCached` Function:**
    *   Accept a `key: string`.
    *   Retrieve the `entry` from `cache.get(key)`.
    *   If no `entry` or if `Date.now() > entry.expiresAt`, delete the entry from `cache` (if expired) and return `null`.
    *   Otherwise, return `entry.value`.
5.  **Implement `setCached` Function:**
    *   Accept a `key: string` and `value: LasaMatch[]`.
    *   Store `{ value, expiresAt: Date.now() + CACHE_TTL_MS }` in `cache.set(key, ...)`.
6.  **Modify `detectLasaConflicts`:**
    *   Normalize the input `medicineName` to create a `cacheKey` (e.g., `medicineName.trim().toLowerCase()`).
    *   **Step 1: Check Cache:** Call `getCached(cacheKey)`. If a result is returned, `return` it immediately.
    *   **Step 2: Check In-Flight Requests:** Call `inFlight.get(cacheKey)`. If a `Promise` is returned, `return await` that `Promise`.
    *   **Step 3: Initiate New Request (if no cache hit or in-flight):**
        *   Define an `async` IIFE (Immediately Invoked Function Expression) that encapsulates the RPC logic.
        *   Inside the IIFE:
            *   Execute `supabase.rpc("find_lasa_conflicts", { target_name: targetName })`.
            *   Handle any `error` from the RPC by throwing an `Error`.
            *   Process the `data` into the desired `LasaMatch[]` format.
            *   Call `setCached(cacheKey, result)` with the successful result.
            *   Crucially, add a `finally` block to the IIFE: `finally { inFlight.delete(cacheKey); }`. This ensures cleanup.
        *   Store the `Promise` returned by this IIFE into `inFlight.set(cacheKey, promise)`.
        *   `return` this `promise`.

This pattern ensures efficient resource utilization and robust handling of concurrent requests for expensive operations.

## Impact on System Architecture

This change has a significant positive impact on our SahiDawa backend architecture, particularly concerning performance and scalability:

*   **Reduced Database Load:** By caching and deduplicating `find_lasa_conflicts` RPC calls, we drastically reduce the number of queries hitting our Supabase instance. This frees up database connections and CPU cycles, allowing Supabase to serve other requests more efficiently.
*   **Improved API Latency:** For medicine names that have been recently queried, subsequent requests will benefit from an immediate cache hit, resulting in significantly faster API response times for LASA conflict checks.
*   **Enhanced Scalability:** The API service can now handle a much higher volume of concurrent requests for LASA conflict detection without being bottlenecked by the database. This is critical for a platform expecting growth in user base and data interactions.
*   **Increased Reliability:** The prevention of TOCTOU race conditions makes the system more predictable and robust under load, reducing the likelihood of unexpected behavior or resource exhaustion.
*   **Pattern for Future Optimizations:** This implementation establishes a clear pattern for applying in-process caching and in-flight deduplication to other expensive or frequently accessed RPCs or database queries within our `apps/api` service, enabling future performance optimizations.

## Testing & Verification

The following scenarios were explicitly tested and verified to ensure the correct behavior of the new caching and deduplication mechanism:

1.  **First Request:** A request for a medicine name not previously seen or cached correctly triggered the `supabase.rpc` call. The result was then stored in our in-process cache.
2.  **Subsequent Request (within TTL):** A second request for the *same* medicine name made within the 5-minute `CACHE_TTL_MS` successfully resulted in a cache hit. The cached data was returned immediately, and no `supabase.rpc` call was observed.
3.  **Concurrent Requests:** Two simultaneous requests for the *same* medicine name were initiated. Verification confirmed that only a single `supabase.rpc` call was made to Supabase. The second request correctly awaited the `Promise` of the first, demonstrating effective in-flight deduplication.
4.  **RPC Failure Handling:** A scenario where the `supabase.rpc` call failed was tested. It was confirmed that the cache was *not* populated with an erroneous result, and crucially, the `inFlight` map was correctly cleared in the `finally` block. This ensures that a subsequent request for the same medicine name would issue a fresh RPC call rather than being permanently blocked or receiving a stale error.

These tests confirm that the caching, deduplication, and error handling mechanisms function as intended, providing both performance benefits and system stability.