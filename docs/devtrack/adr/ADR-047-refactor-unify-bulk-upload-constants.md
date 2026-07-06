# ADR — refactor: unify bulk upload constants

> **Date:** 2026-07-06 | **PR:** #3053 | **Status:** Accepted

## Context

The SahiDawa pharmacy inventory bulk-upload feature lacked unified validation constraints between the frontend and backend. File size limits and row limits were either duplicated or independently defined across the API (`apps/api`) and web (`apps/web`) applications. This divergence introduced several risks:
- Poor user experience, where the frontend might accept a large file only for the backend to reject it or fail during processing.
- Security vulnerabilities, such as Denial of Service (DoS) through memory exhaustion, if the API accepted excessively large payloads before validation.
- Increased maintenance overhead and risk of configuration drift when updating system limits.

## Decision

We centralized the bulk upload validation constraints into the monorepo's shared workspace package (`@sahidawa/shared`). 

Specifically, we:
1. Defined `MAX_BULK_UPLOAD_FILE_SIZE_BYTES` (set to 1MB) and unified `MAX_BULK_UPLOAD_ITEMS` (set to 500) within `packages/shared/src/limits.ts`.
2. Updated the backend API routes (`apps/api/src/routes/pharmacies.ts`) to configure the `multer` middleware with the shared `MAX_BULK_UPLOAD_FILE_SIZE_BYTES` limit, rejecting oversized payloads at the network ingress point.
3. Updated the frontend bulk-upload page (`apps/web/app/[locale]/(dashboard)/pharmacy/inventory/bulk-upload/page.tsx`) to validate file sizes against the shared constant in both the drag-and-drop and file-picker upload paths before initiating any API requests.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Environment-Variable-Driven Limits** | Rejected because managing limits via runtime environment variables (e.g., `NEXT_PUBLIC_MAX_FILE_SIZE` and `API_MAX_FILE_SIZE`) introduces configuration overhead and increases the risk of drift if variables are misconfigured in production environments. |
| **Dynamic Configuration API Endpoint** | Rejected because querying validation limits dynamically from a backend endpoint on frontend initialization adds unnecessary network latency and complexity for static limits that can be resolved at build time. |

## Consequences

**Positive:**
- **Single Source of Truth:** Eliminates configuration drift by defining upload limits in a single shared file.
- **Improved Security:** Enforces strict file-size limits at the API gateway/middleware level using Multer, preventing memory exhaustion attacks.
- **Optimized Bandwidth:** Prevents wasted network bandwidth by failing fast on the client side before an oversized file is transmitted.

**Trade-offs:**
- **Deployment Coupling:** Changes to shared limits require rebuilding and redeploying both the frontend and backend applications to maintain alignment.

## Related Issues & PRs

- PR #3053: refactor: unify bulk upload constants
- Issue #2700