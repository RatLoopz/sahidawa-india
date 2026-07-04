# ADR — fix(db): align medicine search functions with current schema

> **Date:** 2026-07-04 | **PR:** #3009 | **Status:** Accepted

## Context

The SahiDawa platform utilizes PostgreSQL (via Supabase) with `pgvector` and `pg_trgm` for semantic and text-based medicine search. During a prior database refactoring, the columns `strength`, `dosage_form`, and `schedule` were removed from the `public.medicines` table schema. 

However, the database Remote Procedure Calls (RPCs)—specifically `match_medicines` and related search functions—were not updated. They continued to reference and attempt to return these non-existent columns. This schema mismatch caused PostgREST runtime failures (HTTP 500) during semantic retrieval, completely blocking the Retrieval-Augmented Generation (RAG) pipeline.

## Decision

We updated the database migration files to align all medicine search and retrieval functions with the current `public.medicines` schema. Specifically, we:
- Modified `supabase/migrations/20260606000000_add_medicine_rag.sql`, `supabase/migrations/20260627010000_fix_search_medicines_text_trgm_usage.sql`, and `supabase/migrations/20260628160000_add_composition_trgm_index.sql`.
- Removed `strength`, `dosage_form`, and `schedule` from the `RETURNS TABLE` definitions of the SQL functions.
- Removed the corresponding column selections from the internal `SELECT` statements.
- Preserved the existing pgvector cosine distance calculation (`1 - (m.embedding <=> query_embedding)`) and trigram-based similarity logic.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Re-add the missing columns (`strength`, `dosage_form`, `schedule`) to the `public.medicines` table | Rejected because it would revert intentional schema normalization decisions. Re-introducing these columns to the main table solely to satisfy outdated RPC signatures would introduce schema rot and duplicate data. |
| Implement dynamic SQL or view-based abstraction to handle missing columns | Rejected because it introduces unnecessary runtime overhead and complexity to the database layer. Direct alignment of RPC signatures with the physical schema is cleaner, more performant, and ensures strict type safety. |

## Consequences

**Positive:**
- Restored the functionality of the semantic and trigram search pipelines, resolving PostgREST runtime errors.
- Ensured strict schema alignment and type safety between database tables and RPC interfaces.
- Maintained the performance of pgvector and trigram-based indexing without introducing query overhead.

**Trade-offs:**
- Downstream consumers (such as the frontend or LLM orchestration layers) can no longer access `strength`, `dosage_form`, or `schedule` directly from the search result payload. These attributes must now be parsed from the `composition` field or resolved through other schema-compliant relations.

## Related Issues & PRs

- PR #3009: fix(db): align medicine search functions with current schema
- Issue #3008