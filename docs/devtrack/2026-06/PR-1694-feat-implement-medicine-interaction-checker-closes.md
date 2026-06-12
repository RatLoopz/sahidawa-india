# PR #1694 — Feat: Implement Medicine Interaction Checker (closes #1626)

> **Merged:** 2026-06-11 | **Author:** @shauryavardhan1307 | **Area:** Backend | **Impact Score:** 61 | **Closes:** #1626

## What Changed

We have implemented a comprehensive Medicine Interaction Checker feature. This includes a new backend API endpoint `/api/v1/interactions/check` for identifying drug-drug interactions, a dedicated `drug_interactions` database schema, and a responsive frontend user interface at `/interaction-checker`. Crucially, the system incorporates an offline fallback mechanism using local static data to ensure resilience when the primary database is unreachable.

## The Problem Being Solved

Prior to this PR, the SahiDawa platform lacked the capability to inform users about potential adverse drug-drug interactions. This was a significant gap in our commitment to patient safety and comprehensive health information, as users had no integrated tool to check if multiple medicines they were considering or currently taking could lead to harmful effects. The absence of an offline fallback also meant that this critical safety feature would be unavailable in areas with poor or no internet connectivity, which is a common challenge in rural health settings.

## Files Modified

- `apps/api/src/app.ts`
- `apps/api/src/config/cors.ts`
- `apps/api/src/db/client.ts`
- `apps/api/src/routes/interactions.ts`
- `apps/api/tests/cors.test.ts`
- `apps/api/tests/interactions.test.ts`
- `apps/api/ws-setup.js`
- `apps/web/app/[locale]/interaction-checker/page.tsx`
- `apps/web/lib/api.ts`
- `apps/web/lib/api/interactions.ts`
- `apps/web/messages/en.json`
- `apps/web/messages/hi.json`
- `supabase/migrations/20260611000000_add_drug_interactions.sql`

## Implementation Details

The Medicine Interaction Checker is implemented across our database, backend API, and frontend application.

**Database Layer:**
A new `drug_interactions` table was introduced via the `supabase/migrations/20260611000000_add_drug_interactions.sql` migration. This table stores information about known drug interactions, including `drug_a_id`, `drug_b_id` (representing generic drug names), `severity` (e.g., "critical", "serious", "moderate", "minor"), `mechanism`, `description`, `clinical_recommendation`, and `source`. The migration also includes bidirectional index optimizations on `(drug_a_id, drug_b_id)` and `(drug_b_id, drug_a_id)` to ensure efficient lookups regardless of the order of drugs provided. Row-Level Security (RLS) policies were applied to this table to control data access, though the specific RLS DDL is not detailed in the provided diff. The table is seeded with standard interaction data, such as *Sildenafil + Nitroglycerin* and *Paracetamol + Warfarin*.

**Backend API (`apps/api`):**
1.  **CORS Configuration:** The `apps/api/src/config/cors.ts` file was updated to include `http://127.0.0.1:3000` and `http://127.0.0.1:4000` in `DEFAULT_ALLOWED_ORIGINS` to support local development environments. The CORS middleware in `apps/api/src/app.ts` was reordered to be applied earlier in the middleware chain, specifically before other middleware that might terminate the request, ensuring proper handling of preflight requests.
2.  **Supabase Client State:** A new `dbConfig` object with an `isSupabaseOffline` boolean flag was added to `apps/api/src/db/client.ts`. This flag is used to track the real-time connectivity status of the Supabase database, allowing the application to quickly switch to offline fallback mode upon detecting a connection issue.
3.  **New Interactions Route:** A new Express router was created in `apps/api/src/routes/interactions.ts`.
    *   It defines a `checkSchema` using `zod` to validate incoming requests, ensuring that the `medicines` array contains at least two strings.
    *   `localBrandMap` and `localInteractions` static arrays are defined within this file. `localBrandMap` provides a mapping from common brand names (e.g., "Crocin", "Viagra") to their generic equivalents (e.g., "paracetamol", "sildenafil"). `localInteractions` contains a subset of common, clinically significant drug-drug interactions, mirroring the structure of the database table. These serve as the in-memory offline fallback data.
    *   The `resolveToGeneric(input: string)` asynchronous function is responsible for mapping a user-provided medicine name (brand or generic) to its canonical generic name. It first attempts a database lookup in the `medicines` table, searching by `id`, `brand_name.ilike`, or `generic_name.ilike`. If the database query fails due to connectivity issues (e.g., "fetch failed", "refused", "timeout"), it sets `dbConfig.isSupabaseOffline = true` and falls back to `localBrandMap`.
    *   The `POST /check` endpoint:
        *   Validates the request body using `checkSchema`.
        *   Calls `resolveToGeneric` for all input medicines in parallel (`Promise.all`) to obtain their generic names.
        *   It then generates all unique pairs of these resolved generic names.
        *   For each pair, it attempts to query the `drug_interactions` table in Supabase, performing a bidirectional search (`(drug_a_id=A AND drug_b_id=B) OR (drug_a_id=B AND drug_b_id=A)`).
        *   If the Supabase query fails or `dbConfig.isSupabaseOffline` is true, it falls back to searching the `localInteractions` array for a match.
        *   Finally, it aggregates all found interactions and returns them in the response, including the original input names alongside the generic names for clarity.
