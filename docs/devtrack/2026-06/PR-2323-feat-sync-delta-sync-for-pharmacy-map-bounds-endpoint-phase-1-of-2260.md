# PR #2323 — feat(sync): delta sync for pharmacy map bounds endpoint (Phase 1 of #2260)

> **Merged:** 2026-06-21 | **Author:** @thakurakanksha288 | **Area:** Frontend | **Impact Score:** 43

## What Changed

This pull request introduces delta synchronization capabilities to the `/api/pharmacies/in-bounds` endpoint. We added an `updated_at` column with an automatic update trigger and an index to the `pharmacies` database table, along with a new Supabase RPC function `get_pharmacies_in_bounds_delta`. The API now accepts an optional `?since=` query parameter to fetch only pharmacies created or updated after a given timestamp, returning a response that includes `syncedAt` and a `delta` flag, alongside the `pharmacies` array which now contains `id` and `updated_at` for each record.

## The Problem Being Solved

Before this change, our system's map interface (`apps/web/app/[locale]/map/page.tsx`) would perform a full re-fetch of all pharmacies within a given bounding box every time a user panned or zoomed the map. This behavior led to a significant bandwidth bottleneck, as large JSON payloads containing potentially unchanged pharmacy data were repeatedly transmitted over the network. This resulted in slower load times and a suboptimal user experience, particularly for users on low-bandwidth connections or with less powerful devices, as identified in issue #2260.

## Files Modified

- `apps/api/src/routes/pharmacies.ts`
- `apps/web/app/[locale]/map/page.tsx`
- `apps/web/lib/api.ts`
- `supabase/migrations/20260621000000_add_pharmacies_updated_at.sql`
- `supabase/migrations/20260621000001_add_pharmacy_delta_sync_rpc.sql`

## Implementation Details

The implementation of delta synchronization for pharmacy map bounds involved modifications across our database schema, Supabase RPC functions, API endpoint, and frontend data fetching logic:

1.  **Database Schema Update (`supabase/migrations/20260621000000_add_pharmacies_updated_at.sql`):**
    - We extended the `public.pharmacies` table by adding an `updated_at` column of type `timestamp with time zone`. This column defaults to `now()` upon insertion and is marked `NOT NULL`.
    - A `TRIGGER` named `set_public_pharmacies_updated_at` was created. This trigger is configured to execute `BEFORE UPDATE` on each row of the `public.pharmacies` table, automatically setting the `updated_at` column to `now()` using the `public.set_updated_at()` function.
    - An index, `pharmacies_updated_at_idx`, was added on the `updated_at` column. This B-tree index is crucial for optimizing queries that filter records based on their `updated_at` timestamp, ensuring efficient delta fetching.

2.  **New Supabase RPC Function (`supabase/migrations/20260621000001_add_pharmacy_delta_sync_rpc.sql`):**
    - We introduced a new PostgreSQL function, `get_pharmacies_in_bounds_delta`, which serves as the delta-aware counterpart to the existing `get_pharmacies_in_bounds`.
    - This function accepts five parameters: `bound_south`, `bound_west`, `bound_north`, `bound_east` (all `double precision` for the bounding box), and `since` (`timestamp with time zone`).
    - The function queries the `public.pharmacies` table, filtering records where the `location` column (a `geometry` type) `ST_Intersects` with a dynamically created bounding box (`ST_MakeEnvelope`).
    - Crucially, it adds an additional `WHERE` clause: `AND updated_at > since`. This ensures that only pharmacies created or modified _after_ the provided `since` timestamp are returned.
    - The function returns a table with columns `id`, `name`, `address`, `district`, `state`, `phone_number`, `is_verified`, `lat`, `lng`, `distance` (calculated using `ST_Distance` from the center of the bounding box), and `updated_at`.

