# PR #1160 — feat: verify and extend Pharmacy & ASHA Worker Map with Leaflet.js (#1132)

> **Merged:** 2026-06-03 | **Author:** @nimkarprachi17 | **Area:** Frontend | **Impact Score:** 40 | **Closes:** #1132

## What Changed

This pull request introduces a fully functional and interactive map feature to our SahiDawa web platform, enabling users to visualize nearby pharmacies and ASHA (Accredited Social Health Activist) workers. We integrated Leaflet.js and React-Leaflet for frontend map rendering, backed by new PostGIS-enabled database tables and stored procedures for efficient spatial queries, exposed via a new `/api/map/nearby` endpoint. The change also includes critical Jest mocks to ensure our CI pipeline remains stable when testing map-related components.

## The Problem Being Solved

Prior to this PR, our platform lacked a direct, visual mechanism for users to locate essential healthcare resources like pharmacies and ASHA workers in their vicinity. While a basic map page scaffold existed at `apps/web/app/[locale]/map/`, it was not populated with dynamic data and did not offer interactive features. This limitation hindered our goal of providing accessible health information, especially for users in rural areas who need to quickly find local support. Furthermore, the absence of proper spatial data handling on the backend meant we couldn't efficiently query location-based information, and unaddressed TypeScript issues coupled with a lack of testing mocks for map components posed risks to code quality and CI stability.

## Files Modified

- `apps/api/src/app.ts`
- `apps/api/src/db/migrations/001_map_tables.sql`
- `apps/api/src/routes/map.ts`
- `apps/web/app/[locale]/map/page.tsx`
- `apps/web/components/map/MapView.tsx`
- `apps/web/jest.config.cjs`
- `apps/web/tests/mocks/leaflet.ts`
- `apps/web/tests/mocks/react-leaflet.ts`
- `data/seeds/map_seed.sql`
- `package-lock.json`

## Implementation Details

**Backend Implementation:**

1.  **Database Migration (`apps/api/src/db/migrations/001_map_tables.sql`):**
    *   We enabled the `postgis` extension in PostgreSQL to provide spatial data types and functions.
    *   Two new tables were created:
        *   `pharmacies`: Stores pharmacy details including `name`, `type` (`Jan Aushadhi` or `private`), `lat`, `lng`, `address`, `district`, `state`, and `verified` status. A `location` column of type `GEOGRAPHY(POINT, 4326)` is `GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) STORED` to automatically create a PostGIS point from `lat`/`lng` for spatial indexing.
        *   `asha_workers`: Stores ASHA worker details including `name`, `district`, `lat`, `lng`, and `contact`. It also includes a `location` column generated similarly to `pharmacies`.
    *   GIST indexes were added to the `location` columns of both tables (`CREATE INDEX ON pharmacies USING GIST(location);` and `CREATE INDEX ON asha_workers USING GIST(location);`) to optimize spatial queries, particularly `ST_DWithin`.
    *   Two SQL stored functions were defined:
        *   `get_nearby_pharmacies(user_lat DOUBLE PRECISION, user_lng DOUBLE PRECISION, radius_m DOUBLE PRECISION)`: This function queries the `pharmacies` table, returning all pharmacies within `radius_m` of the given `user_lat` and `user_lng`. It calculates and returns the `distance_km` from the user.
        *   `get_nearby_asha_workers(...)`: A similar function for querying `asha_workers`.
2.  **API Route (`apps/api/src/routes/map.ts`):**
    *   A new Express `Router` was created to handle map-related API requests.
    *   The `GET /api/map/nearby` endpoint was implemented to serve nearby pharmacy and ASHA worker data.
    *   It expects `lat` and `lng` as required query parameters and an optional `radius_km` (defaulting to 10 km).
    *   Input validation ensures `lat` and `lng` are valid numbers.
    *   It uses `Promise.all` to concurrently call the `get_nearby_pharmacies` and `get_nearby_asha_workers` stored functions via `supabase.rpc()`. The `radius_km` parameter is converted to meters for the `radius_m` argument of the SQL functions.
    *   The endpoint responds with a JSON object containing `pharmacies` and `asha_workers` arrays.
3.  **API Integration (`apps/api/src/app.ts`):**
    *   The new `mapRouter` was imported and integrated into our main Express application by adding `app.use('/api/map', mapRouter);`, making the `/api/map/nearby` endpoint accessible under the `/api/map` base path.

**Frontend Implementation:**

