# PR #2151 — feat(pharmacy): implement localized bulk medicine inventory upload framework

> **Merged:** 2026-06-20 | **Author:** @surajbharsakle07 | **Area:** Backend | **Impact Score:** 29 | **Closes:** #1494

## What Changed

We have implemented a comprehensive, production-ready framework for pharmacy owners to bulk upload their medicine inventory. This feature includes a new backend API endpoint for processing structured CSV files, a dedicated database schema for tracking inventory batches with robust concurrency safeguards, and a localized drag-and-drop user interface within the SahiDawa web application.

## The Problem Being Solved

Prior to this PR, pharmacy owners on the SahiDawa platform lacked an efficient method to manage their medicine inventory at scale. Manually adding each medicine item individually was a time-consuming and error-prone process, especially for pharmacies with large and frequently changing stock. This limitation hindered the platform's utility for larger pharmacies and created a significant barrier to entry for digitizing their operations, leading to incomplete or outdated inventory data.

## Files Modified

-   `apps/api/src/routes/pharmacies.ts`
-   `apps/web/app/[locale]/(dashboard)/pharmacy/inventory/bulk-upload/page.tsx`
-   `supabase/migrations/20260620000000_create_pharmacy_inventory.sql`

## Implementation Details

This feature introduces a full-stack solution for bulk inventory uploads:

**1. Backend API (`apps/api/src/routes/pharmacies.ts`)**
We extended the existing `pharmacies` router to include a new endpoint (implied to be a `POST` route, e.g., `/pharmacies/inventory/bulk-upload`) for handling bulk inventory submissions.
A new Zod schema, `inventoryRowSchema`, was introduced to strictly validate the structure and data types of each individual medicine item expected within the uploaded CSV file. This schema enforces:
    *   `medicine_name`: string, minimum 1 character.
    *   `batch_number`: string, minimum 1 character.
    *   `expiry_date`: string, strictly `YYYY-MM-DD` format using a regex.
    *   `quantity`: integer, non-negative, preprocessed from any input to a number.
    *   `mrp`: positive number, preprocessed from any input to a number.
The API endpoint is designed with a robust runtime payload parser. It processes the incoming CSV data, validates each line item against the `inventoryRowSchema`, and generates detailed error line summaries for any invalid entries. The route context sequence is guarded upfront to ensure that only authenticated pharmacy owners can access this functionality, saving resources by preventing unnecessary validation steps for unauthorized requests. To prevent concurrent double-submits and ensure data integrity, we replaced sequential validation checks with an atomic catch system that leverages standard PostgreSQL `UNIQUE` constraints at the database layer. This ensures that race conditions fail safely and consistently.

**2. Database Schema (`supabase/migrations/20260620000000_create_pharmacy_inventory.sql`)**
A new database table, `pharmacy_inventory_batches`, was created to specifically track bulk inventory uploads. This table is designed to store the metadata of each upload batch, and crucially, the individual medicine items within these batches. A `UNIQUE` identifier check was directly implemented on the schema structure. This constraint, likely on a combination of `pharmacy_id`, `medicine_name`, and `batch_number` (or a similar composite key), ensures that multi-thread race conditions during concurrent insertions are handled gracefully by the database, preventing duplicate inventory records for the same medicine and batch within a pharmacy.

**3. Frontend User Interface (`apps/web/app/[locale]/(dashboard)/pharmacy/inventory/bulk-upload/page.tsx`)**
A new page was created at `/pharmacy/inventory/bulk-upload` within the `next-intl` dynamic multi-language directory layout `[locale]/(dashboard)`. This page hosts a responsive drag-and-drop file uploader component. The frontend handles file evaluation locally using `FileReader` text streams. This client-side processing allows for immediate feedback on file format and basic parsing errors before the payload is sent to the backend, reducing server load and improving user experience. After processing, the component safely submits the parsed payload to the backend API. A detailed execution log is displayed to the user, showing the number of successful rows, total parsed rows, and specific error descriptions for individual problematic rows, aiding in quick correction of invalid data.

## Technical Decisions

1.  **Zod for Schema Validation**: We chose Zod for defining `inventoryRowSchema` due to its robust runtime validation capabilities, excellent TypeScript integration, and ability to generate detailed error messages. This allows us to define our data shape once and use it for both validation and type inference, ensuring consistency between our API expectations and the data processing logic. Its `preprocess` function was particularly useful for safely converting string inputs from CSV into numbers for `quantity` and `mrp`.
2.  **PostgreSQL `UNIQUE` Constraints for Concurrency**: Instead of implementing complex application-level locking or sequential processing for duplicate checks, we opted to leverage PostgreSQL's native `UNIQUE` constraints. This decision was made because database-level constraints provide an atomic, highly performant, and reliable mechanism to prevent duplicate records, especially in high-concurrency scenarios. It shifts the responsibility of data integrity to the database, which is optimized for such operations, making our backend more resilient and easier to reason about.
3.  **Client-Side CSV Parsing with `FileReader`**: Processing CSV files on the frontend using `FileReader` was chosen to improve user experience and reduce server load. This allows for immediate validation feedback to the user regarding file format, size, and basic structural issues without requiring a round trip to the server. It also offloads computational work from our API, allowing the backend to focus solely on data validation and persistence.
4.  **`next-intl` for Localization**: The decision to place the new page under `[locale]/(dashboard)` leverages our existing `next-intl` setup. This ensures that the bulk upload interface, including all user-facing messages, error logs, and instructions, can be easily translated and adapted for different languages, aligning with SahiDawa's goal of serving diverse rural communities.

