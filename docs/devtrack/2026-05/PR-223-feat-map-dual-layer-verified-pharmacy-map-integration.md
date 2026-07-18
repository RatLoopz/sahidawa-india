# PR #223 — feat(map): dual-layer verified pharmacy map integration

> **Merged:** 2026-05-18 | **Author:** @shashank03-dev | **Area:** Frontend | **Impact Score:** 23 | **Closes:** #210

## What Changed

This pull request significantly enhances our map functionality by integrating verified Jan Aushadhi Kendras from our backend database alongside existing OpenStreetMap (OSM) pharmacy data. The map now simultaneously fetches data from both sources, displays verified stores with a distinct glowing green shield marker, prioritizes them in the pharmacy drawer with a "Verified Safe Store" badge, and introduces a "Verified Partners Only" filter for users.

## The Problem Being Solved

Previously, our map primarily relied on OpenStreetMap data, which, while comprehensive, lacked the crucial "verified" status for pharmacies. We also had a limited backend API (`/api/pharmacies/nearest`) that only returned a hardcoded maximum of 3 results and did not expose verification status or detailed contact information. This meant users couldn't easily identify trusted SahiDawa partner pharmacies, and our system couldn't effectively promote verified health points. The map also lacked a bounding-box search capability for backend data, making "Search this area" functionality incomplete for our own verified data.

## Files Modified

- `apps/api/src/routes/pharmacies.ts`
- `apps/web/app/[locale]/map/PharmacyMap.tsx`
- `apps/web/app/[locale]/map/page.tsx`
- `apps/web/lib/api.ts`

## Implementation Details

### Backend (`apps/api/src/routes/pharmacies.ts`)

1.  **`GET /api/pharmacies/nearest` Endpoint Enhancements:**
    *   The hardcoded 3-result cap was removed. The endpoint now accepts an optional `radius` query parameter (default 50km, max 200km) via `nearestQuerySchema` and returns up to `MAX_RESULTS` (200) pharmacies.
    *   The response payload for each pharmacy is enriched with `phone_number`, `is_verified`, `district`, and `state` fields, providing more comprehensive data to the frontend.
    *   The `is_verified` field now defaults to `false` for any pharmacy where this status is not explicitly set, ensuring a safe and consistent default.
    *   The PostGIS RPC call (`get_nearest_pharmacies`) now filters results by the requested `radius` and sorts them by distance before slicing to `MAX_RESULTS`.
    *   The in-memory fallback logic (used if PostGIS RPC fails or is not configured) was also updated to respect the `radius` and `MAX_RESULTS` limits, and to use the new `extractCoordinates` and `formatPharmacy` helpers.

2.  **New `GET /api/pharmacies/in-bounds` Endpoint:**
    *   A new endpoint was added to support bounding-box queries, crucial for the "Search this area" feature. It accepts `south`, `west`, `north`, and `east` query parameters, validated by `boundsQuerySchema`.
    *   This endpoint first attempts to use a PostGIS RPC function (`get_pharmacies_in_bounds`) for efficient spatial querying.
    *   If the RPC fails or is unavailable, it falls back to fetching all pharmacies from the `pharmacies` table and performing in-memory filtering based on the provided bounds.
    *   Results are formatted using `formatPharmacy` and capped at `MAX_RESULTS`.

