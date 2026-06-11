# ADR — feat(admin): gate mutation controls by role

> **Date:** 2026-06-09 | **PR:** #1487 | **Status:** Accepted

## Context

The SahiDawa admin dashboard required differentiated access levels for various administrative roles. Specifically, moderators needed to view reports and medicines but be restricted from performing mutation operations (e.g., changing report status, adding new medicines), while full administrators retained all capabilities. This was necessary to enforce granular access control and improve the security posture of the platform.

## Decision

Role-based gating of UI mutation controls was implemented within the admin dashboard. The user's administrative role is now extracted from the Supabase session metadata and normalized using a new shared `adminAuth` helper (`apps/web/lib/adminAuth.ts`). This helper provides a `canMutateAdminData` function which determines if the current user's role permits mutation operations. UI elements responsible for report mutation controls (e.g., changing report status) and add-medicine controls are conditionally rendered or enabled based on the `canMutate` flag. Read-only dashboard content remains visible to all authenticated admin roles.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Backend-only authorization enforcement | While essential for security, relying solely on backend authorization would mean mutation controls would still be visible to unauthorized users. This could lead to a confusing user experience where actions appear available but consistently fail upon submission, or require more complex error handling feedback. |
| Separate admin dashboard routes/components per role | This approach would involve creating entirely distinct UI paths or sets of components for each administrative role. This would introduce significant code duplication, increase maintenance overhead for shared features, and make future feature additions more complex as changes would need to be applied across multiple distinct UIs. |

## Consequences

**Positive:**
- Enhanced security by visually restricting mutation capabilities to authorized administrative roles.
- Improved user experience for moderators by hiding irrelevant or unauthorized controls, reducing confusion and potential frustration.
- Centralized and reusable logic for determining administrative mutation permissions via `adminAuth.ts`.
- Maintains a single, unified admin dashboard codebase, simplifying maintenance and feature development.

**Trade-offs:**
- Introduces client-side logic for role-based UI rendering, requiring careful synchronization with backend authorization to prevent discrepancies.
- Relies on the integrity and availability of Supabase session metadata for accurate role assignment.

## Related Issues & PRs

- PR #1487: feat(admin): gate mutation controls by role
- Issue #1487