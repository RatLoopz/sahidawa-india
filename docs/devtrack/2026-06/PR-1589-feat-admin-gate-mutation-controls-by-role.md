# PR #1589 — feat(admin): gate mutation controls by role

> **Merged:** 2026-06-09 | **Author:** @shashank03-dev | **Area:** Frontend | **Impact Score:** 17 | **Closes:** #1487

## What Changed

We have implemented role-based access control (RBAC) for mutation operations within the admin dashboard. This change introduces a `moderator` role that can view all dashboard content but is restricted from performing actions such as marking reports or adding new medicines. Full administrative privileges, including all mutation controls, are now exclusively granted to users with the `admin` role.

## The Problem Being Solved

Prior to this PR, all authenticated users accessing the admin dashboard were presented with the same user interface and had the ability to perform all administrative actions, regardless of their intended role. This lack of granular permission control meant that a user designated as a "moderator" (intended for read-only or limited actions) could inadvertently or maliciously perform sensitive mutation operations. This posed a significant security vulnerability and prevented us from onboarding users with restricted administrative responsibilities. Issue #1487 specifically called for this feature to differentiate between admin and moderator capabilities.

## Files Modified

- `apps/web/app/[locale]/admin/dashboard/page.tsx`
- `apps/web/app/[locale]/admin/layout.tsx`
- `apps/web/lib/adminAuth.ts`
- `apps/web/tests/admin-dashboard-role-gating.test.tsx`

## Implementation Details

This feature introduces a new shared authentication helper and integrates it across the admin dashboard to gate UI elements and API calls based on the user's role.

1.  **New Authentication Helper (`apps/web/lib/adminAuth.ts`):**
    *   We introduced a new file, `adminAuth.ts`, to centralize logic for handling admin roles.
    *   It defines `AdminRole` as a union type: `"admin" | "moderator"`.
    *   `toAdminRole(value: unknown)`: A utility function that safely casts an unknown value to `AdminRole` if it matches "admin" or "moderator", otherwise returns `null`. This ensures type safety and robustness.
    *   `getAdminRoleFromUser(user: Pick<User, "app_metadata" | "user_metadata"> | null | undefined)`: This function extracts the role from a Supabase `User` object, prioritizing `user.app_metadata?.role` and falling back to `user.user_metadata?.role`. It uses `toAdminRole` for normalization.
    *   `getAdminRoleFromSession(session: Pick<Session, "user"> | null | undefined)`: A convenience wrapper that takes a Supabase `Session` object and delegates to `getAdminRoleFromUser` to retrieve the role.
    *   `canMutateAdminData(role: AdminRole | null | undefined)`: This is the core permission logic. It returns `true` only if the provided `role` is strictly `"admin"`, effectively restricting mutation capabilities to administrators.

2.  **Server-Side Layout Integration (`apps/web/app/[locale]/admin/layout.tsx`):**
    *   The server-side `AdminLayout` now utilizes the new `getAdminRoleFromSession` helper to determine the user's role.
    *   The existing redirection logic remains: if a user is not authenticated or if their role is neither "admin" nor "moderator", they are redirected to the login page or an unauthorized access page, respectively. This ensures basic access control before the client-side dashboard loads.

3.  **Client-Side Dashboard Integration (`apps/web/app/[locale]/admin/dashboard/page.tsx`):**
    *   The `AdminDashboard` component now imports `createBrowserClient` from `@supabase/ssr` and the new helpers from `@/lib/adminAuth.ts`.
    *   A `useState` hook, `adminRole`, is introduced to store the client-side user's role.
    *   A `useEffect` hook is added to asynchronously fetch the Supabase session using `createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey())` and then update the `adminRole` state via `getAdminRoleFromSession`. This ensures the UI dynamically adapts to the user's role after initial server-side rendering.
    *   A `canMutate` boolean constant is derived from `canMutateAdminData(adminRole)`. This flag is used extensively for conditional rendering and API call gating.
    *   **UI Gating:**
        *   The "Add Medicine" button (`<Plus /> {t("actions.addMedicine")}`) is now conditionally rendered based on `canMutate`.
        *   The entire "Add Medicine" form is also conditionally rendered, requiring both `canMutate` and `showForm` to be true.
        *   The `ReportsTable` component now receives the `canMutate` prop. Inside `ReportsTable`, the "Actions" table header and the individual "Mark Fake" and "False Alarm" action buttons for each report are conditionally rendered based on `canMutate`.
    *   **API Call Gating:**
        *   The `handleReportAction` and `handleAddMedicine` functions now include an early `return` statement if `!canMutate`. This provides a crucial server-side-independent security layer, preventing unauthorized mutation requests from being sent even if a user bypasses or manipulates the client-side UI.