3.  **Shared Helper Functions:**
    *   `extractCoordinates(p: any)`: A utility to safely extract `lat` and `lng` from various pharmacy data structures (direct `lat`/`lng` properties or GeoJSON `location.coordinates`). This centralizes coordinate parsing logic.
    *   `formatPharmacy(p: any, distanceKm: number)`: Standardizes the pharmacy object structure returned by the API, ensuring consistent fields like `name`, `address`, `lat`, `lng`, `distance`, `phone_number`, `is_verified`, `district`, and `state`.
    *   `validateSupabaseConfig(res: Response)`: Checks for the presence of `SUPABASE_URL` and `SUPABASE_ANON_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) environment variables and sends a 500 error if missing. This improves developer experience by providing clear configuration hints.
    *   `handleFetchError(fetchError: any, res: Response)`: Centralizes error handling for Supabase queries, logging the error and sending a developer-friendly 500 response with hints for common issues (e.g., invalid API key, missing table).

### Frontend API Client (`apps/web/lib/api.ts`)

1.  **New Fetch Functions:**
    *   `fetchVerifiedPharmacies(lat: number, lng: number, radiusKm: number)`: Calls the backend's `/api/pharmacies/nearest` endpoint.
    *   `fetchVerifiedPharmaciesInBounds(south: number, west: number, north: number, east: number)`: Calls the backend's new `/api/pharmacies/in-bounds` endpoint.
    *   Both functions are wrapped in `try...catch` blocks and return an empty array (`[]`) on failure, ensuring graceful degradation of the UI if the backend API is unreachable or returns an error.

### Map Component (`apps/web/app/[locale]/map/PharmacyMap.tsx`)

1.  **`Pharmacy` Interface Extension:**
    *   The `Pharmacy` interface was extended to include an optional `isVerified?: boolean` property, allowing the component to differentiate between verified and unverified stores.
2.  **Verified Marker Rendering:**
    *   A new glowing green shield marker with a pulsing CSS animation is rendered for pharmacies where `isVerified` is `true`. This provides a clear visual distinction on the map.
3.  **Verified Popup Banner:**
    *   When a verified pharmacy's marker is clicked, its map popup now displays a prominent "Verified Safe Store" green banner, reinforcing trust.
4.  **XSS Hardening:**
    *   An `escapeHtml()` utility function was added and applied to all string interpolations within the map popup's HTML content. This sanitizes potentially malicious input, preventing Cross-Site Scripting (XSS) vulnerabilities.

### Map Page (`apps/web/app/[locale]/map/page.tsx`)

1.  **Dual-Source Data Fetching:**
    *   The page now uses `Promise.allSettled` to concurrently fetch pharmacy data from two sources: our backend API (via `fetchVerifiedPharmaciesInBounds` or `fetchVerifiedPharmacies`) and the Overpass API for OSM data (`fetchOsmPharmacies`). This ensures that neither source blocks the other and allows for partial success.
2.  **Proximity Deduplication:**
    *   After fetching, a latitude-aware proximity deduplication algorithm is applied at a 100-meter threshold. This prevents the same physical pharmacy from appearing twice if it exists in both our verified database and OpenStreetMap.
3.  **Explicit Sorting:**
    *   The combined list of pharmacies is sorted to prioritize verified stores first. Within each group (verified or unverified), pharmacies are then sorted by their distance from the user's current location.
4.  **UI Enhancements:**
    *   A "Verified Partners" filter chip with a shield icon was added to the map controls, allowing users to view only SahiDawa's verified partners.
    *   Pharmacy cards in the drawer now display a verified badge and shield icon for `isVerified` pharmacies.
    *   The map's status text dynamically updates to show "Verified + OSM" when verified results are present, informing the user about the dual data sources.

## Technical Decisions

1.  **`Promise.allSettled` for Dual Fetching:** We chose `Promise.allSettled` over `Promise.all` to ensure that the failure of one data source (e.g., backend API down) does not prevent the other (e.g., Overpass API) from rendering its results. This provides a more robust and gracefully degrading user experience.
2.  **Backend RPC with In-Memory Fallback:** For both `/nearest` and `/in-bounds` endpoints, we prioritized using PostGIS RPC functions for their performance benefits in spatial queries. However, a robust in-memory fallback was implemented to ensure the API remains functional even if PostGIS extensions are not configured or the RPC functions are not deployed in the Supabase instance. This enhances the system's resilience and ease of local development.
3.  **Configurable Radius and Max Results:** Instead of hardcoding limits, making the `radius` and `MAX_RESULTS` configurable allows for greater flexibility in future use cases, such as different search scopes or pagination strategies, without requiring code changes.
4.  **Extracted Backend Helpers:** Functions like `extractCoordinates`, `formatPharmacy`, `validateSupabaseConfig`, and `handleFetchError` were extracted to promote code reusability, improve readability, and centralize common logic and error handling patterns within the `pharmacies` route.
5.  **`is_verified` Default to `false`:** Setting a default of `false` for `is_verified` in the backend ensures that unverified pharmacies are never accidentally displayed as verified, maintaining data integrity and user trust.
6.  **XSS Hardening with `escapeHtml()`:** Given that pharmacy names and addresses might come from external sources (like OSM or potentially user input in the future), sanitizing HTML content in map popups with `escapeHtml()` is a critical security measure to prevent Cross-Site Scripting attacks.
7.  **Proximity Deduplication:** To avoid a cluttered and confusing user experience, we implemented a 100m latitude-aware deduplication logic. This ensures that if a verified pharmacy also appears in OSM, it is represented by a single, prioritized entry, preventing visual redundancy.

## How To Re-Implement (Contributor Reference)

To re-implement this dual-layer pharmacy map integration from scratch, a contributor would follow these steps:

1.  **Backend Database Setup (Supabase):**
    *   Ensure a `pharmacies` table exists in your Supabase instance with at least `name`, `address`, `lat`, `lng`, `phone_number`, `is_verified` (boolean), `district`, and `state` columns.
    *   For optimal performance, implement PostGIS extensions and create `get_nearest_pharmacies` and `get_pharmacies_in_bounds` RPC functions. These functions should leverage PostGIS's spatial capabilities (e.g., `ST_Distance`, `ST_Contains`) to efficiently query pharmacies.
    *   Populate the `pharmacies` table with sample data, ensuring some entries have `is_verified: true`.
    *   Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) in your `apps/api/.env` file.

2.  **Backend API (`apps/api/src/routes/pharmacies.ts`):**
    *   Define `nearestQuerySchema` and `boundsQuerySchema` using `zod` for request validation.
    *   Implement `extractCoordinates`, `formatPharmacy`, `validateSupabaseConfig`, and `handleFetchError` helper functions for data processing, configuration validation, and robust error handling.
    *   Create the `GET /api/pharmacies/nearest` route:
        *   Parse `lat`, `lng`, and `radius` from `req.query`.
        *   Call `validateSupabaseConfig`.
        *   Attempt to call the `supabase.rpc("get_nearest_pharmacies", ...)` function.
        *   If RPC succeeds, map `rpcData` using `formatPharmacy`, filter by `radius`, sort by distance, and slice to `MAX_RESULTS`.
        *   If RPC fails, implement the fallback: `supabase.from("pharmacies").select("*")`, then filter and sort in-memory using `calculateDistanceKM` and `formatPharmacy`.
        *   Return JSON response `{ pharmacies }`.
    *   Create the `GET /api/pharmacies/in-bounds` route:
        *   Parse `south`, `west`, `north`, `east` from `req.query`.
        *   Call `validateSupabaseConfig`.
        *   Attempt to call `supabase.rpc("get_pharmacies_in_bounds", ...)` (ensure the RPC function exists or handle the `as any` casting).
        *   If RPC succeeds, map `rpcData` using `formatPharmacy`.
        *   If RPC fails, implement the fallback: `supabase.from("pharmacies").select("*")`, then filter in-memory based on bounds and format using `formatPharmacy`.
        *   Return JSON response `{ pharmacies }`.

3.  **Frontend API Client (`apps/web/lib/api.ts`):**
    *   Define `Pharmacy` interface including `isVerified?: boolean`.
    *   Implement `fetchVerifiedPharmacies(lat, lng, radiusKm)`:
        *   Use `fetch` to call `/api/pharmacies/nearest` with query parameters.
        *   Parse JSON response.
        *   Wrap in `try...catch` to return `[]` on error.
    *   Implement `fetchVerifiedPharmaciesInBounds(south, west, north, east)`:
        *   Use `fetch` to call `/api/pharmacies/in-bounds` with query parameters.
        *   Parse JSON response.
        *   Wrap in `try...catch` to return `[]` on error.

4.  **Map Component (`apps/web/app/[locale]/map/PharmacyMap.tsx`):**
    *   Import the extended `Pharmacy` interface.
    *   Within the map rendering logic (e.g., using a library like `react-leaflet` or `mapbox-gl-js`):
        *   Conditionally render a custom marker for `pharmacy.isVerified === true`. This marker should include a distinct icon (e.g., a shield) and potentially CSS for a glowing/pulsing effect.
        *   In the popup content generation:
            *   Implement an `escapeHtml()` utility function to sanitize all dynamic text.
            *   Conditionally render a "Verified Safe Store" banner HTML element if `pharmacy.isVerified === true`.

5.  **Map Page (`apps/web/app/[locale]/map/page.tsx`):**
    *   Import `fetchVerifiedPharmaciesInBounds` (or `fetchVerifiedPharmacies`) and `fetchOsmPharmacies`.
    *   In the data fetching logic (e.g., `useEffect` or server-side data fetching):
        *   Use `Promise.allSettled([fetchVerifiedPharmaciesInBounds(...), fetchOsmPharmacies(...)])` to fetch data concurrently.
        *   Process the results: filter out rejected promises and extract successful data.
        *   Implement a `deduplicatePharmacies` function that takes an array of pharmacies and a proximity threshold (e.g., 100m). This function should identify and remove duplicate entries based on their `lat`/`lng` and prioritize verified entries.
        *   Implement a `sortPharmacies` function that sorts verified pharmacies first, then by distance.
        *   Update the state with the processed, deduplicated, and sorted list of pharmacies.
    *   **UI Integration:**
        *   Add a state variable for the "Verified Partners Only" filter.
        *   Render a filter chip (e.g., a button with a shield icon) that toggles this state.
        *   Modify the pharmacy list rendering logic to conditionally display only verified pharmacies when the filter is active.
        *   In the pharmacy drawer cards, conditionally render a "Verified" badge and shield icon based on `pharmacy.isVerified`.
        *   Update the map's status text to reflect the data sources being used (e.g., "Verified + OSM").

## Impact on System Architecture

This change significantly impacts our system architecture by transforming our map from a single-source (OSM-only) display to a robust, dual-layer information hub.

1.  **Enhanced Data Integration Strategy:** It establishes a clear pattern for integrating multiple, distinct data sources (our verified backend data and external OSM data) into a unified user experience. This paves the way for integrating other types of verified health points or services in the future.
2.  **Increased Backend API Utility:** The backend `pharmacies` API is now a fully-fledged, configurable service capable of handling complex spatial queries (nearest, in-bounds) and providing rich, verified data. This elevates its role from a simple lookup to a core data provider for location-based services.
3.  **Improved Frontend Resilience and User Trust:** The frontend now gracefully handles backend failures and prioritizes trusted information. By visually distinguishing verified partners, we build user trust and guide them towards reliable health resources, which is central to SahiDawa's mission.
4.  **Foundation for Advanced Features:** This dual-layer approach unlocks future possibilities such as:
    *   Integrating other verified health services (e.g., diagnostic labs, doctors).
    *   Advanced search and filtering based on verification status, services offered, or specific districts/states.
    *   Personalized recommendations based on verified status.
    *   More sophisticated data reconciliation algorithms.
5.  **Security Hardening:** The explicit XSS hardening in the map popups sets a good precedent for handling external or potentially untrusted data throughout the application, improving overall security posture.

## Testing & Verification

The following aspects were tested and verified:

*   **Backend API Functionality:**
    *   `GET /api/pharmacies/nearest`: Verified that it returns pharmacies within the specified `radius` (default 50km, max 200km), capped at 200 results, and includes `phone_number`, `is_verified`, `district`, `state`.
    *   `GET /api/pharmacies/in-bounds`: Verified that it returns pharmacies within the specified bounding box.
    *   Error handling: Tested with missing Supabase credentials and an invalid API key to ensure `validateSupabaseConfig` and `handleFetchError` provide clear, actionable error messages.
    *   Fallback mechanism: Verified that if PostGIS RPCs are not configured, the API gracefully falls back to in-memory calculations and filtering.
*   **Frontend API Client (`apps/web/lib/api.ts`):**
    *   Confirmed that `fetchVerifiedPharmacies` and `fetchVerifiedPharmaciesInBounds` correctly call the backend endpoints.
    *   Verified that both functions return an empty array (`[]`) on backend API failure, preventing frontend crashes.
*   **Map Rendering (`apps/web/app/[locale]/map/PharmacyMap.tsx`):**
    *   Verified that pharmacies with `isVerified: true` display the glowing green shield marker with pulsing CSS animation.
    *   Confirmed that clicking a verified pharmacy's marker shows the "Verified Safe Store" green banner in the map popup.
    *   Tested the `escapeHtml()` utility by attempting to inject malicious HTML into pharmacy names/addresses (if possible via backend data) to confirm XSS prevention.
*   **Map Page Logic (`apps/web/app/[locale]/map/page.tsx`):**
    *   **Dual-fetch:** Verified that both backend and OSM data are fetched in parallel using `Promise.allSettled`.
    *   **Deduplication:** Confirmed that duplicate pharmacies (within 100m proximity) from both sources are correctly identified and only one entry (prioritizing verified) is displayed.
    *   **Sorting:** Verified that verified pharmacies appear at the top of the drawer, followed by unverified pharmacies, with both groups sorted by distance.
    *   **Filter:** Tested the "Verified Partners Only" filter chip to ensure it correctly toggles the display of only verified pharmacies.
    *   **UI Elements:** Verified that the verified badge and shield icon appear in pharmacy drawer cards for `isVerified` pharmacies.
    *   **Status Text:** Confirmed the map status text updates to "Verified + OSM" when verified results are present.
*   **Graceful Degradation:** As highlighted in the PR description, the system was verified to gracefully degrade to OSM-only mode if backend credentials are missing or the backend API is unreachable, without console errors.