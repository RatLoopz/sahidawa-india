# PR #401 — feat(data): add medicine pricing for compare flow

> **Merged:** 2026-05-21 | **Author:** @shashank03-dev | **Area:** Frontend | **Impact Score:** 38 | **Closes:** #369

## What Changed

This pull request introduces comprehensive medicine pricing support into our comparison flow. We've extended the `medicines` database schema with `mrp` (Maximum Retail Price) and `jan_aushadhi_price` fields, updated our local seed data to include these prices, and integrated this new pricing information into the frontend comparison UI. Users can now directly compare medicines based on their MRP, Jan Aushadhi price, and view potential savings.

## The Problem Being Solved

Prior to this PR, our medicine comparison feature (tracked in #369) lacked any pricing information. Users could compare medicines based on generic name, composition, manufacturer, and CDSCO approval status, but a crucial aspect of decision-making – cost – was entirely missing. This limited the utility of the comparison tool, especially for users seeking to identify more affordable Jan Aushadhi alternatives. The absence of pricing prevented users from understanding potential savings, which is a core value proposition of the SahiDawa platform.

## Files Modified

- `apps/api/src/db/schema.sql`
- `apps/web/app/[locale]/compare/page.tsx`
- `apps/web/src/components/ComparisonGrid.tsx`
- `apps/web/src/lib/compareSelectFields.ts`
- `apps/web/src/lib/mapMedicineRow.ts`
- `apps/web/tests/compare-pricing.test.tsx`
- `supabase/migrations/20260521000000_add_medicine_pricing_columns.sql`
- `supabase/schema-target.json`
- `supabase/seed.sql`

## Implementation Details

The implementation involved a full-stack approach, touching database schema, data seeding, API schema synchronization, and frontend UI/logic.

1.  **Database Schema Extension (`supabase/migrations/20260521000000_add_medicine_pricing_columns.sql`, `apps/api/src/db/schema.sql`)**:
    *   Two new columns, `mrp` and `jan_aushadhi_price`, were added to the `medicines` table. Both are defined as `NUMERIC(10, 2)` to store currency values with two decimal places and are nullable, allowing for cases where pricing information might not be available.
    *   Three `CHECK` constraints were introduced to ensure data integrity:
        *   `medicines_mrp_non_negative`: Ensures `mrp` is non-negative if present (`mrp IS NULL OR mrp >= 0`).
        *   `medicines_jan_aushadhi_price_non_negative`: Ensures `jan_aushadhi_price` is non-negative if present (`jan_aushadhi_price IS NULL OR jan_aushadhi_price >= 0`).
        *   `medicines_mrp_gte_jan_aushadhi_price`: Ensures that if both prices are present, `mrp` is greater than or equal to `jan_aushadhi_price` (`mrp IS NULL OR jan_aushadhi_price IS NULL OR mrp >= jan_aushadhi_price`).
    *   New B-tree indexes `idx_medicines_mrp` and `idx_medicines_jan_aushadhi_price` were added to the `medicines` table to optimize queries that filter or sort by these price fields.
    *   Additional columns and indexes were also added to the `counterfeit_reports`, `push_subscriptions`, and `etl_failed_rows` tables. These changes are part of a broader schema evolution and not directly related to the medicine pricing feature for the compare flow, but were included in the same migration.

2.  **Data Seeding (`supabase/seed.sql`)**:
    *   The `supabase/seed.sql` file was updated to include example `mrp` and `jan_aushadhi_price` values for key medicines like Dolo 650, Paracetamol 500mg, and Cetirizine 10mg. This ensures that local development environments have realistic data to test the new comparison features.

3.  **Schema Artifact Synchronization (`supabase/schema-target.json`, `apps/api/src/db/schema.sql`)**:
    *   The `supabase/schema-target.json` file, which represents the desired Supabase schema, was updated to reflect the new columns and constraints.
    *   The `apps/api/src/db/schema.sql` file, a checked-in representation of the database schema used by our API, was also synchronized to match the new database structure.

4.  **Frontend Data Fetching (`apps/web/app/[locale]/compare/page.tsx`, `apps/web/src/lib/compareSelectFields.ts`)**:
    *   In `apps/web/src/lib/compareSelectFields.ts`, a new constant `COMPARE_SELECT_FIELDS` was introduced. This constant now explicitly includes `mrp` and `jan_aushadhi_price` alongside existing fields like `id`, `brand_name`, `generic_name`, etc.
    *   `apps/web/app/[locale]/compare/page.tsx` was modified to use this `COMPARE_SELECT_FIELDS` constant when querying the `medicines` table via Supabase. This ensures that the frontend receives the necessary pricing data for comparison. The previous `SELECT_FIELDS` constant was removed.

5.  **Frontend UI Component (`apps/web/src/components/ComparisonGrid.tsx`)**:
    *   The `Medicine` interface was updated to include `mrp?: number | null;` and `jan_aushadhi_price?: number | null;`.
    *   The `ComparisonGrid` component was significantly enhanced to display the new pricing information.
    *   New helper functions were added:
        *   `hasValidMrp(m: Medicine | null | undefined)`: Checks if a medicine has a valid, non-null, non-negative MRP.
        *   `hasValidJanAushadhiPrice(m: Medicine | null | undefined)`: Checks if a medicine has a valid, non-null, non-negative Jan Aushadhi price.
        *   `formatPrice(value: number | null | undefined)`: Formats a numeric price into a user-friendly string (e.g., "₹120.00" or "Price unavailable").
        *   `computeSavingsPercent(higher: number, lower: number)`: Calculates the percentage savings between two prices.
    *   The comparison table now includes rows for "MRP", "Jan Aushadhi Price", and "Savings".
    *   The "Savings" row dynamically calculates and displays the difference in rupees and percentage between the MRP and Jan Aushadhi price for each medicine, if both are available and valid. If only one price is available, or if the Jan Aushadhi price is higher than MRP (which should be prevented by DB constraints but handled defensively), appropriate messages are displayed.

6.  **Data Mapping (`apps/web/src/lib/mapMedicineRow.ts`)**:
    *   Not documented in this PR.

7.  **Frontend Tests (`apps/web/tests/compare-pricing.test.tsx`)**:
    *   A new test file `compare-pricing.test.tsx` was added to specifically test the pricing logic within the `ComparisonGrid` component.
    *   Tests cover various scenarios, including:
        *   Comparing medicines with valid MRP and Jan Aushadhi prices.
        *   Cases where one or both prices are missing (`null` or `undefined`).
        *   Cases where prices are zero.
        *   Scenarios where no savings are present (e.g., MRP equals Jan Aushadhi price).
        *   Correct formatting of prices and savings percentages.

## Technical Decisions

1.  **Database Column Types (`NUMERIC(10, 2)`)**: We chose `NUMERIC(10, 2)` for `mrp` and `jan_aushadhi_price` to ensure precise storage of monetary values. `FLOAT` or `REAL` types are generally avoided for currency due to potential floating-point inaccuracies. `NUMERIC` provides exact precision, with `10` representing the total number of digits and `2` representing the number of digits after the decimal point, which is suitable for Indian Rupee values.
2.  **Nullable Price Fields**: The price columns were made nullable (`NULL`) because not all medicines in our database might have both MRP and Jan Aushadhi prices available initially. This allows for incremental data population without requiring immediate, complete data for all entries.
3.  **Database `CHECK` Constraints**: Implementing `CHECK` constraints directly in the database (`mrp >= 0`, `jan_aushadhi_price >= 0`, `mrp >= jan_aushadhi_price`) is a critical decision for data integrity. This ensures that invalid price data cannot be inserted or updated at the database level, regardless of the application layer, preventing logical errors and maintaining data quality.
4.  **Database Indexes**: Adding B-tree indexes on `mrp` and `jan_aushadhi_price` (`idx_medicines_mrp`, `idx_medicines_jan_aushadhi_price`) is a performance optimization. While not strictly necessary for the current comparison flow (which fetches specific IDs), it anticipates future features like "find cheapest medicine" or "filter by price range," where these indexes will significantly speed up query execution.
5.  **Centralized `COMPARE_SELECT_FIELDS`**: Defining `COMPARE_SELECT_FIELDS` in `apps/web/src/lib/compareSelectFields.ts` promotes code reusability and maintainability. If the set of fields required for comparison changes in the future, only this single constant needs to be updated, rather than modifying multiple `supabase.select()` calls.
6.  **UI Helper Functions**: The `ComparisonGrid.tsx` component utilizes several small, focused helper functions (`hasValidMrp`, `formatPrice`, `computeSavingsPercent`). This decision improves code readability, modularity, and testability. Each function has a single responsibility, making the component logic easier to understand and debug.
7.  **Defensive UI Rendering**: The UI logic in `ComparisonGrid.tsx` explicitly handles `null` or `undefined` price values and displays "Price unavailable" or "—" accordingly. This ensures a robust user experience even when data is incomplete.

## How To Re-Implement (Contributor Reference)

To re-implement this feature from scratch, a contributor would follow these steps:

1.  **Database Migration**:
    *   Create a new SQL migration file (e.g., `supabase/migrations/YYYYMMDDHHMMSS_add_medicine_pricing.sql`).
    *   Inside this file, add `ALTER TABLE medicines ADD COLUMN mrp NUMERIC(10, 2);` and `ALTER TABLE medicines ADD COLUMN jan_aushadhi_price NUMERIC(10, 2);`.
    *   Add the `CHECK` constraints:
        ```sql
        ALTER TABLE medicines ADD CONSTRAINT medicines_mrp_non_negative CHECK (mrp IS NULL OR mrp >= 0);
        ALTER TABLE medicines ADD CONSTRAINT medicines_jan_aushadhi_price_non_negative CHECK (jan_aushadhi_price IS NULL OR jan_aushadhi_price >= 0);
        ALTER TABLE medicines ADD CONSTRAINT medicines_mrp_gte_jan_aushadhi_price CHECK (mrp IS NULL OR jan_aushadhi_price IS NULL OR mrp >= jan_aushadhi_price);
        ```
    *   Add indexes: `CREATE INDEX IF NOT EXISTS idx_medicines_mrp ON medicines(mrp);` and `CREATE INDEX IF NOT EXISTS idx_medicines_jan_aushadhi_price ON medicines(jan_aushadhi_price);`.
    *   Run `supabase db push` or similar command to apply the migration.

2.  **Schema Synchronization**:
    *   Update `supabase/schema-target.json` to reflect the new `mrp` and `jan_aushadhi_price` columns and their constraints. This can often be done by regenerating the schema definition from the live database.
    *   Ensure `apps/api/src/db/schema.sql` is also updated to match the new schema.

3.  **Seed Data**:
    *   Modify `supabase/seed.sql` to include `mrp` and `jan_aushadhi_price` values in `INSERT` statements for `medicines` table entries, providing realistic test data.

4.  **Frontend Data Model Update**:
    *   In `apps/web/src/components/ComparisonGrid.tsx` (or a shared types file), update the `Medicine` interface:
        ```typescript
        export interface Medicine {
          // ... existing fields
          mrp?: number | null;
          jan_aushadhi_price?: number | null;
        }
        ```

5.  **Frontend Data Fetching**:
    *   Create or update `apps/web/src/lib/compareSelectFields.ts` to define the `COMPARE_SELECT_FIELDS` constant:
        ```typescript
        export const COMPARE_SELECT_FIELDS =
            "id, brand_name, generic_name, composition, manufacturer, expiry_date, cdsco_approval_status, mrp, jan_aushadhi_price";
        ```
    *   In `apps/web/app/[locale]/compare/page.tsx`, modify the `searchMedicines` function to use this constant:
        ```typescript
        const { data, error } = await supabase
            .from("medicines")
            .select(COMPARE_SELECT_FIELDS) // Use the new constant
            .or(`brand_name.ilike.${pattern},generic_name.ilike.${pattern}`)
            .limit(25);
        ```

6.  **UI Component Logic and Rendering**:
    *   In `apps/web/src/components/ComparisonGrid.tsx`:
        *   Implement `hasValidMrp`, `hasValidJanAushadhiPrice`, `formatPrice`, and `computeSavingsPercent` helper functions as detailed in "Implementation Details".
        *   Add new rows to the comparison table for "MRP", "Jan Aushadhi Price", and "Savings".
        *   For the "MRP" and "Jan Aushadhi Price" rows, use `formatPrice` to display the values for `medicine1` and `medicine2`.
        *   For the "Savings" row, calculate the savings in rupees (`mrp - jan_aushadhi_price`) and percentage (`computeSavingsPercent(mrp, jan_aushadhi_price)`) if both valid prices are present. Display these values, handling cases where prices are missing or savings are zero.

7.  **Testing**:
    *   Create `apps/web/tests/compare-pricing.test.tsx`.
    *   Write unit tests for the `ComparisonGrid` component, specifically focusing on the correct display and calculation of prices and savings under various conditions:
        *   Both medicines have valid MRP and Jan Aushadhi prices.
        *   One medicine has prices, the other does not.
        *   Both medicines have prices, but one or both are zero.
        *   Jan Aushadhi price is equal to MRP (no savings).
        *   Ensure `formatPrice` and `computeSavingsPercent` work as expected.
    *   Run `npm test -w web` to verify.

## Impact on System Architecture

This change significantly enhances the SahiDawa platform's utility and data richness.

1.  **Enriched Data Model**: The `medicines` table now holds crucial economic data, moving beyond purely medical attributes. This makes our core data model more comprehensive and valuable for users making health-related purchasing decisions.
2.  **Enhanced User Experience**: The comparison feature is now far more powerful, directly addressing a key user need: understanding the cost implications of different medicine choices, especially the benefits of Jan Aushadhi alternatives. This aligns directly with SahiDawa's mission to promote affordable healthcare.
3.  **Foundation for Future Features**: The introduction of `mrp` and `jan_aushadhi_price` lays the groundwork for numerous future features, such as:
    *   **Price Alerts**: Notifying users when a medicine's price changes or drops below a certain threshold.
    *   **Cheapest Medicine Finder**: Allowing users to search for the most affordable option for a given generic.
    *   **Cost-Benefit Analysis**: Integrating pricing into broader health recommendations.
    *   **Reporting**: Generating insights on price disparities and savings across regions.
4.  **Increased Data Integrity Requirements**: The addition of database `CHECK` constraints elevates the data quality standards for medicine pricing, ensuring that our system stores logical and valid price information.
5.  **Minor Frontend Complexity Increase**: The `ComparisonGrid` component now includes more logic for price calculation and conditional rendering, slightly increasing its complexity. However, this is managed through well-defined helper functions and dedicated tests.

## Testing & Verification

This change was thoroughly tested at multiple levels:

1.  **Database Migration Verification**: The migration script was verified using `node scripts/check-migrations.js`, which passed, confirming the schema changes were correctly defined and applied.
2.  **Local Data Seeding**: The `supabase/seed.sql` was run locally, and the `medicines` table was inspected to ensure that the new `mrp` and `jan_aushadhi_price` columns were populated with the expected example data for Dolo 650, Paracetamol 500mg, and Cetirizine 10mg.
3.  **Frontend Unit/Integration Tests**: A new dedicated test suite, `apps/web/tests/compare-pricing.test.tsx`, was added to specifically validate the pricing logic in the `ComparisonGrid` component. This suite includes `7 passed` tests covering critical scenarios:
    *   **Valid Price Comparison**: Ensuring correct display of MRP, Jan Aushadhi price, and calculated savings (both rupee amount and percentage) when both medicines have complete pricing data.
    *   **Missing Price Handling**: Verifying that "Price unavailable" or "—" is displayed gracefully when `mrp` or `jan_aushadhi_price` is `null` or `undefined` for one or both medicines.
    *   **Zero Price Cases**: Testing scenarios where `mrp` or `jan_aushadhi_price` might be `0`, ensuring calculations and display remain correct.
    *   **No Savings Cases**: Confirming that savings are correctly reported as `₹0.00 (0.0% lower)` when `mrp` equals `jan_aushadhi_price`.
4.  **Visual Verification**: Screenshots provided in the PR description (`56ee80cb-a352-4f00-9bd0-95f3188b3f3d`, `3ff3f505-e02c-4df4-94bc-6047b9670efe`, `bf4866a5-b500-49ec-a316-3830398e1577`) confirm the correct rendering of the comparison grid with pricing information, including MRP, Jan Aushadhi price, and savings, for various medicine combinations.
5.  **Build Verification**: The frontend application successfully built using `npm run build -w web`, indicating no compilation errors introduced by the changes.