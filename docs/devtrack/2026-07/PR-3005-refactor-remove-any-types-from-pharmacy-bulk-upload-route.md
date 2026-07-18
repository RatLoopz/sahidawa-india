# PR #3005 — refactor: remove any types from pharmacy bulk upload route

> **Merged:** 2026-07-03 | **Author:** @Saylee12R | **Area:** Backend | **Impact Score:** 9 | **Closes:** #2367

## What Changed

We refactored the pharmacy bulk upload and management routes within our backend API to eliminate unsafe `any` types. We introduced a dedicated `InventoryInsertRow` interface to strictly type bulk inventory data, constrained CSV normalization records to `Record<string, string | undefined>`, and updated all catch blocks to use `unknown` with explicit type narrowing. Additionally, we updated the pharmacy deletion route to utilize the validated ID from our Zod schema parser instead of the raw request parameters.

## The Problem Being Solved

Before this PR, our bulk upload handlers in `apps/api/src/routes/pharmacies.ts` relied on loose `any` types for handling raw and normalized CSV rows. This bypassed TypeScript's compile-time type safety, making our inventory ingestion pipeline vulnerable to runtime crashes if the uploaded CSV structure deviated or contained malformed data. 

Furthermore, using `catch (error: any)` allowed unsafe property access (such as `error.message`) which would throw a secondary runtime error if the caught exception was not an instance of `Error` (e.g., a string or database driver error object). Finally, using unvalidated request parameters (`req.params.id`) directly in database queries bypassed the guarantees provided by our Zod validation schemas.

## Files Modified

- `apps/api/src/routes/pharmacies.ts`

## Implementation Details

### 1. Strict Inventory Row Typing
We introduced the `InventoryInsertRow` interface to represent the exact structure expected by our database schema for inventory insertions:
```typescript
interface InventoryInsertRow {
    pharmacy_id: string;
    medicine_name: string;
    batch_number: string;
    expiry_date: string;
    quantity: number;
    mrp: number;
}
```
We replaced the loosely typed `rowsToInsert: any[]` array with `rowsToInsert: InventoryInsertRow[]` in both the general bulk upload route and the specific pharmacy bulk upload route.

### 2. Safe CSV Normalization
During CSV parsing, empty strings must be normalized to `undefined` so that Zod's optional field validations resolve correctly. We refactored the normalization accumulator from `Record<string, any>` to a strictly typed record:
```typescript
const normalised: Record<string, string | undefined> = {};
```
This ensures that only strings or `undefined` values can be processed during the mapping phase, preventing downstream type pollution.

### 3. Robust Error Handling with Type Narrowing
We refactored all `catch (error: any)` blocks to `catch (error: unknown)`. To safely log the error messages without risking runtime exceptions, we implemented type narrowing:
```typescript
} catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error(`Exception in bulk operations handler: ${message}`);
    next(error);
}
```

### 4. Validated Parameter Utilization
In the pharmacy deletion route (`router.delete`), we replaced the direct assignment of the raw request parameter:
```typescript
const pharmacyId = req.params.id;
```
with the Zod-validated identifier:
```typescript
const pharmacyId = parsedId.data;
```
This guarantees that the ID passed to our Supabase database client has already been parsed and validated against our schema rules.

## Technical Decisions

- **Explicit Interface over Inline Types:** We chose to define `InventoryInsertRow` as a top-level interface rather than an inline type. This makes the code cleaner, improves readability, and allows us to export or reuse this interface in future inventory-related routes or test suites.
- **`unknown` over `any` for Catch Blocks:** Using `unknown` is a TypeScript best practice. It forces developers to explicitly verify the shape of the caught exception before interacting with it, preventing unexpected crashes when third-party libraries throw non-standard error objects.
- **Leveraging Zod Parsed Data:** Utilizing `parsedId.data` instead of `req.params.id` ensures that our application logic strictly relies on the sanitized and validated output of our middleware, reducing the risk of SQL injection or unexpected database query behavior.

## How To Re-Implement (Contributor Reference)

If you need to refactor similar bulk upload routes or remove `any` types in other modules, follow these steps:

1. **Define the Row Interface:** Create a strict interface representing the database row structure (e.g., `InventoryInsertRow`). Ensure all types (like `number`, `string`, `boolean`) match your database schema.
2. **Type the Accumulator:** When iterating over raw parsed CSV rows, type your normalization accumulator as `Record<string, string | undefined>` instead of `Record<string, any>`.
3. **Update the Target Array:** Change your insertion array declaration from `const rowsToInsert: any[] = []` to `const rowsToInsert: YourInterface[] = []`.
4. **Refactor Catch Blocks:**
   - Change `catch (error: any)` to `catch (error: unknown)`.
   - Extract the error message safely:
     ```typescript
     const message = error instanceof Error ? error.message : String(error);
     ```
5. **Use Validated Data:** Always extract route parameters from your Zod validation results (e.g., `parsedId.data`) rather than directly accessing `req.params`.

## Impact on System Architecture

- **Type Safety:** This change eliminates a major source of implicit `any` types in our backend API, moving us closer to a fully type-safe codebase.
- **Reliability:** By enforcing strict types on CSV normalization and bulk inserts, we prevent malformed data from reaching our database layer, reducing database-level validation failures.
- **Maintainability:** Future updates to the inventory database schema will now trigger compile-time errors in the bulk upload route if the `InventoryInsertRow` interface is updated, preventing silent failures during deployments.

## Testing & Verification

- **Static Analysis:** Verified that the TypeScript compiler successfully type-checks `apps/api/src/routes/pharmacies.ts` without any implicit or explicit `any` warnings in the refactored sections.
- **Edge Cases Handled:**
  - **Empty CSV Cells:** Correctly normalized to `undefined` and validated against Zod optional schemas.
  - **Non-Error Throws:** Safely caught and logged as `"Unknown error"` or stringified without crashing the logging middleware.