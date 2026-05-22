# ADR — feat(data): add medicine pricing for compare flow

> **Date:** 2026-05-21 | **PR:** #401 | **Status:** Accepted

## Context

The SahiDawa platform lacked comprehensive pricing information for medicines, specifically the Maximum Retail Price (MRP) and the Jan Aushadhi price. This absence prevented users from effectively comparing the cost of different medicines, particularly in identifying more affordable Jan Aushadhi alternatives. A core requirement was to empower users with transparent cost comparisons to make informed decisions regarding medicine purchases, directly supporting the platform's mission to improve rural health and access to affordable medicine.

## Decision

The architectural decision was to directly integrate medicine pricing information into the existing `medicines` database table and expose it through the API and frontend comparison flow.

This was implemented by:
1.  **Database Schema Modification**:
    *   Added two new nullable `NUMERIC(10, 2)` columns, `mrp` and `jan_aushadhi_price`, to the `medicines` table in Supabase.
    *   Implemented database-level `CHECK` constraints to ensure data integrity:
        *   `mrp` and `jan_aushadhi_price` must be non-negative.
        *   `mrp` must be greater than or equal to `jan_aushadhi_price` when both are present.
    *   Created B-tree indexes on `mrp` and `jan_aushadhi_price` for efficient querying.
2.  **Data Seeding**: Updated `supabase/seed.sql` with example pricing data for local development and testing.
3.  **API Integration**: Synchronized checked-in schema artifacts (`apps/api/src/db/schema.sql`, `supabase/schema-target.json`) and updated backend queries to include the new pricing fields.
4.  **Frontend Implementation**:
    *   Modified the comparison UI (`apps/web/app/[locale]/compare/page.tsx`, `apps/web/src/components/ComparisonGrid.tsx`) to display `MRP`, `Jan Aushadhi price`, and calculated `savings` (both absolute and percentage).
    *   Updated data mapping logic (`apps/web/src/lib/mapMedicineRow.ts`) and query field selections (`apps/web/src/lib/compareSelectFields.ts`) to consume the new pricing data.
    *   Added dedicated unit tests (`apps/web/tests/compare-pricing.test.tsx`) to cover various pricing scenarios, including missing, zero, and no-savings cases.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Store prices in a separate `medicine_prices` table** | While offering flexibility for historical pricing or multiple price types, this approach introduces join complexity for the primary comparison flow. For the initial requirement of two specific, current price points (`mrp`, `jan_aushadhi_price`) directly tied to a medicine, embedding them in the `medicines` table was simpler and more performant for read-heavy comparison queries. It would also require more complex data integrity constraints across tables. |
| **Store all pricing data in a `JSONB` column on `medicines`** | `JSONB` offers schema flexibility but sacrifices strong typing, robust database-level validation constraints (e.g., `mrp >= jan_aushadhi_price` or non-negativity without custom triggers/functions), and efficient indexing for specific numeric fields. Direct numeric columns allow for simpler queries, aggregations, and critical data integrity checks for financial data. |
| **Only store `mrp` and calculate `jan_aushadhi_price` or savings externally/heuristically** | The core requirement was to explicitly show the Jan Aushadhi price, which is a specific, often government-regulated, price point. Calculating it heuristically or relying on external, potentially unreliable, sources would compromise data accuracy and the platform's mission of providing verified information. Storing both explicitly ensures transparency and accuracy. |

## Consequences

**Positive:**
- Empowered users with transparent cost comparison, enabling informed decisions on medicine purchases.
- Directly supported the platform's goal of promoting affordable healthcare by highlighting Jan Aushadhi alternatives.
- Improved data integrity with database-level constraints ensuring logical consistency between `mrp` and `jan_aushadhi_price`.
- Enhanced user experience with a clear, actionable comparison flow showing savings.
- Established a foundation for future pricing-related features (e.g., price trends, regional pricing).

**Trade-offs:**
- Increased complexity of the `medicines` table schema with additional columns and constraints.
- Requires careful data ingestion and maintenance processes to ensure accuracy and freshness of pricing data.
- Potential for data sparsity if pricing information is not available for all medicines, requiring robust UI handling for null values.

## Related Issues & PRs

- PR #401: feat(data): add medicine pricing for compare flow
- Issue #369