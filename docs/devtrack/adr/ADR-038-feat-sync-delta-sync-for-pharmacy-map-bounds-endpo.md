# ADR — feat(sync): delta sync for pharmacy map bounds endpoint (Phase 1 of #2260)

> **Date:** 2026-06-21 | **PR:** #2323 | **Status:** Accepted

## Context

The `/api/pharmacies/in-bounds` endpoint was identified as a significant bandwidth bottleneck. It performed a full re-fetch of all pharmacies within a given bounding box on every map pan or zoom event. This led to inefficient data transfer, particularly for repeat requests over previously viewed map areas, negatively impacting user experience on low-bandwidth connections.

## Decision

Delta (incremental) sync was implemented for the `/api/pharmacies/in-bounds` endpoint, targeting the identified bandwidth bottleneck.

1.  An `updated_at` column was added to the `pharmacies` table, along with a database trigger to automatically update this timestamp on every row modification and an index for efficient querying.
2.  A new PostgreSQL RPC function, `get_pharmacies_in_bounds_delta(...)`, was introduced. This function accepts a `since` timestamp and returns only pharmacy records that were created or updated after that time within the specified bounds.
3.  The `/api/pharmacies/in-bounds` API endpoint was modified to accept an optional `since` ISO timestamp query parameter.
    - When `since` is omitted, the endpoint continues to call the original RPC and returns a full set of pharmacies within the bounding box, ensuring backward compatibility.
    - When `since` is present, the new delta RPC is called, returning only changed pharmacies.
4.  API responses now include `syncedAt` (a server timestamp to be used as the `since` parameter in subsequent delta requests) and a `delta` boolean flag (indicating whether the response is a delta or a full set). The `pharmacies` array in the response now includes `id` and `updated_at` for each record.
5.  Client-side code (`apps/web/lib/api.ts`, `apps/web/app/[locale]/map/page.tsx`) was updated to accommodate the new API response shape.

## Alternatives Considered

| Alternative                                 | Why Rejected                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Protobuf serialization for payloads**     | Would have introduced significant complexity (schema definitions, serialization layer, client codegen) across the API for most endpoints where payloads were already small. The primary bottleneck was identified as repeated full data fetches, not JSON parsing CPU cost, which was not yet profiled as a major issue on low-end devices. |
| **Chunked streaming for initial hydration** | The application did not have a "download the whole medicine database" flow or similar bulk initial hydration requirement. This approach was deemed irrelevant for the current architecture and endpoints, which primarily handle targeted, parameterized requests.                                                                          |

## Consequences

**Positive:**

- Significantly reduced bandwidth consumption for repeated map pan/zoom operations by only transferring changed pharmacy data.
- Improved perceived performance and responsiveness for users, particularly on low-bandwidth networks.
- Maintained backward compatibility for existing API consumers by preserving the full-fetch behavior when the `since` parameter is omitted.

**Trade-offs:**

- Deletions of pharmacies are not reported by the delta sync mechanism. The system currently uses hard deletes without a tombstone or soft-delete system, meaning clients may display stale data for deleted pharmacies until a full re-sync of the area occurs.
- Increased database schema complexity with the addition of an `updated_at` column, trigger, and index.
- Increased API endpoint logic complexity to handle both full and delta sync paths.

## Related Issues & PRs

- PR #2323: feat(sync): delta sync for pharmacy map bounds endpoint (Phase 1 of #2260)
- Closes part of #2260: Delta sync for pharmacy map bounds (protobuf and streaming tracked as follow-ups).
