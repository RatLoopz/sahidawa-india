# PR #2525 — feat: implement Upstash Redis caching for medicine search API

> **Merged:** 2026-06-24 | **Author:** @panditshubham766-dotcom | **Area:** Frontend | **Impact Score:** 13 | **Closes:** #2329

## What Changed

This pull request refactors the medicine search functionality within our `calculator` page. Previously, the search directly queried our Supabase database from the frontend. Now, we have introduced a new Next.js API route, `apps/web/lib/api/medicines/search/route.ts`, which acts as an intermediary, integrating an Upstash Redis caching layer to serve search results more efficiently. The frontend component `apps/web/app/[locale]/calculator/page.tsx` now fetches data from this new API route.

## The Problem Being Solved

Before this change, every medicine search initiated from the `calculator` page resulted in a direct query to our Supabase `medicines` table. This approach led to several inefficiencies: increased latency for users waiting for search results, higher load on our Supabase database, and redundant database queries for frequently searched medicine names. Issue #2329 specifically highlighted the need to optimize the performance of this critical search endpoint to improve user experience and reduce operational costs.

## Files Modified

- `apps/web/app/[locale]/calculator/page.tsx`
- `apps/web/lib/api/medicines/search/route.ts`
- `apps/web/lib/redis.ts`

## Implementation Details

The core of this feature lies in the introduction of a new Next.js API route and its integration with Upstash Redis.

1.  **Redis Client Initialization (`apps/web/lib/redis.ts`):**
    *   A new file, `apps/web/lib/redis.ts`, was created to centralize the Upstash Redis client instantiation.
    *   It imports the `Redis` class from the `@upstash/redis` library.
    *   The `redis` client instance is exported using `Redis.fromEnv()`, which automatically configures the client by reading environment variables such as `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. This simplifies deployment and credential management.

2.  **Medicine Search API Route (`apps/web/lib/api/medicines/search/route.ts`):**
    *   This new Next.js API route handles `GET` requests for medicine searches.
    *   It defines a `CACHE_TTL` constant set to `24 * 60 * 60` seconds (24 hours), determining how long search results are stored in the cache.
    *   The `escapePostgres(val: string)` helper function is defined to sanitize the incoming search query. It replaces special PostgreSQL `LIKE` pattern characters (`%`, `_`, `\`) with their backslash-escaped versions (`\%`, `\_`, `\\`). This prevents SQL injection vulnerabilities and ensures accurate pattern matching.
    *   Upon receiving a `GET` request, the route extracts the `q` (query) parameter from the URL. If the query is less than 2 characters, an empty array is immediately returned.
    *   A `cacheKey` is constructed using the escaped and lowercased query string (e.g., `med_search:paracetamol`).
    *   **Cache Lookup:** The system first attempts to retrieve data from Redis using `redis.get(cacheKey)`. If `cachedData` is found, it's immediately returned as a `NextResponse.json(cachedData)`, bypassing the database. A `try/catch` block surrounds this operation to log any Redis read errors without halting the request, allowing a fallback to the database.
    *   **Database Query:** If no data is found in the cache, the system proceeds to query the Supabase `medicines` table. It selects specific fields (`id, brand_name, generic_name, manufacturer, mrp, jan_aushadhi_price, composition, cdsco_approval_status`) and uses an `or` clause with `ilike` for both `brand_name` and `generic_name` to perform a case-insensitive partial match using the `escaped` query. Results are limited to 20.
    *   **Cache Write:** After a successful database query, the fetched `data` is stored in Redis using `redis.set(cacheKey, data, { ex: CACHE_TTL })`. This ensures subsequent requests for the same query will hit the cache. Similar to cache reads, a `try/catch` block handles potential Redis write errors, logging them but not preventing the database results from being returned.
    *   Finally, the fetched `data` (or an empty array if `data` is null) is returned as `NextResponse.json(data || [])`.
    *   A comprehensive `try/catch` block wraps the entire `GET` function to catch any unhandled errors, logging them and returning a `NextResponse.json({ error: "Internal Server Error" }, { status: 500 })`.

3.  **Frontend Integration (`apps/web/app/[locale]/calculator/page.tsx`):**
    *   The `searchMedicines` asynchronous function within `CalculatorPageContent` was updated.
    *   It no longer directly interacts with `supabase`. Instead, it now makes an `await fetch()` call to the new API route: ``/api/medicines/search?q=${encodeURIComponent(q)}``.
    *   The response is checked for `res.ok`, and the JSON data is parsed.
    *   The received data is then mapped to the `Medicine[]` type expected by the component, ensuring consistency.
    *   Error handling was updated to catch `fetch` network errors or non-OK responses from the API route, logging them and returning an empty array to the UI.

## Technical Decisions

1.  **Upstash Redis Selection:** We chose Upstash Redis for its serverless, globally distributed, and cost-effective nature. It integrates seamlessly with Next.js applications, providing a low-latency caching solution without the overhead of managing a dedicated Redis server. The `Redis.fromEnv()` method simplifies environment variable-based configuration, aligning with our existing infrastructure practices.
2.  **Next.js API Route for Decoupling:** Moving the search logic to a dedicated Next.js API route (`/api/medicines/search`) was a strategic decision. This decouples the data fetching and caching logic from the frontend UI component, improving modularity. It also allows us to perform server-side operations like database queries and caching without exposing sensitive credentials or logic directly to the client-side bundle. This pattern enhances security and maintainability.
3.  **Cache-Aside Strategy:** The implementation uses a cache-aside pattern. This means our application code is responsible for managing the cache. It first checks the cache, and if data is not found (a cache miss), it fetches from the database and then populates the cache. This provides a robust fallback mechanism to the database if the cache is unavailable or stale, ensuring data availability.
4.  **`escapePostgres` for Security and Correctness:** The inclusion of the `escapePostgres` function, specifically with backslash escaping for `%`, `_`, and `\` characters, is a critical security measure. It prevents potential SQL injection attacks when user-provided input is used in `ilike` clauses. It also ensures that these characters, when intended as literals in a search query, are correctly interpreted by PostgreSQL's `LIKE` operator, rather than as wildcards. This directly addresses potential CodeQL warnings related to database query sanitization.
5.  **24-Hour Cache TTL:** A 24-hour Time-To-Live (TTL) for cached medicine search results was chosen based on the assumption that medicine data (brand names, generic names, prices, etc.) does not change frequently. This relatively long TTL maximizes performance gains by reducing database hits while still allowing for eventual consistency with database updates.

## How To Re-Implement (Contributor Reference)

To re-implement this caching feature for a similar API endpoint, follow these steps:

1.  **Set up Upstash Redis:**
    *   Create an Upstash Redis database instance via the Upstash console.
    *   Obtain your `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
    *   Add these credentials to your `apps/web/.env.local` file (and to your deployment environment variables).

