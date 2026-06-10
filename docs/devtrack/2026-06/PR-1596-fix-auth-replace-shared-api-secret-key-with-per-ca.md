# PR #1596 — fix(auth): replace shared API_SECRET_KEY with per-caller database-backed API keys

> **Merged:** 2026-06-10 | **Author:** @Pcmhacker-piro | **Area:** Backend | **Impact Score:** 36 | **Closes:** #1568

## What Changed

We have replaced the single, shared `API_SECRET_KEY` environment variable used for authenticating the `/api/v1/alerts/ingest` endpoint with a more robust, per-caller API key system. This change introduces a new `api_keys` database table to store hashed API keys and their associated metadata, along with a dedicated Express middleware for authentication and audit logging.

## The Problem Being Solved

Previously, our `/api/v1/alerts/ingest` endpoint relied on a single static `API_SECRET_KEY` environment variable for authentication. This approach presented significant security and operational challenges:
1.  **Zero Caller Identity Tracking:** All external systems (e.g., ML agents) ingesting alerts used the same secret, making it impossible to identify the specific caller in logs or audit trails.
2.  **No Granular Revocation:** If the `API_SECRET_KEY` was compromised, the only way to revoke access was to change the key, which would immediately invalidate access for *all* legitimate callers, requiring a coordinated update across all integrated systems.
3.  **Lack of Audit Trail:** There was no mechanism to track when an API key was last used or by whom, hindering security monitoring and compliance efforts.
4.  **Security Vulnerability:** A leaked `API_SECRET_KEY` allowed any malicious actor to impersonate the alert ingestion system without any forensic trace.

## Files Modified

- `apps/api/src/middleware/apiKeyAuth.ts`
- `apps/api/src/routes/alerts.ts`
- `apps/api/tests/alertsPagination.test.ts`
- `apps/api/tests/setup.ts`
- `supabase/migrations/20260609000000_create_api_keys_table.sql`
- `supabase/migrations/20260609000001_add_rls_api_keys.sql`

## Implementation Details

This feature was implemented by introducing a new database table, a dedicated Express middleware, and updating the target API route.

1.  **Database Schema (`supabase/migrations/20260609000000_create_api_keys_table.sql`):**
    *   We created a new table `api_keys` with the following columns:
        *   `id` (UUID, primary key, default `gen_random_uuid()`): Unique identifier for each API key entry.
        *   `created_at` (TIMESTAMP WITH TIME ZONE, default `now()`): Timestamp of key creation.
        *   `key_hash` (TEXT, UNIQUE, NOT NULL): Stores the PBKDF2 (SHA-512) hash of the API key. This ensures the plaintext key is never stored, enhancing security.
        *   `caller_name` (TEXT, NOT NULL): A human-readable name identifying the system or user associated with the key (e.g., "ML Agent for CDSCO Alerts").
        *   `scopes` (TEXT[], default `'{alerts:ingest}'`): An array of strings defining the permissions granted to this key. This allows for future expansion to support fine-grained access control.
        *   `is_active` (BOOLEAN, default `TRUE`, NOT NULL): A flag to enable or disable the key. Setting this to `FALSE` effectively revokes the key without deleting its record.
        *   `last_used_at` (TIMESTAMP WITH TIME ZONE): Timestamp of the last successful authentication using this key, useful for auditing and identifying stale keys.

2.  **Row-Level Security (`supabase/migrations/20260609000001_add_rls_api_keys.sql`):**
    *   We enabled Row-Level Security (RLS) on the `api_keys` table.
    *   A policy named `api_keys_service_role_access` was created, granting `SELECT`, `INSERT`, `UPDATE`, and `DELETE` permissions on the `api_keys` table exclusively to the `service_role` user. This ensures that only our backend API, operating with the `SUPABASE_SERVICE_ROLE_KEY`, can manage and query API keys, preventing unauthorized access from client-side applications or other database users.

