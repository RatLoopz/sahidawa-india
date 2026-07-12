# PR #3537 — fix(api): exclude soft-deleted pharmacies from admin pharmacy listings

> **Merged:** 2026-07-12 | **Author:** @aayushiii18 | **Area:** Backend | **Impact Score:** 6 | **Closes:** #3409

## What Changed

We updated our backend admin controllers to respect the soft-delete state of pharmacies across administrative endpoints. Specifically, we modified `getPendingPharmacies` to unconditionally filter out inactive pharmacies (`is_active = true`), and we updated `getAllPharmacies` to exclude soft-deleted pharmacies by default unless an explicit query parameter `includeInactive=true` is provided. We also introduced a new Zod validation schema `pharmacyListSchema` to parse this query parameter and added regression tests to verify the filtering behavior.

## The Problem Being Solved

When we introduced soft-deletion for pharmacies in our database migration `supabase/migrations/20260622000000_soft_delete_pharmacies.sql`, we updated our RPC functions to filter out inactive records (`is_active = true`). However, two key admin-facing controller endpoints in `apps/api/src/controllers/admin.controller.ts` were missed: `getAllPharmacies` and `getPendingPharmacies`.

In `getAllPharmacies`, the query selected `is_active` and `deleted_at` columns but did not apply any filter, meaning soft-deleted pharmacies were still returned in the general admin list. In `getPendingPharmacies`, the query only filtered by `status = 'pending'`. If a pharmacy was soft-deleted (i.e., `is_active = false`) while its status was still pending, it would inappropriately remain visible in the pending moderation queue. This created a data inconsistency where deleted entities could still be approved or rejected by admins.

## Files Modified

- `apps/api/src/controllers/admin.controller.ts`
- `apps/api/tests/adminPharmacies.test.ts`

## Implementation Details

### Schema Extension with Zod
We defined a new validation schema, `pharmacyListSchema`, which extends our existing `paginationSchema` using Zod:

```typescript
const pharmacyListSchema = paginationSchema.extend({
    includeInactive: z
        .enum(["true", "false"])
        .default("false")
        .transform((val) => val === "true"),
});
```

This schema handles the incoming string-based query parameters from Express, safely transforming the `"true"` or `"false"` string into a native boolean value.

### Controller Updates
1. **`getPendingPharmacies`**: We added an explicit `.eq("is_active", true)` filter to the Supabase query chain. This ensures that only active pharmacies awaiting verification are fetched.
2. **`getAllPharmacies`**: We replaced `paginationSchema.safeParse` with `pharmacyListSchema.safeParse`. We extracted `includeInactive` along with `page` and `limit`. We refactored the Supabase query execution to build the query dynamically. If `includeInactive` is falsy (i.e., `false`), we append `.eq("is_active", true)` to the query builder before executing it with `await query`.

### Test Suite Updates
In `apps/api/tests/adminPharmacies.test.ts`, we updated the mock setup for Supabase's chainable query builder. We modified the mock `eq` function to return an object containing itself (`{ eq, order }`) to support multiple chained `.eq()` calls. We added a new test case `"excludes soft-deleted pharmacies from the pending list"` that asserts both `.eq("status", "pending")` and `.eq("is_active", true)` are called.

## Technical Decisions

- **Zod Schema Transformation**: We used `.transform((val) => val === "true")` on a Zod string enum instead of a raw boolean schema because query parameters in Express are received as strings. This ensures robust type coercion and validation at the controller boundary.
- **Chained Query Builder Mocking**: In the Jest tests, we refactored the mock chain. Previously, `eq` returned `{ order }`. Because we now call `.eq().eq()`, we updated the mock so `eq` returns `{ eq, order }`. This allows arbitrary chaining of `.eq()` filters without throwing runtime errors during test execution.
- **Conditional Filtering for Admins**: We decided to allow admins to optionally view inactive pharmacies via `includeInactive=true` in `getAllPharmacies` rather than completely hiding them. This preserves administrative visibility for audit trails, whereas in `getPendingPharmacies`, soft-deleted pharmacies are strictly excluded because a deleted pharmacy should never be processed in an active moderation queue.

## How To Re-Implement (Contributor Reference)

If you need to implement a similar soft-delete filter on another admin controller, follow these steps:

1. **Define the Schema**: Extend the base `paginationSchema` using Zod to include the `includeInactive` field:
   ```typescript
   const customListSchema = paginationSchema.extend({
       includeInactive: z
           .enum(["true", "false"])
           .default("false")
           .transform((val) => val === "true"),
   });
   ```
2. **Parse the Query**: Use the schema to parse `req.query` and handle validation errors:
   ```typescript
   const parsed = customListSchema.safeParse(req.query);
   if (!parsed.success) {
       res.status(400).json({ error: "Invalid query parameters" });
       return;
   }
   const { page, limit, includeInactive } = parsed.data;
   ```
3. **Build the Query Dynamically**: Assign the Supabase query builder to a mutable variable, apply filters conditionally, and then await the result:
   ```typescript
   let query = supabase
       .from("your_table")
       .select("id, name, is_active")
       .range(offset, offset + limit - 1);

   if (!includeInactive) {
       query = query.eq("is_active", true);
   }

   const { data, error } = await query;
   ```
4. **Update Jest Mocks**: If your test suite mocks the Supabase client, ensure that the mocked `eq` function returns an object containing itself to support chaining:
   ```typescript
   const eq = jest.fn();
   eq.mockReturnValue({ eq, order });
   ```

## Impact on System Architecture

This change aligns our backend API controllers with the database-level soft-delete design introduced in our Supabase migrations. It prevents data leakage of soft-deleted entities into administrative views and queues. By standardizing query parameter parsing with Zod transforms, we establish a clean pattern for handling boolean query parameters across other admin controllers.

## Testing & Verification

We verified this change by running the Jest test suite in `apps/api/tests/adminPharmacies.test.ts`.

We added a new regression test: `"excludes soft-deleted pharmacies from the pending list"`. This test mocks the Supabase client, performs a GET request to `/api/v1/admin/pharmacies/pending`, and asserts that `.eq("status", "pending")` and `.eq("is_active", true)` are both called on the query builder.

We ran `npx tsc --noEmit` to ensure type safety across the modified files.