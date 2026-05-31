# ADR — Fixes - Moderator users can access admin UI but API rejects all admin actions with 403

> **Date:** 2026-05-31 | **PR:** Fixes - Moderator users can access admin UI but API rejects all admin actions with 403 | **Status:** Accepted

## Context

Moderator users were unable to perform their intended duties (reviewing reports, fetching medicines, updating report statuses) through the admin dashboard. Although the frontend UI and nested API routes within the admin section correctly allowed both "admin" and "moderator" roles, the top-level API route mount for `/api/v1/admin` in `apps/api/src/app.ts` was exclusively restricting access to the "admin" role. This inconsistency resulted in moderator users encountering 403 Forbidden errors for all admin API actions.

## Decision

The top-level API route mount for `/api/v1/admin` in `apps/api/src/app.ts` was updated to include both "admin" and "moderator" roles in its `requireRole` middleware. This change aligned the top-level API access policy with the existing frontend UI and nested API route permissions, resolving the access inconsistency.

```typescript
// Old: app.use("/api/v1/admin", requireAuth, requireRole("admin"), adminRoutes);
// New:
app.use("/api/v1/admin", requireAuth, requireRole("admin", "moderator"), adminRoutes);
```

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Restrict frontend UI and nested API routes to "admin" role only** | This would have been a functional regression, removing intended capabilities from moderator users and contradicting the platform's design for their role. It would also require significant refactoring of existing, correctly implemented permissions. |
| **Implement granular role checks within `adminRoutes` for each endpoint** | While possible, this would have introduced redundancy and complexity. The issue was a top-level block, not a lack of granular control within the `adminRoutes`. Moving the role check down would duplicate logic for every moderator-accessible endpoint, rather than fixing the overarching entry point. |
| **Create a separate `/api/v1/moderator` API endpoint/router** | This would lead to significant code duplication if moderator actions largely overlap with admin actions. It would also complicate frontend routing and potentially diverge shared logic, increasing maintenance overhead. The current shared "admin dashboard" concept for both roles was deemed more efficient. |

## Consequences

**Positive:**
- Moderator users can now successfully access and utilize the admin dashboard APIs, enabling them to perform their assigned duties without encountering 403 errors.
- Achieved consistency across all layers of the application (frontend UI, top-level API routing, and nested API routing) regarding admin dashboard access for both "admin" and "moderator" roles.
- Improved user experience and operational efficiency for moderators.

**Trade-offs:**
- The top-level API gateway for `/api/v1/admin` is now less restrictive, allowing a broader set of authenticated users (moderators) to pass through to the `adminRoutes`. This is aligned with functional requirements but represents a shift from a stricter initial gate.

## Related Issues & PRs

- PR: Fixes - Moderator users can access admin UI but API rejects all admin actions with 403
- Issue #907