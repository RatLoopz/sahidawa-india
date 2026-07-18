# PR #1640 — feat: implement redis tiered caching and cache-warming for CDSCO drug lookup

> **Merged:** 2026-06-12 | **Author:** @jamunatg2006-sys | **Area:** Backend | **Impact Score:** 73 | **Closes:** #1637

## What Changed

This pull request introduces a robust, tiered Redis caching layer for our CDSCO drug lookup API, significantly improving performance and reducing database load. It also adds a cache-warming mechanism to pre-populate frequently accessed drug data on service startup, an admin endpoint for manual cache invalidation, and fourteen new i18n translation files for the "How It Works" page to enhance accessibility. Furthermore, we have synchronized our internal development documentation and added new Architecture Decision Records (ADRs).

## The Problem Being Solved

Before this change, our CDSCO drug lookup API directly queried the database for every request. This led to:
- **High Latency:** Each drug lookup incurred the overhead of a database query, resulting in slower response times for users.
- **Increased Database Load:** Frequent lookups, especially for popular drugs, put a significant strain on our database, impacting its overall performance and potentially leading to bottlenecks.
- **Lack of Proactive Performance:** There was no mechanism to pre-load frequently accessed drug data, meaning the first request for any drug always hit the database.
- **Limited Control and Observability:** We lacked a direct way to manually invalidate cached data in response to updates or issues, and detailed metrics on cache performance (hits/misses) were not readily available.
- **Accessibility Gaps:** The "How It Works" page in our web UI was not available in several major Indian languages, limiting its reach and usability for a significant portion of our target audience.
- **Documentation Drift:** Our internal development tracking documentation and ADRs were not fully aligned with recent backend changes, specifically regarding admin-gate mutation controls.

## Files Modified

- `apps/api/src/app.ts`
- `apps/api/src/db/seeds/hot_drugs_seed.ts`
- `apps/api/src/gracefulShutdown.ts`
- `apps/api/src/index.ts`
- `apps/api/src/routes/admin.routes.ts`
- `apps/api/src/routes/alerts.ts`
- `apps/api/src/routes/verify.ts`
- `apps/api/src/services/cache.service.ts`
- `apps/api/src/services/drugLookup.service.ts`
- `apps/api/src/utils/redis.ts`
- `apps/api/tests/cache.service.test.ts`

## Implementation Details

Our system now leverages Redis as a high-performance, in-memory cache for CDSCO drug lookup results. This implementation involves several key components:

1.  **Redis Utility (`apps/api/src/utils/redis.ts`)**:
    *   We introduced `redisClient`, an instance of the `ioredis` client, configured to connect to Redis using the `REDIS_URL` environment variable.
    *   The `connectRedis()` function handles the initial connection, including retry logic and logging for connection status and errors.
    *   Wrapper functions `setWithTTL(key: string, value: string, ttlSeconds: number)` and `get(key: string)` provide a consistent interface for interacting with Redis, abstracting away direct `ioredis` calls.
    *   A `del(keys: string | string[])` function is also provided for cache invalidation.

2.  **Cache Service (`apps/api/src/services/cache.service.ts`)**:
    *   This new service is the core of our caching logic. It defines `KEY_PREFIXES` for different cache types (e.g., `DRUG_CACHE`) and `TTL_SECONDS` for our tiered caching strategy:
        *   `HOT_TIER_TTL`: 24 hours
        *   `WARM_TIER_TTL`: 6 hours
        *   `COLD_TIER_TTL`: 1 hour
    *   The `getOrSet(key: string, fetcher: () => Promise<T>, ttlSeconds: number)` function is central. It first attempts to retrieve data from Redis using `redisClient.get()`.
        *   If a cache hit occurs, it logs the hit and returns the cached data.
        *   If a cache miss occurs, it executes the provided `fetcher` function (which typically queries the database), logs the miss, stores the result in Redis using `redisClient.setWithTTL()` with the specified TTL, and then returns the data.
    *   `invalidateDrugCache(drugIds: string[])` is implemented to clear specific drug entries from the cache. It iterates through the provided `drugIds`, constructs the corresponding cache keys using `KEY_PREFIXES.DRUG_CACHE`, and calls `redisClient.del()` for each.
    *   The `warmCache()` function is responsible for pre-populating the hot cache tier. It iterates through the `hotDrugs` array from `apps/api/src/db/seeds/hot_drugs_seed.ts`, performs a `drugLookupService.lookupDrug()` for each, and stores the result in the cache with the `HOT_TIER_TTL`.

