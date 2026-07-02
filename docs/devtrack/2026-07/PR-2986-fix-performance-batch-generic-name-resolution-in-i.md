# PR #2986 — fix(performance): batch generic name resolution in interactions check

> **Merged:** 2026-07-02 | **Author:** @PremSahith | **Area:** Backend | **Impact Score:** 9 | **Closes:** #2985

## What Changed

We refactored the medicine resolution logic in our drug-drug interactions endpoint to eliminate an $O(N)$ database query pattern. Specifically, we replaced the individual, parallelized database queries in `apps/api/src/routes/interactions.ts` with a single, batched query. The deprecated `resolveToGeneric` function was replaced by `resolveMedicinesToGenerics`, which aggregates all input medicines, constructs a unified PostgREST `.or()` query, and maps the database results back to the original inputs in memory.

## The Problem Being Solved

Before this PR, our `POST /interactions/check` endpoint suffered from an $O(N)$ N+1 query vulnerability. When a user submitted a list of $N$ medicines to check for interactions, the system executed $N$ separate, concurrent database queries via `Promise.all` to resolve each brand name to its generic counterpart. 

While executing these queries in parallel avoided blocking the Node.js event loop, it placed a severe connection and query load on our Supabase PostgreSQL database. For a typical check involving 15 to 20 medicines, this generated 15 to 20 independent `SELECT` statements simultaneously. Under high traffic—particularly in rural health settings with unstable connections—this pattern led to database connection pool exhaustion, increased API latency, and unnecessary database CPU spikes.

## Files Modified

- `apps/api/src/routes/interactions.ts`

## Implementation Details

### 1. Batch Resolution Function (`resolveMedicinesToGenerics`)
We introduced `resolveMedicinesToGenerics(inputs: string[])` to handle the resolution of an array of medicine strings in a single database round-trip:
* **Input Sanitization:** The function maps over the input array, trims whitespace, and filters out empty values using `inputs.map((i) => i.trim()).filter(Boolean)`.
* **Query Batching:** Instead of querying row-by-row, we map each clean input through our existing `buildMedicineResolutionFilter` helper and join them with commas to construct a single, massive PostgREST OR query string:
  ```typescript
  const orQuery = cleanInputs.map(buildMedicineResolutionFilter).join(",");
  ```
* **Single Database Call:** We execute a single query against the `medicines` table using the constructed OR filter:
  ```typescript
  const { data, error } = await supabase
      .from("medicines")
      .select("brand_name, generic_name")
      .or(orQuery);
  ```

### 2. In-Memory Mapping
Because the database returns a flat array of matching rows, we perform the mapping back to the original inputs in memory. We initialize a `resultsMap` (defaulting each input to itself). If the database returns data, we iterate through the original inputs and search the returned dataset for a match where either the `brand_name` or `generic_name` contains the lowercased input. If a match is found, we update the `resultsMap` with the resolved `generic_name`.

### 3. Unified Offline Fallback
If the database query fails or if the system is flagged as offline (`dbConfig.isSupabaseOffline`), we fall back to our local static map (`localBrandMap`). We loop through all inputs, normalize them using `normalizeOfflineBrandName`, and retrieve the generic name from the local map, updating the `resultsMap` accordingly.

### 4. Route Integration
In the `POST /check` route handler, we replaced the parallelized `Promise.all` block:
```typescript
// Deprecated O(N) approach
const resolvedList = await Promise.all(
    medicines.map((medicine) => resolveToGeneric(medicine))
);
```
with our new batched call:
```typescript
// Optimized O(1) approach
const resolvedList = await resolveMedicinesToGenerics(medicines);
```

## Technical Decisions

* **PostgREST `.or()` Query Construction:** We chose to leverage PostgREST's native `.or()` filter. By joining individual filters with commas, we instruct Supabase to execute a single SQL query with an `OR` clause. This allows the PostgreSQL query planner to optimize the execution using existing indexes on the `brand_name` and `generic_name` columns.
* **In-Memory Matching over DB-Side Joins:** Since the input array size for an interaction check is relatively small (typically under 30 medicines), performing case-insensitive string matching (`includes` and `toLowerCase`) in Node.js memory is extremely fast and avoids complex database-side string manipulation or temporary tables.
* **Map-Based Defaults:** We initialize the `resultsMap` with the original input as the default generic name. This ensures that if a medicine cannot be resolved (either via the database or the offline fallback), it gracefully falls back to using the input string itself, maintaining backward compatibility and preventing runtime crashes.

## How To Re-Implement (Contributor Reference)

If you need to re-implement or adapt this batching pattern for another endpoint, follow these steps:

1. **Define the Batch Function:** Create an asynchronous function that accepts an array of string inputs and returns a promise resolving to an array of objects mapping the input to the resolved value.
2. **Sanitize Inputs:** Clean the input array by trimming whitespace and filtering out falsy values.
3. **Initialize the Default Map:** Create a `Map<string, string>` where the key is the lowercased input and the value is the original input. This acts as your fallback if no match is found.
4. **Build the Batched Filter:** Map each input through your filter-building utility and join them with a comma to create a single query string compatible with Supabase's `.or()` filter.
5. **Execute and Handle Errors:** Wrap the Supabase call in a `try/catch` block. If an error occurs or the database is offline, set a fallback flag.
6. **Map Results in Memory:** If the query succeeds, iterate through your original inputs. For each input, search the returned database rows for a match (using case-insensitive comparisons on the relevant fields) and update your `Map` with the resolved database value.
7. **Apply Offline Fallback:** If the fallback flag is active, loop through the inputs, run your offline normalization function, look up the values in your local static dictionary, and update the `Map`.
8. **Return Formatted Output:** Map the original inputs array to the final output structure, retrieving the resolved values from your `Map` (defaulting to the original input if undefined).

## Impact on System Architecture

* **Database Scalability:** This change reduces the database query load for interaction checks from $O(N)$ to exactly $O(1)$ database queries per request. This significantly lowers the risk of connection pool exhaustion on our Supabase instance, especially during peak usage in rural clinics where multiple health workers might perform checks simultaneously.
* **Network Latency:** Consolidating multiple HTTP requests to Supabase into a single round-trip minimizes network overhead and improves the overall response time of the `POST /interactions/check` endpoint.
* **Offline Resilience:** The batching logic seamlessly integrates with our offline fallback mechanism, ensuring that even when the database is unreachable, the entire batch of medicines is resolved instantly using the local static map without changing the output structure.

## Testing & Verification

* **Compilation:** Verified that TypeScript compilation passes with zero errors via `npm run build -w apps/api`.
* **Functional Verification:** Manually tested the API to ensure that the single batched query correctly resolves brand names to generic names and returns the exact same array structure as the previous implementation.
* **Offline Fallback Verification:** Simulated database failures to verify that the system successfully falls back to `localBrandMap` for all batched inputs and updates the offline state flag correctly.