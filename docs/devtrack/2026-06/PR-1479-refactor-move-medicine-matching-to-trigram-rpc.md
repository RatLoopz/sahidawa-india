# PR #1479 — refactor: move medicine matching to trigram RPC

> **Merged:** 2026-06-07 | **Author:** @ash1shkumar | **Area:** Backend | **Impact Score:** 9 | **Closes:** #1458

## What Changed

We refactored the `/api/v1/scan/match` endpoint in `apps/api/src/routes/scan.ts` to significantly improve performance and scalability. The previous server-side medicine matching logic, which involved fetching candidates with a Supabase `.or()` query and then performing in-memory Levenshtein similarity scoring, has been replaced. We now leverage an existing PostgreSQL Remote Procedure Call (RPC), `search_medicines_text`, which utilizes `pg_trgm` for efficient database-side similarity matching and ranking.

## The Problem Being Solved

Before this change, the `/api/v1/scan/match` endpoint suffered from several performance and scalability issues:

1.  **Inefficient Candidate Retrieval:** The initial database query used a broad `ilike` `.or()` clause across `brand_name` and `generic_name` columns to fetch up to 100 potential medicine candidates. This could be inefficient, especially with a growing `medicines` dataset, as it might retrieve many irrelevant records.
2.  **High Server-Side Computational Load:** After fetching candidates, the application server (Node.js) performed computationally expensive Levenshtein distance calculations for each candidate using the `getLevenshteinDistance()` and `getSimilarity()` functions. This in-memory processing consumed significant CPU resources and added latency to the API response.
3.  **Limited Scalability:** As the number of medicine entries in our database increased, or as the volume of scan requests grew, the server-side processing would become a bottleneck, directly impacting the responsiveness and throughput of the API.
4.  **Suboptimal Similarity Matching:** While Levenshtein distance is a valid metric, `pg_trgm` offers highly optimized and often more accurate text similarity matching for search scenarios, leveraging specialized database indexes (GIN indexes) for superior performance.

## Files Modified

-   `apps/api/src/routes/scan.ts`

## Implementation Details

The core of this refactor lies within the `router.post("/match", ...)` handler in `apps/api/src/routes/scan.ts`.

1.  **Removal of Server-Side Similarity Logic:**
    *   The `getLevenshteinDistance(a: string, b: string): number` function, which calculated the Levenshtein distance between two strings, was removed.
    *   The `getSimilarity(a: string, b: string): number` function, which used `getLevenshteinDistance` to compute a percentage similarity score, was also removed. These functions are no longer needed as similarity scoring is now handled by the database.

2.  **Migration to PostgreSQL RPC:**
    *   The previous Supabase query, which looked like this:
        ```typescript
        const keyword = query.trim().split(/\s+/)[0];
        const safeKeyword = escapeIlike(keyword);
        const { data, error } = await supabase
            .from("medicines")
            .select("brand_name, generic_name")
            .or(`brand_name.ilike.%${safeKeyword}%,generic_name.ilike.%${safeKeyword}%`)
            .limit(100);
        ```
        was entirely replaced.
    *   The new implementation directly calls an existing PostgreSQL RPC:
        ```typescript
        const { data, error } = await supabase.rpc("search_medicines_text", {
            query_text: query,
            match_count: 3,
        });
        ```
    *   The `search_medicines_text` RPC (which is an existing database function, not defined in this PR) is responsible for:
        *   Receiving the user's `query_text` and a `match_count` (set to `3` in this implementation).
        *   Performing efficient trigram-based similarity matching against medicine names (likely `brand_name` and `generic_name`) using `pg_trgm` operators and functions.
        *   Ranking the results by similarity score directly within the database.
        *   Limiting the output to the top `match_count` results.
        *   Returning a structured result set that includes `brand_name`, `generic_name`, and a `similarity` score (expected to be a numeric value, typically between 0 and 1).

