# PR #3219 — Feat : Create database migration for api_keys table#3099

> **Merged:** 2026-07-06 | **Author:** @hrx01-dev | **Area:** Backend | **Impact Score:** 23 | **Closes:** #3099

## What Changed

We introduced a database migration that restructures our API key management system to be secure, time-bound, and tied directly to individual user accounts. We replaced the legacy, unassociated API key structure with a new `public.api_keys` table secured by Row Level Security (RLS) and indexed for fast lookups. Additionally, we refactored our Express API key authentication middleware (`apiKeyAuth.ts`) to enforce time-based expiration checks and map requests to a specific `user_id` instead of a generic caller name.

## The Problem Being Solved

Before this PR, our API key implementation was insecure and lacked proper user association. It relied on a generic `caller_name` text field rather than a direct foreign key link to our central authentication system (`auth.users`), making it impossible to trace API requests back to specific users or enforce ownership. 

Furthermore, key expiration was managed via a manual, binary `is_active` boolean flag, which required active database updates to revoke keys. The database also lacked Row Level Security (RLS) for API keys, meaning any authenticated client could potentially query or manipulate keys belonging to other users. Finally, our PBKDF2 hashing logic in the Express backend requires a unique salt for cryptographic verification, which was not properly integrated into the database schema.

## Files Modified

- `apps/api/src/db/schema.sql`
- `apps/api/src/middleware/apiKeyAuth.ts`
- `supabase/migrations/20260704153000_create_api_keys_table.sql`

## Implementation Details

### 1. Database Schema & Migration
We created a new Supabase migration file `supabase/migrations/20260704153000_create_api_keys_table.sql` and appended the corresponding schema to our local `apps/api/src/db/schema.sql`. The migration drops any legacy `api_keys` table and creates a new one with the following structure:
- `id`: UUID (Primary Key, defaults to `gen_random_uuid()`)
- `user_id`: UUID (Foreign Key referencing Supabase's internal `auth.users(id)` with `ON DELETE CASCADE`)
- `key_hash`: TEXT (Stores the PBKDF2 hash of the API key)
- `key_salt`: TEXT (Stores the unique salt used during PBKDF2 hashing)
- `scopes`: TEXT[] (Array of authorized scopes, defaults to empty `{}`)
- `expires_at`: TIMESTAMPTZ (Nullable timestamp for key expiration)
- `created_at`: TIMESTAMPTZ (Defaults to `NOW()`)

We enabled Row Level Security (RLS) on this table and established a policy allowing authenticated users to manage (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) only their own API keys:
```sql
CREATE POLICY "Users can manage their own api keys"
ON public.api_keys
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```
An index `idx_api_keys_user_id` was also created on the `user_id` column to optimize query performance during authentication lookups.

### 2. Middleware Refactoring
We updated the `apiKeyAuth.ts` middleware to align with the new schema:
- **Interface Update:** We modified the `ApiKeyInfo` interface to replace `callerName: string` with `userId: string`.
- **Query Refactoring:** The Supabase query was updated to select `id, user_id, scopes, expires_at, key_hash, key_salt` instead of the legacy `caller_name` and `is_active` fields.
- **Expiration Validation:** We replaced the `is_active` check with a dynamic timestamp comparison:
  ```typescript
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
      res.status(401).json({ error: "API key has expired" });
      return;
  }
  ```
- **Context & Logging:** Upon successful PBKDF2 verification, the middleware attaches the `userId` to the request context (`req.apiKey`) and logs the authenticated request using the `userId` instead of the legacy caller name.

## Technical Decisions

- **Foreign Key to `auth.users` with Cascade Delete:** We chose to link API keys directly to Supabase's native authentication system. Using `ON DELETE CASCADE` ensures that if a user account is deleted, all associated API keys are automatically purged, preventing orphaned records and potential security leaks.
- **Time-based Expiration (`expires_at`) over Boolean (`is_active`):** Relying on a boolean flag requires a cron job or manual intervention to deactivate keys. By using a `TIMESTAMPTZ` column, we can set self-expiring keys (e.g., short-lived tokens for automated integrations) and validate them on-the-fly with a simple timestamp comparison.
- **Row Level Security (RLS):** This is critical for our multi-tenant architecture. By enforcing `auth.uid() = user_id` at the database layer, we guarantee that even if a bug is introduced in our application layer, users cannot view or modify other users' API keys.
- **Dedicated `key_salt` Column:** Since our Express backend uses PBKDF2 for key hashing, storing a unique salt alongside the hash is standard cryptographic practice to prevent rainbow table attacks.

## How To Re-Implement (Contributor Reference)

If you need to re-implement or extend this API key verification system, follow these steps:

1. **Database Migration Setup:**
   Create a SQL migration file that drops any existing `api_keys` table and defines the table with `user_id` referencing `auth.users(id)` and explicit columns for `key_hash`, `key_salt`, and `expires_at`.
2. **Enable RLS:**
   Always enable RLS on the table and write a policy restricting access to the owner:
   ```sql
   ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "manage_own_keys" ON public.api_keys FOR ALL TO authenticated USING (auth.uid() = user_id);
   ```
3. **Sync Local Schema:**
   Ensure that any changes made in the migration are appended to `apps/api/src/db/schema.sql` to keep local development environments in sync.
4. **Update Middleware Types:**
   In `apps/api/src/middleware/apiKeyAuth.ts`, ensure the `ApiKeyInfo` interface exposes `userId` instead of legacy identifiers.
5. **Implement Expiration and Cryptographic Checks:**
   - Query the database using the incoming API key's ID.
   - Verify that the key has not expired by comparing `expires_at` with the current system time.
   - Retrieve the `key_salt` and `key_hash` from the database.
   - Use Node's `crypto.pbkdf2` (promisified) to hash the incoming raw key with the retrieved salt, and compare the result with the stored `key_hash`.
   - Attach the validated `userId` and `scopes` to the request object (`req.apiKey`) and call `next()`.

## Impact on System Architecture

This change transitions SahiDawa's API authentication from a generic, hardcoded caller-based system to a secure, user-centric model. It lays the groundwork for secure external integrations, allowing third-party developers, clinics, and rural health partners to generate API keys tied directly to their SahiDawa user accounts. It also improves database hygiene and security compliance by automating key expiration and cascading deletions.

## Testing & Verification

- **Database Migration:** Verified by running the migration against a local Supabase instance, ensuring the table, index, and RLS policies are created correctly.
- **RLS Verification:** Tested that authenticated users can only query and insert their own API keys, and unauthorized attempts to access other users' keys are blocked by PostgreSQL.
- **Middleware Verification:** Tested the Express middleware with:
  - A valid, active API key (succeeds and populates `req.apiKey` with `userId`).
  - An expired API key (returns `401 API key has expired`).
  - A key with a missing or invalid salt (returns `401 Invalid API key`).
  - An invalid key signature (fails PBKDF2 verification).