4.  **API Integration:** The `interactionsRouter` is mounted in `apps/api/src/app.ts` at the `/api/v1/interactions` path.

**Frontend Application (`apps/web`):**
1.  **API Client:** A new API client wrapper, `checkInteractions`, was added to `apps/web/lib/api/interactions.ts`. This function handles the HTTP POST request to `/api/v1/interactions/check`, including support for CSRF protection. This client is then exported via `apps/web/lib/api.ts`.
2.  **User Interface:** A new page component, `apps/web/app/[locale]/interaction-checker/page.tsx`, provides the user interface for the interaction checker.
    *   It features a debounced fuzzy autocomplete search input for medicines, allowing users to easily find and select drugs.
    *   Selected medicines are displayed as interactive chip badges.
    *   When at least two medicines are selected, the component fetches interaction data from the backend.
    *   Interaction results are presented as color-coded alert cards, grouped by severity (Critical, Serious, Moderate, Minor), providing clear visual cues to the user.
    *   The selected medicines are persisted in `localStorage` to maintain state across sessions or page reloads.
3.  **Translations:** New translation keys relevant to the interaction checker UI were added under the `"Interactions"` namespace in `apps/web/messages/en.json` and `apps/web/messages/hi.json`.

## Technical Decisions

1.  **Offline Fallback for Critical Safety:** The decision to implement a robust offline fallback mechanism using `localBrandMap` and `localInteractions` was critical. In rural health settings, internet connectivity can be unreliable. For a feature as vital as drug interaction checking, continuous availability, even with a limited dataset, is paramount for patient safety. This prioritizes immediate utility over comprehensive, real-time data when the primary database is inaccessible.
2.  **Generic Name Resolution:** Interactions are fundamentally based on active pharmaceutical ingredients, not brand names. By implementing `resolveToGeneric`, we ensure that user input, whether a brand or generic name, is normalized to its generic equivalent before checking for interactions. This makes the system more robust, user-friendly, and accurate.
3.  **Bidirectional Interaction Search:** The database schema and query logic (`or(and(drug_a_id.eq.${a},drug_b_id.eq.${b}),and(drug_a_id.eq.${b},drug_b_id.eq.${a}))`) explicitly support bidirectional lookup. This simplifies data entry in the `drug_interactions` table (only one entry needed for A+B interaction) and ensures that the order in which a user inputs medicines does not affect the interaction detection.
4.  **`dbConfig.isSupabaseOffline` Flag:** Introducing a global flag to track Supabase connectivity (`apps/api/src/db/client.ts`) allows the backend to quickly detect and adapt to database outages. Instead of repeatedly attempting slow, failing database queries, the system can immediately switch to its offline fallback, improving performance and user experience during network issues.
5.  **Zod for API Validation:** Using `zod` for request body validation (`checkSchema` in `apps/api/src/routes/interactions.ts`) provides a declarative, type-safe, and easy-to-read way to enforce API contract requirements. This improves developer experience, reduces potential bugs, and ensures consistent data handling.
6.  **CORS Middleware Reordering:** Moving the `cors` middleware earlier in `apps/api/src/app.ts` was a fix to ensure that CORS headers are correctly applied for all requests, including preflight `OPTIONS` requests, before other middleware potentially processes or terminates the request. This prevents common CORS-related issues during development and deployment.

