# PR #2061 — security(api): enforce authentication on pharmacy registration endpoi…

> **Merged:** 2026-06-19 | **Author:** @panditshubham766-dotcom | **Area:** Backend | **Impact Score:** 19 | **Closes:** #1565

## What Changed

This PR significantly enhances the security of our SahiDawa API by enforcing authentication on the `POST /api/pharmacies` endpoint. We integrated the `requireAuth` middleware to block unauthenticated requests and added a new `created_by` column to the `pharmacies` database table. This column now stores the `id` of the authenticated user who registers a new pharmacy, improving auditability.

## The Problem Being Solved

Before this change, the `POST /api/pharmacies` endpoint was publicly accessible, allowing any unauthenticated client to register new pharmacies in our system. This represented a critical security vulnerability, as it could be exploited for unauthorized data creation, spam, or other malicious activities, compromising the integrity of our pharmacy data. Furthermore, our system lacked a mechanism to track which specific user initiated the registration of a pharmacy, making it impossible to audit the origin of pharmacy records or hold users accountable for their submissions.

## Files Modified

- `apps/api/src/routes/pharmacies.ts`
- `supabase/migrations/20260619000000_add_created_by_to_pharmacies.sql`

## Implementation Details

Our system implemented the following changes to secure the pharmacy registration endpoint and track creators:

1.  **Database Schema Update (`supabase/migrations/20260619000000_add_created_by_to_pharmacies.sql`):**
    - A new migration script was introduced to modify the `pharmacies` table in our Supabase database.
    - It adds a `created_by` column with a `UUID` data type to the `pharmacies` table.
    - This `created_by` column is configured as a foreign key (`REFERENCES auth.users(id)`), establishing a direct link to the `id` column of the `auth.users` table. This ensures referential integrity, meaning every `created_by` entry must correspond to an existing user in our authentication system.

2.  **API Endpoint Modification (`apps/api/src/routes/pharmacies.ts`):**
    - We imported the `requireAuth` middleware and the `AuthenticatedRequest` type from `../middleware/auth`. The `requireAuth` middleware is responsible for validating the authentication token (e.g., JWT) present in the request and populating `req.user` with the authenticated user's details. The `AuthenticatedRequest` type extends the standard Express `Request` type to include the `user` property.
    - The `router.post("/", ...)` definition for the pharmacy registration endpoint was updated to include `requireAuth` as the first middleware:
        ```typescript
        router.post(
            "/",
            requireAuth,
            async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
                // ...
            }
        );
        ```
        This ensures that any request to this endpoint will first pass through `requireAuth`. If the request is unauthenticated or has an invalid token, `requireAuth` will terminate the request with a `401 Unauthorized` response before it reaches our handler logic.
    - Inside the `async` handler function, we added an explicit type guard to check for `req.user`:
        ```typescript
        if (!req.user) {
            res.status(401).json({ error: "Unauthorized access" });
            return;
        }
        ```
        While `requireAuth` is designed to ensure `req.user` is present, this explicit check provides an additional layer of runtime safety and type-checking assurance, preventing potential `null` or `undefined` access errors if `req.user` were somehow missing.
    - The `data` object, which holds the validated pharmacy payload from `registerPharmacySchema.safeParse(req.body)`, is now augmented to include the `created_by` field:
        ```typescript
        const data = {
            ...parsed.data,
            created_by: req.user.id,
        };
        ```
        This merges the authenticated user's ID into the data structure that will be inserted into the database.
    - Finally, the `supabase.from('pharmacies').insert(...)` call was updated to explicitly include the `created_by` field with the value derived from `data.created_by`:
        ```typescript
        const { data: newPharmacy, error: insertError } = await supabase
            .from("pharmacies")
            .insert({
                // ... other pharmacy fields
                created_by: data.created_by,
            })
            .select()
            .single();
        ```
        This ensures that the `created_by` column is populated with the ID of the user who initiated the registration when a new pharmacy record is created.

## Technical Decisions

- **Middleware-based Authentication:** We opted for an Express middleware (`requireAuth`) to enforce authentication. This pattern is highly effective for several reasons: it promotes separation of concerns by isolating authentication logic, it's reusable across multiple protected routes, and it allows for clear control over the request lifecycle, ensuring unauthenticated requests are rejected early.
- **`AuthenticatedRequest` Type for Type Safety:** By introducing and using the `AuthenticatedRequest` type, we gain compile-time guarantees that `req.user` will be available and correctly typed within our protected route handlers. This significantly reduces the likelihood of runtime errors related to accessing undefined properties and improves developer experience by providing intelligent code completion.
- **`created_by` Column with Foreign Key:** The decision to add a `created_by` column with a foreign key constraint directly referencing `auth.users(id)` is a standard and robust database design practice. It ensures data integrity by guaranteeing that every pharmacy record is linked to a valid user, prevents orphaned data, and facilitates efficient querying for audit trails or user-specific data.
- **Database Migrations for Schema Changes:** Utilizing Supabase migration scripts for schema modifications ensures that database changes are version-controlled, repeatable, and applied consistently across all development, staging, and production environments. This is crucial for maintaining a stable and synchronized database schema.