3.  **Drug Lookup Service Integration (`apps/api/src/services/drugLookup.service.ts`)**:
    *   Not documented in this PR, but implied by the `cache.service.ts` and `warmCache` logic, the `drugLookupService` is now integrated with the `CacheService` to utilize the `getOrSet` method. This means that any call to `drugLookupService.lookupDrug()` (or similar methods) will first check the cache before hitting the database.

4.  **Cache Warm-up Seed (`apps/api/src/db/seeds/hot_drugs_seed.ts`)**:
    *   This new file exports `hotDrugs: DrugSeed[]`, an array of objects, each containing an `id`, `genericName`, and `brandNames`. This list represents the most frequently accessed or critical drugs that we want to ensure are always in the hot cache tier from the moment the service starts.

5.  **Application Lifecycle Integration (`apps/api/src/index.ts`, `apps/api/src/gracefulShutdown.ts`)**:
    *   In `apps/api/src/index.ts`, the `connectRedis()` function is now called asynchronously before the server starts listening, ensuring Redis is ready. Immediately after, `warmCache()` is invoked to pre-populate the hot tier.
    *   In `apps/api/src/gracefulShutdown.ts`, we added logic to gracefully disconnect the `redisClient` using `redisClient.quit()` during application shutdown. This prevents hanging connections and ensures resource cleanup.

6.  **Admin Cache Invalidation Endpoint (`apps/api/src/routes/admin.routes.ts`)**:
    *   A new `POST /cache/invalidate` endpoint has been added.
    *   This endpoint is protected by `requireAuth` and `requireRole("admin", "moderator")`, ensuring only authorized personnel can trigger cache invalidation.
    *   It accepts a request body with optional `drugIds: string[]` and `batchNumbers: string[]`.
    *   If `drugIds` are provided, it calls `invalidateDrugCache()` from `cache.service.ts`.
    *   If `batchNumbers` are provided, it constructs the corresponding Redis keys using `KEY_PREFIXES.DRUG_CACHE` and calls `redisClient.del()` to remove them. This allows for targeted invalidation of specific drug or batch-related cache entries.

7.  **Internationalization (i18n)**:
    *   Not documented in this PR, but the PR description indicates that 14 new locale JSON files were added to `apps/web/messages/` for languages such as Assamese, Bengali, Gujarati, Kannada, Kashmiri, Maithili, Malayalam, Marathi, Odia, Punjabi, Sanskrit, Tamil, Telugu, and Urdu. These files provide translations for the "How It Works" page, making the UI accessible to a broader Indian audience.

8.  **Documentation Updates**:
    *   `docs/devtrack/README.md` was updated to reflect the latest development tracking.
    *   New ADRs, specifically `docs/devtrack/2026-06/PR-1589-feat-admin-gate-mutation-controls-by-role.md` and `docs/devtrack/adr/ADR-030-feat-admin-gate-mutation-controls-by-role.md`, were added to document the architectural decisions behind admin-gate mutation controls by role.

9.  **`apps/api/src/app.ts` Adjustments**:
    *   The `CSRF_SECRET` environment variable check was refined to only apply outside of `development` mode, allowing for more flexibility in local testing.
    *   The `cors` middleware was moved to a later position in the middleware chain, after `cookieParser` and `express.json`, which can sometimes resolve issues with cookie parsing or body parsing interacting with CORS preflight requests.
    *   The `/api/analytics` route no longer requires `admin` or `moderator` roles, indicating a change in access control for analytics data.
    *   Several unused route imports (`interactionsRouter`, `alternativesRouter`, `eligibilityRouter`) were removed, cleaning up the application's main entry point.

