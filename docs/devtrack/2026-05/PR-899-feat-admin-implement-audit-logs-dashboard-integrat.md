# PR #899 — feat(admin): implement audit logs dashboard integration

> **Merged:** 2026-05-30 | **Author:** @Tanish-Solanki | **Area:** Backend | **Impact Score:** 20 | **Closes:** #809

## What Changed

This pull request fully implements the Audit Logs feature within our SahiDawa Admin Dashboard. We have established a new, secure backend API endpoint to fetch audit records from our Supabase `audit_logs` table, complete with pagination and intelligent detail formatting. Concurrently, the frontend has been updated to dynamically retrieve and display these logs, replacing a previously hardcoded empty state with real-time administrative history, including loading indicators and lazy-loading behavior.

## The Problem Being Solved

Before this PR, the Admin Dashboard's "Audit Logs" tab was a placeholder, always displaying a "No audit entries yet" message regardless of actual administrative activity. This meant that administrators lacked visibility into critical actions performed on the platform, such as report status changes, medicine creation, or user management. The absence of a functional audit trail hindered accountability, debugging, and compliance efforts, making it impossible to track who did what and when. Our system had the underlying audit logging infrastructure, but no mechanism to expose this valuable data to the administrators who needed it.

## Files Modified

- `apps/api/src/controllers/admin.controller.ts`
- `apps/api/src/routes/admin.routes.ts`
- `apps/api/tests/adminLogs.test.ts`
- `apps/web/app/[locale]/admin/dashboard/page.tsx`

## Implementation Details

### Backend (`apps/api`)

1.  **Audit Logs Controller (`apps/api/src/controllers/admin.controller.ts`)**:
    *   We introduced a new asynchronous function, `getAuditLogs`, to handle the retrieval of audit records.
    *   This function parses `page` and `limit` query parameters from the request, defaulting to `1` and `20` respectively, to support pagination. An `offset` is calculated based on these parameters.
    *   It queries the `audit_logs` table in Supabase, selecting all columns (`*`) and requesting an exact `count` of total records. The results are ordered by `created_at` in descending order to show the most recent logs first, and a `range` is applied for pagination.
    *   Robust error handling is in place: if the Supabase query fails, a `500` status with a "Failed to fetch audit logs" message is returned.
    *   A crucial `formatDetails` helper function was implemented to provide human-readable descriptions for specific audit actions:
        *   For actions starting with `STATUS_` (e.g., `STATUS_VERIFIED_FAKE`), it extracts the `status` from the `details` JSON and formats it as "Updated report status to \[status]".
        *   For `CREATE_MEDICINE` actions, it extracts `brand_name` and `generic_name` to form "Created new medicine: \[brand name] (\[generic name])".
        *   For other actions, it falls back to displaying the action type and a JSON string representation of the `details`.
        *   It includes `try-catch` blocks to safely parse `details` if it's a JSON string and gracefully handles parsing errors by defaulting to the raw `action` string.
    *   The final response includes the `formattedLogs` array and a `meta` object containing `total`, `page`, `limit`, and `totalPages` for client-side pagination management.

2.  **Protected API Route (`apps/api/src/routes/admin.routes.ts`)**:
    *   We registered a new `GET` route, `/logs`, within the `/api/v1/admin` namespace.
    *   This route is directly mapped to our new `getAuditLogs` controller function.
    *   Crucially, this route leverages our existing middleware setup, specifically `requireAuth` and `requireRole('admin', 'moderator')`, which are applied globally to all admin routes. This ensures that only authenticated users with either 'admin' or 'moderator' roles can access the sensitive audit log information, maintaining strict security and access control.

### Frontend (`apps/web`)

1.  **Dynamic State Management (`apps/web/app/[locale]/admin/dashboard/page.tsx`)**:
    *   The previously hardcoded `const [auditLogs] = useState<AuditEntry[]>([]);` was replaced with a dynamic state: `const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);`.
    *   A new `logsLoading` boolean state (`const [logsLoading, setLogsLoading] = useState(false);`) was added to manage the loading indicator's visibility.

