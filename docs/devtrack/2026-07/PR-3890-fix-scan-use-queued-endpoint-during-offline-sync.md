# PR #3890 — fix(scan): use queued endpoint during offline sync

> **Merged:** 2026-07-28 | **Author:** @Shreya-nipunge | **Area:** Frontend | **Impact Score:** 15 | **Closes:** #3884

## What Changed

We updated our offline synchronization engine to respect the specific API endpoint (`apiUrl`) captured at the time of an offline scan. The `verifyMedicine` function in `apps/web/lib/api.ts` now accepts an optional `endpoint` parameter, which is passed down by the sync worker in `apps/web/lib/scanQueueSync.ts`. Additionally, we made the `apiUrl` field optional in the `QueuedScan` database interface to safely handle legacy queued scans that lack this property, falling back to the default global configuration.

## The Problem Being Solved

In SahiDawa, rural health workers (such as ASHA workers) often perform medicine verification scans in remote areas with intermittent or zero internet connectivity. Our system queues these scans locally in IndexedDB using `syncQueue.ts` and syncs them once a connection is re-established.

Before this PR, the synchronization worker (`syncPendingScans`) completely ignored the specific `apiUrl` captured when the scan was queued. Instead, it would attempt to verify all queued scans using whatever global environment configuration was active at the moment of synchronization. This caused severe issues if the user switched network environments, if the backend ML service URL changed, or if different scans in the queue were intended for different verification endpoints (e.g., a dedicated ML batch verification endpoint vs. a standard Node API fallback). The system would incorrectly route legacy or specialized scans, leading to failed syncs or incorrect verification results.

## Files Modified

- `apps/web/lib/api.ts`
- `apps/web/lib/db/syncQueue.ts`
- `apps/web/lib/scanQueueSync.ts`
- `apps/web/tests/scanQueueSync.test.ts`

## Implementation Details

### 1. API Endpoint Resolution (`apps/web/lib/api.ts`)
We refactored `verifyMedicine` to accept an optional third parameter: `endpoint?: string`. 
- **ML Endpoint Detection:** If an `endpoint` is provided, we check if it matches the ML batch verification pattern using the regex `/\/verify\/batch\/?$/.test(endpoint)`. If it matches, we treat it as the ML service endpoint.
- **Strict Error Handling:** If a custom `endpoint` is provided and the fetch request fails, we throw an explicit error (`"Stored ML verification endpoint returned an unsuccessful response"`) instead of silently falling back to the Node API. This ensures we do not route requests to incorrect servers.
- **Direct Fallback:** If the custom `endpoint` does not match the ML pattern, we bypass the ML block and execute a POST request via `fetchWithCsrf` directly to the provided `endpoint` (or default to `${API_BASE}/api/verify` if no endpoint is provided).

### 2. Database Schema & Backward Compatibility (`apps/web/lib/db/syncQueue.ts`)
We updated the `QueuedScan` interface to make `apiUrl` optional:
```typescript
export interface QueuedScan {
    barcode: string;
    timestamp: number;
    locale: string;
    apiUrl?: string; // Made optional
    // ... other properties
}
```
This prevents runtime crashes when reading legacy offline scans stored in users' IndexedDB instances that do not contain the `apiUrl` property.

### 3. Sync Worker Integration (`apps/web/lib/scanQueueSync.ts`)
The `syncPendingScans` function iterates over the queued items. We updated the call to `verifyMedicine` to pass the stored `apiUrl`:
```typescript
const result = await verifyMedicine(item.barcode, undefined, item.apiUrl);
```

## Technical Decisions

- **Strict Error Throwing for Custom Endpoints:** When a custom `endpoint` is provided to `verifyMedicine` and fails, we explicitly throw an error instead of falling back to the Node API. A custom endpoint represents a deliberate routing decision made at the time of the scan (e.g., targeting a specific local clinic server). Falling back to a default Node API might result in verifying against an incorrect database, violating our data integrity guarantees.
- **Regex-based ML Endpoint Detection:** We used `/\/verify\/batch\/?$/` to detect if the custom endpoint is an ML service. This allows us to reuse the existing retry and error-handling logic tailored for our ML microservices without duplicating code.
- **Graceful Legacy Handling:** Instead of running a database migration on IndexedDB to backfill missing `apiUrl` fields (which can be risky and error-prone on client devices), we made the field optional in TypeScript and added fallback logic in both the API layer and the test suite.

## How To Re-Implement (Contributor Reference)

To re-implement or extend this behavior, follow these steps:

1. **Update the Database Interface:** Open `apps/web/lib/db/syncQueue.ts` and ensure the `QueuedScan` interface's `apiUrl` property is marked as optional (`apiUrl?: string;`).
2. **Modify the Verification API:** In `apps/web/lib/api.ts`, update `verifyMedicine` to accept `endpoint?: string` as its third parameter:
   - Check if the endpoint is an ML endpoint using `/\/verify\/batch\/?$/.test(endpoint)`.
   - If it is an ML endpoint, attempt to fetch from it. If it fails, throw an error. Do not fall back to the Node API.
   - If it is not an ML endpoint, fall back to calling `fetchWithCsrf` using the `endpoint` directly (or the default `${API_BASE}/api/verify` if `endpoint` is undefined).
3. **Update the Sync Worker:** In `apps/web/lib/scanQueueSync.ts`, locate the loop inside `syncPendingScans`. Pass `item.apiUrl` as the third argument to `verifyMedicine`.
4. **Write Regression Tests:** In `apps/web/tests/scanQueueSync.test.ts`, add two test cases:
   - One that mocks `verifyMedicine`, adds an item with a custom `apiUrl` to the sync queue, runs `syncPendingScans`, and asserts that `verifyMedicine` was called with that custom URL.
   - Another that adds an item, deletes its `apiUrl` property to simulate a legacy scan, runs `syncPendingScans`, and asserts that `verifyMedicine` was called with `undefined` as the endpoint.

## Impact on System Architecture

This change strengthens SahiDawa's offline-first capabilities. By decoupling the synchronization process from the active global network configuration, we ensure that medicine verification remains highly deterministic. Scans queued under a specific environment (e.g., a localized clinic server) will always sync back to that exact server, even if the worker moves to a different region with different global environment variables before the sync completes. This is a critical step toward supporting multi-tenant and localized offline deployments in diverse rural Indian health centers.

## Testing & Verification

### Unit & Integration Testing
We added targeted Jest tests in `apps/web/tests/scanQueueSync.test.ts` to cover both the standard flow (using the queued endpoint) and the legacy fallback flow (where `apiUrl` is undefined).

- **Queued Endpoint Test:** Verifies that when a scan is queued with `https://queued.example/api/verify`, the sync worker calls `verifyMedicine` with that exact URL.
- **Legacy Fallback Test:** Verifies that when a legacy scan (missing `apiUrl`) is processed, the sync worker calls `verifyMedicine` with `undefined` for the endpoint parameter, triggering the default global configuration fallback.

### Validation Checks
All 6 tests in the focused suite passed successfully. TypeScript compilation, Prettier formatting, and `git diff --check` were verified.