# ADR — feat(admin): implement audit logs dashboard integration

> **Date:** 2026-05-30 | **PR:** #899 | **Status:** Accepted

## Context

The SahiDawa Admin Dashboard previously included a placeholder for Audit Logs, displaying a static empty state despite the existence of an underlying audit logging infrastructure. This meant that critical system actions, such as report verification, medicine creation, and status changes, were being recorded in the database but were not accessible or viewable by administrators or moderators through the platform's UI. This lack of visibility hindered operational transparency, accountability, and the ability to effectively monitor and debug administrative activities.

## Decision

A comprehensive full-stack solution was implemented to integrate dynamic audit log display into the Admin Dashboard.

1.  **Backend API Development:** A new `GET /logs` API endpoint was added to the `apps/api` service within `admin.routes.ts` and `admin.controller.ts`. This endpoint is secured using `requireAuth` and `requireRole('admin', 'moderator')` middleware, ensuring only authorized personnel can access audit data. The controller fetches audit records from the `audit_logs` Supabase table, supports pagination via `page` and `limit` query parameters, orders results by `created_at` in descending order, and includes pagination metadata in the response. A `formatDetails` helper function was introduced to parse and present JSON `details` fields into human-readable strings (e.g., "Updated report status to X", "Created new medicine: Y").

2.  **Frontend Integration:** The `apps/web` Admin Dashboard was updated to replace the hardcoded empty state for audit logs with a dynamic data fetching mechanism. A `fetchAuditLogs()` function was implemented to asynchronously call the new backend API. To optimize performance, audit logs are fetched using lazy loading, triggering the API request only when the Audit Logs tab is actively selected. The UI now displays a loading indicator during data retrieval, renders audit entries upon successful fetch, and reverts to an empty state message if no records are returned.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Direct Frontend Database Access for Audit Logs** | Directly querying the `audit_logs` table from the frontend using the Supabase client would necessitate exposing database credentials or relying heavily on complex Row Level Security (RLS) policies for authorization. This approach increases the attack surface, complicates authorization logic, and prevents backend-driven data transformation (like `formatDetails`) and aggregation without additional frontend logic. Centralized backend control provides a more secure and maintainable access layer. |
| **Server-Side Rendering (SSR) for Audit Logs Tab** | Implementing SSR for the audit logs tab could potentially offer faster initial content display. However, given that audit logs are typically accessed on demand within a specific tab, the performance benefits of SSR were deemed marginal compared to the added complexity in server-side rendering logic and increased server load for every dashboard page request, even when the audit log tab is not active. Client-side fetching with lazy loading on tab activation provides an adequate user experience with simpler implementation. |

## Consequences

**Positive:**
-   **Enhanced Accountability and Transparency:** Provides administrators and moderators with real-time visibility into critical system actions, improving operational oversight and accountability.
-   **Improved Debugging and Auditing:** Offers a valuable tool for diagnosing issues, tracking user activity, and ensuring compliance with internal policies.
-   **Robust Security:** Access to sensitive audit log data is strictly enforced through backend authentication and role-based authorization middleware.
-   **Optimized User Experience:** Lazy loading prevents unnecessary API calls and improves initial dashboard load times, while dynamic loading states provide clear user feedback.
-   **Human-Readable Logs:** The backend's `formatDetails` function translates technical log data into easily understandable descriptions, enhancing usability.

**Trade-offs:**
-   **Increased Backend Complexity:** The introduction of a new API endpoint, controller logic, and data formatting adds to the backend codebase and requires ongoing maintenance.
-   **Frontend State Management:** Managing dynamic loading states, pagination, and error handling for the audit log component adds complexity to the frontend application's state management.

## Related Issues & PRs

-   PR #899: feat(admin): implement audit logs dashboard integration
-   Issue #809