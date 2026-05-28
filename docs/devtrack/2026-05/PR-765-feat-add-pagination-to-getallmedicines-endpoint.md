# PR #765 — feat: add pagination to getAllMedicines endpoint

> **Merged:** 2026-05-27 | **Author:** @Midoriya-w | **Area:** Backend | **Impact Score:** 6 | **Closes:** #743

## What Changed

We have updated the `getAllMedicines` admin controller endpoint in `apps/api/src/controllers/admin.controller.ts` to support dynamic pagination. This involved replacing a hardcoded `.limit(50)` in the Supabase query with dynamic `page` and `limit` parameters derived from `req.query`. The API response now includes a `meta` object containing pagination details such as `total`, `page`, `limit`, and `totalPages`, alongside the fetched medicine data.

## The Problem Being Solved

Previously, our `getAllMedicines` endpoint in `apps/api/src/controllers/admin.controller.ts` utilized a fixed `.limit(50)` clause when querying the Supabase `medicines` table. This design flaw meant that the API would only ever return the first 50 medicine records, regardless of the actual size of our medicine database. As the SahiDawa platform's medicine inventory grows, this led to silent data truncation, rendering any records beyond the 50th inaccessible to administrative clients. This lack of full data accessibility and the absence of any indication to the frontend that more data existed severely hindered the scalability and administrative usability of the platform, making it impossible to manage a comprehensive and growing list of Indian medicines effectively.

## Files Modified

- `apps/api/src/controllers/admin.controller.ts`
- `package-lock.json`

## Implementation Details

The core changes for implementing pagination are encapsulated within the `getAllMedicines` asynchronous function in `apps/api/src/controllers/admin.controller.ts`.

1.  **Error Handling Wrapper:** The entire logic of the `getAllMedicines` function is now wrapped in a `try-catch` block. This ensures that any unexpected errors during parameter parsing, database interaction, or response generation are caught, preventing server crashes and returning a `500 Internal server error` to the client.

2.  **Query Parameter Parsing:**
    - We extract `page` and `limit` from `req.query`.
    - `parseInt(req.query.page as string) || 1;` parses the `page` query parameter. If `page` is not provided or is invalid, it defaults to `1`.
    - `parseInt(req.query.limit as string) || 50;` parses the `limit` query parameter. If `limit` is not provided or is invalid, it defaults to `50` records per page.

3.  **Offset Calculation:**
    - The `offset` for the database query is calculated using the standard formula for offset-based pagination: `const offset = (page - 1) * limit;`. This determines the starting record index for the current page.

4.  **Supabase Query Modification:**
    - The previous Supabase query `supabase.from('medicines').select('*').limit(50);` was replaced with a more advanced query:
        ```typescript
        const { data, error, count } = await supabase
          .from('medicines')
          .select('*', { count: 'exact' })
          .range(offset, offset + limit - 1);
        ```
    - `select('*', { count: 'exact' })`: This is a critical change. It instructs Supabase to not only fetch the selected columns but also to return the total count of records that match the query *before* any pagination is applied. This `count` is essential for calculating the total number of pages.
    - `.range(offset, offset + limit - 1)`: This method is used for pagination. Supabase's `range` is inclusive for both its start and end parameters. Therefore, `offset` defines the starting index (0-based), and `offset + limit - 1` defines the inclusive end index for the current page's records.

5.  **Supabase Error Handling:**
    - After the Supabase query, we check `if (error)`. If an error occurs during the database operation, we respond with `res.status(500).json({ error: 'Failed to fetch medicines' });`.

6.  **Response Structure:**
    - The API response is now structured to include both the paginated data and metadata:
        ```typescript
        res.json({
          medicines: data,
          meta: {
            total: count || 0,
            page,
            limit,
            totalPages: count ? Math.ceil(count / limit) : 0
          }
        });
        ```
    - `medicines: data`: This key holds the array of medicine records for the current page.
    - `meta`: This object provides comprehensive pagination information:
        - `total`: The total number of medicine records in the database (from `count`). Defaults to `0` if `count` is null.
        - `page`: The current page number being returned.
        - `limit`: The number of items requested per page.
        - `totalPages`: Calculated as `Math.ceil(count / limit)`, providing the total number of pages available based on the `total` count and `limit`. Defaults to `0` if `count` is null.

7.  **`package-lock.json` Update:**
    - The `package-lock.json` file was updated. This primarily reflects an upgrade of the `express-rate-limit` dependency from `^8.5.1` to `^8.5.2`. Additionally, several `peer` dependency flags were adjusted for various packages. These changes are a standard outcome of running `npm install` or `npm update` during the rebase process and are not directly tied to the pagination feature's implementation logic.