1.  **`MapView.tsx` Component (`apps/web/components/map/MapView.tsx`):**
    *   This is a new React component responsible for rendering the interactive map.
    *   It uses `next/dynamic` with `ssr: false` for all `react-leaflet` components (`MapContainer`, `TileLayer`, `Marker`, `Popup`). This ensures these browser-dependent components are only loaded and executed client-side, preventing server-side rendering errors.
    *   It imports `leaflet/dist/leaflet.css` for map styling.
    *   Custom `L.icon` instances (`greenIcon` and `blueIcon`) are defined using direct URLs to marker images. This addresses common issues with default Leaflet marker icons not displaying correctly in Webpack builds and provides distinct visual cues for pharmacies and ASHA workers.
    *   **State Management:** `userLocation` (for map centering), `pharmacies`, `ashaWorkers` (for fetched data), `showPharmacies`, `showAsha` (for filter toggles), and `loading` are managed using `useState`.
    *   **Geolocation and Data Fetching:** A `useEffect` hook handles initial setup:
        *   It attempts to get the user's current position using `navigator.geolocation.getCurrentPosition`.
        *   If successful, it sets `userLocation` and fetches nearby data from `/api/map/nearby` using the obtained coordinates.
        *   If geolocation fails or is denied, it falls back to a default location (Pune: `[18.5204, 73.8567]`) and fetches data for that location.
        *   The fetched data populates the `pharmacies` and `ashaWorkers` states.
    *   **Rendering:** The component renders filter buttons to toggle the visibility of pharmacy and ASHA worker markers. The `MapContainer` displays OpenStreetMap tiles, and `Marker` components are rendered for each fetched pharmacy and ASHA worker, each with a `Popup` showing relevant details like name, type, address, contact, and distance.
2.  **Page Integration (`apps/web/app/[locale]/map/page.tsx`):**
    *   The `MapView` component is imported and rendered within the existing `PharmacyMapPage` component. This integrates the new interactive map into the dedicated map page, enhancing its functionality.
3.  **Testing Mocks (`apps/web/jest.config.cjs`, `apps/web/tests/mocks/leaflet.ts`, `apps/web/tests/mocks/react-leaflet.ts`):**
    *   `apps/web/jest.config.cjs` was updated to include `moduleNameMapper` configurations. These mappings redirect imports for `leaflet` and `react-leaflet` to mock files (`<rootDir>/tests/mocks/leaflet.ts` and `<rootDir>/tests/mocks/react-leaflet.ts`) during Jest test runs.
    *   These mock files provide minimal, non-functional exports for Leaflet and React-Leaflet modules, allowing our Jest tests to execute successfully in a Node.js environment without encountering errors from browser-specific Leaflet code.

**Data Seeding:**
*   `data/seeds/map_seed.sql`: Not documented in this PR, but implies the addition of initial data for the new `pharmacies` and `asha_workers` tables to facilitate development and testing.

## Technical Decisions

1.  **Leaflet.js and React-Leaflet:** We selected Leaflet.js for its lightweight nature, open-source license, and robust feature set, making it an ideal choice for a cost-effective and performant mapping solution. React-Leaflet provides a seamless, declarative integration with our React/Next.js frontend, aligning with our existing component-based architecture. This choice avoids the licensing complexities and potential costs associated with proprietary mapping solutions like Google Maps.
2.  **PostGIS for Spatial Data Management:** Leveraging PostGIS on our PostgreSQL database (via Supabase) was a strategic decision to handle geographical data efficiently. PostGIS offers powerful spatial data types, functions, and indexing capabilities (GIST indexes) that are crucial for performing fast proximity searches (`ST_DWithin`) and managing location-based information at scale. This integrates well with our existing data infrastructure without introducing new database technologies.
3.  **Client-Side Rendering for Map Components (`next/dynamic` with `ssr: false`):** Leaflet and `react-leaflet` depend heavily on browser-specific APIs (e.g., `window`, `document`). To prevent errors during Next.js's server-side rendering process, we explicitly opted for client-side-only rendering of the `MapView` component and its Leaflet dependencies using `next/dynamic` with the `ssr: false` option. This ensures the map components are only initialized in the browser environment where they can function correctly.
4.  **SQL Stored Functions for API Logic:** Encapsulating the spatial query logic within PostgreSQL stored functions (`get_nearby_pharmacies`, `get_nearby_asha_workers`) and calling them via Supabase RPC (`supabase.rpc()`) centralizes complex database operations. This approach keeps our Express API endpoints lean, improves performance by executing logic closer to the data, and promotes reusability of the spatial query logic.
5.  **Custom Leaflet Marker Icons:** The default Leaflet marker icons often fail to load correctly in modern JavaScript bundlers like Webpack due to asset path resolution issues. By defining custom `L.icon` instances with direct URLs to marker images, we ensure consistent and reliable display of markers, while also allowing for distinct visual identification of pharmacies (green) and ASHA workers (blue).
6.  **Jest Mocks for CI Stability:** To prevent our continuous integration (CI) pipeline from failing due to Leaflet's browser-specific dependencies when running Jest tests in a Node.js environment, we implemented `moduleNameMapper` configurations in `jest.config.cjs`. These mocks provide dummy implementations for `leaflet` and `react-leaflet`, allowing tests to run without attempting to render actual map components, thus ensuring test suite stability and efficiency.