3.  **API Key Authentication Middleware (`apps/api/src/middleware/apiKeyAuth.ts`):**
    *   We introduced `requireApiKey`, an asynchronous Express middleware function.
    *   It expects the API key to be provided in the `x-api-secret` HTTP header.
    *   Upon receiving a request, it performs the following steps:
        *   **Header Check:** If `x-api-secret` is missing, it responds with a `401 Unauthorized` and "Missing API key".
        *   **Key Hashing:** The received plaintext API key is hashed using `crypto.pbkdf2Sync`. The parameters used are: `apiKey` (the plaintext key), `salt` ("sahidawa-api-key-v1"), `iterations` (100000), `keylen` (64 bytes), and `digest` ("sha512"). The result is converted to a hexadecimal string. This matches the hashing algorithm used when storing the `key_hash` in the database.
        *   **Database Lookup:** It queries the `api_keys` table using `supabase.from("api_keys").select("id, caller_name, scopes, is_active").eq("key_hash", keyHash).maybeSingle()`.
        *   **Validation:**
            *   If a database error occurs during lookup, it logs the error using `logger.error` and returns a `500 Internal Server Error`.
            *   If no matching key is found or the found key has `is_active: false`, it responds with a `401 Unauthorized` and "Invalid or inactive API key".
        *   **Last Used Update:** If the key is valid and active, it asynchronously updates the `last_used_at` column for the corresponding key in the `api_keys` table using `supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id)`. This is a fire-and-forget operation, meaning the authentication flow doesn't wait for this update to complete, ensuring minimal latency. Any errors during this update are logged as warnings using `logger.warn`.
        *   **Request Augmentation:** The `caller_name`, `scopes`, and `id` (as `keyId`) from the database are attached to the request object as `req.apiKey` (of type `ApiKeyInfo`), making this information available to subsequent middleware and route handlers.
        *   **Audit Logging:** A successful authentication is logged using `logger.info("Authenticated API request", { caller: data.caller_name })`.
        *   **Continuation:** Calls `next()` to pass control to the next middleware or route handler.

4.  **Alert Ingestion Route Update (`apps/api/src/routes/alerts.ts`):**
    *   The `alertsRouter.post("/ingest", ...)` endpoint was modified.
    *   The previous manual check for `process.env.API_SECRET_KEY` and `req.headers["x-api-secret"]` was entirely removed.
    *   The `requireApiKey` middleware was inserted into the route definition: `alertsRouter.post("/ingest", requireApiKey, async (req: ApiKeyRequest, res: Response) => { ... })`.
    *   The `req` object type was updated to `ApiKeyRequest` to reflect the `req.apiKey` property added by the middleware.
    *   All `console.error` calls within this route and the `alertsRouter.get("/")` route were replaced with structured logging using `logger.error`.
    *   Audit logging was enhanced by including the `caller: req.apiKey?.callerName` in the `logger.info` message upon successful alert ingestion.

## Technical Decisions

1.  **Database-Backed Keys:** We chose a database-backed approach over other methods (e.g., signed tokens, external identity providers) for API keys primarily to enable granular control and easy revocation. Storing keys in the database allows us to activate/deactivate individual keys, track usage, and associate metadata (like `caller_name` and `scopes`) directly with each key, which was the core requirement for addressing the root cause.
2.  **PBKDF2 for Hashing:** Initially, SHA-256 was considered for hashing API keys. However, a subsequent commit (prompted by CodeQL analysis, as indicated by the commit message "fix: use PBKDF2 instead of SHA-256 for API key hashing (CodeQL)") changed this to PBKDF2 (Password-Based Key Derivation Function 2) with SHA-512 as the underlying hash function. PBKDF2 is a key derivation function designed to make brute-force attacks more computationally expensive by requiring a large number of iterations and a salt. This significantly increases the security of stored key hashes compared to simple cryptographic hashes like SHA-256, even when a unique salt is not stored per key (we use a global salt "sahidawa-api-key-v1" for simplicity, which is acceptable for API keys where the key itself is the secret, unlike user passwords). The high iteration count (100,000) further strengthens this defense.
3.  **`x-api-secret` Header:** We opted for a custom `x-api-secret` header for API key transmission. This is a common and straightforward pattern for API key authentication, avoiding potential conflicts with standard `Authorization` headers if other authentication schemes (like OAuth) were to be introduced later for different endpoints.
4.  **`maybeSingle()` for Lookup:** The `maybeSingle()` method from the Supabase client was chosen for database lookup. This method is ideal when expecting at most one row, returning `null` for `data` if no row is found, which simplifies the conditional logic for checking key existence.
5.  **Asynchronous `last_used_at` Update:** The update to `last_used_at` is performed asynchronously using `.then()` without `await`. This was a deliberate choice to ensure that the authentication process itself is not blocked by the database write operation for updating the timestamp. While a failure to update `last_used_at` is logged as a warning, it does not prevent the request from proceeding, maintaining low latency for critical ingestion endpoints.
6.  **Structured Logging:** Replacing `console.error` with `logger.error` and `logger.info` throughout the `alerts.ts` route aligns with our standard practice for structured logging. This allows for easier parsing, filtering, and analysis of logs, especially when integrating with external logging systems, and provides richer context (like `caller` information) for debugging and auditing.

