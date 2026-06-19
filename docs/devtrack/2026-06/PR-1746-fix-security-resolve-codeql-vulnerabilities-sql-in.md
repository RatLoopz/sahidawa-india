# PR #1746 — fix(security): resolve CodeQL vulnerabilities (SQL Injection, Log Inj…

> **Merged:** 2026-06-12 | **Author:** @dipexplorer | **Area:** Backend | **Impact Score:** 25 | **Closes:** #123

## What Changed

This pull request introduces critical security enhancements to our backend API. We have implemented robust input validation using the `zod` library for the `/cache/invalidate` endpoint, refactored the `warmCache` function in `cache.service.ts` to prevent SQL injection vulnerabilities, and added comprehensive sanitization for user-controlled input in log messages across `cache.service.ts`, `drugLookup.service.ts`, and `admin.routes.ts` to mitigate log injection risks.

## The Problem Being Solved

Prior to this PR, our system was susceptible to several CodeQL-identified vulnerabilities:

1.  **SQL Injection in `warmCache`:** The `apps/api/src/services/cache.service.ts` file's `warmCache` function constructed Supabase `.or()` filters by manually concatenating strings for `generic_name.in` and `brand_name.in` clauses. This method allowed for potential SQL injection if malicious input were to reach these fields, enabling an attacker to manipulate database queries.
2.  **Log Injection:** Multiple logging statements in `apps/api/src/services/cache.service.ts` and `apps/api/src/services/drugLookup.service.ts`, as well as the construction of Redis keys in `apps/api/src/routes/admin.routes.ts`, directly incorporated user-controlled data (e.g., `batchNumber`, `keysToDelete`). This allowed an attacker to inject newline characters (`\r` or `\n`) into log entries, potentially forging log messages or disrupting log parsing, a vulnerability known as log injection.
3.  **Unvalidated Input:** The `/cache/invalidate` endpoint in `apps/api/src/routes/admin.routes.ts` directly consumed `req.body` parameters (`drugIds`, `batchNumbers`) without explicit schema validation. This lack of validation could lead to unexpected data types, malformed requests, or further downstream vulnerabilities.

## Files Modified

- `apps/api/src/routes/admin.routes.ts`
- `apps/api/src/services/cache.service.ts`
- `apps/api/src/services/drugLookup.service.ts`

## Implementation Details

### Input Validation for `/cache/invalidate`

In `apps/api/src/routes/admin.routes.ts`, we introduced `zod` for schema-based input validation on the `/cache/invalidate` POST endpoint.
1.  A `zod` schema, `InvalidateCacheSchema`, was defined to expect `drugIds` and `batchNumbers` as optional arrays of strings, defaulting to empty arrays if not provided.
2.  Inside the route handler, `InvalidateCacheSchema.safeParse(req.body)` is now used to validate the incoming request body.
3.  If `parsed.success` is false, indicating an invalid payload format, the system responds with a `400 Bad Request` status and an error message, preventing further processing of potentially malicious or malformed data.
4.  If validation succeeds, the validated data is destructured from `parsed.data`.

### SQL Injection Prevention in `warmCache`

The `warmCache` function in `apps/api/src/services/cache.service.ts` was refactored to eliminate the SQL injection vulnerability.
1.  Instead of constructing a single `.or()` query with string-interpolated `in` clauses (e.g., `generic_name.in.("value1","value2")`), we now perform two separate Supabase queries:
    *   One query fetches medicines based on `generic_name` using `supabase.from("medicines").select(...).in("generic_name", genericNames)`.
    *   A second query fetches medicines based on `brand_name` using `supabase.from("medicines").select(...).in("brand_name", brandNames)`.
2.  Supabase's `.in()` method, when provided with an array, handles parameterization internally, ensuring that the values are properly escaped and preventing SQL injection.
3.  The results from both queries (`genericMeds` and `brandMeds`) are then merged into a single `medicines` array. A `Map` (`uniqueMeds`) is used to deduplicate the results based on `m.id`, ensuring each medicine is cached only once.

### Log Injection Prevention

To prevent log injection, we've implemented string sanitization for all user-controlled inputs that are logged or used in key generation.
1.  **`apps/api/src/routes/admin.routes.ts`**: When constructing Redis keys for batch numbers, `batch.replace(/[\r\n]/g, "")` is applied to each `batch` string to remove any newline characters before it's used in the key.
2.  **`apps/api/src/services/cache.service.ts`**:
    *   In `getCachedDrug`, `batchNumber.replace(/[\r\n]/g, "")` is applied to the `batchNumber` before it's logged in the `logger.error` call.
    *   In `setCachedDrug`, `batchNumber.replace(/[\r\n]/g, "")` is applied to the `batchNumber` before it's logged in the `logger.error` call.
    *   In `invalidateDrugCache`, `keysToDelete.join(", ").replace(/[\r\n]/g, "")` is applied to the joined string of invalidated keys before it's logged in the `logger.info` call.
3.  **`apps/api/src/services/drugLookup.service.ts`**:
    *   In `lookupDrugByBatch`, `batchNumber.replace(/[\r\n]/g, "")` is applied to the `batchNumber` before it's included in the `logger.error` object and in the `logger.error` message for unexpected errors.

This sanitization ensures that newline characters cannot be injected into our logs, preventing log forging and maintaining log integrity.

## Technical Decisions