3.  **Simplified Result Processing:**
    *   The complex post-query processing logic, which involved creating a `Set` of unique candidate names, mapping them to scores using `getSimilarity()`, filtering for scores `>= 50`, sorting by score, and slicing to the top 3, was removed.
    *   The `data` returned by the `search_medicines_text` RPC is now directly mapped to the required API response format:
        ```typescript
        const matches = data.map(
            (medicine: {
                brand_name: string | null;
                generic_name: string;
                similarity: number | null;
            }) => ({
                name: medicine.brand_name || medicine.generic_name,
                score: Math.round((medicine.similarity ?? 0) * 100),
            })
        );
        ```
        This transformation takes the `brand_name` (if available) or `generic_name` as the `name` and converts the RPC's `similarity` score (a float) into a rounded percentage integer for the `score` field, maintaining the existing API contract.

## Technical Decisions

1.  **Leveraging `pg_trgm` for Similarity:** We chose to move to `pg_trgm` because it is a highly optimized PostgreSQL extension specifically designed for efficient text similarity searches using trigrams. It can utilize GIN indexes, providing significantly faster performance for fuzzy matching compared to application-level string algorithms like Levenshtein, especially on large datasets.
2.  **Database-Side Processing for Performance:** The decision to offload the computationally intensive similarity scoring and ranking to the PostgreSQL database was made to drastically improve the performance and reduce the latency of the `/api/v1/scan/match` endpoint. Databases are highly optimized for data retrieval, filtering, and sorting, making them ideal for this kind of task. This frees up the Node.js application server to handle more requests.
3.  **Utilizing Supabase RPC:** Supabase provides a seamless way to interact with custom PostgreSQL functions via `supabase.rpc()`. This integrates cleanly with our existing Supabase client and allows us to encapsulate complex database logic within the database itself, promoting a cleaner separation of concerns.
4.  **Maintaining API Contract:** A critical decision was to ensure that the external API response format (`[{ "name": "Medicine Name", "score": 87 }]`) remained unchanged. This preserves backward compatibility with all existing consumers of the `/api/v1/scan/match` endpoint, preventing breaking changes and minimizing coordination efforts.
5.  **Code Simplification:** Removing the custom `getLevenshteinDistance` and `getSimilarity` functions, along with the complex in-memory candidate processing, significantly simplifies the application's codebase. This reduces maintenance overhead and makes the `scan.ts` route easier to understand.

## How To Re-Implement (Contributor Reference)

To re-implement this feature from scratch, a contributor would follow these steps:

1.  **Verify/Create PostgreSQL `search_medicines_text` RPC:**
    *   Ensure that a PostgreSQL function named `search_medicines_text` exists in the SahiDawa Supabase database.
    *   This function must accept two parameters: `query_text TEXT` (the search query) and `match_count INT` (the number of top matches to return).
    *   The RPC's return type should be a `SETOF` a composite type or a table structure that includes `brand_name TEXT`, `generic_name TEXT`, and `similarity NUMERIC` (where `similarity` is typically a float between 0 and 1).
    *   The function's logic should use `pg_trgm` functions (e.g., `similarity()`, `word_similarity()`) to compare `query_text` against `medicines.brand_name` and `medicines.generic_name`.
    *   It must order the results by the calculated similarity score in descending order and limit the output to `match_count`.
    *   **Conceptual RPC Example (actual RPC not in this PR):**
        ```sql
        CREATE EXTENSION IF NOT EXISTS pg_trgm; -- Ensure pg_trgm is enabled

        CREATE OR REPLACE FUNCTION public.search_medicines_text(
            query_text TEXT,
            match_count INT DEFAULT 3
        )
        RETURNS TABLE (
            brand_name TEXT,
            generic_name TEXT,
            similarity NUMERIC
        )
        LANGUAGE plpgsql
        AS $$
        BEGIN
            RETURN QUERY
            SELECT
                m.brand_name,
                m.generic_name,
                GREATEST(
                    COALESCE(similarity(LOWER(query_text), LOWER(m.brand_name)), 0),
                    COALESCE(similarity(LOWER(query_text), LOWER(m.generic_name)), 0)
                ) AS similarity_score
            FROM
                public.medicines m
            WHERE
                LOWER(query_text) % LOWER(m.brand_name) OR LOWER(query_text) % LOWER(m.generic_name)
            ORDER BY
                similarity_score DESC
            LIMIT match_count;
        END;
        $$;
        ```
    *   Ensure appropriate GIN indexes are created on `brand_name` and `generic_name` for `pg_trgm` to be effective (e.g., `CREATE INDEX trgm_idx_medicines_brand_name ON public.medicines USING GIN (brand_name gin_trgm_ops);`).

