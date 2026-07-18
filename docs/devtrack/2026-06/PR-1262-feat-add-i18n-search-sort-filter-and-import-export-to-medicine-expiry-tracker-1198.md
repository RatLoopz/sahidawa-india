# PR #1262 — feat: add i18n, search, sort, filter and import/export to Medicine Expiry Tracker (#1198)

> **Merged:** 2026-06-04 | **Author:** @nimkarprachi17 | **Area:** Frontend | **Impact Score:** 8 | **Closes:** #1198

## What Changed

We have significantly enhanced the `Medicine Expiry Tracker` page located at `apps/web/app/[locale]/expiry-tracker/page.tsx`. This update introduces full internationalization support using `next-intl`, enabling the UI to display in multiple languages. Furthermore, we've implemented robust client-side search, sorting, and filtering capabilities for the medicine list, alongside a critical feature allowing users to import and export their medicine data as JSON backups.

## The Problem Being Solved

Prior to this PR, the Medicine Expiry Tracker page lacked fundamental features for usability and data management. All UI strings were hardcoded in English, making the platform inaccessible to non-English speaking users. There was no mechanism to efficiently locate specific medicines, organize the list, or filter by expiry status, which became cumbersome with a growing inventory. Most critically, users had no way to back up or restore their locally stored medicine data, posing a significant risk of data loss.

## Files Modified

- `apps/web/app/[locale]/expiry-tracker/page.tsx`
- `apps/web/messages/en.json`

## Implementation Details

The core of this enhancement resides within the `apps/web/app/[locale]/expiry-tracker/page.tsx` component, which was largely rewritten to incorporate new functionalities.

**Internationalization (i18n):**

- We integrated `next-intl` by importing `useTranslations` and initializing it with `const t = useTranslations("ExpiryTracker");`.
- All user-facing strings, including the page title, subtitle, form labels, input placeholders, button texts, and expiry status messages, are now wrapped with the `t()` function (e.g., `t("title")`, `t("addMedicine")`, `t("statusExpired")`).
- A new `ExpiryTracker` namespace was defined in `apps/web/messages/en.json` to house all the English translation keys and their corresponding values for this page.

**State Management:**

- The component utilizes `useState` hooks for managing the `medicines` array (the primary data store), input fields (`name`, `expiryDate`, `batchNumber`), and control states (`searchQuery`, `sortBy`, `filterStatus`, `importError`).
- A `useEffect` hook ensures that medicine data is loaded from `window.localStorage.getItem("sahidawa_expiry_tracker")` on initial component mount and saved back to `localStorage` whenever the `medicines` array changes via `saveToLocalStorage`.

**Medicine Data Structure:**

- Medicines are represented by the `Medicine` interface: `{ id: string; name: string; expiryDate: string; batchNumber?: string; }`.

**Add and Delete Functionality:**

- The `handleSubmit` function for adding new medicines generates a unique `id` using `crypto.randomUUID()`, appends the new medicine to the `medicines` array, and then calls `saveToLocalStorage`.
- The `handleDelete` function filters the `medicines` array to remove the item with the specified `id` and updates `localStorage`.

**Expiry Status Logic:**

- `parseLocalDate(dateStr: string)` converts a "YYYY-MM-DD" string into a `Date` object.
- `getDiffDays(dateStr: string)` calculates the difference in days between the expiry date and today's date.
- `getExpiryStatus(dateStr: string)` uses `getDiffDays` to categorize medicines into "Expired" (`diffDays < 0`), "Expiring Soon" (`diffDays ≤ 30`), or "Safe" (`diffDays > 30`), returning an object with a corresponding icon, translated text, color, and a `key` for filtering.

**Search, Sort, and Filter:**

- **Search:** An `input` field updates the `searchQuery` state. The `processedMedicines` array is filtered by checking if `med.name.toLowerCase()` includes `searchQuery.toLowerCase()`.
- **Sort:** A dropdown (`select` element) allows users to choose `sortBy` options: "Expiry Date (soonest first)", "Expiry Date (latest first)", or "Name (A-Z)". The `processedMedicines` array is sorted accordingly using `getDiffDays` for date sorting and `localeCompare` for name sorting.
- **Filter:** Filter chips (buttons) update the `filterStatus` state (`all`, `expired`, `expiringSoon`, `safe`). The `processedMedicines` array is filtered based on the `key` returned by `getExpiryStatus`.
- All these operations are chained on the `medicines` array to produce `processedMedicines`, which is then rendered.

**Data Export:**

- The `handleExport` function serializes the current `medicines` array to a JSON string using `JSON.stringify(medicines, null, 2)`.
- It then creates a `Blob` of type `application/json`, generates a temporary URL using `URL.createObjectURL`, and programmatically triggers a download of `sahidawa_expiry_backup.json` by creating and clicking an `<a>` element. The temporary URL is revoked afterward.

**Data Import:**