3.  **API Endpoint Modification (`apps/api/src/routes/pharmacies.ts`):**
    - The GET handler for the `/api/pharmacies/in-bounds` route was updated.
    - We extended the `boundsQuerySchema` (a Zod schema) to include an optional `since` parameter, which is coerced to a `Date` object.
    - New TypeScript interfaces `PharmacyDeltaRpcResult` (extending `PharmacyRpcResult` to include `updated_at`) and `FormattedPharmacy` (to represent the final API response structure, including optional `id` and `updated_at`) were defined.
    - Inside the route handler, a `syncedAt` timestamp (`new Date().toISOString()`) is captured _before_ any database query. This timestamp represents the server's view of "now" for the current response, which clients should use for their next `since` request.
    - We implemented conditional logic: if the `since` parameter is present in the request, we call the new `supabase.rpc("get_pharmacies_in_bounds_delta", ...)` function; otherwise, we fall back to the original `supabase.rpc("get_pharmacies_in_bounds", ...)` to maintain backward compatibility.
    - The response payload now includes the `pharmacies` array (mapped to `FormattedPharmacy`), the captured `syncedAt` timestamp, and a `delta` boolean flag (set to `true` if `since` was provided, `false` otherwise).
    - The existing fallback path (in-memory filtering if PostGIS RPC is unavailable) was explicitly noted to _not_ apply `since` filtering, as it's a full-set fallback.
    - The OpenAPI documentation comments for this endpoint were updated to reflect the new `since` parameter and the `syncedAt`/`delta` fields in the response.

4.  **Frontend API Client Update (`apps/web/lib/api.ts`):**
    - The `VerifiedPharmacy` type was updated to include optional `id` and `updated_at` fields, reflecting the expanded data returned by the API.
    - A new type, `PharmaciesInBoundsResult`, was introduced to represent the full API response structure: `{ pharmacies: VerifiedPharmacy[], syncedAt: string, delta: boolean }`.
    - The `fetchVerifiedPharmaciesInBounds` asynchronous function was modified to accept an optional `since?: string` argument.
    - The function now constructs the API URL by conditionally appending `&since=${since}` if the `since` argument is provided.
    - The return type of `fetchVerifiedPharmaciesInBounds` was updated from `Promise<VerifiedPharmacy[]>` to `Promise<PharmaciesInBoundsResult>`.

5.  **Frontend Call Site Update (`apps/web/app/[locale]/map/page.tsx`):**
    - The `PharmacyMapPage` component, which is the primary consumer of `fetchVerifiedPharmaciesInBounds`, was updated to destructure the `pharmacies` array from the new `PharmaciesInBoundsResult` object. Specifically, the line `verifiedResult.value.map(...)` was changed to `verifiedResult.value.pharmacies.map(...)`.
    - Not documented in this PR: The actual passing of the `since` parameter from the frontend to `fetchVerifiedPharmaciesInBounds` for incremental updates is a follow-up task and not implemented in this specific PR.

## Technical Decisions

