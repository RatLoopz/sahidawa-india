# PR #344 — test(alerts): add pagination integration test suite and alerts route

> **Merged:** 2026-05-19 | **Author:** @KaparthyReddy | **Area:** Backend | **Impact Score:** 15 | **Closes:** #291

## What Changed

We have introduced a new paginated API endpoint, `GET /api/v1/alerts`, to retrieve drug alerts from our system. This endpoint supports `page` and `limit` query parameters for efficient data fetching. Alongside this, a comprehensive integration test suite has been added in `apps/api/tests/alertsPagination.test.ts` to validate the endpoint's functionality, including its pagination logic, default parameter handling, boundary conditions, and error responses.

## The Problem Being Solved

Prior to this PR, our system lacked a dedicated, paginated API endpoint for retrieving drug alerts. This meant that any client application needing to display a list of alerts would either have to fetch the entire dataset (which is inefficient and resource-intensive for a growing number of alerts) or implement complex client-side pagination. This approach could lead to performance bottlenecks, increased network load, and a suboptimal user experience, especially as the volume of alerts increased. Issue #291 specifically called for a solution to enable efficient, server-side pagination for alerts.

## Files Modified

- `apps/api/src/app.ts`
- `apps/api/src/routes/alerts.ts`
- `apps/api/tests/alertsPagination.test.ts`

## Implementation Details

The implementation involved three key areas: route definition, API logic, and comprehensive testing.

1.  **Route Definition and Registration:**
    *   A new Express `Router` instance, `alertsRouter`, was created in `apps/api/src/routes/alerts.ts`.
    *   This router defines a single `GET` endpoint at its root path (`/`).
    *   The `alertsRouter` was then integrated into our main Express application by adding `app.use("/api/v1/alerts", alertsRouter);` in `apps/api/src/app.ts`. This makes the endpoint accessible at `GET /api/v1/alerts`.

2.  **API Logic (`apps/api/src/routes/alerts.ts`):**
    *   **Query Parameter Parsing:** Inside the `GET` handler, `req.query.page` and `req.query.limit` are extracted and parsed into integers using `parseInt()`.
    *   **Parameter Validation and Defaults:**
        *   The `page` parameter defaults to `1` if it's not a valid number or is less than `1`.
        *   The `limit` parameter defaults to `10` if invalid or less than `1`. Crucially, the `limit` is capped at `100` using `Math.min(rawLimit, 100)` to prevent clients from requesting an excessive number of records in a single call.
    *   **Offset Calculation:** The `offset` for the database query is calculated as `(page - 1) * limit`, converting the 1-based API page index to a 0-based database offset.
    *   **Supabase Query:**
        *   We query the `drug_alerts` table using our `supabase` client (`supabase.from("drug_alerts")`).
        *   `select("*", { count: "exact" })` is used to fetch all columns for the current page while simultaneously retrieving the total count of all rows in the table. This is essential for calculating `totalCount` and `totalPageCount` efficiently in a single database round trip.
        *   Results are ordered by `created_at` in descending order (`.order("created_at", { ascending: false })`).
        *   The `range(offset, offset + limit - 1)` method is applied to retrieve only the specific slice of data corresponding to the current page.
    *   **Error Handling:** If the Supabase query returns an `error`, the API responds with a `500` status code and a JSON object `{ error: "Failed to fetch alerts" }`.
    *   **Structured Response:** On success, the endpoint returns a JSON object containing:
        *   `data`: An array of `Alert` objects for the current page.
        *   `pageIndex`: The current 1-based page number.
        *   `pageSize`: The number of items returned on the current page.
        *   `totalCount`: The total number of alerts in the `drug_alerts` table.
        *   `totalPageCount`: The total number of pages, calculated as `Math.ceil(totalCount / limit)`.

