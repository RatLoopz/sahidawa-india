# ADR — fix(scan): use queued endpoint during offline sync

> **Date:** 2026-07-28 | **PR:** #3890 | **Status:** Accepted

## Context

SahiDawa relies on offline-first capabilities to support medicine verification in rural areas with intermittent connectivity. Scans performed offline are stored in an IndexedDB-backed queue (`syncQueue`) and synchronized when connectivity is restored. 

Previously, the synchronization worker ignored the specific `apiUrl` captured at the time of the scan, instead defaulting to the active global configuration at the time of synchronization. This created a discrepancy if the network environment, ML service routing, or API configuration changed between the offline scan event and the subsequent sync. Furthermore, any fix had to maintain backward compatibility with legacy queued items in IndexedDB that lacked the `apiUrl` field.

## Decision

We updated the synchronization pipeline to respect the endpoint captured at the time of the offline scan:

1. **Parameterize Verification Endpoint:** Modified `verifyMedicine` in `apps/web/lib/api.ts` to accept an optional `endpoint` parameter. When provided, the function targets this specific endpoint. To ensure deterministic behavior, if a targeted endpoint is provided and fails, the function throws an error immediately rather than silently falling back to the Node API.
2. **Pass Queued Endpoint During Sync:** Updated `scanQueueSync.ts` to pass the stored `item.apiUrl` from the queue item into `verifyMedicine`.
3. **Graceful Legacy Fallback:** Made the `apiUrl` property optional in the `QueuedScan` interface. If a legacy queue item lacks an `apiUrl`, the system falls back to the active global environment configuration (`NEXT_PUBLIC_ML_URL` or `NEXT_PUBLIC_API_URL`).

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Dynamic Runtime Resolution** (Always use the latest global configuration during sync) | Rejected because it fails to respect the specific network path or ML model version targeted when the user performed the scan, which is critical for multi-tenant or version-sensitive deployments. |
| **IndexedDB Schema Migration** (Backfill missing `apiUrl` fields for legacy queue items) | Rejected due to unnecessary complexity and risk of database corruption on client devices. A runtime fallback to global configuration handles legacy items safely without schema migrations. |

## Consequences

**Positive:**
- Ensures deterministic synchronization behavior by preserving the exact API/ML endpoint targeted at the time of the scan.
- Maintains backward compatibility with legacy offline queues via a graceful fallback mechanism.
- Implements strict error handling for targeted endpoints, preventing silent, incorrect fallbacks during sync.

**Trade-offs:**
- Increases the complexity of the `verifyMedicine` signature and internal routing logic.
- If an endpoint captured in the queue becomes permanently decommissioned before sync occurs, those queue items will fail to sync until handled, rather than silently falling back to the active Node API.

## Related Issues & PRs

- PR #3890: fix(scan): use queued endpoint during offline sync
- Issue #3884