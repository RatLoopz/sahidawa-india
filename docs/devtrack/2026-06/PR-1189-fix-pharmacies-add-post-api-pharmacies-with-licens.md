# PR #1189 — fix(pharmacies): add POST /api/pharmacies with licenseId uniqueness check

> **Merged:** 2026-06-03 | **Author:** @anshul23102 | **Area:** Backend | **Impact Score:** 9 | **Closes:** #1180

## What Changed

We have introduced a new `POST /api/pharmacies` endpoint in `apps/api/src/routes/pharmacies.ts` to enable the registration of new pharmacies. This endpoint now includes robust validation using Zod and enforces uniqueness for the `licenseId` field, returning a `409 Conflict` if a duplicate is detected. All newly registered pharmacies are automatically set to `is_verified=false` pending administrative review.

## The Problem Being Solved

Prior to this change, our system lacked a dedicated application-level API endpoint for registering new pharmacies. This meant that pharmacy records were either created directly in the database or through less controlled mechanisms, without any application-level guard against duplicate `licenseId` values. The absence of this crucial check led to a significant data integrity issue: the same physical pharmacy location could be registered multiple times. These duplicate records polluted our nearby search results with redundant entries and corrupted distance queries, leading to an unreliable user experience and inaccurate data. The core problem was the missing `POST /api/pharmacies` route, which prevented us from enforcing the `licenseId` uniqueness invariant at the API layer.

## Files Modified

- `apps/api/src/routes/pharmacies.ts`

## Implementation Details

The implementation for this change is contained within `apps/api/src/routes/pharmacies.ts`.

1.  **Zod Schema Definition:** We defined a new Zod schema, `registerPharmacySchema`, to validate the incoming request body for pharmacy registration. This schema specifies the required fields: `name` (string, min 2 chars), `licenseId` (string, min 3 chars), `address` (string, min 5 chars), `district` (string, min 2 chars), and `state` (string, min 2 chars). Optional fields include `phone_number` (string, validated by regex `^\+?[\d\s\-()]{7,15}$`), `lat` (number, between -90 and 90), and `lng` (number, between -180 and 180). The `licenseId` is explicitly marked as required, forming the basis for our uniqueness check.

2.  **POST Route Handler:** A `router.post("/")` handler was added to manage requests to the `/api/pharmacies` endpoint.

3.  **Request Validation:**
    *   Upon receiving a request, `req.body` is validated against `registerPharmacySchema` using `parsed.safeParse(req.body)`.
    *   If validation fails (`!parsed.success`), our system immediately responds with a `400 Bad Request` status, including a detailed error message and the specific validation `issues` provided by Zod.

4.  **License ID Uniqueness Check:**
    *   If the payload is valid, we proceed to check for an existing pharmacy with the same `licenseId`. This is done by querying the `pharmacies` table using Supabase: `supabase.from("pharmacies").select("id").eq("license_id", data.licenseId).maybeSingle()`.
    *   If a `lookupError` occurs during this database operation, it is logged using our `logger.error` and passed to the `next` Express middleware for centralized error handling.
    *   If an `existing` record is found (meaning `existing` is not null), it indicates a duplicate `licenseId`. Our system then responds with a `409 Conflict` status, informing the client that "A pharmacy with this license ID is already registered."

5.  **Pharmacy Insertion:**
    *   If no existing pharmacy with the given `licenseId` is found, our system proceeds to insert a new record into the `pharmacies` table using `supabase.from("pharmacies").insert(...)`.
    *   The fields `name`, `license_id` (mapped from `data.licenseId`), `address`, `district`, and `state` are populated from the validated `data`.
    *   Optional fields (`phone_number`, `lat`, `lng`) are inserted as `null` if they were not provided in the request body (`data.phone_number ?? null`).
    *   Crucially, the `is_verified` field is explicitly set to `false` for all new registrations, ensuring that new pharmacies require administrative approval before becoming active.
    *   The `.select().single()` method is used to retrieve the newly inserted pharmacy record.
    *   If an `insertError` occurs during this operation, it is passed to the `next` Express middleware.