- A hidden `<input type="file" accept=".json" />` is used, triggered by a button click, with its `onChange` event linked to `handleImport`.
- `handleImport` uses `FileReader` to read the selected JSON file.
- Upon loading, it attempts to `JSON.parse` the content.
- **Schema Validation:** It validates that the parsed data is an array and that each item within the array contains at least `id`, `name`, and `expiryDate` as strings.
- **Deduplication:** It prevents duplicate entries by creating a `Set` of existing medicine IDs and filtering imported items to only include those with IDs not already present in the current `medicines` list.
- The valid and deduplicated imported medicines are merged with the existing list and saved to `localStorage`.
- Error handling is included to catch invalid JSON or schema mismatches, setting an `importError` state that can be displayed to the user.

## Technical Decisions

1.  **`next-intl` for Internationalization:** We chose `next-intl` because it is specifically designed for Next.js applications, offering robust features like server-side rendering compatibility and a clear API for managing translations. This decision aligns with our goal of building a globally accessible platform and sets a standard for future i18n implementations across the frontend.
2.  **Client-Side Data Storage (`localStorage`):** For the Medicine Expiry Tracker, storing data entirely in `localStorage` was chosen to keep the feature self-contained and independent of backend services. This simplifies development and deployment for a personal utility, as it avoids the need for user authentication or database management for this specific module.
3.  **Client-Side Search, Sort, and Filter:** Performing these operations directly on the `medicines` array in the client is efficient for the expected scale of a personal medicine inventory. This approach reduces server load and provides an immediate, responsive user experience without network latency.
4.  **JSON Format for Import/Export:** JSON was selected as the backup format due to its widespread adoption, human readability, and ease of parsing and serialization in JavaScript. This ensures compatibility and simplicity for users managing their data.
5.  **Deduplication Strategy on Import:** When importing data, we explicitly deduplicate entries by their `id`. This prevents the accumulation of redundant records if a user imports a backup that partially or fully overlaps with their existing local data, maintaining data integrity.
6.  **Minimal Schema Validation for Imports:** We implemented basic schema validation (checking for `id`, `name`, `expiryDate` as strings) during import. This decision balances robustness against over-engineering, ensuring that imported data has the essential structure required by the application without imposing overly strict or complex validation rules for a client-side backup.

## How To Re-Implement (Contributor Reference)

To re-implement the enhanced Medicine Expiry Tracker page, follow these steps:

1.  **Set up `next-intl`:**
    - Ensure `next-intl` is installed in `apps/web`.
    - In `apps/web/app/[locale]/expiry-tracker/page.tsx`, import `useTranslations` from `next-intl`.
    - Initialize `const t = useTranslations("ExpiryTracker");` within the `ExpiryTrackerPage` component.
    - Create or update `apps/web/messages/en.json` to include the `ExpiryTracker` namespace with all required translation keys (e.g., `title`, `subtitle`, `addMedicine`, `name`, `expiryDate`, `batchNumber`, `addToTracker`, `statusExpired`, `statusExpiringSoon`, `statusSafe`, `exportBackup`, `importBackup`, `importError`, `filterAll`, `filterExpired`, `filterExpiringSoon`, `filterSafe`).

2.  **Define Medicine Interface and State:**
    - Define the `Medicine` interface:
        ```typescript
        interface Medicine {
            id: string;
            name: string;
            expiryDate: string;
            batchNumber?: string;
        }
        ```
    - Initialize `useState` hooks for `medicines`, `name`, `expiryDate`, `batchNumber`, `searchQuery`, `sortBy` (type `SortOption`), `filterStatus` (type `FilterStatus`), and `importError`.
    - Implement `useEffect` to load `medicines` from `localStorage` on mount and `saveToLocalStorage` to persist changes.

3.  **Implement Core Logic:**
    - **`saveToLocalStorage(updatedMedicines: Medicine[])`:** Serializes `updatedMedicines` to JSON and saves it to `localStorage` under the key `"sahidawa_expiry_tracker"`.
    - **`handleSubmit(e: React.FormEvent)`:** Prevents default, creates a new `Medicine` object with `crypto.randomUUID()`, adds it to `medicines`, and clears form fields.
    - **`handleDelete(id: string)`:** Filters `medicines` to remove the item with the given `id`.
    - **`parseLocalDate(dateStr: string)`:** Converts a "YYYY-MM-DD" string to a `Date` object.
    - **`getDiffDays(dateStr: string)`:** Calculates days remaining until expiry.
    - **`getExpiryStatus(dateStr: string)`:** Returns an object with `icon`, `text` (translated using `t()`), `color`, and `key` (`expired`, `expiringSoon`, `safe`) based on `getDiffDays`.

4.  **Implement Search, Sort, and Filter:**
    - Create `processedMedicines` by chaining `filter` and `sort` operations on the `medicines` array:
        - **Filter by status:** `medicines.filter((med) => getExpiryStatus(med.expiryDate).key === filterStatus || filterStatus === "all")`.
        - **Filter by search query:** `.filter((med) => med.name.toLowerCase().includes(searchQuery.toLowerCase()))`.
        - **Sort:** `.sort((a, b) => { ... })` based on `sortBy` state (using `getDiffDays` for date sorting and `localeCompare` for name).
    - Render an `input` for `searchQuery`, a `select` for `sortBy`, and buttons/chips for `filterStatus`, updating the respective states on change.

