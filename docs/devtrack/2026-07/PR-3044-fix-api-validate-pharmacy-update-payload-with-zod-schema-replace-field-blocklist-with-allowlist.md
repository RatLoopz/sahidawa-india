# PR #3044 — fix(api): validate pharmacy update payload with Zod schema, replace field blocklist with allowlist

> **Merged:** 2026-07-04 | **Author:** @aayushiii18 | **Area:** Backend | **Impact Score:** 13 | **Closes:** #3036

## What Changed

We replaced the insecure blocklist-based payload filtering in the `PUT /api/pharmacies/:id` route with a strict, schema-driven allowlist using Zod. We introduced two new validation schemas, `updatePharmacySchema` and `adminOnlyPharmacyFieldsSchema`, to validate and sanitize incoming request bodies. The route handler now uses `.safeParse()` to reject unknown fields and validate data types before passing the payload to our Supabase database.

## The Problem Being Solved

Previously, the `PUT /api/pharmacies/:id` endpoint was highly fragile and vulnerable to mass assignment attacks. The handler assigned the raw `req.body` directly to the `updateData` variable and relied on a blocklist approach—manually deleting a small, hardcoded set of restricted keys (`id`, `created_by`, and conditionally `status` and `is_verified` if the user was not an admin). 

This approach meant that any other field present in the request body was passed straight to the Supabase `.update()` call with zero type validation or sanitization. If a malicious actor sent unexpected fields that mapped to our database columns, those fields would be updated directly. Furthermore, there was no validation for field formats (such as phone numbers or coordinates), which could lead to database-level errors or corrupted data.

## Files Modified

- `apps/api/src/routes/pharmacies.ts`
- `package-lock.json`
- `package.json`

## Implementation Details

### 1. Schema Definition
We defined two new Zod schemas in `apps/api/src/routes/pharmacies.ts`:
*   **`updatePharmacySchema`**: Mirrors our existing `registerPharmacySchema` but marks all fields as `.optional()` to support partial updates. We appended `.strict()` to reject any unknown keys outright rather than silently dropping them.
    ```typescript
    const updatePharmacySchema = z
        .object({
            name: z.string().min(2).optional(),
            licenseId: z.string().min(3).optional(),
            address: z.string().min(5).optional(),
            district: z.string().min(2).optional(),
            state: z.string().min(2).optional(),
            phone_number: z
                .string()
                .regex(/^\+?[\d\s\-()]{7,15}$/)
                .optional(),
            lat: z.number().min(-90).max(90).optional(),
            lng: z.number().min(-180).max(180).optional(),
        })
        .strict();
    ```
*   **`adminOnlyPharmacyFieldsSchema`**: Validates administrative fields that should never be modifiable by standard pharmacy owners.
    ```typescript
    const adminOnlyPharmacyFieldsSchema = z
        .object({
            status: z.enum(["pending", "approved", "rejected"]).optional(),
            is_verified: z.boolean().optional(),
        })
        .strict();
    ```

### 2. Route Handler Refactoring
In the `PUT /:id` route handler, we removed the manual `delete` operations and implemented a strict validation flow:
*   We parse the incoming `req.body` using `updatePharmacySchema.safeParse(req.body)`. If validation fails, we immediately return a `400 Bad Request` with the Zod validation issues.
*   We initialize our database payload `updateData` using the validated data: `let updateData: Record<string, unknown> = { ...parsedBody.data };`.
*   If the user is an administrator (`isAdmin` is true), we extract and validate the admin-only fields (`status` and `is_verified`) from `req.body` using `adminOnlyPharmacyFieldsSchema.safeParse()`. If valid, we merge these fields into `updateData`.
*   The sanitized `updateData` object is then passed to the Supabase client update query.

## Technical Decisions

*   **Zod for Schema Validation**: We chose to use Zod because it is already our standard validation library across the SahiDawa API. This maintains architectural consistency and allows us to reuse existing validation patterns (like the phone number regex and coordinate boundaries).
*   **Strict Mode (`.strict()`)**: We explicitly enabled `.strict()` on our schemas. This ensures that if a client attempts to send unvalidated or malicious fields, the API rejects the request immediately with a `400` error rather than silently ignoring the extra fields, making API behavior predictable and secure.
*   **Separation of Concerns for Admin Fields**: Instead of creating a single complex schema with conditional logic, we separated standard fields and admin-only fields into two distinct schemas. This makes the security boundary explicit and easy to audit.
*   **Dependency Updates**: The addition of `rate-limit-redis` in `package.json` and `package-lock.json` is: Not documented in this PR.

## How To Re-Implement (Contributor Reference)

To implement a similar secure update pattern for other resource routes in SahiDawa, follow these steps:

1.  **Define the Schemas**: Create a standard update schema and an admin-only update schema using Zod. Ensure all fields are `.optional()` to support partial updates, and always append `.strict()` to prevent mass assignment.
2.  **Validate Standard Fields**: In your route handler, run `safeParse` against the request body using the standard update schema.
    ```typescript
    const parsedBody = updatePharmacySchema.safeParse(req.body);
    if (!parsedBody.success) {
        return res.status(400).json({ error: "Invalid payload", issues: parsedBody.error.issues });
    }
    ```
3.  **Conditionally Validate Admin Fields**: Check the user's role. If they are an admin, parse the admin-specific fields from the request body and merge them into the validated payload.
    ```typescript
    let updateData = { ...parsedBody.data };
    if (isAdmin) {
        const parsedAdmin = adminOnlyPharmacyFieldsSchema.safeParse({
            status: req.body.status,
            is_verified: req.body.is_verified
        });
        if (!parsedAdmin.success) {
            return res.status(400).json({ error: "Invalid admin fields", issues: parsedAdmin.error.issues });
        }
        updateData = { ...updateData, ...parsedAdmin.data };
    }
    ```
4.  **Execute Database Update**: Pass the fully validated and merged `updateData` object to the Supabase client.

## Impact on System Architecture

This change shifts our API design from a reactive, insecure "blocklist" security model to a proactive, secure "allowlist" model. It hardens our backend against mass assignment vulnerabilities and ensures that only validated, well-formed data reaches our database. It establishes a clean, reusable pattern for handling mixed-privilege update payloads (where some fields are user-editable and others are admin-only) across the SahiDawa ecosystem.

## Testing & Verification

We verified this change by running our existing automated test suites locally:
*   `tests/pharmacies.test.ts`
*   `tests/adminPharmacies.test.ts`

We ran the tests using the command:
```bash
npm test -- pharmacies
```
All 25 tests passed successfully, confirming that the new validation logic does not break existing update workflows for either standard users or administrators.

### Edge Cases Handled
*   **Partial Updates**: Verified that clients can send a subset of fields (e.g., only updating the `phone_number`) without triggering validation errors on missing fields.
*   **Malicious Field Injection**: Verified that non-admin users attempting to send `status` or `is_verified` in their payload cannot modify those fields, as they are not part of the standard `updatePharmacySchema` and are rejected by `.strict()`.
*   **Invalid Data Types**: Verified that invalid phone numbers, out-of-bounds coordinates, or short strings are caught by Zod and rejected with descriptive error messages.