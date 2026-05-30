# PR #857 — Feat/real nearby pharmacy search using supabase+post gis

> **Merged:** 2026-05-29 | **Author:** @Akshayy9 | **Area:** Database | **Impact Score:** 37 | **Closes:** #171

## What Changed

This pull request significantly enhances our pharmacy search capabilities by integrating real-time geospatial queries using Supabase's PostGIS extension. We've introduced two new PostgreSQL Remote Procedure Call (RPC) functions, `get_nearest_pharmacies` and `get_pharmacies_in_bounds`, to perform efficient server-side distance and bounding box calculations. Concurrently, the `/api/pharmacies` route in our Node.js backend has been refactored with robust TypeScript types and comprehensive OpenAPI/Swagger documentation, ensuring a more reliable and discoverable API. Finally, we've seeded our database with 30 actual Jan Aushadhi Kendra locations across India to provide real-world data for testing and immediate use.

## The Problem Being Solved

Previously, our system relied on a mock or client-side fallback mechanism for pharmacy search, which was inefficient, inaccurate for large datasets, and lacked the scalability required for a production-grade geospatial feature. The absence of server-side geospatial indexing meant that fetching and filtering pharmacies by distance or within a geographical area required retrieving all pharmacy data and performing Haversine calculations in JavaScript, leading to increased latency and computational load on the API server. Furthermore, the API endpoints lacked proper TypeScript typing, making them prone to runtime errors, and were not documented in our OpenAPI specification, hindering developer experience and discoverability. The lack of real pharmacy data also meant that testing and demonstrating the feature was limited to synthetic data.

## Files Modified

- `apps/api/src/routes/pharmacies.ts`
- `apps/api/tests/pharmacies.test.ts`
- `apps/web/package.json`
- `supabase/migrations/20260530000000_create_pharmacy_rpc_functions.sql`
- `supabase/migrations/20260530000001_seed_jan_aushadhi_pharmacies.sql`

## Implementation Details

**Database Migrations (`supabase/migrations/`):**