## Technical Decisions

We made several key technical decisions in implementing this pagination:

1.  **Offset-Based Pagination:** We opted for offset-based pagination using Supabase's `.range()` method. This is a widely understood and straightforward approach for fetching sequential blocks of data, suitable for most administrative UIs where users navigate through pages.
2.  **Efficient Total Count Retrieval:** The decision to use `select('*', { count: 'exact' })` in the Supabase query was crucial. This allows us to retrieve the total number of records in the `medicines` table (before pagination is applied) in a single database call, alongside the paginated data. This avoids the need for a separate, potentially expensive, `COUNT(*)` query, optimizing database interaction and reducing latency.
3.  **Standardized `meta` Object:** Returning a `meta` object in the API response is a common and recommended practice for paginated APIs. This provides clients with all necessary information (`total`, `page`, `limit`, `totalPages`) to accurately render pagination controls, display status messages (e.g., "Showing 1-50 of 1000 items"), and construct subsequent requests for other pages.
4.  **Robust Parameter Handling:** Implementing `parseInt()` with logical OR (`||`) fallbacks for `page` and `limit` ensures that the endpoint remains functional and predictable even if clients omit or provide invalid pagination query parameters. This enhances API robustness and developer experience.
5.  **Comprehensive Error Handling:** The addition of a `try-catch` block around the entire endpoint logic improves the resilience of our API. It allows us to gracefully handle unexpected errors during execution, providing a consistent `500 Internal server error` response rather than an unhandled exception.

## How To Re-Implement (Contributor Reference)

Should a contributor need to implement a similar pagination feature for another endpoint, the following steps and considerations would be applicable:

1.  **Identify Target Endpoint:** Pinpoint the specific API endpoint function (e.g., `getUsers`, `getReports`) that requires pagination. This function will reside in a controller file, similar to `apps/api/src/controllers/admin.controller.ts`.
2.  **Integrate `try-catch`:** Wrap the entire function's logic within a `try-catch` block to ensure robust error handling.
    ```typescript
    export const getYourData = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      try {
        // ... pagination logic ...
      } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
      }
    };
    ```
3.  **Parse Query Parameters:** Extract `page` and `limit` from `req.query`, providing default values for robustness.
    ```typescript
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50; // Or another sensible default
    ```
4.  **Calculate Offset:** Compute the `offset` based on the parsed `page` and `limit`.
    ```typescript
    const offset = (page - 1) * limit;
    ```
5.  **Construct Supabase Query:** Modify the Supabase query to include `count: 'exact'` and `.range()`.
    ```typescript
    const { data, error, count } = await supabase
      .from('your_table_name') // Replace with the actual table name
      .select('*', { count: 'exact' }) // Essential for total count
      .range(offset, offset + limit - 1); // Supabase range is inclusive
    ```
6.  **Handle Supabase Errors:** Check for errors returned by Supabase and respond accordingly.
    ```typescript
    if (error) {
      res.status(500).json({ error: 'Failed to fetch your data' });
      return;
    }
    ```
7.  **Format Response:** Structure the API response to include the paginated data and the `meta` object.
    ```typescript
    res.json({
      your_data_key: data, // e.g., 'users', 'reports'
      meta: {
        total: count || 0,
        page,
        limit,
        totalPages: count ? Math.ceil(count / limit) : 0
      }
    });
    ```
    **Gotchas and Best Practices:**
    *   Always use `count: 'exact'` with Supabase `select` to get the total record count efficiently in a single query.
    *   Remember that Supabase's `.range(start, end)` is inclusive; ensure your `end` index is `offset + limit - 1`.
    *   Provide meaningful default values for `page` and `limit` to ensure the API is usable even without explicit client parameters.
    *   Document the new query parameters (`page`, `limit`) and the response structure (`meta` object) for frontend developers.

## Impact on System Architecture

This change significantly enhances the scalability and administrative capabilities of the SahiDawa platform's backend API. By introducing robust pagination to the `getAllMedicines` endpoint, we have established a critical pattern for efficient data retrieval. This prevents resource exhaustion on the server by limiting the number of records fetched per request and reduces network payload sizes, leading to better performance and responsiveness. This architectural improvement unlocks the platform's ability to seamlessly manage an ever-growing database of Indian medicines without encountering performance bottlenecks or data accessibility issues. Furthermore, it sets a consistent standard for implementing pagination across other API endpoints that might return large collections, ensuring a uniform and reliable API design. Frontend applications can now confidently build comprehensive administrative interfaces that can browse, filter, and manage the entire medicine inventory, moving beyond the previous limitation of only accessing a small, fixed subset of data.

## Testing & Verification

Not documented in this PR.