6.  **Success Response:** On successful insertion, our system responds with a `201 Created` status code, returning the newly created `pharmacy` object in the JSON response body.

7.  **Error Handling:** The entire database operation is wrapped in a `try...catch` block to gracefully handle any unexpected errors, passing them to the `next` middleware.

## Technical Decisions

*   **Zod for Schema Validation:** We chose Zod for request body validation due to its robust capabilities, strong TypeScript integration, and clear, descriptive error messages. This ensures that incoming data conforms to our expected structure and types, preventing malformed data from reaching our database and improving API reliability.
*   **Application-Level Uniqueness Check:** Instead of solely relying on a database-level unique constraint (which would typically result in a generic database error), we implemented an explicit `SELECT` query to check for `licenseId` uniqueness *before* attempting an `INSERT`. This allows us to return a more specific and actionable `409 Conflict` HTTP status code to the client, clearly indicating a business logic violation rather than a technical database error. This provides a better developer and user experience for API consumers.
*   **`maybeSingle()` for Existence Checks:** Utilizing Supabase's `maybeSingle()` method for the uniqueness lookup simplifies the logic by returning `null` if no record is found, rather than throwing an error. This makes the code cleaner and easier to read when checking for the absence of a record.
*   **Default `is_verified=false`:** Setting `is_verified` to `false` by default for new pharmacy registrations is a deliberate security and data quality decision. It establishes a necessary administrative review process, preventing unapproved or potentially malicious entries from immediately appearing on the platform and ensuring the integrity of our pharmacy data.
*   **Standard HTTP Status Codes:** We adhere to standard HTTP status codes (`201 Created`, `400 Bad Request`, `409 Conflict`) to provide clear and predictable communication to API consumers, making the endpoint intuitive and easy to integrate with.

## How To Re-Implement (Contributor Reference)

To re-implement this feature from scratch, a contributor would follow these steps:

1.  **Define the Zod Validation Schema:**
    *   In `apps/api/src/routes/pharmacies.ts`, import `z` from `zod`.
    *   Create `const registerPharmacySchema = z.object({...})` defining the expected structure of the pharmacy registration payload.
    *   Ensure `licenseId` is a required `z.string().min(3)`.
    *   Add validation rules for other fields, e.g., `z.string().min(2)` for `name`, `district`, `state`; `z.string().regex(...)` for `phone_number`; and `z.number().min().max()` for `lat`/`lng`. Mark optional fields with `.optional()`.

2.  **Add the POST Route Handler:**
    *   Within `apps/api/src/routes/pharmacies.ts`, add a new `router.post("/", async (req: Request, res: Response, next: NextFunction) => { ... });` block.

3.  **Validate Incoming Request Body:**
    *   Inside the `router.post` handler, use `const parsed = registerPharmacySchema.safeParse(req.body);`.
    *   Implement an `if (!parsed.success)` block to handle validation failures, returning `res.status(400).json({ error: "Invalid pharmacy payload", issues: parsed.error.issues });` and `return;`.
    *   Extract the validated data: `const data = parsed.data;`.

4.  **Implement Uniqueness Check for `licenseId`:**
    *   Wrap the database operations in a `try...catch(err)` block, passing `next(err)` in the catch.
    *   Inside the `try` block, query Supabase:
        ```typescript
        const { data: existing, error: lookupError } = await supabase
            .from("pharmacies")
            .select("id")
            .eq("license_id", data.licenseId)
            .maybeSingle();
        ```
    *   Handle `lookupError` by logging it and calling `next(lookupError)`.
    *   Implement an `if (existing)` block to detect duplicates, returning `res.status(409).json({ error: "A pharmacy with this license ID is already registered" });` and `return;`.

