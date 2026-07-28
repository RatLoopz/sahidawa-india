# ADR — feat(web): implement offline-first scan history sync and connection s…

> **Date:** 2026-07-28 | **PR:** #3894 | **Status:** Accepted

## Context

SahiDawa operates in rural Indian environments characterized by highly intermittent and low-bandwidth network connectivity. Users scanning medicines need their scan history preserved locally and synchronized seamlessly with the cloud once internet connectivity is restored. 

Previously, the web application lacked automatic synchronization triggers and clear visual cues regarding connection and sync status. This led to potential data loss, redundant manual sync attempts, and user confusion regarding whether their local scans were safely backed up to the cloud.

## Decision

We implemented a reactive, offline-first synchronization architecture within the scan history module. The implementation details include:

1. **Network State Tracking:** Utilized native browser events (`online`, `offline`) combined with `window.navigator.onLine` to maintain a reactive `isOnline` state.
2. **Automated Synchronization:** Refactored data fetching and synchronization functions (`loadHistory`, `syncHistoryFromCloud`) using `useCallback` to stabilize dependency arrays. Added a `useEffect` hook that automatically triggers background synchronization immediately when the browser transitions to an online state.
3. **State-Driven UI & Guardrails:** Introduced a multi-state sync indicator (`synced`, `pending`, `syncing`, `error`) and disabled manual sync actions during offline or active sync states to prevent race conditions and redundant API payloads.
4. **Localization:** Added full translation keys for all sync states across 6 regional Indian languages (`en`, `hi`, `kok`, `sd`, `mni`, `mai`) to ensure accessibility for rural users.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Service Worker Background Sync API** | Rejected due to inconsistent support across older mobile browsers and WebViews frequently used in rural Indian demographics. It also introduced unnecessary architectural complexity for the current scope. |
| **Periodic Polling (Interval-based Sync)** | Rejected because polling consumes excessive battery and cellular data, which are highly constrained resources for our target user base. Event-driven synchronization is significantly more resource-efficient. |

## Consequences

**Positive:**
- **Improved UX in Low-Connectivity Zones:** Automatic, zero-touch data synchronization occurs as soon as a network connection is detected.
- **Data Integrity:** Disabling manual sync triggers during offline states or active sync operations prevents duplicate payloads and race conditions.
- **Localized Transparency:** Real-time sync status indicators are fully localized in regional languages, building trust with non-English speaking users.

**Trade-offs:**
- **False Positives:** The browser's `navigator.onLine` API can occasionally report false positives (e.g., connected to a local Wi-Fi router that lacks actual internet access).
- **Component Complexity:** Increased client-side state management complexity within the history page component.

## Related Issues & PRs

- PR #3894: feat(web): implement offline-first scan history sync and connection s…
- Issue #3892