## How To Re-Implement (Contributor Reference)

To re-implement the Medicine Interaction Checker from scratch, a contributor would follow these steps:

1.  **Database Setup:**
    *   Create a `drug_interactions` table in Supabase (or equivalent PostgreSQL) with columns: `id` (PK), `drug_a_id` (TEXT), `drug_b_id` (TEXT), `severity` (TEXT, e.g., 'critical', 'serious', 'moderate', 'minor'), `mechanism` (TEXT), `description` (TEXT), `clinical_recommendation` (TEXT), `source` (TEXT).
    *   Add unique indexes for bidirectional lookup: `CREATE UNIQUE INDEX idx_drug_interactions_ab ON drug_interactions (drug_a_id, drug_b_id);` and `CREATE UNIQUE INDEX idx_drug_interactions_ba ON drug_interactions (drug_b_id, drug_a_id);`.
    *   Implement Row-Level Security (RLS) policies to ensure appropriate access control for the `drug_interactions` table.
    *   Populate the table with initial seed data for common drug interactions.

2.  **Backend API (`apps/api`):**
    *   **CORS:** Ensure `http://127.0.0.1:3000` and `http://127.0.0.1:4000` are allowed origins in `apps/api/src/config/cors.ts`. Verify that `app.use(cors(createCorsOptions()))` is placed early in `apps/api/src/app.ts`.
    *   **Offline State Management:** Introduce a global state variable (e.g., `dbConfig.isSupabaseOffline`) in `apps/api/src/db/client.ts` to track database connectivity.
    *   **Offline Data:** Define static `localBrandMap` (brand to generic) and `localInteractions` (interaction objects) arrays within the new route file (`apps/api/src/routes/interactions.ts`).
    *   **Generic Resolver:** Implement an asynchronous function, `resolveToGeneric(input: string)`, that:
        *   Takes a medicine name as input.
        *   Attempts to query the `medicines` table (or similar) in the primary database to find its generic name, handling potential database connection errors by setting the `isSupabaseOffline` flag.
        *   If the database is offline or the lookup fails, it falls back to searching `localBrandMap`.
        *   Returns an object `{ input: string, generic: string }`.
    *   **Interaction Check Endpoint:** Create a new Express router and define a `POST /check` endpoint:
        *   Use `zod` (or similar validation library) to validate the request body, requiring an array of at least two medicine names.
        *   Map the input medicine names to their generic equivalents using `resolveToGeneric` in parallel.
        *   Generate all unique pairs from the list of generic names.
        *   For each pair, attempt to query the `drug_interactions` table in the database using a bidirectional `OR` condition (e.g., `(drug_a_id = X AND drug_b_id = Y) OR (drug_a_id = Y AND drug_b_id = X)`).
        *   If the database is offline or the query fails, search the `localInteractions` array for matching pairs.
        *   Collect all found interactions and return them in a structured JSON response.
    *   **Integration:** Mount this new router in `apps/api/src/app.ts` under a versioned API path, e.g., `/api/v1/interactions`.

3.  **Frontend Application (`apps/web`):**
    *   **API Client:** Create a new API client function, `checkInteractions(medicines: string[])`, in `apps/web/lib/api/interactions.ts` that makes a `POST` request to `/api/v1/interactions/check` and handles CSRF tokens. Export this function from `apps/web/lib/api.ts`.
    *   **Interaction Checker Page:** Create a new React page component at `apps/web/app/[locale]/interaction-checker/page.tsx`.
        *   Implement state management for a list of selected medicines (e.g., using `useState` and `localStorage` for persistence).
        *   Integrate a debounced input field for medicine search with fuzzy autocomplete capabilities.
        *   Display selected medicines as interactive chip badges.
        *   Trigger the `checkInteractions` API call when at least two medicines are selected.
        *   Render the returned interactions using distinct UI components (e.g., color-coded cards) grouped by severity.
    *   **Translations:** Add all necessary UI strings to `apps/web/messages/en.json` and `apps/web/messages/hi.json` under an "Interactions" namespace.

