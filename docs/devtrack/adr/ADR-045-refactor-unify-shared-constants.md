# ADR — Refactor/unify shared constants

> **Date:** 2026-07-04 | **PR:** #3186 | **Status:** Accepted

## Context

The SahiDawa monorepo workspace configuration defined `packages/*` as a workspace path, but the `@sahidawa/shared` package did not exist in the codebase. Consequently, configuration limits and business logic constants were duplicated across `apps/web` and `apps/api`. 

This duplication led to validation drift. Specifically, the frontend interaction checker allowed users to select up to 50 medicines, whereas the backend API's Zod schema and route handler capped requests at 20. This mismatch caused client-side validation to pass for inputs containing 21–50 medicines, which then silently failed with a `400 Bad Request` on the server. Additionally, the bulk upload limit of 500 items was hardcoded as numeric literals across multiple files in both the frontend and backend.

## Decision

We bootstrapped the `@sahidawa/shared` workspace package and migrated shared numeric limits into it. Specifically:

1. Created `@sahidawa/shared` with a dedicated `package.json` and `tsconfig.json`.
2. Defined and exported unified constants in `packages/shared/src/limits.ts`:
   - `MAX_INTERACTION_MEDICINES = 50` (standardized to the higher frontend limit to resolve the validation mismatch).
   - `MAX_BULK_UPLOAD_ITEMS = 500` (replacing hardcoded literals).
3. Refactored `apps/api` and `apps/web` to import these constants from `@sahidawa/shared`.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Maintain duplicate constants with sync checks** | Error-prone and fails to leverage the monorepo structure. Does not prevent future validation drift as the team scales. |
| **Fetch limits dynamically via a runtime config API** | Introduces unnecessary network latency and runtime overhead for static limits. Prevents compile-time validation in Zod schemas and TypeScript types. |

## Consequences

**Positive:**
- Eliminated client/server validation drift by establishing a single source of truth for application limits.
- Resolved the interaction checker bug, allowing users to successfully check 21–50 medicines.
- Established the foundation of the `@sahidawa/shared` package, enabling future sharing of types, schemas, and utility functions.

**Trade-offs:**
- Increased build pipeline complexity, as `@sahidawa/shared` must now be built before compiling dependent applications.
- Increasing the pairwise interaction check limit from 20 to 50 increases the maximum computational load per request on the API.

## Related Issues & PRs

- PR #3186: Refactor/unify shared constants