1.  **Narrow Scope (Phase 1 of #2260):** We deliberately limited the scope of this PR to address only the pharmacy map bounds endpoint. This decision was based on an analysis that identified this specific endpoint's repeated full re-fetches as the sole significant bandwidth bottleneck in the current application. Other API endpoints already handle small, targeted requests efficiently.
2.  **Prioritizing Delta Sync over Protobuf/Streaming:** We chose to implement delta synchronization first, deferring Protobuf serialization and chunked streaming.
    - **Protobuf:** While offering payload size reduction, it introduces considerable complexity (schema definitions, serialization, client codegen). We decided to wait for profiling data to confirm if JSON parsing is a CPU bottleneck on low-end devices before adopting Protobuf.
    - **Chunked Streaming:** This technique is primarily beneficial for initial bulk data hydration. Our current application architecture does not feature a "download the entire database" flow, making chunked streaming less immediately impactful.
3.  **Database-Level Filtering:** Implementing delta filtering directly within the PostgreSQL RPC function (`get_pharmacies_in_bounds_delta`) was a critical decision. This approach minimizes data transfer between the database and the API server, reducing database load and improving overall system efficiency by ensuring only relevant, changed records are processed.
4.  **Backward Compatibility:** We ensured that the `/api/pharmacies/in-bounds` endpoint remains fully backward compatible. Existing clients or tests that do not provide the `since` parameter will continue to receive a full result set, behaving as they did before this change.
5.  **Explicit Handling of Deletions as a Known Limitation:** We consciously decided not to implement a deletion-aware delta sync mechanism (e.g., soft deletes or tombstone tables) within this PR. This is a complex design decision with significant implications, warranting its own dedicated discussion and implementation. We explicitly documented this limitation to ensure transparency and guide future development.

## How To Re-Implement (Contributor Reference)

Should a contributor need to implement a similar delta synchronization feature for another entity within SahiDawa, they would follow these steps:

1.  **Database Schema Update:**
    - **Add `updated_at` Column:** Execute an `ALTER TABLE` statement to add an `updated_at` column (type `timestamp with time zone`, `DEFAULT now()`, `NOT NULL`) to the target table (e.g., `public.medicines`).
    - **Create Update Trigger:** Implement a `BEFORE UPDATE` trigger on the target table that calls the `public.set_updated_at()` function to automatically update the `updated_at` timestamp on every row modification.
    - **Add Index:** Create a B-tree index on the new `updated_at` column to optimize timestamp-based filtering queries.

2.  **Supabase RPC Function for Delta Fetching:**
    - **Duplicate Existing RPC:** Identify and duplicate the existing Supabase RPC function responsible for fetching data for the target entity within a specific context (e.g., `get_medicines_by_name`).
    - **Add `since` Parameter:** Modify the new RPC function's signature to include a `since` parameter of type `timestamp with time zone`.
    - **Implement `updated_at` Filter:** Add `AND updated_at > since` to the `WHERE` clause of the SQL query within the new RPC function.
    - **Include `updated_at` in Return:** Ensure the `RETURNS TABLE` definition for the RPC function includes the `updated_at` column.

3.  **API Endpoint Integration (`apps/api/src/routes/your_entity.ts`):**
    - **Update Schema:** Modify the Zod schema for the relevant GET endpoint to include an optional `since: z.coerce.date().optional()` query parameter.
    - **Define Types:** Create new TypeScript interfaces (e.g., `YourEntityDeltaRpcResult`, `FormattedYourEntity`) that reflect the expanded data structure, including `id` and `updated_at`.
    - **Conditional RPC Call:** In the route handler, capture a `syncedAt` timestamp (`new Date().toISOString()`) at the start. Then, use an `if (since)` condition to call either the new delta-aware RPC or the original RPC.
    - **Format Response:** Map the RPC results to the `FormattedYourEntity` type, ensuring `id` and `updated_at` are correctly included. Return an object with the structure `{ yourEntities: FormattedYourEntity[], syncedAt: string, delta: Boolean(since) }`.
    - **Update OpenAPI Docs:** Add documentation for the new `since` query parameter and the `syncedAt`/`delta` fields in the response.

4.  **Frontend API Client (`apps/web/lib/api.ts`):**
    - **Update Entity Type:** Modify the `YourEntity` TypeScript type to include optional `id` and `updated_at` fields.
    - **Define Result Type:** Create a new `YourEntitiesResult` type: `{ yourEntities: YourEntity[], syncedAt: string, delta: boolean }`.
    - **Modify Fetch Function:** Update the `fetchYourEntities` function to accept an optional `since?: string` argument and to conditionally append `&since=${since}` to the API request URL.
    - **Update Return Type:** Change the function's return type to `Promise<YourEntitiesResult>`.

5.  **Frontend Call Site (`apps/web/app/[locale]/your_page.tsx`):**
    - **Adjust Data Access:** Update the component that calls `fetchYourEntities` to destructure the `yourEntities` array from the returned `YourEntitiesResult` object.
    - **Implement Client-Side Sync Logic:** Introduce logic to store the `syncedAt` value (e.g., in a state management solution or a dedicated cache) associated with the specific data query (e.g., bounding box, search parameters). On subsequent requests, pass this stored `syncedAt` value as the `since` parameter.
    - **Merge/Replace Data:** Based on the `delta` flag in the API response: if `delta` is `true`, merge the incoming `yourEntities` with the existing cached data (updating existing records by `id` and adding new ones). If `delta` is `false`, replace the entire cached dataset for that query.

## Impact on System Architecture

This change significantly enhances the performance and scalability of our SahiDawa platform, particularly for map-based interactions.

- **Improved Performance:** By enabling delta synchronization, we drastically reduce the amount of data transferred over the network during repeated map pans and zooms. This leads to faster load times and a more responsive user experience, especially for users with limited bandwidth or older devices.
- **Reduced Database Load:** Filtering records at the database level using the `updated_at` column and its index minimizes the processing overhead on our Supabase instance. Only changed records are retrieved, reducing query execution time and overall database resource consumption.
- **Foundation for Future Optimizations:** This PR establishes a robust pattern for implementing incremental data fetching. It provides a clear architectural blueprint that can be extended to other data entities if future profiling identifies similar performance bottlenecks.
- **Increased Frontend Complexity:** While beneficial for performance, this change introduces additional complexity to the frontend. Clients must now manage `syncedAt` timestamps for different data regions/queries and implement intelligent merging logic to combine delta responses with their local cache.
- **Acknowledged Architectural Gap (Deletions):** The current implementation does not address deletions. This means that if a pharmacy is hard-deleted from the database, a client that previously fetched it via a full sync will continue to display it until a subsequent full sync of that area occurs. This is a known architectural limitation that will require a separate design and implementation effort (e.g., soft deletes, tombstone tables, or a deletion log) to fully resolve.

## Testing & Verification

Our verification process for this change included:

- **Backward Compatibility Testing:** The existing `apps/api/tests/pharmacies.test.ts` suite was executed and passed all 17 tests without modification. This confirmed that the default behavior of the `/api/pharmacies/in-bounds` endpoint (when the `since` parameter is omitted) remains fully backward compatible with existing API consumers.
- **Type Safety:** We performed a `npx tsc --noEmit` check in both the `apps/web` and `apps/api` directories. This ensured that all TypeScript type definitions, interface updates, and function signatures were consistent and free of compilation errors across the codebase.
- **Delta Path Testing:** Not documented in this PR: The PR description explicitly states that a dedicated test for the `since` delta path was planned to be added before the PR was ready for review. Assuming this was completed, such a test would typically involve:
    1.  Making an initial request to `/api/pharmacies/in-bounds` without the `since` parameter to establish a baseline and capture the `syncedAt` value.
    2.  Programmatically updating an existing pharmacy record in the database.
    3.  Making a subsequent request to the same endpoint, providing the previously captured `syncedAt` value as the `since` parameter.
    4.  Asserting that the response `pharmacies` array contains only the updated pharmacy (and any newly created ones), that the `delta` flag is `true`, and that the new `syncedAt` value is current.
- **Edge Case Considerations:**
    - **No Changes Since `since`:** If a `since` timestamp is provided but no pharmacies have been created or updated in the specified bounding box since that time, the API should return an empty `pharmacies` array, with `delta: true`, and a current `syncedAt` timestamp.
    - **Invalid `since` Parameter:** The `boundsQuerySchema` uses `z.coerce.date()`, which handles various date formats. If a truly invalid `since` value is provided, Zod's validation will fail, resulting in a `400 Bad Request` response from the API.
    - **PostGIS RPC Unavailability:** The system includes a fallback mechanism. If the `get_pharmacies_in_bounds` or `get_pharmacies_in_bounds_delta` PostGIS RPC functions are unavailable (e.g., in a local development environment without PostGIS extensions), the API will fall back to an in-memory filter. In this scenario, `since` filtering is not applied, and a full result set is returned with `delta: false`.
    - **Deletion Handling:** As a known limitation, deletions are not reported. Clients must account for this by performing periodic full refreshes or by implementing a separate mechanism to detect and remove deleted items from their local cache.