5.  **Insert New Pharmacy Record:**
    *   If no duplicate is found, construct the insertion object, mapping `data.licenseId` to `license_id` (snake\_case for database columns).
    *   Crucially, set `is_verified: false`.
    *   Handle optional fields by using the nullish coalescing operator (e.g., `data.phone_number ?? null`).
    *   Execute the Supabase insert:
        ```typescript
        const { data: pharmacy, error: insertError } = await supabase
            .from("pharmacies")
            .insert({
                name: data.name,
                license_id: data.licenseId,
                address: data.address,
                district: data.district,
                state: data.state,
                phone_number: data.phone_number ?? null,
                lat: data.lat ?? null,
                lng: data.lng ?? null,
                is_verified: false,
            })
            .select()
            .single();
        ```
    *   Handle `insertError` by calling `next(insertError)`.

6.  **Return Success Response:**
    *   On successful insertion, return `res.status(201).json({ pharmacy });`.

## Impact on System Architecture

This change significantly impacts our system architecture by formalizing the process of pharmacy registration. It introduces a robust, validated API endpoint, shifting the responsibility for creating pharmacy records from potentially unvalidated direct database operations to a controlled application layer. This enhances data integrity by enforcing the `licenseId` uniqueness constraint, which is critical for preventing data corruption in search results and ensuring accurate location-based services.

The default `is_verified=false` for new registrations establishes a foundational workflow for administrative moderation, which is crucial for maintaining the quality and trustworthiness of data on the SahiDawa platform. This feature unlocks the ability for future frontend applications or external partners to programmatically register pharmacies in a secure and validated manner, without requiring direct database access. It sets a strong precedent for how new entities should be introduced into our system, emphasizing validation, uniqueness, and a clear moderation pipeline.

## Testing & Verification

The following testing was performed to verify the functionality and robustness of this change:

1.  **Successful Registration (New `licenseId`):**
    *   A `POST` request was made to `/api/pharmacies` with a valid payload containing a unique `licenseId`.
    *   **Expected Result:** The system returned a `201 Created` status code. A new pharmacy record was successfully created in the `pharmacies` table, and the response body contained the newly created pharmacy object, with `is_verified` correctly set to `false`.

2.  **Duplicate Registration (`licenseId` Conflict):**
    *   A second `POST` request was made to `/api/pharmacies` using the *exact same `licenseId`* as a previously registered pharmacy.
    *   **Expected Result:** The system returned a `409 Conflict` status code, indicating that "A pharmacy with this license ID is already registered." No new pharmacy record was created in the database.

3.  **Invalid Payload (Validation Failure):**
    *   `POST` requests were made to `/api/pharmacies` with various invalid payloads, including:
        *   Missing required fields (e.g., `name`, `licenseId`).
        *   Fields with incorrect data types (e.g., a number for `licenseId`).
        *   Fields failing schema-defined constraints (e.g., `name` shorter than 2 characters, `lat` out of range).
    *   **Expected Result:** The system consistently returned a `400 Bad Request` status code. The response body included a detailed `error` message and an `issues` array from Zod, specifying the exact validation failures.

**Edge Cases:**
*   **Optional Fields Handling:** Testing confirmed that optional fields like `phone_number`, `lat`, and `lng` are correctly handled. If provided, they are stored; if omitted from the request, they are inserted as `null` in the database, as intended by `data.field ?? null`.
*   **Error Propagation:** The `try...catch` block ensures that any unexpected errors during database operations (e.g., network issues, database downtime) are caught and correctly passed to the Express `next` middleware for centralized error handling, preventing the API from crashing.
*   **Concurrent Requests:** Not documented in this PR if a database unique constraint was added to the `license_id` column. While the application-level check mitigates most duplicate attempts, a true race condition with simultaneous requests could theoretically lead to two requests passing the `SELECT` check before the first `INSERT` commits. In such a scenario, if a database-level unique constraint exists, one of the `INSERT` operations would fail at the database level. If no such constraint exists, true duplicates could still occur in very rare, high-concurrency situations, though the application-level check significantly reduces this risk.