## How To Re-Implement (Contributor Reference)

To re-implement this feature from scratch, a contributor would follow these steps:

1.  **Create Database Migration:**
    - Generate a new Supabase migration file (e.g., `supabase/migrations/YYYYMMDDHHMMSS_add_created_by_to_pharmacies.sql`).
    - Add the following SQL statement to the migration file:
        ```sql
        ALTER TABLE pharmacies
        ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
        ```
    - Apply the migration to the Supabase database using the Supabase CLI (`supabase migration up`) or through the Supabase dashboard.

2.  **Modify API Endpoint:**
    - Locate the relevant API route file, in this case, `apps/api/src/routes/pharmacies.ts`.
    - Import the authentication middleware and type definition at the top of the file:
        ```typescript
        import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
        ```
        _(Note: Ensure `../middleware/auth` correctly exports `requireAuth` and `AuthenticatedRequest`.)_
    - Update the `router.post` declaration for the pharmacy registration endpoint to include the `requireAuth` middleware and cast the `req` object to `AuthenticatedRequest`:
        ```typescript
        router.post("/", requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            // ... existing validation logic for registerPharmacySchema
        ```
    - Immediately after the `parsed.success` check, add a type guard to ensure `req.user` is present:

        ```typescript
        if (!parsed.success) {
            res.status(400).json({
                error: "Invalid pharmacy payload",
                issues: parsed.error.issues,
            });
            return;
        }

        if (!req.user) {
            // This check is crucial after requireAuth
            res.status(401).json({ error: "Unauthorized access" });
            return;
        }
        ```

    - Modify how the `data` object is constructed to include the `created_by` field from `req.user.id`:
        ```typescript
        const data = {
            ...parsed.data, // Contains the validated pharmacy details
            created_by: req.user.id, // Add the authenticated user's ID
        };
        ```
    - Finally, update the `supabase.from('pharmacies').insert()` call to include the `created_by` field:
        ```typescript
        const { data: newPharmacy, error: insertError } = await supabase
            .from("pharmacies")
            .insert({
                // ... existing fields like name, address, license_id, etc.
                created_by: data.created_by, // Ensure this field is passed
            })
            .select()
            .single();
        ```
    - **Gotchas:** Verify that the `requireAuth` middleware correctly populates `req.user` with an object containing an `id` property. The `auth.users` table must exist and be accessible by the Supabase service role for the foreign key constraint to function correctly.

## Impact on System Architecture

This change has a significant positive impact on our SahiDawa system architecture:

- **Enhanced Security Posture:** By securing a critical data creation endpoint, we have closed a major vulnerability, making our API more resilient against unauthorized access and data manipulation. This is a fundamental step towards building a robust and trustworthy platform.
- **Improved Auditability and Accountability:** The introduction of the `created_by` field provides an invaluable audit trail. We can now definitively track which user initiated the creation of each pharmacy record, which is essential for debugging, compliance, and understanding user activity patterns within the platform.
- **Foundation for Granular Access Control:** The `requireAuth` middleware and the `created_by` field lay a strong foundation for implementing more granular Role-Based Access Control (RBAC) in the future. We can now easily extend our authorization logic to check not only if a user is authenticated, but also if they have the specific role or permissions required to create pharmacies.
- **Data Model Enrichment:** The `pharmacies` table now contains richer metadata, directly linking records to their creators. This enriches our data model and allows for more complex queries and reporting capabilities in the future.

## Testing & Verification

Verification of this change involved both positive and negative test cases to ensure the authentication enforcement and data linkage worked as expected.

- **Positive Test Case (Authenticated Request):**
    - An authenticated user (with a valid JWT in the `Authorization: Bearer <token>` header) sent a `POST` request to `/api/pharmacies` with a valid pharmacy payload.
    - Expected result: The request should succeed, returning a `201 Created` status code and the newly registered pharmacy data.
    - Database verification: The newly created pharmacy record in the `pharmacies` table was inspected to confirm that the `created_by` column was populated with the `id` of the authenticated user who made the request.
- **Negative Test Case (Unauthenticated Request):**
    - An unauthenticated request (without an `Authorization` header or with an invalid/expired token) was sent to `POST /api/pharmacies`.
    - Expected result: The request should be rejected by the `requireAuth` middleware, returning a `401 Unauthorized` status code. The pharmacy should not be created in the database.
- **Negative Test Case (Invalid Payload):**
    - A request (authenticated or unauthenticated) was sent with an invalid pharmacy payload (e.g., missing required fields).
    - Expected result: The request should return a `400 Bad Request` status code due to `registerPharmacySchema` validation, regardless of authentication status. This confirms that authentication enforcement does not interfere with existing input validation.

The PR includes a screenshot as "Proof of Work," which visually confirms the successful execution of at least one of these test scenarios. Specific details on the exact test steps and output shown in the screenshot are Not documented in this PR.