## Technical Decisions

1.  **Choice of Redis for Caching**: We chose Redis due to its proven performance as an in-memory data store, its support for time-to-live (TTL) on keys, and its robust client libraries (`ioredis`). Its speed and efficiency are critical for reducing latency in high-volume drug lookups.
2.  **Tiered Caching Strategy (Hot/Warm/Cold)**: Implementing a multi-tier cache with varying TTLs (24h, 6h, 1h) allows us to balance data freshness with cache hit rates.
    *   **Hot Tier (24h)**: For extremely popular drugs, ensuring they remain cached for a longer duration, maximizing performance.
    *   **Warm Tier (6h)**: For moderately popular drugs, providing a good balance between freshness and performance.
    *   **Cold Tier (1h)**: A general-purpose cache for less frequently accessed drugs, still offering a performance boost over direct database access but allowing data to expire relatively quickly.
    This approach optimizes memory usage by not keeping all data indefinitely and ensures that frequently accessed data is prioritized.
3.  **Cache Warming on Startup**: The decision to pre-populate the hot cache tier using `hot_drugs_seed.ts` was made to ensure that our most critical and frequently searched drugs are immediately available from the cache upon service deployment or restart. This prevents a "cold start" performance penalty for initial user requests.
4.  **Admin Cache Invalidation Endpoint**: A dedicated admin endpoint was deemed necessary to provide manual control over the cache. This is crucial for scenarios where underlying drug data changes rapidly, or if an issue requires immediate cache clearance, without needing to restart the entire service. Role-based access control (`admin`, `moderator`) ensures security.
5.  **Graceful Shutdown for Redis Client**: Integrating `redisClient.quit()` into our `gracefulShutdown.ts` mechanism is a best practice. It ensures that when the application shuts down, the Redis client cleanly disconnects, releasing resources and preventing potential connection leaks or errors in the Redis server.
6.  **Centralized Cache Service**: Encapsulating all caching logic within `apps/api/src/services/cache.service.ts` promotes modularity, reusability, and easier maintenance. It separates concerns, making the `drugLookupService` cleaner and focused on business logic.
7.  **Internationalization**: The decision to add 14 new locale files for the "How It Works" page directly addresses our mission to make SahiDawa accessible across diverse linguistic regions of India. This improves user experience and broadens our platform's reach.
8.  **Documentation Alignment**: Updating `docs/devtrack/README.md` and adding new ADRs ensures that our architectural decisions and development progress are accurately recorded and easily accessible to current and future contributors, fostering better understanding and consistency.

## How To Re-Implement (Contributor Reference)

To re-implement this tiered Redis caching and cache-warming feature, a contributor would follow these steps:

1.  **Set up Redis**:
    *   Ensure a Redis instance is running and accessible.
    *   Configure the `REDIS_URL` environment variable in your `.env` file (e.g., `REDIS_URL=redis://localhost:6379`).

2.  **Create Redis Utility (`apps/api/src/utils/redis.ts`)**:
    *   Install `ioredis`: `npm install ioredis`.
    *   Create `redis.ts` to initialize `redisClient` and export `connectRedis`, `setWithTTL`, `get`, and `del` functions. Implement connection retry logic and error handling.

    ```typescript
    // Example snippet for apps/api/src/utils/redis.ts
    import Redis from "ioredis";
    import logger from "./logger";

    export const redisClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

    export async function connectRedis() {
        // ... connection logic, error handling, retries ...
    }

    export async function setWithTTL(key: string, value: string, ttlSeconds: number) {
        if (!redisClient.isOpen) { /* handle error */ }
        await redisClient.set(key, value, "EX", ttlSeconds);
    }

    export async function get(key: string): Promise<string | null> {
        if (!redisClient.isOpen) { /* handle error */ }
        return redisClient.get(key);
    }

    export async function del(keys: string | string[]) {
        if (!redisClient.isOpen) { /* handle error */ }
        await redisClient.del(keys);
    }
    ```

