# PR #2377 — fix(api): build single .or() expression for scan/match fallback

> **Merged:** 2026-06-22 | **Author:** @vipul674 | **Area:** Backend | **Impact Score:** 9 | **Closes:** #2374

## What Changed

This pull request addresses a critical bug in the `POST /api/v1/scan/match` API endpoint. We have refactored the fallback database search logic to correctly construct multi-word OR queries using the Supabase client. Instead of iteratively calling the `.or()` method, which led to previous conditions being overwritten, we now build a single, comma-separated string of all OR conditions and pass it in a single call to the Supabase client.

## The Problem Being Solved

Before this change, the `POST /api/v1/scan/match` endpoint suffered from a silent bug in its fallback search mechanism. When a user searched for a multi-word query, such as "paracetamol 500mg", the system would attempt to find medicines matching any of the words. However, due to an incorrect usage pattern with the Supabase JavaScript client, the `.or()` method was called in a loop for each word. This iterative calling of `.or()` was observed to overwrite previously set filter conditions within the Supabase client's internal query builder. Consequently, only the _last_ word in the search query was effectively applied as a filter, meaning a search for "paracetamol 500mg" would only return results related to "500mg", leading to incomplete and misleading search results for our users. This issue was tracked in #2374.

## Files Modified

- `apps/api/src/routes/scan.ts`

## Implementation Details

The core of this fix resides within the `router.post("/match", scanQueryLimiter, async (req: Request, res: Response) => { ... })` handler in `apps/api/src/routes/scan.ts`. Specifically, the modification targets the fallback search logic that executes when the initial scan/match attempts do not yield results and the input query contains multiple words (`if (words.length > 1)`).

Previously, the code constructed the fallback query as follows:

```typescript
let fallbackQuery = supabase.from("medicines").select("brand_name, generic_name");
for (const word of words) {
    fallbackQuery = fallbackQuery.or(
        `brand_name.ilike.%${escapePostgrest(word)}%,generic_name.ilike.%${escapePostgrest(word)}%`
    );
}
const { data: fallback } = await (fallbackQuery as any).limit(3);
```

This approach, where `fallbackQuery` was reassigned in each iteration using `.or()`, was the root cause of the bug.

The updated implementation replaces this loop with a more robust pattern:

1.  It first maps the `words` array (obtained by splitting the input query and filtering words shorter than 3 characters) into an array of individual OR condition strings. Each string represents a condition to match the word in either `brand_name` or `generic_name` using `ilike` (case-insensitive like). The `escapePostgrest` utility function is used to sanitize each word for safe inclusion in the PostgREST query.
    ```typescript
    const orConditions = words
        .map(
            (w: string) =>
                `brand_name.ilike.%${escapePostgrest(w)}%,generic_name.ilike.%${escapePostgrest(w)}%`
        )
        .join(",");
    ```
2.  These individual condition strings are then joined together into a single comma-separated string using `.join(",")`. This combined string represents the full set of OR conditions.
3.  Finally, this single `orConditions` string is passed as an argument to a _single_ `.or()` call on the Supabase query builder, ensuring that all conditions are applied simultaneously and correctly.
    `typescript
const { data: fallback } = await supabase
    .from("medicines")
    .select("brand_name, generic_name")
    .or(orConditions) // The combined OR expression is passed here
    .limit(3);
`
    This change ensures that a query like "paracetamol 500mg" correctly translates into a Supabase query that searches for `(brand_name ILIKE '%paracetamol%' OR generic_name ILIKE '%paracetamol%') OR (brand_name ILIKE '%500mg%' OR generic_name ILIKE '%500mg%')`.

## Technical Decisions

The primary technical decision was to understand and correctly implement the Supabase client's `.or()` method behavior. Our investigation revealed that chaining `.or()` calls in a loop, as was done previously, did not accumulate conditions as expected but rather replaced them. The Supabase PostgREST client is designed to accept a single string containing multiple comma-separated conditions for logical OR operations.

Therefore, the chosen approach was to:

1.  **Generate individual condition clauses:** For each search term, create a complete `ilike` clause for both `brand_name` and `generic_name`.
2.  **Aggregate and join:** Collect these clauses into an array and then use `Array.prototype.join(',')` to concatenate them into a single string. This is a standard and efficient JavaScript pattern for dynamic string construction.
3.  **Single `.or()` call:** Pass this comprehensive string to the `.or()` method once. This correctly instructs the Supabase client to apply all specified conditions as a single logical OR expression.