## Impact on System Architecture

This PR significantly expands SahiDawa's capabilities, moving it from a data display platform to a proactive health risk assessment tool.

1.  **Enhanced Patient Safety:** The introduction of the Medicine Interaction Checker directly addresses a critical aspect of patient safety, providing users with immediate insights into potential drug-drug interactions.
2.  **Offline Resilience Pattern:** The implementation of an offline fallback mechanism sets a precedent and architectural pattern for other critical features within SahiDawa. This pattern can be replicated to ensure core functionalities remain available even in environments with unreliable internet connectivity, which is vital for our rural health mission.
3.  **New Data Domain:** We have introduced a new core data domain (`drug_interactions`) and its associated API, enriching SahiDawa's data model and expanding the scope of health information we can provide. This opens avenues for future features like personalized medicine recommendations or integration with electronic health records.
4.  **Modular API Expansion:** The addition of the `/api/v1/interactions` endpoint demonstrates our continued commitment to a modular, versioned API architecture, making it easier to scale and maintain our backend services.
5.  **Improved User Experience:** The interactive and visually intuitive frontend component for checking interactions elevates the overall user experience, making complex medical information accessible and actionable.
6.  **Foundation for Clinical Decision Support:** This feature lays a foundational layer for more advanced clinical decision support systems within SahiDawa, potentially integrating with patient profiles and prescription data in the future.

## Testing & Verification

The Medicine Interaction Checker feature underwent rigorous testing to ensure its functionality and resilience.

**Automated Backend Tests (`apps/api/tests/interactions.test.ts`):**
*   **Request Payload Validation:** We verified that the API correctly returns a `400` status code when fewer than two medicines are provided in the request body, adhering to the `checkSchema` validation.
*   **Online Interaction Checks:** Tests confirmed that the system successfully queries the Supabase database and returns accurate interaction results when the database is online and accessible.
*   **Offline Fallback Behavior:** Critical tests were performed to ensure that when Supabase is simulated as offline (e.g., connection refused or timeout), the API gracefully falls back to using the `localBrandMap` for generic name resolution and `localInteractions` for interaction lookups, providing results even without database connectivity.
*   **Error Handling for Name Resolution:** Tests confirmed that errors during the database-based name resolution process correctly trigger the `isSupabaseOffline` flag in `dbConfig`, ensuring subsequent requests also utilize the offline fallback.

**Frontend Interface Verification:**
*   **Screenshots:** Provided screenshots (`Screenshot (520)`, `Screenshot (521)`) visually confirm the successful implementation of the frontend interface. These images demonstrate:
    *   The responsive Medicine Interaction Checker page at `/interaction-checker`.
    *   The debounced fuzzy autocomplete search functionality.
    *   The representation of selected medicines as chip badges.
    *   The display of color-coded alert cards grouped by severity (Critical, Serious, Moderate, Minor).
    *   The overall user experience and design adherence.

**Edge Cases Considered:**
*   **No Interactions Found:** The system is designed to return an empty list of interactions if no matches are found, providing clear feedback to the user.
*   **Single Medicine Input:** Handled by the `zod` validation, which prevents the request from proceeding and returns a `400` error.
*   **Brand Names Not in Local Fallback:** If a brand name is provided and the database is offline, but the brand name is not present in `localBrandMap`, the system defaults to using the input string itself as the generic name, preventing a complete failure.
*   **Multiple Inputs to Same Generic:** The use of `Array.from(new Set(resolvedList.map((r) => r.generic.toLowerCase())))` ensures that if multiple brand names resolve to the same generic ingredient (e.g., "Crocin" and "Dolo" both resolve to "paracetamol"), only unique generic names are considered for pair generation, avoiding redundant checks.