3.  **Define Cache Seed Data (`apps/api/src/db/seeds/hot_drugs_seed.ts`)**:
    *   Create `hot_drugs_seed.ts` with the `DrugSeed` interface and the `hotDrugs` array containing initial drugs for cache warming.

4.  **Develop Cache Service (`apps/api/src/services/cache.service.ts`)**:
    *   Create `cache.service.ts`.
    *   Define `KEY_PREFIXES` (e.g., `DRUG_CACHE: "drug:"`) and `TTL_SECONDS` for `HOT_TIER_TTL`, `WARM_TIER_TTL`, `COLD_TIER_TTL`.
    *   Implement `getOrSet<T>(key: string, fetcher: () => Promise<T>, ttlSeconds: number)`:
        *   Call `redisClient.get(key)`.
        *   If `null`, call `fetcher()`, then `redisClient.setWithTTL(key, JSON.stringify(result), ttlSeconds)`.
        *   Log cache hits/misses.
    *   Implement `invalidateDrugCache(drugIds: string[])` to construct keys and call `redisClient.del()`.
    *   Implement `warmCache()`: Iterate `hotDrugs`, call `drugLookupService.lookupDrug()`, and use `getOrSet` with `HOT_TIER_TTL`.

5.  **Integrate Cache Service into `drugLookup.service.ts`**:
    *   Modify `apps/api/src/services/drugLookup.service.ts` (or relevant lookup functions) to use `cache.service.getOrSet()`.
    *   For example, a `lookupDrug` function would wrap its database call with `await cacheService.getOrSet(cacheKey, () => this.fetchDrugFromDB(drugId), TTL_SECONDS.WARM_TIER_TTL);`.

6.  **Update Application Entry Point (`apps/api/src/index.ts`)**:
    *   Import `connectRedis` and `warmCache`.
    *   Call `await connectRedis()` and `await warmCache()` before `app.listen()`.

7.  **Implement Graceful Shutdown (`apps/api/src/gracefulShutdown.ts`)**:
    *   Import `redisClient`.
    *   Add logic within `releaseDatabaseResources()` to call `await redisClient.quit()` to ensure a clean disconnect. Include `try-catch` for robustness.

8.  **Create Admin Invalidation Endpoint (`apps/api/src/routes/admin.routes.ts`)**:
    *   Add a `POST /cache/invalidate` route.
    *   Apply `requireAuth` and `requireRole("admin", "moderator")` middleware.
    *   In the handler, parse `drugIds` and `batchNumbers` from `req.body`.
    *   Call `invalidateDrugCache(drugIds)` and `redisClient.del(batchKeys)` as appropriate.

9.  **Update `apps/api/src/app.ts`**:
    *   Adjust `CSRF_SECRET` check.
    *   Review and potentially reorder middleware (e.g., `cors` after `cookieParser`).
    *   Adjust role requirements for routes like `/api/analytics`.
    *   Remove any unused route imports.

10. **Add i18n Files**:
    *   Create new JSON files for each locale (e.g., `as.json`, `bn.json`, `gu.json`, etc.) in `apps/web/messages/` with translations for the "How It Works" page.

11. **Update Documentation**:
    *   Modify `docs/devtrack/README.md` and add new ADRs (e.g., `docs/devtrack/adr/ADR-XXX-feature-name.md`) to document these changes and decisions.

12. **Write Tests (`apps/api/tests/cache.service.test.ts`)**:
    *   Add unit tests for `cache.service.ts` covering cache hits, misses, TTLs, `warmCache`, and `invalidateDrugCache`.
    *   Add integration tests for the admin invalidation endpoint.
    *   Mock `ioredis` client interactions to isolate `cache.service` logic.