2.  **Audit Log Fetching Logic**:
    *   A `fetchAuditLogs` `useCallback` hook was implemented.
    *   This function sets `logsLoading` to `true` at the start of the fetch operation.
    *   It makes an authenticated `fetch` request to our new backend endpoint: ``${API_BASE}/logs``, including `authHeaders()` for authorization.
    *   Upon a successful response (`res.ok`), it parses the JSON data and updates the `auditLogs` state with `data.logs`. If `data.logs` is null or undefined, it defaults to an empty array.
    *   A `catch` block is included for silent failure, ensuring the UI doesn't break on network errors, though the logs list will remain empty.
    *   The `finally` block ensures `logsLoading` is set back to `false` regardless of success or failure.

3.  **Lazy Loading and UI Integration**:
    *   An `useEffect` hook was added to trigger `fetchAuditLogs` only when the `tab` state (representing the active dashboard tab) is equal to `"logs"`. This prevents unnecessary API calls when the dashboard initially loads or when other tabs are active, optimizing performance and resource usage.
    *   The JSX rendering for the Audit Logs tab now conditionally displays:
        *   A loading indicator (`Loader2` component with "Loading audit logs…") when `logsLoading` is `true`.
        *   The "No audit entries yet" message if `logsLoading` is `false` and `auditLogs.length` is `0`.
        *   The actual list of audit entries once `auditLogs` has data and `logsLoading` is `false`.

## Technical Decisions

1.  **Supabase as the Audit Log Store**: We chose to leverage Supabase for storing audit logs because it is already an integral part of our SahiDawa backend infrastructure. This decision minimizes the introduction of new dependencies, streamlines database interactions, and allows us to utilize its robust querying capabilities, including pagination and exact row counts, directly from our Node.js backend.
2.  **Pagination for Scalability and UX**: Implementing pagination (`page`, `limit`, `offset`) was a critical decision for both performance and user experience. Audit logs can grow very large over time. Fetching all logs at once would be inefficient, slow, and potentially crash the client. Pagination ensures that only a manageable subset of logs is transferred and rendered at any given time, providing a smooth and responsive experience for administrators.
3.  **Human-Readable Log Details**: The `formatDetails` function was a deliberate choice to enhance the usability of the audit logs. Raw JSON details, while technically accurate, are not user-friendly. By intelligently parsing and rephrasing common actions like `STATUS_VERIFIED_FAKE` or `CREATE_MEDICINE` into natural language, we make the audit trail immediately understandable to administrators without requiring them to interpret JSON structures. The `try-catch` for `JSON.parse` ensures resilience against malformed or unexpected `details` data.
4.  **Role-Based Access Control (RBAC)**: Protecting the `/api/v1/admin/logs` endpoint with `requireAuth` and `requireRole('admin', 'moderator')` is paramount for security. Audit logs contain sensitive information about administrative actions. Restricting access to only authenticated administrators and moderators prevents unauthorized users from viewing or tampering with this critical historical data, aligning with our security best practices.
5.  **Lazy Loading on Frontend**: The decision to fetch audit logs only when the "Audit Logs" tab is active (`tab === "logs"`) is an optimization for frontend performance. This "lazy loading" approach prevents unnecessary API calls and data fetching during initial dashboard load or when other tabs are being viewed. It reduces network traffic and speeds up the initial rendering of the dashboard, improving the overall user experience.
6.  **Standard React Hooks (`useState`, `useEffect`, `useCallback`)**: We utilized standard React hooks for state management and side effects on the frontend. `useState` is ideal for managing the `auditLogs` data and `logsLoading` state. `useEffect` provides a clean way to trigger data fetching based on tab changes, and `useCallback` memoizes `fetchAuditLogs` to prevent unnecessary re-creations, optimizing performance within the `useEffect` dependency array.
7.  **`supertest` for API Testing**: `supertest` was chosen for backend API testing because it provides a high-level abstraction for testing HTTP requests and responses with Express applications. Its fluent API makes it easy to write clear and concise tests for routes, controllers, and middleware, ensuring the reliability of our backend endpoints.
8.  **Mocking in Backend Tests**: Mocking the Supabase client and authentication middleware in `adminLogs.test.ts` was a strategic decision to achieve isolated and fast unit tests. By mocking, we prevent tests from hitting a real database or relying on actual authentication services, making them deterministic, quicker to run, and focused solely on the logic within `getAuditLogs` and the route definition.

