# PR #1482 — fix(api): restrict admin write routes

> **Merged:** 2026-06-07 | **Author:** @Avinash-sdbegin | **Area:** Backend | **Impact Score:** 9 | **Closes:** #1391

## What Changed

This pull request refactored the authorization middleware in `apps/api/src/routes/admin.routes.ts` to apply role-based access control at the route level instead of globally. We removed the blanket `requireRole("admin", "moderator")` middleware from the router's `use` statement. Now, read-only endpoints explicitly allow both "admin" and "moderator" roles, while mutation endpoints are strictly limited to "admin" users only.

## The Problem Being Solved

Before this PR, all routes defined within `apps/api/src/routes/admin.routes.ts` were protected by a single, global `router.use(requireAuth, requireRole("admin", "moderator"));` middleware. This design meant that any user with either an "admin" or "moderator" role gained full access to all endpoints within this router. This included sensitive mutation operations such as `PATCH /reports/:id/status` and `POST /medicines`, which should ideally be restricted to higher-privileged "admin" users. This setup violated the principle of least privilege, granting moderators more permissions than necessary for their designated responsibilities and introducing an unnecessary security risk.

## Files Modified

- `apps/api/src/routes/admin.routes.ts`

## Implementation Details

The core of this implementation lies within the `apps/api/src/routes/admin.routes.ts` file, which defines the API endpoints for administrative functionalities.

1.  **Removal of Global Middleware:** The line `router.use(requireAuth, requireRole("admin", "moderator"));` was removed. This line previously applied the specified authentication and authorization checks to every subsequent route defined within this `router` instance.
2.  **Granular Middleware Application:** The `requireAuth` and `requireRole` middleware functions are now applied individually to each route definition, allowing for fine-grained control over access.
    *   **Read-Only Endpoints:** For `GET` requests that retrieve data, access is granted to both "admin" and "moderator" roles. This includes:
        *   `router.get("/reports", requireAuth, requireRole("admin", "moderator"), getPendingReports);`
        *   `router.get("/medicines", requireAuth, requireRole("admin", "moderator"), getAllMedicines);`
        *   `router.get("/logs", requireAuth, requireRole("admin", "moderator"), getAuditLogs);`
        *   `router.get("/push-notifications/analytics", requireAuth, requireRole("admin", "moderator"), getPushNotificationAnalytics);`
    *   **Mutation Endpoints:** For `PATCH` and `POST` requests that modify or create data, access is restricted exclusively to the "admin" role. This includes:
        *   `router.patch("/reports/:id/status", requireAuth, requireRole("admin"), updateReportStatus);`
        *   `router.post("/medicines", requireAuth, requireRole("admin"), createMedicine);`

This change ensures that the `requireAuth` middleware verifies user authentication for all routes, and the `requireRole` middleware then checks if the authenticated user possesses the necessary role(s) for that specific operation.

## Technical Decisions

Our primary technical decision was to transition from a broad, global application of role-based access control (RBAC) to a more granular, route-level application within the `admin.routes.ts` file. This approach was chosen specifically to enforce the principle of least privilege. By applying `requireRole` directly to each endpoint, we can precisely define which roles are authorized for read operations versus write operations. This allows us to differentiate responsibilities, such as enabling moderators to view reports and medicine lists (read-only) while restricting the ability to change report statuses or add new medicines (write operations) solely to administrators. We did not consider alternative authorization libraries or patterns, as the existing `requireAuth` and `requireRole` middleware functions provided the necessary capabilities; the change was purely in their strategic application.

## How To Re-Implement (Contributor Reference)

To re-implement or apply a similar granular access control pattern:

1.  **Locate the Router:** Identify the `Router` instance (e.g., `const router = Router();`) in the target route file (e.g., `apps/api/src/routes/admin.routes.ts`).
2.  **Remove Global Middleware:** If present, remove any `router.use()` calls that apply broad authentication or authorization middleware to all routes within that router. For instance, remove `router.use(requireAuth, requireRole("some_role", "another_role"));`.
3.  **Apply Middleware Per Route:** For each individual route defined using `router.get()`, `router.post()`, `router.patch()`, `router.put()`, or `router.delete()`:
    *   **Determine Access Requirements:** Based on the endpoint's functionality (read, create, update, delete) and the SahiDawa security policy, decide which roles should have access.
    *   **Insert Middleware:** Place the `requireAuth` middleware first, followed by the `requireRole` middleware, directly before the route handler function.
    *   **Example for Read Access (Multiple Roles):**
        ```typescript
        import { requireAuth, requireRole } from '../middleware/auth'; // Assuming path
        import { getSomeData } from '../controllers/dataController'; // Assuming path

        router.get("/data", requireAuth, requireRole("admin", "moderator"), getSomeData);
        ```
    *   **Example for Write Access (Single Role):**
        ```typescript
        import { requireAuth, requireRole } from '../middleware/auth'; // Assuming path
        import { createNewItem } from '../controllers/itemController'; // Assuming path

        router.post("/items", requireAuth, requireRole("admin"), createNewItem);
        ```
4.  **Verify Role Definitions:** Ensure that the string arguments passed to `requireRole()` (e.g., `"admin"`, `"moderator"`) precisely match the role names defined and used within our authentication system.
5.  **Test Thoroughly:** After applying these changes, rigorously test the access control for all relevant user roles (e.g., admin, moderator, regular user, unauthenticated) to confirm that permissions are correctly enforced for each endpoint.

## Impact on System Architecture

This change significantly strengthens the security posture of the SahiDawa backend by implementing a more robust and granular least-privilege model for our administrative APIs. It makes the `apps/api/src/routes/admin.routes.ts` file more explicit and auditable regarding the required permissions for each endpoint, enhancing readability and maintainability from a security perspective. This pattern establishes a clear precedent for how we manage access control, allowing us to extend this fine-grained authorization to other parts of the API where different roles might require varying levels of access to specific resources or operations. Ultimately, it reduces our attack surface by preventing unauthorized write operations by roles like "moderator" that are only intended for read access, contributing to a more secure and resilient platform.

## Testing & Verification

The author performed manual validation to verify the correct application of the new access controls, as detailed in the "Proof of Work" section of the PR description.

*   **Moderator Access Verification:**
    *   We confirmed that users with the "moderator" role could successfully access the read-only endpoints: `GET /reports`, `GET /medicines`, `GET /logs`, and `GET /push-notifications/analytics`.
    *   We also confirmed that "moderator" users were correctly denied access (receiving a 403 Forbidden response) when attempting to access the mutation endpoints: `PATCH /reports/:id/status` and `POST /medicines`.
*   **Admin Access Verification:**
    *   We verified that users with the "admin" role retained full access to all routes within `apps/api/src/routes/admin.routes.ts`, including both read and write operations.

**Edge Cases:**
*   **Unauthenticated Users:** The `requireAuth` middleware, present on all routes, ensures that any unauthenticated user is denied access to these endpoints, which is the expected behavior.
*   **Users with Other Roles:** Users possessing roles other than "admin" or "moderator" would be denied access to all routes in `admin.routes.ts` due to the `requireRole` middleware, enforcing our role-based security.
*   **Automated Tests:** Not documented in this PR are specific automated unit or integration tests for these role-based access changes. However, the manual validation provides confidence in the immediate functionality.