## Impact on System Architecture

This change profoundly impacts our SahiDawa backend architecture:

*   **Performance Enhancement**: The most immediate impact is a significant reduction in latency for CDSCO drug lookups. By serving responses from Redis, we bypass database I/O for cached items, leading to faster user experiences and a more responsive platform.
*   **Reduced Database Load**: The caching layer acts as a buffer, absorbing a large percentage of read requests for drug data. This drastically reduces the load on our primary database, freeing up resources for other operations and improving its overall stability and scalability.
*   **Increased Scalability**: With a robust caching layer, our API can now handle a much higher volume of concurrent drug lookup requests without proportional increases in database resource consumption. This is critical for scaling SahiDawa to a larger user base.
*   **Enhanced Operational Control**: The new admin invalidation endpoint provides our operations team with direct control over cached data, allowing for immediate responses to data updates or inconsistencies without requiring service restarts.
*   **Improved User Experience (i18n)**: The addition of extensive internationalization for the "How It Works" page directly contributes to a more inclusive and user-friendly platform, making SahiDawa accessible to a wider audience across India.
*   **New Critical Dependency**: Redis is now a critical component of our backend infrastructure. Its availability and performance directly impact the SahiDawa API's functionality and responsiveness. Monitoring and managing the Redis instance becomes a key operational concern.
*   **Architectural Clarity**: The introduction of a dedicated `CacheService` and `redis.ts` utility centralizes caching logic, making the system more modular and easier to understand for new contributors.

## Testing & Verification

We performed comprehensive testing and verification for this change:

1.  **Unit Tests**: The `apps/api/tests/cache.service.test.ts` file was added and updated to include extensive unit tests for the `CacheService`. These tests cover:
    *   Correct behavior for cache hits and misses.
    *   Proper application of TTLs for different cache tiers.
    *   Functionality of `warmCache()` to pre-populate data.
    *   Correctness of `invalidateDrugCache()` for removing specific entries.
    *   Mocking of `ioredis` client interactions to ensure isolated testing of the service logic.
    *   All 149 existing API tests were run and passed, ensuring no regressions.

2.  **Integration Tests**:
    *   The new `POST /cache/invalidate` admin endpoint was tested to ensure it correctly invalidates cache entries based on `drugIds` and `batchNumbers` and that role-based access control is enforced.
    *   End-to-end tests for drug lookup APIs (not explicitly detailed in the PR, but implied by the passing test suite) would have verified that the caching layer transparently intercepts requests and returns cached data when available.

3.  **Local Environment Verification**:
    *   The feature was deployed and tested locally, observing Redis logs and API response times to confirm cache hits/misses and performance improvements.
    *   The `connectRedis()` and `warmCache()` functions were verified to execute correctly on application startup.
    *   The graceful shutdown mechanism was tested to ensure `redisClient` disconnects cleanly.

4.  **Linting and Formatting**: `prettier --write` was executed on all changed files, ensuring adherence to our code style guidelines.

5.  **Git Status Verification**: `git rev-list --left-right --count feat/redis-cache-warming-ttl...upstream/main` confirmed that the branch was fully rebased and up-to-date with `main`, preventing unexpected merge conflicts.

**Edge Cases Considered**:
*   **Redis Connection Failure**: The `connectRedis()` utility includes retry logic and robust error logging to handle initial connection issues. If Redis becomes unavailable during runtime, the `getOrSet` mechanism would fall back to the `fetcher` (database call), albeit with performance degradation.
*   **Cache Invalidation of Non-existent Keys**: Calling `invalidateDrugCache` or `redisClient.del` on keys that do not exist in Redis is a no-op and does not cause errors.
*   **Concurrent Cache Access**: Redis inherently handles concurrent read/write operations efficiently, preventing race conditions within the cache itself.
*   **Data Consistency**: The tiered TTLs balance freshness. For immediate consistency needs, the admin invalidation endpoint provides a manual override.