3.  **Integration Testing (`apps/api/tests/alertsPagination.test.ts`):**
    *   A new test file was created to house 12 distinct integration tests.
    *   We use `supertest` to make HTTP requests against our `app` instance.
    *   The `supabase` client is mocked using `jest.mock("../src/db/client")` to ensure tests are isolated and do not depend on a live database. The mock simulates the behavior of `from`, `select`, `order`, and `range` methods, allowing us to control the data, error, and count returned by the "database."
    *   Helper functions `buildAlerts` and `mockSupabase` were created to streamline test data generation and mock configuration.
    *   Tests cover a wide range of scenarios, including correct schema, accurate page indexing, handling of empty datasets, custom `limit` values, default parameter fallbacks, invalid `page` inputs (e.g., string, zero), `limit` capping, and database error conditions.

## Technical Decisions

-   **Express.js for API Layer:** We continued to use Express.js for defining the new API endpoint, maintaining consistency with our existing backend architecture. This leverages our established patterns for routing and middleware.
-   **Direct Supabase Integration:** The decision to directly use the `supabase` client with `select("*", { count: "exact" }).order(...).range(...)` was made for efficiency. The `count: "exact"` option is crucial as it allows us to retrieve both the paginated data and the total row count in a single database query, avoiding the performance overhead of a separate `COUNT(*)` query.
-   **1-Based Page Indexing:** We opted for a 1-based page index for the API (`page` query parameter and `pageIndex` in the response). This is a common and intuitive convention for users interacting with paginated data, even though the underlying database operations use 0-based offsets.
-   **Hard Limit on Page Size:** Capping the `limit` parameter at `100` is a deliberate security and performance decision. It prevents clients from making requests that could potentially overload our server or database by asking for an unreasonably large number of records in a single API call. This promotes responsible API consumption.
-   **Comprehensive Integration Testing with Mocking:** The choice to implement a detailed integration test suite, including mocking the `supabase` client, was made to ensure the robustness and reliability of the new endpoint. Mocking allows us to test the API's logic in isolation, covering various success and failure scenarios (including database errors and invalid inputs) without the flakiness or slowness of actual database calls. This provides high confidence in the correctness of the pagination logic.

## How To Re-Implement (Contributor Reference)

To re-implement the paginated alerts endpoint, a contributor would follow these steps:

1.  **Create the Router File:**
    *   Create `apps/api/src/routes/alerts.ts`.
    *   Import `Router`, `Request`, `Response` from `express` and `supabase` from `../db/client`.
    *   Initialize `const alertsRouter = Router();`.

2.  **Define the GET Endpoint Handler:**
    *   Add `alertsRouter.get("/", async (req: Request, res: Response) => { ... });`.

3.  **Parse and Validate Query Parameters within the Handler:**
    *   Retrieve `page` and `limit` from `req.query`.
    *   Convert them to numbers using `parseInt(value as string, 10)`.
    *   Implement default values and the `limit` cap:
        ```typescript
        const rawPage = parseInt(req.query.page as string, 10);
        const rawLimit = parseInt(req.query.limit as string, 10);
        const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
        const limit = isNaN(rawLimit) || rawLimit < 1 ? 10 : Math.min(rawLimit, 100); // Max limit of 100
        ```

4.  **Calculate Database Offset:**
    *   `const offset = (page - 1) * limit;`

5.  **Execute Supabase Query:**
    *   Perform the database query using the `supabase` client:
        ```typescript
        const { data, error, count } = await supabase
            .from("drug_alerts")
            .select("*", { count: "exact" }) // Crucial for total count
            .order("created_at", { ascending: false }) // Example ordering
            .range(offset, offset + limit - 1); // Apply pagination
        ```

6.  **Handle Supabase Errors:**
    *   Check `if (error)` and respond with `res.status(500).json({ error: "Failed to fetch alerts" });`.

7.  **Construct and Send Response:**
    *   Calculate `totalCount = count ?? 0;` and `totalPageCount = Math.ceil(totalCount / limit);`.
    *   Send the structured JSON response:
        ```typescript
        res.json({
            data: data ?? [],
            pageIndex: page,
            pageSize: (data ?? []).length,
            totalCount,
            totalPageCount,
        });
        ```

8.  **Export the Router:**
    *   Add `export default alertsRouter;` at the end of `alerts.ts`.

9.  **Register the Router in `app.ts`:**
    *   Import `alertsRouter` into `apps/api/src/app.ts`.
    *   Add `app.use("/api/v1/alerts", alertsRouter);` to register the endpoint.

