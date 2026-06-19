# ADR — security(api): enforce authentication on pharmacy registration endpoi…

> **Date:** 2026-06-19 | **PR:** #2061 | **Status:** Accepted

## Context

The `POST /api/pharmacies` endpoint, responsible for registering new pharmacy entities, lacked authentication. This exposed a critical security vulnerability, allowing any unauthenticated actor to create pharmacy records within the system. Additionally, there was no mechanism to track which authenticated user initiated the creation of a pharmacy record, hindering auditability and accountability.

## Decision

Mandatory authentication was implemented for the `POST /api/pharmacies` endpoint. This was achieved by integrating the `requireAuth` middleware into the route handler. Concurrently, the `pharmacies` database table was extended with a `created_by` column, defined as a UUID referencing `auth.users(id)`. During pharmacy registration, the authenticated user's ID (`req.user.id`) is now captured and stored in this `created_by` column. An explicit type guard and check for `req.user` presence were added to ensure robust handling of unauthorized requests and safe property access.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Implement role-based authorization | While offering more granular control, the immediate priority was establishing basic user authentication. Introducing role-based authorization would have added significant complexity to the middleware and user management system, which was beyond the scope of this critical security fix. |
| Utilize IP whitelisting or rate limiting | These measures provide network-level security and can mitigate certain types of abuse (e.g., DoS, brute-force). However, they do not verify user identity or provide accountability for data creation. Authentication was deemed essential for establishing trust and linking actions to specific users. |

## Consequences

**Positive:**
- Enhanced security posture by preventing unauthorized creation of pharmacy records.
- Improved data integrity and auditability by linking each pharmacy record to its creating user.
- Established a clear API contract requiring authenticated requests for pharmacy registration.

**Trade-offs:**
- Increased complexity for client applications, which must now manage and provide authentication tokens for this endpoint.
- Required a database schema migration to add the `created_by` column, necessitating careful deployment procedures.

## Related Issues & PRs

- PR #2061: security(api): enforce authentication on pharmacy registration endpoi…
- Issue #1565