This approach was chosen because it directly aligns with the expected usage of the Supabase client for complex OR queries, resolving the bug without introducing new dependencies or significantly altering the query structure beyond the `.or()` call itself. No alternative Supabase client methods were considered as the issue was with the pattern of usage, not the availability of different methods.

## How To Re-Implement (Contributor Reference)

To re-implement this feature or understand the exact flow for similar dynamic OR queries:

1.  **Locate the API Endpoint:** Navigate to `apps/api/src/routes/scan.ts` and find the `router.post("/match", ...)` handler.
2.  **Identify Fallback Logic:** Within this handler, locate the `if (words.length > 1)` block, which is responsible for the multi-word fallback search.
3.  **Prepare Search Terms:** Ensure the `words` array is correctly populated from the user's query, typically by splitting the query string and filtering out short words (e.g., `word.length > 2`).
4.  **Construct Individual OR Clauses:** For each `word` in the `words` array, you need to generate a string that represents the `ILIKE` condition for the relevant database columns. In this case, `brand_name` and `generic_name`. Remember to use the `escapePostgrest(word)` helper function to prevent SQL injection and ensure correct pattern matching.
    ```typescript
    const singleWordCondition = `brand_name.ilike.%${escapePostgrest(word)}%,generic_name.ilike.%${escapePostgrest(word)}%`;
    ```
5.  **Aggregate and Join Conditions:** Use `Array.prototype.map()` to transform the `words` array into an array of these `singleWordCondition` strings. Then, use `Array.prototype.join(',')` to combine them into a single comma-separated string. This string will be the complete OR expression.
    ```typescript
    const allOrConditionsString = words
        .map(
            (w: string) =>
                `brand_name.ilike.%${escapePostgrest(w)}%,generic_name.ilike.%${escapePostgrest(w)}%`
        )
        .join(",");
    ```
6.  **Execute Supabase Query:** Initiate your Supabase query, selecting the necessary columns, and then apply the `allOrConditionsString` to the `.or()` method. Finally, apply any limits or other modifiers.
    ```typescript
    const { data: results } = await supabase
        .from("your_table_name") // In this case, "medicines"
        .select("column1, column2") // In this case, "brand_name, generic_name"
        .or(allOrConditionsString) // CRITICAL: Pass the combined string here
        .limit(3); // Apply any limits
    ```
7.  **Process Results:** Handle the `data` returned from the Supabase query, mapping it to the desired output format for the API response.

## Impact on System Architecture

This change primarily refines the data retrieval logic within the existing `POST /api/v1/scan/match` API endpoint. It does not introduce new architectural components or alter the overall system design. Its impact is focused on improving the reliability and accuracy of search results for multi-word queries, which is crucial for the SahiDawa platform's core functionality of medicine verification. By ensuring that all search terms are correctly considered, we enhance the user experience and the trustworthiness of our search capabilities. This fix solidifies the robustness of our backend API's interaction with the Supabase database for complex filtering operations.

## Testing & Verification

The verification for this change primarily involved testing the `POST /api/v1/scan/match` endpoint with multi-word queries.

- **Manual Testing:** The PR description explicitly outlines the expected behavior change:
    - **Before:** A search for "paracetamol 500mg" would only yield results matching "500mg".
    - **After:** A search for "paracetamol 500mg" correctly yields results matching either "paracetamol" OR "500mg".
      This indicates that manual testing was performed by sending requests to the API with problematic multi-word inputs and observing the corrected output.
- **Edge Cases Considered:**
    - **Single-word queries:** The `if (words.length > 1)` condition ensures that single-word queries bypass this specific fallback logic, so their behavior remains unchanged and correct.
    - **Short words:** The `filter((w: string) => w.length > 2)` ensures that very short words (e.g., "a", "of") are excluded from the fallback search, maintaining the intended filtering behavior.
    - **Special characters:** The continued use of `escapePostgrest` ensures that search terms containing special characters are properly sanitized before being included in the PostgREST query, preventing syntax errors or injection vulnerabilities.
- **Automated Testing:** Not documented in this PR.