## How To Re-Implement (Contributor Reference)

To re-implement this audit logs dashboard integration from scratch, a contributor would follow these steps:

### Backend Implementation

1.  **Define the Audit Logs Controller**:
    *   Create or modify `apps/api/src/controllers/admin.controller.ts`.
    *   Add an `async` function `getAuditLogs` that accepts `AuthenticatedRequest` and `Response` objects.
    *   Inside, parse `page` and `limit` from `req.query`, defaulting to `1` and `20`. Calculate `offset = (page - 1) * limit`.
    *   Implement the Supabase query:
        ```typescript
        const { data, error, count } = await supabase
          .from('audit_logs')
          .select('*', { count: 'exact' }) // Select all columns and get total count
          .order('created_at', { ascending: false }) // Order by creation time, newest first
          .range(offset, offset + limit - 1); // Apply pagination range
        ```
    *   Add error handling for `supabase` query failures, returning a `500` status.
    *   Implement the `formatDetails` helper function as seen in the diff, including `JSON.parse` with `try-catch` and specific formatting logic for `STATUS_` and `CREATE_MEDICINE` actions.
    *   Map the fetched `data` using `formatDetails` to create `formattedLogs`.
    *   Construct the JSON response with `logs: formattedLogs` and `meta: { total, page, limit, totalPages }`.
    *   Wrap the entire controller logic in a `try-catch` block for general error handling.

2.  **Register the API Route**:
    *   Modify `apps/api/src/routes/admin.routes.ts`.
    *   Import `getAuditLogs` from the controller.
    *   Add the route definition: `router.get('/logs', getAuditLogs);`.
    *   Ensure this route is placed *after* the existing `router.use(requireAuth);` and `router.use(requireRole('admin', 'moderator'));` middleware calls to automatically apply security.

3.  **Write Backend Tests**:
    *   Create a new test file `apps/api/tests/adminLogs.test.ts`.
    *   Set up environment variables and mock `WebSocket` for Supabase client initialization.
    *   **Crucially, mock the Supabase client (`../src/db/client`)** to control its `from`, `select`, `order`, and `range` methods, allowing you to return predefined test data or errors.
    *   **Mock the authentication middleware (`../src/middleware/auth`)** to automatically succeed and populate `req.user` with a test admin user, bypassing actual authentication during tests.
    *   Use `supertest` to send HTTP requests to `/api/v1/admin/logs`.
    *   Write test cases to verify:
        *   Successful retrieval of logs with correct formatting for different `action` types.
        *   Correct pagination metadata (`total`, `page`, `limit`, `totalPages`).
        *   Correct Supabase query parameters (`from`, `select`, `order`, `range`).
        *   Graceful error handling when Supabase returns an error.
        *   (Implicitly, due to middleware mocks) that the route is protected.

### Frontend Implementation

1.  **Update Dashboard Page (`apps/web/app/[locale]/admin/dashboard/page.tsx`)**:
    *   Import `Loader2` from `@/components/ui/loader` or similar for the loading spinner.
    *   Replace the static `auditLogs` state with `const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);`.
    *   Add a new state for loading: `const [logsLoading, setLogsLoading] = useState(false);`.
    *   Implement the `fetchAuditLogs` function using `useCallback`:
        ```typescript
        const fetchAuditLogs = useCallback(async () => {
            setLogsLoading(true);
            try {
                const res = await fetch(`${API_BASE}/logs`, { headers: authHeaders() });
                if (res.ok) {
                    const data = await res.json();
                    setAuditLogs(data.logs ?? []);
                }
            } catch {
                // Handle network errors or silently fail
            } finally {
                setLogsLoading(false);
            }
        }, []); // Dependencies for useCallback
        ```
    *   Add a `useEffect` hook to trigger fetching only when the "Audit Logs" tab is active:
        ```typescript
        useEffect(() => {
            if (tab === "logs") {
                fetchAuditLogs();
            }
        }, [tab, fetchAuditLogs]);
        ```
    *   Modify the JSX within the "Audit Logs" tab section to conditionally render based on `logsLoading` and `auditLogs.length`:
        ```jsx
        {logsLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading audit logs…
            </div>
        ) : auditLogs.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400">
                No audit entries yet.
            </div>
        ) : (
            {/* Render your audit logs list here, iterating over auditLogs */}
        )}
        ```
    *   Ensure `API_BASE` and `authHeaders()` are correctly defined and accessible.