## How To Re-Implement (Contributor Reference)

To re-implement a similar per-caller API key authentication system:

1.  **Database Schema Definition:**
    *   Create a new SQL migration file (e.g., `supabase/migrations/YYYYMMDDHHMMSS_create_api_keys_table.sql`).
    *   Define the `api_keys` table with columns for `id` (UUID, PK), `created_at`, `key_hash` (TEXT, UNIQUE, NOT NULL), `caller_name` (TEXT, NOT NULL), `scopes` (TEXT[]), `is_active` (BOOLEAN), and `last_used_at` (TIMESTAMP WITH TIME ZONE).
    *   Example `key_hash` generation (for initial key creation, not part of this PR but essential for setup):
        ```typescript
        import crypto from 'crypto';
        const generateApiKey = () => crypto.randomBytes(32).toString('hex'); // Example: 64-char hex key
        const hashApiKey = (apiKey: string) => crypto
            .pbkdf2Sync(apiKey, "sahidawa-api-key-v1", 100000, 64, "sha512")
            .toString("hex");
        // Store hashApiKey(generatedKey) in the database.
        ```

2.  **Row-Level Security (RLS) Policy:**
    *   Create another SQL migration file (e.g., `supabase/migrations/YYYYMMDDHHMMSS_add_rls_api_keys.sql`).
    *   Enable RLS on the `api_keys` table: `ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;`
    *   Create a policy to grant `SELECT`, `INSERT`, `UPDATE`, `DELETE` permissions to the `service_role` only:
        ```sql
        CREATE POLICY "api_keys_service_role_access"
        ON public.api_keys
        FOR ALL
        TO service_role
        USING (true) WITH CHECK (true);
        ```

3.  **Create Authentication Middleware:**
    *   Create a new TypeScript file (e.g., `apps/api/src/middleware/apiKeyAuth.ts`).
    *   Define an interface for `ApiKeyInfo` and extend `Request` for `ApiKeyRequest` to carry authenticated key details.
    *   Implement the `requireApiKey` middleware function as detailed in the "Implementation Details" section, handling header extraction, PBKDF2 hashing, Supabase lookup (`select().eq().maybeSingle()`), validation, asynchronous `last_used_at` updates, request augmentation (`req.apiKey`), and structured logging.

4.  **Integrate Middleware into Routes:**
    *   Import `requireApiKey` and `ApiKeyRequest` into the target route file (e.g., `apps/api/src/routes/alerts.ts`).
    *   Apply the middleware to the desired endpoint:
        ```typescript
        import { requireApiKey, ApiKeyRequest } from "../middleware/apiKeyAuth";
        import logger from "../utils/logger";

        // ... other imports and route setup ...

        alertsRouter.post("/ingest", requireApiKey, async (req: ApiKeyRequest, res: Response) => {
            // Now req.apiKey is available here, e.g., req.apiKey?.callerName
            logger.info("Alerts ingested successfully", { caller: req.apiKey?.callerName, count: alerts?.length });
            // ... rest of your route logic ...
        });
        ```
    *   Replace any `console.error` with `logger.error` for consistent structured logging.

