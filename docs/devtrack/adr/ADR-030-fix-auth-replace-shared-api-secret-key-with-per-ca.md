# ADR — fix(auth): replace shared API_SECRET_KEY with per-caller database-backed API keys

> **Date:** 2026-06-10 | **PR:** #1596 | **Status:** Accepted

## Context

The `/api/v1/alerts/ingest` endpoint relied on a single, shared `API_SECRET_KEY` environment variable for authentication. This approach presented significant security and operational deficiencies:
- Lack of caller identity tracking, preventing forensic analysis.
- Inability to revoke a single compromised key without affecting all other legitimate callers.
- Absence of an audit trail for API access.
- A missing `API_SECRET_KEY` could lead to server configuration errors.

## Decision

The system transitioned from a single shared `API_SECRET_KEY` to a database-backed, per-caller API key authentication mechanism. This was implemented by:
1.  Introducing a new `api_keys` table in Supabase, storing `key_hash` (derived using PBKDF2 with a salt), `caller_name`, `scopes`, `is_active`, and `last_used_at`.
2.  Applying Row Level Security (RLS) to the `api_keys` table, restricting access to the `service_role` only.
3.  Developing a new `apiKeyAuth` middleware (`apps/api/src/middleware/apiKeyAuth.ts`) that:
    -   Extracts the API key from the `x-api-secret` request header.
    -   Hashes the provided key using PBKDF2 (sha512, 100,000 iterations, 64-byte key length).
    -   Performs a database lookup against the `api_keys` table using the generated hash.
    -   Validates key existence and `is_active` status.
    -   Updates the `last_used_at` timestamp for successful authentications.
    -   Attaches `keyId`, `callerName`, and `scopes` to the request object for subsequent use (e.g., audit logging).
    -   Returns 401 for missing, invalid, or inactive keys, and 500 for internal errors.
4.  Modifying the `/api/v1/alerts/ingest` route (`apps/api/src/routes/alerts.ts`) to integrate the `requireApiKey` middleware, replacing the previous static `API_SECRET_KEY` check.
5.  Implementing structured `logger.error` calls with caller identity for improved observability.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Continue with a single shared `API_SECRET_KEY` | Rejected due to critical security vulnerabilities: no caller identity, no granular revocation, and no audit trail. |
| Implement JWT-based authentication | Rejected as it would introduce additional complexity for token issuance, refresh, and revocation mechanisms (e.g., blocklists) for an internal API ingestion endpoint. A direct database lookup for API keys was deemed simpler and more appropriate for this specific use case. |
| IP Whitelisting | Rejected because it lacks flexibility for callers with dynamic IP addresses or those operating from shared network infrastructure, and does not provide caller identity. |

## Consequences

**Positive:**
- Enhanced security posture by enabling individual API key revocation without impacting other callers.
- Improved auditability and forensic capabilities through explicit caller identity tracking for each API request.
- Granular control over API access via `is_active` status and defined `scopes`.
- Increased system resilience by preventing server crashes due to a missing `API_SECRET_KEY` environment variable.

**Trade-offs:**
- Increased database load due to a lookup on the `api_keys` table for every authenticated API request.
- Added operational complexity for API key generation, distribution, and lifecycle management (e.g., requiring a UI or administrative process for key creation/revocation).
- Increased code complexity with the introduction of new middleware and database interaction logic.

## Related Issues & PRs

- PR #1596: fix(auth): replace shared API_SECRET_KEY with per-caller database-backed API keys
- Issue #1568