## Impact on System Architecture

This change significantly enhances the observability and accountability of our SahiDawa platform. By integrating a functional audit log dashboard, we've closed a critical gap in our administrative tooling.

1.  **Enhanced Accountability**: Every administrative action, previously logged but inaccessible, is now visible. This fosters greater accountability among administrators and moderators, as their actions are transparently recorded and reviewable.
2.  **Improved Debugging and Troubleshooting**: When issues arise, the audit logs provide a clear chronological record of administrative changes, making it much easier to pinpoint the cause of problems related to data modification or system configuration.
3.  **Compliance and Security**: A robust audit trail is fundamental for various compliance standards and security best practices. This feature strengthens our ability to demonstrate who performed what action, which is crucial for internal audits and potential external regulatory requirements in the healthcare domain.
4.  **Foundation for Future Features**: This implementation lays the groundwork for more advanced administrative features, such as filtering, searching, and exporting audit logs, or even integrating with external monitoring systems. It also validates our existing audit logging infrastructure, ensuring that the data being collected is indeed useful and accessible.
5.  **Performance Considerations**: The introduction of pagination and lazy loading ensures that this new feature scales well with a growing volume of audit data, preventing performance bottlenecks on both the backend and frontend as SahiDawa expands.

## Testing & Verification

### Backend Testing

We created a dedicated test file, `apps/api/tests/adminLogs.test.ts`, to rigorously verify the backend implementation.

*   **Audit Log Retrieval**: We confirmed that the `GET /api/v1/admin/logs` endpoint successfully fetches audit records from the mocked Supabase `audit_logs` table.
*   **Pagination Metadata**: Tests verified that the API response correctly includes `meta` object with `total`, `page`, `limit`, and `totalPages` based on the mocked data and query parameters.
*   **Log Formatting Logic**: Extensive tests were conducted to ensure the `formatDetails` function correctly transforms raw `details` JSON into human-readable strings for various action types, specifically `STATUS_` actions (e.g., "Updated report status to verified\_fake") and `CREATE_MEDICINE` actions (e.g., "Created new medicine: Mock Brand (Mock Generic)"). We also verified the fallback behavior for unknown actions or malformed `details`.
*   **Error Handling Behavior**: We simulated Supabase query failures and confirmed that the API gracefully returns a `500` status with an appropriate error message ("Failed to fetch audit logs").
*   **Middleware Integration**: By mocking `requireAuth` and `requireRole` to succeed, our tests implicitly verified that the route is intended to be protected by these middlewares, ensuring only authorized users can access the endpoint.

### Frontend Testing

Verification on the frontend involved manual testing and observation of network behavior:

*   **API Request Trigger**: We verified that the `fetchAuditLogs` API request is only triggered when the "Audit Logs" tab within the Admin Dashboard is actively selected, confirming the lazy-loading mechanism.
*   **Audit Entries Rendering**: Upon successful data fetch, we confirmed that the retrieved audit entries are correctly rendered in the dashboard UI, displaying the formatted details and other log information.
*   **Loading State**: We observed that a loading indicator (`Loader2` component) appears while the audit logs are being fetched, providing clear feedback to the user.
*   **Empty State**: We confirmed that the "No audit entries yet" message correctly appears only when no audit logs are returned from the backend (or if the fetch fails silently), and not as a permanent placeholder.

### TypeScript Verification

We executed `npx tsc --noEmit -p apps/web/tsconfig.json` to perform a type check on the frontend application. The successful result (`SUCCESS`) confirmed that all new and modified TypeScript code adheres to our strict type definitions, preventing potential runtime type errors.