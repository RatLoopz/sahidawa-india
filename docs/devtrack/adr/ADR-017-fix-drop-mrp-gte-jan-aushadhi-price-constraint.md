# ADR — Fix/drop mrp gte jan aushadhi price constraint

> **Date:** 2026-05-31 | **PR:** #988 | **Status:** Accepted

## Context

The SahiDawa platform included a database constraint, `medicines_mrp_gte_jan_aushadhi_price`, which enforced that the `mrp` (Maximum Retail Price) for a medicine must be greater than or equal to its `jan_aushadhi_price` (Jan Aushadhi Store price). This constraint was based on an incorrect assumption that branded medicines are always more expensive than their generic equivalents, which is not consistently true in the real Indian pharmaceutical market where local/discounted brands can be cheaper than government ceiling prices. This false premise led to ETL pipeline failures when attempting to backfill `jan_aushadhi_price` data for commercial medicines where the `mrp` was legitimately lower than the `jan_aushadhi_price`.

## Decision

The `medicines_mrp_gte_jan_aushadhi_price` database constraint was removed. This was implemented by:

1.  Creating a new SQL migration (`supabase/migrations/20260531000000_drop_mrp_gte_jan_aushadhi_price_constraint.sql`) to drop the constraint from the `public.medicines` table using `ALTER TABLE ... DROP CONSTRAINT IF EXISTS` for idempotent execution.
2.  Removing the corresponding constraint definition from `apps/api/src/db/schema.sql` to ensure schema consistency across the application.
    The existing non-negative price constraints (`medicines_mrp_non_negative` and `medicines_jan_aushadhi_price_non_negative`) were preserved.

## Alternatives Considered

| Alternative                                                        | Why Rejected                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modify ETL to filter or adjust data violating the constraint       | This would have introduced complex logic into the ETL process to either skip records, modify data (potentially corrupting it), or flag errors, without addressing the root issue of an incorrect database constraint. It would have masked the underlying data model flaw.                                                                                |
| Introduce a conditional database constraint based on medicine type | This would have required adding new schema fields (e.g., `is_jan_aushadhi_medicine`) and complex conditional logic within the constraint. This adds schema complexity and relies on accurate, consistent classification of medicines, which might not always be feasible or desirable, still attempting to enforce a rule that doesn't universally apply. |

## Consequences

**Positive:**

- Resolved ETL pipeline failures caused by the incorrect pricing assumption.
- Enabled successful backfilling of `jan_aushadhi_price` data for commercial medicines, allowing the platform to reflect real-world market pricing accurately.
- Improved data integrity by removing a constraint based on a false premise.

**Trade-offs:**

- The database no longer enforces a direct relationship between `mrp` and `jan_aushadhi_price`. Application logic or data ingestion processes must now explicitly handle scenarios where `mrp` might be less than `jan_aushadhi_price` if specific business rules require such differentiation or validation.

## Related Issues & PRs

- PR #988: Fix/drop mrp gte jan aushadhi price constraint
- Issue #895
