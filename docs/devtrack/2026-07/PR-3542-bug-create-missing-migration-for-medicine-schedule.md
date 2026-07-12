# PR #3542 — [Bug] Create missing migration for medicine_schedules table

> **Merged:** 2026-07-12 | **Author:** @HarshiVarshney | **Area:** Backend | **Impact Score:** 6 | **Closes:** #3101

## What Changed

We updated our central database schema file `apps/api/src/db/schema.sql` to include the definition of the `medicine_schedules` table and its associated indexes. This change synchronizes our static schema definition with the existing Supabase migration history, specifically matching the structure defined in `supabase/migrations/20260609000003_create_medicine_schedules.sql`. No new database migrations were introduced, as the table was already present in the migration history but omitted from the consolidated schema file.

## The Problem Being Solved

In our development workflow, we maintain a dual-source-of-truth for our database schema. Supabase migrations (located in `supabase/migrations/`) are used to apply incremental changes to live environments, while `apps/api/src/db/schema.sql` serves as the master blueprint for spinning up local development environments, running integration tests, and generating TypeScript types. 

Prior to this PR, the `medicine_schedules` table was successfully created in the Supabase migration history but was completely missing from `apps/api/src/db/schema.sql`. This discrepancy caused local database initializations and CI/CD test suites to spin up without the `medicine_schedules` table, resulting in database relation errors when backend services attempted to query or write scheduling data.

## Files Modified

- `apps/api/src/db/schema.sql`

## Implementation Details

We appended the SQL definition for the `medicine_schedules` table and its indexes to `apps/api/src/db/schema.sql`. The implementation mirrors the existing Supabase migration:

### 1. Table Definition (`public.medicine_schedules`)
- **`id`**: A `UUID` primary key that defaults to a randomly generated UUID using `gen_random_uuid()`.
- **`user_id`**: A `UUID` foreign key referencing `auth.users(id)` with `ON DELETE CASCADE`. This ensures that if a user deletes their account, all associated medicine schedules are automatically purged from our system.
- **`medicine_id`**: An optional `UUID` foreign key referencing `public.medicines(id)` with `ON DELETE SET NULL`. This allows us to link schedules to verified medicines in our database while ensuring that if a medicine record is deleted, the user's schedule remains intact.
- **`medicine_name`**: A `TEXT` field to store the name of the medicine. This acts as a fallback or direct entry when `medicine_id` is null.
- **`dosage`**: A `TEXT` field defaulting to `'1 tablet'`.
- **`frequency`**: An `INTEGER` field representing how often the medicine should be taken, backed by a check constraint `CHECK (frequency > 0)` to prevent invalid zero or negative frequencies.
- **`times`**: A `JSONB` column defaulting to an empty array literal `'[]'::jsonb` to store specific times of day (e.g., `["08:00", "20:00"]`).
- **`start_date`** & **`end_date`**: `DATE` fields defining the active window of the schedule.
- **`notes`**: An optional `TEXT` field for user-specific instructions.
- **`is_active`**: A `BOOLEAN` flag defaulting to `TRUE` to easily toggle schedules.
- **`created_at`** & **`updated_at`**: Standard timestamp fields defaulting to `NOW()`.

### 2. Performance Indexes
- **`idx_medicine_schedules_user_id`**: A standard B-Tree index on `user_id` to optimize user-specific schedule lookups.
- **`idx_medicine_schedules_active`**: A partial B-Tree index on `is_active` filtered by `WHERE is_active = TRUE`. This optimizes queries that fetch only active schedules for push notifications and daily reminders, reducing index size and lookup times.

## Technical Decisions

### Why No New Migration File Was Created
We explicitly decided not to generate a new Supabase migration file (e.g., `supabase/migrations/20260712xxxxxx_create_medicine_schedules.sql`). Because the table was already defined in an earlier migration (`20260609000003_create_medicine_schedules.sql`), adding a new migration to create the same table would cause deployment failures on production and staging environments where the table already exists. The correct approach was to retroactively update the static `schema.sql` file to align with the active migration state.

### JSONB for Time Tracking
We chose `JSONB` for the `times` field instead of a separate relation table. Since the times of day a user takes medication are highly static and small in size (typically 1 to 4 text strings like `"09:00"`), using `JSONB` avoids unnecessary table joins and simplifies payload serialization in our API layer.

### Partial Indexing
We implemented a partial index on `is_active = TRUE`. In our system, inactive schedules (historical data) will grow indefinitely, while active schedules remain relatively constant. Indexing only active rows keeps the index small, highly cacheable, and extremely fast for our notification workers.

## How To Re-Implement (Contributor Reference)

If you need to synchronize a missing table from migrations into `apps/api/src/db/schema.sql` in the future, follow these steps:

1. Locate the migration file that introduced the table in `supabase/migrations/`.
2. Open `apps/api/src/db/schema.sql` and navigate to the bottom of the file.
3. Add a commented section header matching the sequential numbering of the schema (e.g., `-- 11. Medicine Schedules`).
4. Copy the exact `CREATE TABLE IF NOT EXISTS` statement and any associated `CREATE INDEX IF NOT EXISTS` statements from the migration file.
5. Ensure that any foreign key references to external schemas (like `auth.users`) are fully qualified.
6. Verify that there is no trailing newline issue at the end of `schema.sql`.
7. Run your local database initialization script to ensure the schema compiles without syntax errors:
   ```bash
   npm run db:import-schema # Or the equivalent local schema validation command
   ```

## Impact on System Architecture

This change restores the integrity of our local development environment setup. Developers spinning up the SahiDawa backend locally for the first time will now have the `medicine_schedules` table created automatically. This unblocks the development of medicine adherence tracking, push notification workers, and patient dashboard APIs that rely on querying user schedules.

## Testing & Verification

Not documented in this PR.