2.  **Install Upstash Redis Client:**
    *   Navigate to the `apps/web` directory in your terminal.
    *   Run `pnpm add @upstash/redis` to install the necessary library.

3.  **Create Redis Client Utility:**
    *   Create a new file: `apps/web/lib/redis.ts`.
    *   Add the following code to initialize and export the Redis client:
        ```typescript
        import { Redis } from "@upstash/redis";
        export const redis = Redis.fromEnv();
        ```

4.  **Develop the Next.js API Route with Caching:**
    *   Create a new API route file: `apps/web/lib/api/[your-endpoint-name]/route.ts` (e.g., `apps/web/lib/api/medicines/search/route.ts`).
    *   Define an `async function GET(request: NextRequest)` (or `POST`, `PUT`, etc., depending on your needs).
    *   Implement a helper function for escaping special characters if your database query uses `LIKE` or `ILIKE`:
        ```typescript
        function escapePostgres(val: string) {
            return val.replace(/[\\%_]/g, "\\$&");
        }
        ```
    *   Inside your `GET` handler:
        *   Extract necessary parameters from `request.url.searchParams`.
        *   Define a `CACHE_TTL` (e.g., `const CACHE_TTL = 24 * 60 * 60;`).
        *   Construct a unique `cacheKey` based on the request parameters (e.g., `const cacheKey = \`your_prefix:${escapedQuery.toLowerCase()}\`;`).
        *   **Cache Read:**
            ```typescript
            try {
                const cachedData = await redis.get(cacheKey);
                if (cachedData) {
                    return NextResponse.json(cachedData);
                }
            } catch (cacheError) {
                console.error("Redis cache read error:", cacheError);
                // Continue to database if cache read fails
            }
            ```
        *   **Database Query:** If no cache hit, perform your database query using `supabase` or your ORM.
            ```typescript
            const { data, error } = await supabase
                .from("your_table")
                .select("...")
                .filter("...", "...", "...") // Your query logic
                .limit(20);
            if (error) {
                throw error; // Or handle appropriately
            }
            ```
        *   **Cache Write:** After a successful database query, store the results in Redis.
            ```typescript
            try {
                await redis.set(cacheKey, data, { ex: CACHE_TTL });
            } catch (cacheError) {
                console.error("Failed to save to Redis cache:", cacheError);
                // Log error but don't prevent response
            }
            ```
        *   Return the data: `return NextResponse.json(data || []);`.
        *   Wrap the entire handler in a `try/catch` for robust error handling:
            ```typescript
            try {
                // ... all logic above ...
            } catch (error) {
                console.error("Error in API route:", error);
                return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
            }
            ```