## How To Re-Implement (Contributor Reference)

To re-implement the Pharmacy & ASHA Worker Map feature from scratch, a contributor would follow these steps:

1.  **Database Schema and Spatial Functions (PostgreSQL with PostGIS):**
    *   Ensure the `postgis` extension is enabled in your PostgreSQL database.
    *   Create the `pharmacies` and `asha_workers` tables, including the `GEOGRAPHY(POINT, 4326)` `location` column generated from `lat` and `lng`, as detailed in `apps/api/src/db/migrations/001_map_tables.sql`.
    *   Add GIST indexes to the `location` columns of both tables for optimal spatial query performance.
    *   Define the `get_nearby_pharmacies` and `get_nearby_asha_workers` SQL stored functions, which perform `ST_DWithin` queries and calculate `distance_km`, as provided in the migration file.
    *   Populate these tables with sample data (e.g., using `INSERT` statements or a seed script like `data/seeds/map_seed.sql`).

2.  **Backend API Endpoint (Express.js & Supabase):**
    *   Create a new file, `apps/api/src/routes/map.ts`.
    *   Define an Express `Router` and implement a `GET /nearby` endpoint.
    *   This endpoint should parse `lat`, `lng`, and `radius_km` from query parameters.
    *   Perform input validation for `lat` and `lng`.
    *   Use `Promise.all` to execute `supabase.rpc('get_nearby_pharmacies', { user_lat, user_lng, radius_m: radius_km * 1000 })` and `supabase.rpc('get_nearby_asha_workers', { user_lat, user_lng, radius_m: radius_km * 1000 })`.
    *   Return the results as a JSON object: `{ pharmacies: data, asha_workers: data }`.
    *   In `apps/api/src/app.ts`, import `mapRouter` and register it with `app.use('/api/map', mapRouter);`.

3.  **Frontend Map Component (Next.js & React-Leaflet):**
    *   Install `leaflet` and `react-leaflet` packages: `npm install leaflet react-leaflet`.
    *   Create `apps/web/components/map/MapView.tsx`.
    *   Import `MapContainer`, `TileLayer`, `Marker`, and `Popup` using `next/dynamic` with `ssr: false` to ensure client-side rendering.
    *   Import Leaflet's CSS: `import 'leaflet/dist/leaflet.css';`.
    *   Define custom `L.icon` objects for pharmacy (green) and ASHA worker (blue) markers, specifying `iconUrl`, `shadowUrl`, `iconSize`, and `iconAnchor`.
    *   Implement a `useEffect` hook to:
        *   Attempt to get the user's current location using `navigator.geolocation.getCurrentPosition`.
        *   On success, set the `userLocation` state and `fetch` data from `/api/map/nearby` using the obtained coordinates.
        *   On failure (e.g., permission denied), set a fallback `userLocation` (e.g., Pune) and fetch data for that location.
        *   Update `pharmacies` and `ashaWorkers` states with the fetched data.
    *   Render filter buttons to toggle the `showPharmacies` and `showAsha` states.
    *   Render the `MapContainer` centered on `userLocation` with an `TileLayer` pointing to OpenStreetMap.
    *   Conditionally render `Marker` components for each pharmacy and ASHA worker, using their respective custom icons and including `Popup` components to display details.

4.  **Page Integration:**
    *   In `apps/web/app/[locale]/map/page.tsx`, import the `MapView` component.
    *   Embed `<MapView />` within the page's JSX structure.

5.  **Jest Testing Mocks:**
    *   Create mock files: `apps/web/tests/mocks/leaflet.ts` and `apps/web/tests/mocks/react-leaflet.ts`. These files should export minimal, non-functional stubs for the modules (e.g., `export const MapContainer = () => null;`).
    *   Update `apps/web/jest.config.cjs` to include `moduleNameMapper` entries that redirect `^leaflet$` and `^react-leaflet$` imports to these mock files during test execution.