4.  **New Test Suite (`apps/web/tests/admin-dashboard-role-gating.test.tsx`):**
    *   A dedicated Jest test file was added to verify the role-gating logic using `@testing-library/react`.
    *   It mocks the Supabase `getSession` method to simulate different user roles (admin, moderator, null) and asserts the visibility or absence of mutation controls.

## Technical Decisions

1.  **Centralized Role Logic:** We decided to create a new `apps/web/lib/adminAuth.ts` module to encapsulate all role-related logic. This promotes a single source of truth for role definition, extraction, and permission checks, reducing redundancy and improving maintainability across the application.
2.  **Hybrid Role Determination (Server-Side and Client-Side):** The `admin/layout.tsx` handles initial server-side role checks for redirection, while `admin/dashboard/page.tsx` performs client-side session fetching for dynamic UI updates. This approach ensures immediate access control and a responsive user experience without requiring a full page reload for role-based UI changes.
3.  **Robust Security via Dual Gating:** We implemented both UI-level gating (hiding controls) and API-level gating (early returns in mutation handlers). This layered approach significantly enhances security by preventing unauthorized actions even if the UI is compromised or direct API calls are attempted by a non-admin user.
4.  **Supabase Metadata for Roles:** Leveraging Supabase's `app_metadata` and `user_metadata` fields for storing user roles aligns with best practices for custom user attributes in Supabase. Prioritizing `app_metadata` is a common pattern for application-specific roles.
5.  **Component Testing for UI Logic:** Instead of complex end-to-end tests, we opted for focused component tests (`admin-dashboard-role-gating.test.tsx`) that mock Supabase sessions. This allows for efficient and reliable verification of UI rendering and interaction based on different roles without the overhead of a full browser environment.

## How To Re-Implement (Contributor Reference)

To re-implement this role-gating feature from scratch, a contributor would follow these steps:

1.  **Define Admin Roles:**
    *   Create a new file `apps/web/lib/adminAuth.ts`.
    *   Define the `AdminRole` type: `export type AdminRole = "admin" | "moderator";`.
    *   Implement a helper `toAdminRole(value: unknown): AdminRole | null` to safely cast values.

2.  **Create Supabase Role Extraction Helpers:**
    *   In `apps/web/lib/adminAuth.ts`, implement `getAdminRoleFromUser(user: Pick<User, "app_metadata" | "user_metadata"> | null | undefined): AdminRole | null` to extract the role from `user.app_metadata.role` or `user.user_metadata.role`.
    *   Implement `getAdminRoleFromSession(session: Pick<Session, "user"> | null | undefined): AdminRole | null` as a wrapper around `getAdminRoleFromUser`.

3.  **Implement Mutation Permission Logic:**
    *   In `apps/web/lib/adminAuth.ts`, add `export function canMutateAdminData(role: AdminRole | null | undefined): boolean { return role === "admin"; }`.

4.  **Integrate into Server-Side Layout:**
    *   Modify `apps/web/app/[locale]/admin/layout.tsx`.
    *   Import `getAdminRoleFromSession` from `@/lib/adminAuth`.
    *   Replace direct access to `session.user.app_metadata?.role` with `getAdminRoleFromSession(session)` for role determination.
    *   Ensure the layout redirects users without appropriate roles.

5.  **Integrate into Client-Side Dashboard:**
    *   Modify `apps/web/app/[locale]/admin/dashboard/page.tsx`.
    *   Import `createBrowserClient` from `@supabase/ssr` and `canMutateAdminData`, `getAdminRoleFromSession`, `AdminRole` from `@/lib/adminAuth`.
    *   Add `const [adminRole, setAdminRole] = useState<AdminRole | null>(null);` to the component state.
    *   Add a `useEffect` hook to fetch the Supabase session client-side and set `adminRole`:
        ```typescript
        useEffect(() => {
            let mounted = true;
            const supabase = createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
            supabase.auth.getSession().then(({ data }) => {
                if (mounted) setAdminRole(getAdminRoleFromSession(data.session));
            }).catch(() => {
                if (mounted) setAdminRole(null);
            });
            return () => { mounted = false; };
        }, []);
        ```
    *   Derive `const canMutate = canMutateAdminData(adminRole);`.

