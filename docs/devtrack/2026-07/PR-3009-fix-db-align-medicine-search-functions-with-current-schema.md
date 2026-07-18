# PR #3009 — fix(db): align medicine search functions with current schema

> **Merged:** 2026-07-04 | **Author:** @arushiranjan | **Area:** Database | **Impact Score:** 30 | **Closes:** #3008

## What Changed

We updated our database search functions and Remote Procedure Calls (RPCs) across three migration files to align with the current schema of the `public.medicines` table. Specifically, we removed all references to the non-existent columns `strength`, `dosage_form`, and `schedule` from both the `RETURNS TABLE` definitions and the internal `SELECT` statements of our search functions. This change ensures that our vector-based and trigram-based medicine retrieval queries execute successfully without throwing database schema mismatch errors.

## The Problem Being Solved

Before this PR, calling our medicine retrieval and RAG (Retrieval-Augmented Generation) services resulted in runtime failures. The database engine threw PostgREST errors because the stored procedures (such as `match_medicines`) were written to select and return `strength`, `dosage_form`, and `schedule` columns. However, these columns had been deprecated and removed from the underlying `public.medicines` table in previous schema iterations. Because of this schema drift, any attempt to perform semantic searches or similarity matches for medicine verification failed completely, blocking our rural health platform's core verification pipeline.

## Files Modified

- `supabase/migrations/20260606000000_add_medicine_rag.sql`
- `supabase/migrations/20260627010000_fix_search_medicines_text_trgm_usage.sql`
- `supabase/migrations/20260628160000_add_composition_trgm_index.sql`

## Implementation Details

We modified the SQL definitions of our medicine search functions across three historical migration files to ensure clean database initializations and migrations. 

In each of these files, the table-returning functions were redefined as follows:

1. **Return Type Modification**:
   We removed the following column declarations from the `RETURNS TABLE` signature:
   ```sql
   strength           VARCHAR(100),
   dosage_form        VARCHAR(100),
   schedule           VARCHAR(50),
   ```

2. **Query Selection Alignment**:
   Inside the `RETURN QUERY SELECT` block of the functions, we removed the corresponding column references from the target table `m` (aliased for `public.medicines`):
   ```sql
   m.strength,
   m.dosage_form,
   m.schedule,
   ```

3. **Preservation of Search Logic**:
   - In `20260606000000_add_medicine_rag.sql`, we preserved the pgvector cosine distance calculation:
     ```sql
     (1 - (m.embedding <=> query_embedding))::double precision AS similarity
     ```
   - In the trigram-based search migrations (`20260627010000_fix_search_medicines_text_trgm_usage.sql` and `20260628160000_add_composition_trgm_index.sql`), we preserved the text similarity logic that uses `similarity()` and `word_similarity()` functions to calculate the match score:
     ```sql
     GREATEST(
       similarity(m.name, query_text),
       similarity(m.generic_name, query_text),
       ...
     )
     ```

By keeping the core mathematical and text-matching logic intact while stripping out the deprecated columns, we restored the database's ability to compile and execute these RPCs.

## Technical Decisions

- **Modifying Existing Migrations**: Instead of writing a brand-new migration that drops and recreates the functions, we chose to modify the existing migration files directly. This ensures that new developers setting up their local SahiDawa environments or our CI/CD pipelines running fresh database seeds do not encounter schema mismatch errors during the initial migration run.
- **Strict Schema Adherence**: We decided against keeping these columns as nullable or dummy returns (e.g., returning `NULL AS strength`) because doing so would introduce technical debt and mislead downstream client-side applications into expecting data fields that our database no longer tracks.

## How To Re-Implement (Contributor Reference)

If you need to write or update a search function that queries the `public.medicines` table, follow these steps:

1. **Inspect the Current Schema**: Always verify the active columns in the `public.medicines` table before writing SQL functions. Do not assume fields like `strength` or `dosage_form` exist as standalone columns.
2. **Define the Return Signature**: Ensure your `RETURNS TABLE` statement matches the exact data types and order of the columns you plan to select:
   ```sql
   CREATE OR REPLACE FUNCTION match_medicines(
     query_embedding vector(1536),
     match_threshold double precision,
     match_count int
   )
   RETURNS TABLE (
     id UUID,
     name VARCHAR(255),
     generic_name VARCHAR(500),
     manufacturer VARCHAR(255),
     composition TEXT,
     mrp NUMERIC(10, 2),
     jan_aushadhi_price NUMERIC(10, 2),
     similarity DOUBLE PRECISION
   ) AS $$
   ...
   ```
3. **Write the Select Statement**: Ensure the `SELECT` block matches the return signature perfectly. If you add or remove a column from the `SELECT` statement, you must update the `RETURNS TABLE` block accordingly, or PostgreSQL will throw a runtime signature mismatch error.
4. **Handle Missing Data Gracefully**: If downstream services require dosage or strength information, they must parse it from the `composition` or `name` fields, or fetch it from updated relational tables rather than relying on the legacy flat columns in the `medicines` table.

## Impact on System Architecture

This fix directly restores the stability of SahiDawa's core verification pipeline. 
- **RAG Pipeline**: Our LLM-based RAG pipeline can now successfully query the database using semantic embeddings to find alternative medicines (such as lower-cost Jan Aushadhi generics).
- **API Layer**: PostgREST can now expose the `match_medicines` RPC without throwing internal server errors (HTTP 500), allowing our mobile and web clients to perform fast, reliable searches.

## Testing & Verification

We verified this fix by running the medicine retrieval service locally against a PostgreSQL instance running the updated migrations:
- **Before the Fix**: Calling the retrieval service triggered a PostgREST database error because the database engine could not find the `strength`, `dosage_form`, or `schedule` columns on the `medicines` table during function execution.
- **After the Fix**: The retrieval pipeline executed successfully. When queried against an empty local database, the RPC completed without errors and returned an empty array (`Retrieved medicines: []`) as expected, confirming that the database schema and the function signatures are once again in perfect alignment.