2.  **Modify API Endpoint (`apps/api/src/routes/scan.ts`):**
    *   Locate the `router.post("/match", ...)` handler.
    *   **Remove Old Functions:** Delete the `getLevenshteinDistance` and `getSimilarity` functions from the file.
    *   **Replace Database Query:**
        *   Remove the previous `supabase.from("medicines").select(...).or(...)` call and any associated `keyword` or `safeKeyword` processing.
        *   Replace it with the `supabase.rpc()` call:
            ```typescript
            const { data, error } = await supabase.rpc("search_medicines_text", {
                query_text: query,
                match_count: 3, // Or a configurable value if needed
            });
            ```
    *   **Update Result Mapping:**
        *   Remove the old post-processing logic that involved `candidates`, `scored`, `filter`, `sort`, and `slice`.
        *   Replace it with the direct mapping of the RPC results:
            ```typescript
            const matches = data.map(
                (medicine: {
                    brand_name: string | null;
                    generic_name: string;
                    similarity: number | null;
                }) => ({
                    name: medicine.brand_name || medicine.generic_name,
                    score: Math.round((medicine.similarity ?? 0) * 100),
                })
            );
            ```
    *   **Maintain Error Handling:** Ensure that `if (error)` blocks and `logger.error` calls remain in place to handle potential RPC errors.

## Impact on System Architecture

This refactor has a significant positive impact on our system architecture:

1.  **Enhanced Performance and Scalability:** By offloading the computationally intensive fuzzy matching to PostgreSQL's `pg_trgm` extension, we drastically improve the performance of the `/api/v1/scan/match` endpoint. This reduces the CPU load on our Node.js API servers, allowing them to handle a higher volume of requests and improving overall system responsiveness. The database, with its optimized indexing, is far better suited for this task at scale.
2.  **Reduced Application Server Complexity:** The application server's codebase for medicine matching is now much simpler. We've removed custom string similarity algorithms and complex in-memory data manipulation, leading to cleaner, more maintainable code within `apps/api/src/routes/scan.ts`.
3.  **Optimized Resource Utilization:** Shifting the workload to the database leverages its strengths for data processing, freeing up application server resources for other tasks. This leads to more efficient use of our infrastructure.
4.  **Foundation for Advanced Search:** This change establishes a robust pattern for implementing efficient, database-driven fuzzy search capabilities. It sets the stage for potentially integrating more advanced text search features across the SahiDawa platform without burdening the application layer.
5.  **Increased Database Dependency for Business Logic:** While beneficial for performance, this change increases the amount of business logic residing within the database via RPCs. This requires careful management and versioning of database functions.

## Testing & Verification

The following verification steps were performed for this change:

*   **RPC Usage Confirmation:** We confirmed that the `/api/v1/scan/match` endpoint now correctly invokes the `search_medicines_text` PostgreSQL RPC.
*   **Code Removal Verification:** We verified the complete removal of the previous `.or()` candidate search logic, the `getSimilarity()` function, and the `getLevenshteinDistance()` function from `apps/api/src/routes/scan.ts`.
*   **Response Structure Validation:** We confirmed that the API response structure for `/api/v1/scan/match` remains unchanged, returning an array of objects with `name` (string) and `score` (integer) fields, e.g., `[ { "name": "Medicine Name", "score": 87 } ]`.
*   **Database-Side Ranking:** We verified that the ranking and filtering of medicine matches are now performed entirely by the database through the `search_medicines_text` RPC, utilizing trigram similarity for ordering.
*   **Scope Check:** We ensured that only the intended route implementation (`/api/v1/scan/match`) was modified, preventing any unintended side effects on other parts of the API.

**Edge Cases:**
*   **Empty Query:** Not documented in this PR, but the `search_medicines_text` RPC is expected to handle an empty `query_text` gracefully, likely returning an empty result set.
*   **No Matches:** If the RPC returns no matches, the API should correctly respond with an empty JSON array `[]`.
*   **Case Sensitivity:** Not documented in this PR, but the `search_medicines_text` RPC is expected to perform case-insensitive matching, similar to the previous Levenshtein implementation which used `toLowerCase()`.