*   **Zod for Input Validation:** We chose `zod` for API input validation due to its strong TypeScript integration, declarative schema definition, and excellent runtime validation capabilities. It provides a clear, concise, and type-safe way to define expected data structures, reducing boilerplate compared to manual validation or other libraries like Joi, and ensuring that only correctly formatted data proceeds through our system.
*   **Supabase Query Refactoring for SQL Injection:** The decision to split the `warmCache` query into two separate `.in()` calls instead of using a single `.or()` with string concatenation was made to leverage Supabase's built-in parameterized query capabilities. While a single `.or()` might seem more efficient, manually constructing SQL-like strings is inherently risky and prone to injection. Supabase's `.in()` method handles the necessary escaping and parameterization, providing a secure and robust solution. The slight performance overhead of two queries followed by client-side deduplication is an acceptable trade-off for enhanced security.
*   **String Sanitization for Log Injection:** The `string.replace(/[\r\n]/g, "")` pattern was chosen as a simple, effective, and widely understood method to remove newline and carriage return characters from strings. This approach directly addresses the log injection vulnerability by ensuring that user-controlled data cannot prematurely terminate log lines or inject false entries, without altering the semantic content of the logged data.

## How To Re-Implement (Contributor Reference)

To re-implement or apply similar security measures:

1.  **For Input Validation (using `zod`):**
    *   Install `zod`: `npm install zod` or `yarn add zod`.
    *   Define a `zod` schema for your expected request body or query parameters, e.g., `const MySchema = z.object({ field1: z.string(), field2: z.array(z.number()).optional() });`.
    *   In your Express route handler, use `const parsed = MySchema.safeParse(req.body);`.
    *   Check `if (!parsed.success)` to handle validation failures, typically by returning a `400 Bad Request` response with `parsed.error.errors` for detailed validation messages.
    *   Access the validated data via `parsed.data`.

2.  **For SQL Injection Prevention (Supabase/PostgREST):**
    *   **Avoid string concatenation for query parameters.** Never build `WHERE` clauses or `IN` lists by directly inserting user-controlled strings.
    *   **Utilize client library methods:** Always prefer Supabase client methods like `.eq()`, `.in()`, `.filter()`, etc., which handle parameterization automatically.
    *   If you need complex `OR` conditions that cannot be directly expressed by a single `.or()` with arrays (which Supabase supports for simple cases), consider:
        *   Performing multiple separate queries and merging results client-side, as done in `warmCache`.
        *   Creating a database view or a stored procedure that encapsulates the complex logic, allowing the client to call it with parameterized inputs.

3.  **For Log Injection Prevention:**
    *   **Identify all points where user-controlled input is logged.** This includes request parameters, body fields, headers, and any data that originates from external sources.
    *   **Sanitize before logging:** Before passing any such string to a logger (e.g., `logger.info`, `logger.error`) or using it to construct keys/identifiers that might appear in logs, apply sanitization.
    *   The recommended pattern is `yourString.replace(/[\r\n]/g, "")`. This removes carriage return and newline characters, preventing log line breaks.
    *   Be mindful of other potential log injection vectors, such as ANSI escape codes, though newline characters are the most common.

## Impact on System Architecture

This change significantly strengthens the security posture of the SahiDawa backend, particularly against common web vulnerabilities identified by static analysis tools like CodeQL.

*   **Enhanced Security:** By addressing SQL injection, log injection, and unvalidated input, we reduce the attack surface and improve the overall trustworthiness of our API. This is crucial for a platform handling sensitive health and medicine verification data.
*   **Standardized Input Validation:** The adoption of `zod` introduces a consistent and type-safe approach to input validation across our API endpoints. This pattern can now be easily extended to other routes, improving code quality and reducing the likelihood of future validation-related bugs.
*   **Improved Logging Reliability:** Sanitizing log messages ensures that our operational logs are accurate and free from malicious manipulation, making debugging, monitoring, and auditing more reliable.
*   **Minor Performance Adjustments:** The refactoring of `warmCache` from a single `.or()` query to two `.in()` queries might introduce a negligible increase in database round trips during cache warming. However, given that cache warming is an infrequent background operation, this impact is minimal and is a necessary trade-off for robust security.
*   **Foundation for Future Security Audits:** These fixes demonstrate our commitment to security and provide a stronger baseline for future security audits and compliance requirements.

## Testing & Verification

The resolution of these vulnerabilities was primarily driven by findings from CodeQL scans.
*   **CodeQL Verification:** The primary verification involved re-running CodeQL scans to confirm that the identified vulnerabilities (SQL Injection, Log Injection, Unvalidated Input) were no longer reported after the changes.
*   **Unit/Integration Testing for Validation:** We verified the `InvalidateCacheSchema` in `admin.routes.ts` by sending requests with valid and invalid payloads to the `/cache/invalidate` endpoint. This confirmed that valid requests proceed correctly and invalid requests are rejected with a `400 Bad Request` status.
*   **Manual Cache Invalidation Testing:** We manually tested the `/cache/invalidate` endpoint with valid `drugIds` and `batchNumbers` to ensure that cache invalidation functionality remained intact and performed as expected.
*   **Log Output Inspection:** We performed manual inspection of log outputs generated by `cache.service.ts` and `drugLookup.service.ts` after processing inputs containing newline characters. This confirmed that the `batchNumber.replace(/[\r\n]/g, "")` sanitization successfully removed these characters, preventing log injection.
*   **Database Query Logging:** For the `warmCache` function, database query logs were inspected to confirm that the Supabase client was issuing parameterized queries for the `.in()` clauses, rather than insecure string-interpolated queries.