**Key Gotchas:**
*   **SSR Compatibility:** Always use `next/dynamic` with `ssr: false` for Leaflet/React-Leaflet components in Next.js.
*   **Marker Icon Paths:** Leaflet's default marker icons often break in modern build environments; explicitly defining `L.icon` with full URLs is a robust solution.
*   **Geolocation Fallback:** Implement a fallback mechanism for `navigator.geolocation.getCurrentPosition` in case of user denial or browser limitations.
*   **Database Schema:** Ensure `postgis` is enabled and spatial indexes are created for performance.

## Impact on System Architecture

This change significantly enhances our system's capabilities and architecture:

1.  **Spatial Data Foundation:** We've established a robust foundation for handling geographical data by integrating PostGIS into our PostgreSQL database. This allows us to store, query, and analyze location-based information efficiently, unlocking possibilities for future features requiring spatial awareness.
2.  **Modular API Design:** The introduction of a dedicated `/api/map` endpoint with specific functions for spatial queries improves the modularity and organization of our backend API. This separation of concerns makes the API easier to understand, maintain, and extend.
3.  **Reusable Frontend Component:** The `MapView.tsx` component is designed to be reusable and self-contained. This promotes a component-driven development approach, allowing us to easily integrate interactive maps into other parts of the SahiDawa platform (e.g., for supply chain visualization, patient visit tracking, or community health events) without duplicating code.
4.  **Enhanced User Experience and Accessibility:** By providing an intuitive visual map, we directly address a critical user need, making it easier for individuals in rural areas to locate essential healthcare resources. This improves the platform's utility and impact.
5.  **Scalability for Location-Based Services:** The PostGIS integration positions our system to scale for more advanced location-based services, such as route optimization for ASHA workers, heatmap generation for health hotspots, or geofencing for service areas, aligning with our long-term vision for the platform.
6.  **Improved Development Workflow:** The addition of Jest mocks for Leaflet ensures that our frontend test suite remains fast and reliable, preventing CI failures related to browser-specific dependencies. This contributes to a more stable and efficient development and deployment pipeline.

## Testing & Verification

The implementation of the Pharmacy & ASHA Worker Map feature underwent thorough testing and verification:

1.  **Local Environment Validation:** We ran the full SahiDawa project locally, confirming that the map page at `http://localhost:3000/en/map` rendered without errors and displayed the map interface as expected.
2.  **Visual and Functional Verification:**
    *   The map was visually inspected to ensure OpenStreetMap tiles loaded correctly.
    *   Pharmacy markers (green) and ASHA worker markers (blue) were verified to appear at their respective geographical coordinates.
    *   Clicking on individual markers was confirmed to open popups displaying accurate and relevant details (e.g., pharmacy name, type, address, distance; ASHA worker name, district, contact, distance).
    *   The filter toggles ("🟢 Pharmacies" and "🔵 ASHA Workers") were tested to correctly show and hide the corresponding marker types on the map.
    *   Browser geolocation functionality was tested to ensure the map automatically centered on the user's current location and fetched nearby data. The fallback mechanism to a default location (Pune) was also implicitly verified when geolocation was denied or unavailable.
3.  **API Endpoint Verification:** The frontend's successful interaction with the `/api/map/nearby` endpoint implicitly verified its functionality, ensuring it correctly processed `lat`, `lng`, and `radius_km` parameters and returned structured JSON data for nearby pharmacies and ASHA workers.
4.  **TypeScript Compliance:** The command `npx tsc --noEmit` was executed, confirming that there were zero TypeScript errors across the codebase, ensuring type safety and code quality.
5.  **CI Stability:** The addition of Jest mocks for `leaflet` and `react-leaflet` in `apps/web/jest.config.cjs` specifically addressed and resolved previous CI test failures related to these libraries. This ensures that our automated tests can run reliably in a Node.js environment without requiring a full browser, maintaining the integrity and efficiency of our CI pipeline.

**Edge Cases Considered:**
*   **Geolocation Failure/Denial:** Handled by falling back to a default central Indian location (Pune) to ensure the map is always functional.
*   **No Nearby Data:** The map gracefully handles cases where the API returns empty lists for pharmacies or ASHA workers by simply not displaying any markers for those categories.
*   **Invalid API Parameters:** The backend API endpoint includes validation for `lat` and `lng` to prevent malformed requests.