5.  **Update Frontend Component (or calling client):**
    *   Modify the component that previously made direct database calls.
    *   Replace direct database calls with `fetch` requests to your new API route.
    *   Example from `apps/web/app/[locale]/calculator/page.tsx`:
        ```typescript
        const res = await fetch(`/api/[your-endpoint-name]?param=${encodeURIComponent(value)}`);
        if (!res.ok) {
            throw new Error("Failed to fetch data from API");
        }
        const data = await res.json();
        // Map data to your component's expected format
        return (data ?? []).map((row: any) => ({ /* ... */ }));
        ```
    *   Ensure robust error handling for the `fetch` call.

## Impact on System Architecture

This change significantly impacts our system architecture by introducing a critical caching layer for frequently accessed data.

*   **Performance Enhancement:** The primary impact is a substantial reduction in latency for medicine search queries. By serving cached results, we bypass the database for repeat requests, leading to faster response times for users.
*   **Reduced Database Load:** Offloading search queries to Redis significantly decreases the read load on our Supabase PostgreSQL database. This frees up database resources for other operations and improves the overall stability and scalability of our data layer.
*   **Improved Scalability:** The caching layer allows the medicine search feature to scale more effectively. Redis can handle a high volume of read requests independently of the database, making our platform more resilient to traffic spikes.
*   **Architectural Decoupling:** The introduction of a dedicated Next.js API route for medicine search promotes a cleaner, more modular architecture. The UI component is now decoupled from the data access and caching logic, making both parts easier to develop, test, and maintain.
*   **New Infrastructure Dependency:** We now have a dependency on Upstash Redis as an external service. This adds a new component to our infrastructure stack, requiring monitoring for its availability and performance.
*   **Foundation for Future Caching:** This implementation establishes a pattern for integrating Redis caching into other API endpoints, paving the way for broader performance optimizations across the SahiDawa platform.

## Testing & Verification

Verification of this change involved both functional and implicit performance testing.

*   **Functional Testing:** The "Proof of Work" screenshot demonstrates that the medicine search functionality on the `calculator` page continues to work as expected. Users can input search queries, and relevant medicine results are displayed correctly. This confirms that the new API route is correctly fetching data and the frontend is processing it.
*   **Performance Testing (Implicit):** While explicit performance benchmarks are not documented in this PR, the `type:performance` label and the PR description indicate that the primary goal was to reduce API latency. This would typically be verified by observing network request timings in browser developer tools, comparing response times before and after the caching implementation.
*   **Edge Cases Handled:**
    *   **Short Queries:** Queries with less than two characters are handled gracefully by returning an empty array, preventing unnecessary database or cache lookups.
    *   **Special Characters:** The `escapePostgres` function ensures that search queries containing PostgreSQL wildcard characters (`%`, `_`, `\`) are correctly escaped, preventing both SQL injection and unintended search behavior.
    *   **Cache Miss:** The system correctly falls back to querying the Supabase database when a requested item is not found in the Redis cache.
    *   **Redis Unavailability:** The `try/catch` blocks around Redis operations ensure that if Redis is temporarily unavailable or experiences an error, the system will log the issue and attempt to fetch data directly from the database, providing a robust fallback.
    *   **Database Errors:** Errors during the Supabase query are caught, logged, and result in a 500 Internal Server Error response from the API route, preventing unhandled exceptions.
    *   **Frontend Fetch Errors:** The frontend `searchMedicines` function includes error handling for network issues or non-200 responses from the API, ensuring the UI remains stable.
*   **Cache Hit/Miss Verification:** Not explicitly documented in this PR, but typically, a contributor would verify cache hits by making repeated requests for the same medicine query and observing that the response time is significantly faster after the initial request, and potentially by inspecting Redis logs or metrics.