# PR #3661 — fix adherence dose log pagination

> **Merged:** 2026-07-17 | **Author:** @Shreya-nipunge | **Area:** Backend | **Impact Score:** 9 | **Closes:** #3658

## What Changed

We replaced the hardcoded 500-record limit on the medicine schedule adherence statistics endpoint (`GET /api/schedules/:id/stats`) with a deterministic, paginated database retrieval loop. The backend now fetches matching dose logs in sequential pages of 500 records, ordered by their unique ID, until the entire dataset is retrieved. This ensures that the calculated adherence statistics (taken, skipped, and adherence percentage) are computed using the complete historical dataset rather than a truncated subset.

## The Problem Being Solved

Previously, our system capped the dose log retrieval query at 500 records using a hard `.limit(500)` constraint. For chronic patients in rural health programs who have long-term medicine schedules (e.g., daily or multi-daily doses spanning several months or years), the total number of dose logs quickly exceeds 500. 

This truncation caused several critical issues:
1. **Inaccurate Adherence Metrics:** The calculated adherence percentage was computed using a truncated list of dose logs against the total expected doses, leading to artificially depressed adherence scores.
2. **Missing UI Data:** The frontend could not display historical dose logs beyond the first 500 records.
3. **Non-Deterministic Results:** The query lacked an explicit ordering clause, meaning the database could return arbitrary records, leading to inconsistent statistics across different API requests.

## Files Modified

- `apps/api/src/routes/medicineSchedules.ts`
- `apps/api/tests/medicineSchedules.test.ts`

## Implementation Details

### Backend Route Refactoring

In `apps/api/src/routes/medicineSchedules.ts`, we introduced a pagination constant and refactored the database retrieval logic inside the `GET /:id/stats` route handler:

1. **Constant Definition:**
   We defined a fixed page size to control our database chunking:
   ```typescript
   const DOSE_LOG_PAGE_SIZE = 500;
   ```

2. **Deterministic Pagination Loop:**
   We replaced the single `.limit(500)` query with an iterative `while (true)` loop that utilizes Supabase's `.range()` and `.order()` builders:
   ```typescript
   const doseLogs: any[] = [];
   let offset = 0;

   while (true) {
       const { data: page, error: doseError } = await supabase
           .from("dose_logs")
           .select("*")
           .eq("schedule_id", req.params.id)
           .eq("user_id", req.user!.id)
           .gte("log_date", from)
           .lte("log_date", to)
           .order("id", { ascending: true })
           .range(offset, offset + DOSE_LOG_PAGE_SIZE - 1);

       if (doseError) {
           res.status(500).json({ error: "Failed to fetch adherence data" });
           return;
       }

       const currentPage = page ?? [];
       doseLogs.push(...currentPage);

       if (currentPage.length < DOSE_LOG_PAGE_SIZE) break;
       offset += DOSE_LOG_PAGE_SIZE;
   }
   ```

3. **Accurate Statistics Calculation:**
   Once the loop terminates, the complete `doseLogs` array is used to compute the metrics:
   - `takenCount`: Filtered where `status === "taken"`.
   - `skippedCount`: Filtered where `status === "skipped"`.
   - `adherencePercent`: Rounded ratio of `takenCount` to `expectedDoses`.

## Technical Decisions

### Why Offset Pagination via `.range()`?
We chose offset-based pagination using Supabase's `.range(start, end)` because it maps cleanly to Postgres's `LIMIT` and `OFFSET` capabilities while keeping the implementation straightforward. Since the primary key `id` is ordered, this guarantees that we do not skip records or process duplicates across page boundaries.

### Why Enforce Deterministic Ordering?
Without `.order("id", { ascending: true })`, Postgres does not guarantee the order of returned rows. Enforcing an explicit sort order on a unique column (`id`) is mathematically required when using offset-based pagination to ensure data consistency across sequential queries.

### Fail-Fast on Later Page Failures
If a database error occurs on any page request (e.g., the 3rd page of a 1500-record set fails due to a transient network issue), our system immediately aborts and returns a `500 Internal Server Error`. We explicitly decided *not* to return partial statistics, as presenting incomplete adherence data to healthcare workers could lead to incorrect clinical decisions.

## How To Re-Implement (Contributor Reference)

If you need to implement a similar pagination pattern for other high-volume endpoints in our system, follow these steps:

1. **Define Page Size:** Establish a constant page size (e.g., `500`) to prevent memory exhaustion on the API container.
2. **Initialize State:** Create an empty accumulator array (e.g., `const results: any[] = []`) and an offset tracker (e.g., `let offset = 0`).
3. **Execute Loop:** Wrap the query in a `while (true)` block.
4. **Apply Range and Order:**
   - Always chain `.order("unique_column_name", { ascending: true })` to ensure deterministic sorting.
   - Chain `.range(offset, offset + PAGE_SIZE - 1)` to fetch the correct slice.
5. **Handle Errors Immediately:** If the database client returns an error object, break execution, log the error, and return an error response to the client. Do not proceed with partial data.
6. **Accumulate and Evaluate:** Push the page results into your accumulator. If the returned page length is strictly less than your `PAGE_SIZE`, break the loop. Otherwise, increment your offset by `PAGE_SIZE` and repeat.

## Impact on System Architecture

- **Memory Footprint:** By chunking the database reads into pages of 500, we prevent massive single-query payloads from blocking the database connection pool or causing out-of-memory (OOM) errors on our Node.js API instances.
- **Data Integrity:** This change guarantees that clinical adherence reports generated by SahiDawa are 100% accurate, regardless of how long a patient has been on their medication schedule.

## Testing & Verification

We added comprehensive regression tests in `apps/api/tests/medicineSchedules.test.ts` to verify the pagination logic:

1. **Multi-Page Aggregation Test:**
   We mocked a scenario where a schedule has 600 total dose logs. The test mocks two consecutive database responses:
   - Page 1: 500 records (300 taken, 200 skipped).
   - Page 2: 100 records (100 taken).
   
   The test verifies that:
   - The endpoint returns a `200 OK` status.
   - The statistics are calculated correctly across both pages (expected: 600, taken: 400, skipped: 200, adherence: 67%).
   - The database client is called with the correct ranges: `range(0, 499)` and `range(500, 999)`.

2. **Error Resilience Test:**
   We verified that if the first page succeeds but the second page fails, the system returns a `500` error instead of calculating statistics on the partial first-page data.