1.  **`20260530000000_create_pharmacy_rpc_functions.sql`**: This migration introduces two critical PostgreSQL functions leveraging the PostGIS extension:
    *   **`get_nearest_pharmacies(query_lat float, query_lng float, search_radius_km float)`**:
        *   This function is designed to find pharmacies within a specified radius of a given point.
        *   It takes `query_lat` (latitude of the search origin), `query_lng` (longitude of the search origin), and `search_radius_km` (the maximum distance in kilometers) as input.
        *   Inside the function, we first create a `GEOGRAPHY` point from the input coordinates using `ST_SetSRID(ST_MakePoint(query_lng, query_lat), 4326)::geography`. This ensures spatial operations are performed on geographic coordinates (latitude/longitude) rather than planar ones.
        *   The core filtering is done using `ST_DWithin(p.location, search_point, search_radius_km * 1000)`. `ST_DWithin` is an index-accelerated function that efficiently checks if a geometry (pharmacy's `location`) is within a specified distance (converted to meters) of another geometry (`search_point`). This is crucial for performance.
        *   The distance for each matching pharmacy is then precisely calculated using `ST_Distance(p.location, search_point) / 1000.0` (converting meters to kilometers).
        *   Results are ordered by this calculated `distance` in ascending order to return the nearest pharmacies first.
        *   A `LIMIT 200` clause is applied to prevent excessively large result sets, aligning with our `MAX_RESULTS` constant in the API.
        *   The function is defined with `SECURITY DEFINER`, which allows it to execute with the permissions of the function's owner (typically the `supabase_admin` role), enabling access to the `pharmacies` table even when called via the `anon` key. This matches the pattern established by `find_lasa_conflicts`.
    *   **`get_pharmacies_in_bounds(bound_south float, bound_west float, bound_north float, bound_east float)`**:
        *   This function retrieves pharmacies located within a rectangular bounding box, typically used for map viewport queries.
        *   It accepts `bound_south`, `bound_west`, `bound_north`, and `bound_east` representing the latitude/longitude boundaries of the box.
        *   A bounding box geometry is constructed using `ST_MakeEnvelope(bound_west, bound_south, bound_east, bound_north, 4326)::geography`.
        *   Pharmacies are filtered using `ST_Intersects(p.location, bounds_envelope)`, which efficiently checks if a pharmacy's location intersects with the defined bounding box.
        *   For convenience, it also calculates the distance from the center of the bounding box to each pharmacy, using `ST_Distance(p.location, ST_Centroid(bounds_envelope)) / 1000.0`.
        *   Similar to `get_nearest_pharmacies`, it uses `SECURITY DEFINER` for permission elevation.

2.  **`20260530000001_seed_jan_aushadhi_pharmacies.sql`**:
    *   This migration populates the `pharmacies` table with 30 real-world Pradhan Mantri Bhartiya Jan Aushadhi Kendra locations.
    *   Data includes `name`, `address`, `phone_number`, `is_verified`, `district`, `state`, and crucially, `lat` and `lng` coordinates.
    *   The `location` column, which is of `GEOGRAPHY(Point, 4326)` type, is populated using `ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography` for each entry, ensuring spatial indexing is active.
    *   The `INSERT` statements use `ON CONFLICT (name, address) DO NOTHING` to ensure idempotency. This prevents duplicate entries if the migration is run multiple times, which is a best practice for seed data.

**API Route Refactor (`apps/api/src/routes/pharmacies.ts`):**

1.  **TypeScript Type Definitions**:
    *   We introduced several new interfaces to improve type safety and readability:
        *   `PharmacyRow`: Represents a raw pharmacy record from the `pharmacies` table, including `lat`/`lng` or a GeoJSON `location` object.
        *   `PharmacyRpcResult`: Defines the structure of data returned directly by our PostGIS RPC functions, including the calculated `distance`.
        *   `FormattedPharmacy`: Specifies the final shape of a pharmacy object returned in our API responses, with a human-readable `distance` string.
        *   `PharmacyWithRawDistance`: An internal helper interface used during the Haversine fallback path to temporarily hold the numeric distance for sorting before formatting.
    *   These types replace previous `any` usages, particularly in mapping and filtering operations, significantly reducing potential runtime errors and improving code maintainability.

2.  **`nearest` Endpoint (`/api/pharmacies/nearest`):**
    *   The `nearestQuerySchema` (using `zod`) now validates `lat`, `lng`, and `radius` parameters. The `radius` defaults to 50 km and is clamped between 1 and 200 km.
    *   **Primary Path (PostGIS RPC)**: The route now attempts to call the `supabase.rpc("get_nearest_pharmacies", { query_lat: lat, query_lng: lng, search_radius_km: radius })` function.
        *   Crucially, the `search_radius_km` parameter is now passed directly to the RPC, allowing PostGIS to perform efficient server-side filtering using `ST_DWithin`. Previously, the RPC was called without this parameter, and filtering was done client-side.
        *   If the RPC succeeds (`!rpcError && rpcData`), the `rpcData` (typed as `PharmacyRpcResult[]`) is directly mapped to `FormattedPharmacy[]`, with the `distance` already calculated and filtered by the database. The `id` and raw numeric `distance` from the RPC result are not leaked in the final API response.
    *   **Fallback Path (Haversine Calculation)**: If the PostGIS RPC fails (e.g., PostGIS extension not enabled, or a database error), a `logger.warn` message is emitted, and the system gracefully falls back to the previous JavaScript-based Haversine calculation.
        *   In this path, all pharmacies are fetched from the `pharmacies` table (`supabase.from("pharmacies").select("*")`).
        *   The `calculateDistanceKM` helper function computes the distance between the query point and each pharmacy.
        *   Pharmacies are then filtered client-side by the `radius`, sorted by `rawDistance`, and sliced to `MAX_RESULTS` before being mapped to `FormattedPharmacy[]`.

3.  **`in-bounds` Endpoint (`/api/pharmacies/in-bounds`):**
    *   The `boundsQuerySchema` validates `south`, `west`, `north`, and `east` parameters.
    *   **Primary Path (PostGIS RPC)**: The route will call `supabase.rpc("get_pharmacies_in_bounds", { bound_south: south, bound_west: west, bound_north: north, bound_east: east })`. The provided diff shows the OpenAPI documentation for this endpoint, indicating its intended use of the RPC.
    *   **Fallback Path**: Not documented in this PR, but it's implied that a fallback to in-memory filtering would exist, similar to the `nearest` endpoint.

4.  **OpenAPI/Swagger Documentation**:
    *   Extensive JSDoc annotations (`@openapi`) have been added to both `/api/pharmacies/nearest` and `/api/pharmacies/in-bounds` routes.
    *   These annotations define the summary, description, tags, parameters (with types, examples, and descriptions), and detailed response schemas (including 200, 400, and 500 responses). This ensures our API documentation at `/api/docs` is always up-to-date and comprehensive.

**Helper Functions (`apps/api/src/routes/pharmacies.ts`):**

*   `calculateDistanceKM`: Standard Haversine formula for distance calculation, used in the fallback path.
*   `extractCoordinates`: Safely extracts `lat` and `lng` from a `PharmacyRow`, handling both direct `lat`/`lng` properties and GeoJSON `location.coordinates`.
*   `formatPharmacy`: Transforms a `PharmacyRow` and a calculated distance into the `FormattedPharmacy` structure, including formatting the distance to one decimal place with " km".
*   `validateSupabaseConfig`: Ensures `SUPABASE_URL` and `SUPABASE_ANON_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) are set, returning a 500 error if not.
*   `handleFetchError`: Centralized error handling for Supabase query failures, logging details and sending a structured error response.

**`apps/web/package.json`**:
Not documented in this PR.

## Technical Decisions

1.  **PostGIS for Geospatial Queries**: We chose PostGIS due to its robust, industry-standard capabilities for geospatial data storage and querying. It offers highly optimized spatial indexes (e.g., GiST indexes on `GEOGRAPHY` columns) and functions like `ST_DWithin` and `ST_Intersects`, which are significantly more performant and scalable than performing Haversine calculations in application code, especially as our pharmacy dataset grows. This decision aligns with our goal of building a scalable and efficient platform.
2.  **Supabase RPC for Database Functions**: Utilizing Supabase's Remote Procedure Call (RPC) feature allows us to encapsulate complex geospatial logic directly within the database. This keeps our application layer cleaner, reduces data transfer over the network (as filtering happens at the database level), and leverages PostgreSQL's powerful query optimizer. The `SECURITY DEFINER` pattern was chosen for the RPC functions to ensure they can be invoked securely via the `anon` key, without exposing sensitive table permissions directly to the API client.
3.  **Graceful Fallback to Haversine**: While PostGIS is our primary solution, we decided to retain a JavaScript-based Haversine calculation fallback. This ensures that the API remains functional, albeit less performant, even if the PostGIS extension is not enabled or if there's a transient issue with the RPC invocation. This enhances the robustness and fault tolerance of our system. A `logger.warn` is used to alert us when the fallback is triggered, indicating a potential configuration issue.
4.  **Comprehensive TypeScript Typing**: The decision to replace `any` types with specific interfaces (`PharmacyRow`, `PharmacyRpcResult`, `FormattedPharmacy`, `PharmacyWithRawDistance`) was driven by our commitment to code quality, maintainability, and developer experience. Strong typing catches errors at compile-time, makes the codebase easier to understand, and facilitates future refactoring.
5.  **OpenAPI/Swagger Documentation**: Integrating detailed JSDoc annotations for OpenAPI specification was a deliberate choice to improve API discoverability and usability. This ensures that our API documentation is automatically generated and kept in sync with the code, providing clear contracts for frontend developers and external integrators.

## How To Re-Implement (Contributor Reference)

To re-implement this feature from scratch, a contributor would follow these steps:

1.  **Database Setup (PostGIS & Tables)**:
    *   Ensure the `postgis` extension is enabled in your Supabase project. This can typically be done via the Supabase UI (Database -> Extensions) or by running `CREATE EXTENSION IF NOT EXISTS postgis;` in a migration.
    *   Verify the `pharmacies` table exists with a `location` column of type `GEOGRAPHY(Point, 4326)`. If not, create it:
        ```sql
        CREATE TABLE public.pharmacies (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            name text NOT NULL,
            address text NOT NULL,
            lat double precision, -- Optional, for fallback or direct input
            lng double precision, -- Optional, for fallback or direct input
            location geography(Point, 4326), -- The PostGIS column
            phone_number text,
            is_verified boolean DEFAULT FALSE,
            district text,
            state text
        );
        CREATE INDEX pharmacies_location_idx ON public.pharmacies USING GIST (location);
        ```
    *   Populate the `location` column for existing data using `ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography`.

2.  **Create PostGIS RPC Functions**:
    *   Create a new Supabase migration file (e.g., `supabase/migrations/YYYYMMDDHHMMSS_create_pharmacy_rpc_functions.sql`).
    *   Define the `get_nearest_pharmacies` function:
        ```sql
        CREATE OR REPLACE FUNCTION public.get_nearest_pharmacies(
            query_lat float,
            query_lng float,
            search_radius_km float DEFAULT 50
        )
        RETURNS TABLE (
            id uuid,
            name text,
            address text,
            district text,
            state text,
            phone_number text,
            is_verified boolean,
            lat float,
            lng float,
            distance float
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
            search_point geography := ST_SetSRID(ST_MakePoint(query_lng, query_lat), 4326)::geography;
        BEGIN
            RETURN QUERY
            SELECT
                p.id,
                p.name,
                p.address,
                p.district,
                p.state,
                p.phone_number,
                p.is_verified,
                ST_Y(p.location::geometry) AS lat, -- Extract lat from geography point
                ST_X(p.location::geometry) AS lng, -- Extract lng from geography point
                (ST_Distance(p.location, search_point) / 1000.0) AS distance
            FROM
                public.pharmacies AS p
            WHERE
                p.location IS NOT NULL AND ST_DWithin(p.location, search_point, search_radius_km * 1000)
            ORDER BY
                distance
            LIMIT 200;
        END;
        $$;
        ```
    *   Define the `get_pharmacies_in_bounds` function (similar structure, using `ST_MakeEnvelope` and `ST_Intersects`):
        ```sql
        CREATE OR REPLACE FUNCTION public.get_pharmacies_in_bounds(
            bound_south float,
            bound_west float,
            bound_north float,
            bound_east float
        )
        RETURNS TABLE (
            id uuid,
            name text,
            address text,
            district text,
            state text,
            phone_number text,
            is_verified boolean,
            lat float,
            lng float,
            distance float -- Distance from the center of the bounding box
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
            bounds_envelope geography := ST_SetSRID(ST_MakeEnvelope(bound_west, bound_south, bound_east, bound_north, 4326), 4326)::geography;
            bounds_center geography := ST_Centroid(bounds_envelope);
        BEGIN
            RETURN QUERY
            SELECT
                p.id,
                p.name,
                p.address,
                p.district,
                p.state,
                p.phone_number,
                p.is_verified,
                ST_Y(p.location::geometry) AS lat,
                ST_X(p.location::geometry) AS lng,
                (ST_Distance(p.location, bounds_center) / 1000.0) AS distance
            FROM
                public.pharmacies AS p
            WHERE
                p.location IS NOT NULL AND ST_Intersects(p.location, bounds_envelope)
            LIMIT 200;
        END;
        $$;
        ```

3.  **Seed Initial Data**:
    *   Create another migration file (e.g., `supabase/migrations/YYYYMMDDHHMMSS_seed_jan_aushadhi_pharmacies.sql`).
    *   Insert sample pharmacy data, ensuring the `location` column is populated correctly using `ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography`. Use `ON CONFLICT DO NOTHING` for idempotency.

4.  **API Endpoint (`apps/api/src/routes/pharmacies.ts`)**:
    *   **Dependencies**: Ensure `@supabase/supabase-js` and `zod` are installed.
    *   **Type Definitions**: Define the `PharmacyRow`, `PharmacyRpcResult`, `FormattedPharmacy`, and `PharmacyWithRawDistance` interfaces as provided in the PR diff.
    *   **Validation Schemas**: Implement `nearestQuerySchema` and `boundsQuerySchema` using `zod` for input validation.
    *   **Helper Functions**: Implement `calculateDistanceKM`, `extractCoordinates`, `formatPharmacy`, `validateSupabaseConfig`, and `handleFetchError`.
    *   **`nearest` Route Logic**:
        *   Parse and validate query parameters using `nearestQuerySchema`.
        *   Attempt to call `supabase.rpc("get_nearest_pharmacies", { query_lat: lat, query_lng: lng, search_radius_km: radius })`.
        *   If RPC succeeds, map `PharmacyRpcResult[]` to `FormattedPharmacy[]` and return.
        *   If RPC fails, log a warning and fall back to fetching all pharmacies (`supabase.from("pharmacies").select("*")`).
        *   In the fallback, calculate distances using `calculateDistanceKM`, filter by `radius`, sort by `rawDistance`, and then map to `FormattedPharmacy[]`.
    *   **OpenAPI Documentation**: Add JSDoc comments with `@openapi` annotations to the route handlers for automatic Swagger generation.

5.  **Testing (`apps/api/tests/pharmacies.test.ts`)**:
    *   Write unit and integration tests covering both the PostGIS RPC happy path and the Haversine fallback path.
    *   Test various scenarios: valid coordinates, invalid coordinates (expect 400), different radii, empty results, and the correct structure of the returned data.
    *   Ensure no internal data (`rawDistance`, `id`) is exposed in the final API response.
    *   Mock Supabase calls (`supabase.rpc`, `supabase.from().select()`) to control test outcomes and simulate RPC success/failure.

## Impact on System Architecture

This change significantly elevates SahiDawa's geospatial capabilities, transforming our pharmacy search from a basic, client-side operation into a robust, scalable, and performant server-side feature.

1.  **Performance and Scalability**: By offloading geospatial calculations to PostGIS, we leverage highly optimized database indexes and functions. This drastically reduces the computational load on our Node.js API server and improves query response times, especially as the number of pharmacies and concurrent users grows. This is critical for a platform aiming for nationwide coverage.
2.  **Data Accuracy and Richness**: The integration of real Jan Aushadhi Kendra data provides immediate value and a strong foundation for further development. It allows for more accurate testing and demonstration of the platform's utility in real-world scenarios.
3.  **API Robustness and Maintainability**: The introduction of strong TypeScript types and comprehensive OpenAPI documentation makes the `/api/pharmacies` endpoints more reliable, easier to understand, and simpler for frontend developers to consume. This reduces integration friction and improves overall developer experience.
4.  **Foundation for Future Geospatial Features**: This PR establishes a solid architectural pattern for handling other location-based services. We can now easily extend this pattern to implement features like:
    *   Searching for nearby health camps or medical professionals.
    *   Geofencing for alert systems.
    *   Optimized routing for delivery services (though this would require more advanced PostGIS features).
    *   Spatial analysis of health data.
5.  **Reduced Technical Debt**: Replacing `any` types and client-side filtering with a structured, database-driven approach reduces technical debt and aligns our codebase with best practices for modern API development.

## Testing & Verification

This change was thoroughly tested and verified through several mechanisms:

1.  **Unit and Integration Tests (`apps/api/tests/pharmacies.test.ts`)**:
    *   The test suite expanded from 4 to 15 tests, covering a wide range of scenarios.
    *   **PostGIS RPC Happy Path**: Tests confirm that when the `get_nearest_pharmacies` RPC succeeds, the API correctly processes and returns the data, respecting the `search_radius_km` parameter and the `MAX_RESULTS` limit.
    *   **Radius Parameter Handling**: Specific tests ensure that the `radius` parameter is correctly passed to the RPC and that a default radius of 50 km is applied when not specified.
    *   **Empty Results**: Tests verify that an empty array is returned when no pharmacies are found within the specified radius.
    *   **Data Integrity**: Tests confirm that internal properties like `rawDistance` and `id` (from the RPC result) are not exposed in the final API response, ensuring a clean public contract.
    *   **Bounds RPC**: Tests cover the happy path for `get_pharmacies_in_bounds`, ensuring pharmacies within the specified bounding box are returned.
    *   **Fallback Mechanism**: Tests explicitly simulate PostGIS RPC failure (e.g., by mocking `supabase.rpc` to return an error) and verify that the API gracefully falls back to the JavaScript-based Haversine calculation, still returning correct results.
    *   **Validation**: Original validation tests for invalid coordinates and radius values were preserved and passed, ensuring 400 Bad Request responses with detailed error messages.

2.  **Manual API Testing (cURL)**:
    *   The provided screenshots and `curl` commands demonstrate successful API calls to `/api/pharmacies/nearest` with specific coordinates (Delhi) and radius, returning expected nearby pharmacies with correct distances.
    *   Validation of invalid coordinates (`lat=999&lng=999`) was confirmed to return a 400 error with specific details about the invalid parameters.

3.  **Swagger UI Verification**:
    *   A screenshot of the `/api/docs` endpoint shows that the OpenAPI documentation for `/api/pharmacies/nearest` is correctly generated, displaying the summary, description, parameters, and response schemas as defined in the JSDoc annotations. This confirms the API contract is well-documented and discoverable.

4.  **Database Seed Verification**:
    *   The `20260530000001_seed_jan_aushadhi_pharmacies.sql` migration was run, and the presence of 30 real Jan Aushadhi Kendra locations in the `pharmacies` table was verified, ensuring the data is available for spatial queries.

**Edge Cases Considered:**
*   **No Pharmacies Found**: Handled by returning an empty array.
*   **Invalid Coordinates/Radius**: Handled by `zod` validation, returning a 400 error.
*   **PostGIS RPC Failure**: Gracefully handled by falling back to Haversine calculation.
*   **Missing Supabase Configuration**: Handled by `validateSupabaseConfig`, returning a 500 error.
*   **Large Number of Results**: Limited to `MAX_RESULTS` (200) by both the RPC and the fallback mechanism.
*   **Idempotent Seeding**: `ON CONFLICT DO NOTHING` ensures the seed migration can be re-run without creating duplicate entries.