10. **Write Comprehensive Integration Tests:**
    *   Create `apps/api/tests/alertsPagination.test.ts`.
    *   **Mock `supabase`:** Use `jest.mock("../src/db/client", () => ({ supabase: { from: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(), range: jest.fn(), }, }));` to control database responses.
    *   Implement helper functions like `buildAlerts` and `mockSupabase` to simplify test setup.
    *   Use `supertest` to make requests to `app` and assert on `res.status` and `res.body` for all success and error scenarios, including edge cases for `page`, `limit`, and database states.

## Impact on System Architecture

This change significantly enhances our backend API capabilities by providing a robust and efficient mechanism for retrieving drug alerts.

-   **API Surface Expansion:** We now have a new, well-defined `GET /api/v1/alerts` endpoint, expanding our API surface and providing a standardized way to access alert data.
-   **Improved Frontend Performance and User Experience:** Frontend applications can now fetch only the necessary subset of alert data, leading to smaller network payloads, faster page loads, and a smoother user experience, especially when dealing with a large number of alerts. This directly addresses the needs outlined in Issue #291.
-   **Enhanced Scalability:** The server-side pagination logic, including the `limit` cap and the efficient Supabase query with `count: "exact"` and `range`, reduces the load on our database and network. This design choice contributes to the overall scalability and resilience of the SahiDawa platform.
-   **Standardized Pagination Pattern:** The chosen response schema for pagination (`data`, `pageIndex`, `pageSize`, `totalCount`, `totalPageCount`) establishes a consistent pattern that can be readily adopted for future paginated endpoints across other data entities, promoting API consistency and reducing development overhead.
-   **Increased API Robustness:** The addition of a comprehensive integration test suite for this endpoint significantly increases our confidence in its correctness and resilience to various inputs and database conditions. This reduces the risk of regressions and ensures the reliability of a critical data access point.

## Testing & Verification

This change was thoroughly tested and verified through a dedicated integration test suite located in `apps/api/tests/alertsPagination.test.ts`. The testing strategy focused on comprehensive coverage of the API endpoint's behavior, including various success paths and error conditions.

The key aspects of our testing and verification process were:

1.  **Supabase Client Mocking:** We utilized `jest.mock("../src/db/client")` to mock the `supabase` client. This allowed us to simulate specific database responses (data, count, errors) without relying on an actual database connection, ensuring fast, isolated, and deterministic tests.
2.  **`supertest` for API Interaction:** `supertest` was employed to make HTTP requests to our Express application (`app`). This enabled us to test the `GET /api/v1/alerts` endpoint as an external client would, verifying the full request-response cycle.
3.  **Extensive Test Cases (12 tests):** The test suite includes 12 distinct integration tests covering a wide array of scenarios:
    *   **Correct Pagination Schema:** Verified that the response body consistently includes `data`, `pageIndex`, `pageSize`, `totalCount`, and `totalPageCount`.
    *   **Page Index Accuracy:** Confirmed correct `pageIndex` and `pageSize` when requesting specific pages (e.g., page 2, the last page).
    *   **Empty Data Handling:** Tested scenarios where the requested page exceeds the total available pages (expecting an empty `data` array) and when the `drug_alerts` table is entirely empty (expecting zero counts and an empty `data` array).
    *   **Custom Limit Respect:** Verified that the `limit` query parameter is correctly applied, returning the specified number of items per page (e.g., `limit=5`, `limit=25`).
    *   **Default Parameter Fallbacks:** Ensured that `page=1` and `limit=10` are correctly applied when no query parameters are provided.
    *   **Invalid Parameter Handling:**
        *   Tested `page=abc` (invalid string) and `page=0` (zero), confirming that `page` gracefully falls back to `1`.
        *   Tested `limit=999` (exceeding the maximum allowed), verifying that `limit` is capped at `100`.
    *   **Database Error Simulation:** A test case specifically mocked a database error from Supabase, confirming that the API correctly returns a `500` status code with an appropriate error message.

All 12 tests passed successfully within 1.047 seconds, as evidenced by the PR description's test output. This comprehensive testing approach ensures the reliability and correctness of the new pagination endpoint, covering critical edge cases and error conditions.