5.  **Update Test Environment:**
    *   Modify `apps/api/tests/setup.ts` to remove any environment variables related to the old authentication method (e.g., `process.env.API_SECRET_KEY`).
    *   Update `jest.mock("../src/db/client", ...)` in test files (e.g., `apps/api/tests/alertsPagination.test.ts`) to include mocks for `eq`, `maybeSingle`, `insert`, `update`, and `then` to properly simulate Supabase interactions required by the new middleware.
    *   Add specific test cases for the new authentication flow: missing header, invalid key, inactive key, database errors during key lookup, and successful authentication.

## Impact on System Architecture

This change significantly enhances the security posture and operational capabilities of the SahiDawa platform, particularly for critical ingestion endpoints.

1.  **Improved Security:** By moving from a shared static secret to per-caller, database-backed API keys, we eliminate a single point of failure. A compromise of one key no longer affects all integrated systems, and individual keys can be revoked instantly by setting `is_active` to `false`. The use of PBKDF2 for hashing further protects against brute-force attacks on stored key hashes.
2.  **Enhanced Auditability and Forensics:** The `caller_name` associated with each key, combined with the `last_used_at` timestamp and structured audit logs (which now include the caller identity), provides a clear trail of who accessed the system and when. This is crucial for security monitoring, compliance, and incident response.
3.  **Scalability and Granular Control:** The `scopes` array in the `api_keys` table lays the groundwork for implementing more fine-grained access control in the future. As SahiDawa grows and integrates with more external services, we can assign specific permissions to each API key, limiting its capabilities to only what is necessary.
4.  **Decoupling Configuration:** API key management is now decoupled from environment variables and deployment cycles. New keys can be provisioned and existing ones managed directly through the database (or an administrative interface built on top of it) without requiring application redeployments.
5.  **Standardized Authentication Pattern:** The introduction of a dedicated `apiKeyAuth` middleware establishes a reusable and consistent pattern for API key authentication across other endpoints if needed, promoting cleaner code and easier maintenance.

## Testing & Verification

The changes were thoroughly tested to ensure both functionality and security.

1.  **Unit/Integration Tests:**
    *   **New Test Cases:** Four specific test cases were added within `apps/api/tests/alertsPagination.test.ts` under the `POST /api/v1/alerts/ingest — API key authentication` suite:
        *   Returns `401` when the `x-api-secret` header is missing.
        *   Returns `401` when the provided API key is invalid (i.e., no matching hash found in the mocked database).
        *   Returns `500` when a database error occurs during the API key lookup.
        *   Returns `400` when the payload is invalid, ensuring that authentication passes but subsequent validation fails correctly.
    *   **Supabase Mocking:** The `jest.mock("../src/db/client", ...)` in `apps/api/tests/alertsPagination.test.ts` was significantly expanded. It now correctly mocks `supabase.from().select().eq().maybeSingle()`, `supabase.from().update().eq().then()`, and `supabase.from().insert()` to simulate the database interactions of the new middleware and route. This includes mocking the `then` method to handle the asynchronous `last_used_at` update.
    *   **Existing Test Coverage:** All 127 existing API tests and 237 web tests passed, confirming that the changes did not introduce regressions or break existing functionality.
    *   **Environment Variable Removal:** The `process.env.API_SECRET_KEY` was removed from `apps/api/tests/setup.ts`, ensuring that tests correctly rely on the new database-backed authentication.

2.  **Edge Cases:**
    *   **Inactive Keys:** The `is_active` flag in the `api_keys` table is explicitly checked, ensuring that deactivated keys cannot be used for authentication.
    *   **Database Errors:** The middleware includes `try...catch` blocks and checks for `error` objects from Supabase queries, gracefully handling database lookup failures by returning a `500 Internal Server Error` and logging the issue.
    *   **Hashing Algorithm Robustness:** The use of PBKDF2 with a high iteration count and SHA-512 digest protects against brute-force attacks on the stored `key_hash`.
    *   **Concurrent Updates:** The `last_used_at` update is fire-and-forget, which is robust to concurrent requests using the same key, as the exact timing of the update is not critical for authentication success.
    *   **Missing `caller_name` or `scopes`:** The database schema defines `caller_name` as `NOT NULL`, and `scopes` has a default, ensuring these critical fields are always present.