5.  **Implement Import/Export:**
    - **Export (`handleExport`):**
        - Create a `Blob` from `JSON.stringify(medicines, null, 2)`.
        - Use `URL.createObjectURL` to get a temporary URL.
        - Create a temporary `<a>` element, set `href` and `download="sahidawa_expiry_backup.json"`, programmatically click it, and then `URL.revokeObjectURL`.
    - **Import (`handleImport`):**
        - Use a hidden `<input type="file" accept=".json" ref={fileInputRef} onChange={handleImport} />`.
        - In `handleImport`, use `FileReader` to read the file as text.
        - Inside `reader.onload`:
            - `JSON.parse` the result.
            - Validate: `Array.isArray(parsed)` and `item.id`, `item.name`, `item.expiryDate` are strings.
            - Deduplicate: Create a `Set` of existing `medicines.map((m) => m.id)` and filter imported items to exclude those already present.
            - Merge: `[...medicines, ...validAndNewItems]`.
            - Call `saveToLocalStorage` with the merged array.
            - Implement `try-catch` for parsing and validation errors, setting `importError` state.

6.  **UI Integration:**
    - Utilize the `PageHeader` component.
    - Structure the layout using Tailwind CSS, typically with a sidebar for the add form and main content area for the medicine list and controls.
    - Ensure all UI elements use the `t()` function for internationalization.

## Impact on System Architecture

This pull request primarily impacts the frontend `apps/web` application, specifically the `Medicine Expiry Tracker` module.

1.  **Frontend Internationalization Standard:** By integrating `next-intl` and demonstrating its usage across all UI strings, this PR establishes a clear pattern and standard for internationalization within the SahiDawa frontend. Future features and existing pages can now consistently adopt this approach, making the platform more accessible to a global audience, particularly in diverse linguistic regions of India.
2.  **Enhanced User Experience and Data Management:** The addition of search, sort, and filter functionalities significantly elevates the usability of the Expiry Tracker. Users can now efficiently manage larger inventories of medicines, quickly identify critical items (e.g., expiring soon), and organize their view. This improves the practical utility of the platform for rural health workers.
3.  **Data Portability and Resilience:** The import/export feature provides users with crucial control over their local medicine data. This enables them to back up their information, migrate it between devices (if `localStorage` is transferred), or recover from accidental data loss. This is a vital step towards making client-side data more robust and user-controlled.
4.  **Modular Feature Development Pattern:** The implementation showcases how to integrate multiple complex features (i18n, client-side data manipulation, file I/O) within a single Next.js client component. This serves as a valuable architectural pattern for future feature development that requires similar capabilities without immediate backend dependencies.
5.  **No Backend Impact:** This change is entirely confined to the frontend. It introduces no new dependencies on backend services, database schema changes, or API endpoints. The `Medicine Expiry Tracker` remains a self-contained, client-side utility, which simplifies its maintenance and deployment from a backend perspective.

## Testing & Verification

The changes introduced in this PR were verified through a combination of automated checks and manual testing:

- **TypeScript Compilation:** The command `npx tsc --noEmit` was executed, confirming zero TypeScript errors. This ensures type safety and helps prevent common development-time issues.
- **Local Project Verification:** The author explicitly stated that they ran the project locally and verified no compile/build errors, indicating basic functional testing was performed.
- **Manual Feature Testing:**
    - **Internationalization:** Verified that all UI strings on the Expiry Tracker page correctly display translated content via `next-intl` lookups.
    - **Add/Delete Medicine:** Confirmed that medicines can be added with unique IDs and successfully removed from the list, with changes persisting in `localStorage`.
    - **Search:** Tested filtering the medicine list by name using various search queries (full name, partial name, case-insensitive).
    - **Sort:** Verified that sorting by "Expiry Date (soonest first)", "Expiry Date (latest first)", and "Name (A-Z)" correctly reorders the list.
    - **Filter:** Confirmed that filter chips ("All", "Expired", "Expiring Soon", "Safe") accurately display medicines based on their expiry status.
    - **Export Backup:** Successfully exported the current medicine list as `sahidawa_expiry_backup.json` and verified its JSON structure and content.
    - **Import Backup:**
        - Tested importing a valid `sahidawa_expiry_backup.json` file, ensuring medicines were correctly merged and deduplicated by `id`.
        - Tested importing a malformed JSON file or a file with an incorrect schema, verifying that the `importError` message was displayed.
        - Confirmed that importing a backup containing existing medicine IDs correctly deduplicated and did not add duplicates.
- **Edge Cases:**
    - `localStorage` operations are wrapped in `try-catch` blocks to gracefully handle potential browser security restrictions or full storage scenarios.
    - The export button is disabled when the `medicines` array is empty, preventing the export of an empty file.
    - Date parsing (`parseLocalDate`) is designed to handle the "YYYY-MM-DD" format consistently.