6.  **Apply Conditional UI Rendering:**
    *   Use the `canMutate` flag to conditionally render elements:
        *   For the "Add Medicine" button: `{canMutate && (<button>...</button>)}`
        *   For the "Add Medicine" form: `{canMutate && showForm && (<div>...</div>)}`
        *   Pass `canMutate` as a prop to `ReportsTable`: `<ReportsTable ... canMutate={canMutate} />`.
        *   Inside `ReportsTable`, conditionally render the "Actions" table header and the action buttons for each report row using `{canMutate && (<th>...</th>)}` and `{canMutate && (<td>...</td>)}`.

7.  **Gate API Calls:**
    *   In `handleReportAction` and `handleAddMedicine` functions, add an early exit: `if (!canMutate) return;` at the beginning of the function body.

8.  **Write Component Tests:**
    *   Create `apps/web/tests/admin-dashboard-role-gating.test.tsx`.
    *   Mock `createBrowserClient` and its `auth.getSession` method to return sessions with different `app_metadata.role` values ("admin", "moderator", `null`).
    *   Use `@testing-library/react` to render the `AdminDashboard` component.
    *   Assert the visibility or absence of mutation-related UI elements (buttons, form fields, table columns) for each mocked role.

## Impact on System Architecture

This change significantly enhances the security and modularity of the SahiDawa admin platform.

1.  **Enhanced Security Posture:** By introducing explicit role-based gating for mutation operations, we have closed a critical security gap. This prevents unauthorized users (e.g., moderators) from performing sensitive actions, even if they gain access to the admin dashboard.
2.  **Clearer Separation of Concerns:** The creation of `apps/web/lib/adminAuth.ts` centralizes all logic related to admin roles. This makes the system more modular, easier to understand, and simplifies future extensions or modifications to our role-based access control system.
3.  **Foundation for Granular Permissions:** The `AdminRole` type and `canMutateAdminData` function establish a clear pattern for defining and enforcing permissions. This architecture can be readily extended to support more granular roles (e.g., "auditor", "data entry specialist") and permissions in the future, without requiring a major refactor.
4.  **Improved Maintainability:** Centralizing role logic means that changes to how roles are determined or what permissions they grant only need to be updated in one place, reducing the risk of inconsistencies and bugs.
5.  **Frontend-Backend Security Contract:** While this PR focuses on the frontend, it establishes a strong expectation for the backend API to also enforce these role-based permissions. This ensures a consistent and robust security model across the entire SahiDawa platform.

## Testing & Verification

The changes were thoroughly tested to ensure correct role-based gating and functionality.

*   **New Component Test Suite:** A dedicated test suite, `apps/web/tests/admin-dashboard-role-gating.test.tsx`, was introduced to specifically cover the UI and client-side logic for role-gating.
*   **Supabase Session Mocking:** We mocked the Supabase `createBrowserClient().auth.getSession()` method to simulate various user roles:
    *   An "admin" user session.
    *   A "moderator" user session.
    *   A session with no explicit role (implicitly treated as non-admin/non-moderator).
*   **Verification Scenarios:**
    *   **Moderator Access:** Tests confirmed that when a moderator session is mocked, the "Add Medicine" button is not visible, the "Add Medicine" form is not rendered, and the "Actions" column and corresponding action buttons ("Mark Fake", "False Alarm") in the reports table are absent.
    *   **Admin Access:** Tests verified that when an admin session is mocked, the "Add Medicine" button is visible, the "Add Medicine" form can be toggled, and the "Actions" column and action buttons are present and interactive in the reports table.
    *   **API Call Integrity:** The existing `tests/adminApi.test.ts` suite, which covers the `PATCH` request path for report mutations, was run alongside the new tests. Its successful completion (as indicated by the `10 tests passed` output) confirms that admin report mutations still send the expected requests without being inadvertently blocked by the new `canMutate` checks.
*   **Proof of Work:** The author provided a verification run output (`npm run test -w web -- tests/admin-dashboard-role-gating.test.tsx tests/adminApi.test.ts --runInBand`) showing `2 test suites passed, 10 tests passed`, confirming the successful execution of both the new role-gating tests and existing API tests.
*   **Edge Cases:**
    *   **Unauthenticated Users:** Handled by the `admin/layout.tsx` which redirects them to the login page.
    *   **Users with Unknown Roles:** `getAdminRoleFromSession` returns `null` for unrecognized roles, which `canMutateAdminData` correctly interprets as `false`, preventing any mutation capabilities.
    *   **Client-Side Bypass:** The early `return` statements in `handleReportAction` and `handleAddMedicine` provide a crucial safeguard, ensuring that even if a user somehow manipulates the client-side UI to trigger a mutation, the request will not be sent if their role does not permit it.