## How To Re-Implement (Contributor Reference)

To re-implement the bulk medicine inventory upload framework, a contributor would follow these steps:

1.  **Database Migration (`supabase/migrations`)**:
    *   Create a new SQL migration file (e.g., `20260620000000_create_pharmacy_inventory.sql`).
    *   Define a new table, for instance, `pharmacy_inventory_items`, to store individual medicine entries.
    *   Include columns like `id` (UUID), `pharmacy_id` (foreign key to `pharmacies` table), `medicine_name` (text), `batch_number` (text), `expiry_date` (date), `quantity` (integer), `mrp` (numeric), `created_at` (timestamp with default now).
    *   **CRITICAL**: Add a `UNIQUE` constraint on a composite key, such as `(pharmacy_id, medicine_name, batch_number)`, to prevent duplicate entries for the same medicine batch within a pharmacy. This is crucial for the atomic catch system.

2.  **Backend API (`apps/api/src/routes/pharmacies.ts`)**:
    *   Define the `inventoryRowSchema` using Zod as shown in the PR diff, ensuring it matches the expected CSV column headers and data types.
    *   Create a new `router.post` endpoint (e.g., `/pharmacies/:id/inventory/bulk-upload`) within `apps/api/src/routes/pharmacies.ts`.
    *   Implement authentication and authorization middleware (e.g., `requireAuth`) to ensure only authenticated pharmacy owners can access the route.
    *   The route handler should:
        *   Receive the uploaded CSV file (e.g., via `multipart/form-data` or a JSON array of parsed rows).
        *   Parse the CSV data into an array of objects. A library like `csv-parser` or `papaparse` could be used.
        *   Iterate through each parsed row and validate it against the `inventoryRowSchema` using `inventoryRowSchema.safeParse(row)`.
        *   Collect successful validations and detailed error messages for failed validations (including line numbers).
        *   Perform a bulk insertion into the `pharmacy_inventory_items` table using Supabase client's `insert` method. Wrap this in a transaction if necessary for atomicity across the batch.
        *   Handle potential `PostgrestError` from Supabase, specifically looking for `23505` (unique violation) to confirm the atomic catch system is working.
        *   Return a structured JSON response indicating successes, failures, and detailed error summaries for the frontend.

3.  **Frontend UI (`apps/web/app/[locale]/(dashboard)/pharmacy/inventory/bulk-upload/page.tsx`)**:
    *   Create the new Next.js page component at the specified path.
    *   Implement a file input component that supports drag-and-drop functionality.
    *   Attach an `onChange` or `onDrop` event handler to the file input.
    *   Inside the handler:
        *   Use `FileReader` to read the contents of the uploaded CSV file as text (`reader.readAsText(file)`).
        *   Once loaded (`reader.onload`):
            *   Parse the CSV text into an array of JavaScript objects. Again, `papaparse` is a good choice for client-side CSV parsing.
            *   Perform basic client-side validation (e.g., file size, number of rows, basic header check).
            *   Send the parsed data (or the raw CSV text, depending on backend design) to the new backend API endpoint using `fetch` or a library like `axios`.
            *   Display the response from the backend, including the detailed execution log with successes and individual row errors, to the user.
    *   Ensure all user-facing text is wrapped with `next-intl` translation components or hooks.

## Impact on System Architecture

This change significantly enhances the SahiDawa platform's capabilities for pharmacy management. It introduces a scalable mechanism for data ingestion, moving beyond single-entry operations. This sets a precedent for future bulk data operations across other entities (e.g., patient records, medical supplies). The robust backend validation and database-level concurrency control improve overall data integrity and system reliability, especially under load. For pharmacy owners, it drastically improves their operational efficiency, making SahiDawa a more attractive and practical solution for managing their inventory. This feature unlocks the potential for more comprehensive and up-to-date medicine availability data, which is crucial for our rural health initiatives.

## Testing & Verification

The feature was tested by:
1.  Logging in as an approved pharmacy account operator.
2.  Navigating to the `/pharmacy/inventory/bulk-upload` page.
3.  Attempting to upload invalid files (e.g., non-CSV) or CSVs with mismatched/corrupted line data items to verify the exact error parsing array outputs displayed on the frontend. This confirmed the `inventoryRowSchema` and the backend's runtime payload parser correctly identify and report issues.
4.  Uploading a valid medicine database CSV to verify successful bulk insertion into Supabase. This confirmed the end-to-end flow, from frontend parsing to backend validation and database persistence.
Boundary conditions were specifically checked, ensuring that the Zod rules correctly rejected bad data schemas (e.g., negative quantities, incorrect date formats, missing required fields). The atomic catch system for concurrent submissions was implicitly verified through the use of PostgreSQL `UNIQUE` constraints, ensuring database-level integrity.