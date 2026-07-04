# ADR — Adding Snooze Functionality to Tracker

> **Date:** 2026-07-04 | **PR:** #3006 | **Status:** Accepted

## Context

In the SahiDawa medicine expiry tracker, expiring or expired medicines trigger persistent, high-visibility warnings and notifications on the user dashboard. While these alerts are critical for patient safety, users frequently encounter scenarios where they cannot immediately replenish or dispose of a medicine but still need to clear urgent alerts to focus on other items. Deleting the medicine record to silence the alert was the only workaround, which destroyed valuable inventory history. A mechanism was required to temporarily dismiss these active notifications and dashboard warnings without permanently deleting the underlying medicine records.

## Decision

We implemented a "Snooze for 3 days" feature for expiring or expired medicines. This was executed across the database, state management, and UI layers:

1. **Database Schema Update:** Added a nullable `snoozed_until` (`TIMESTAMPTZ`) column to the `expiry_tracker_items` table via migration `20260701000000_add_snoozed_until_to_expiry_tracker.sql`.
2. **State & Sync Layer:** Extended the frontend `Medicine` interface with an optional `snoozedUntil` ISO timestamp. Updated `useMedicineTracker` to support dual-state persistence: updating Supabase for authenticated users and syncing to local storage for guest users.
3. **Notification Management:** Integrated notification cancellation directly into the snooze action (`snoozeMedicine`), ensuring pending local alerts are cleared immediately when a user snoozes an item.
4. **Dynamic Status Overriding:** Modified the frontend status evaluation logic (`getExpiryStatus`). If `snoozedUntil` is set and is in the future, the medicine's operational status is dynamically overridden to "safe". This automatically filters the item out of urgent dashboard views (e.g., "expired" or "expiring soon" lists).
5. **UI Integration:** Added a conditional `BellOff` action button in `ExpiryTable.tsx`, restricted to items currently flagged as "expired" or "expiringSoon".

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Pure Client-Side Snoozing** | Storing the snooze state exclusively in browser local storage for all users would simplify the database schema. However, this was rejected because it breaks multi-device synchronization for authenticated users, causing inconsistent alert states across devices. |
| **Status-Based Soft Archive** | Moving snoozed items to a separate "Archived" tab or status. This was rejected because users still need to see these medicines in their primary active inventory list; they only want to suppress the urgent visual alarms and push notifications. |

## Consequences

**Positive:**
- **Reduced Alert Fatigue:** Users can temporarily clear clutter from their primary dashboards, improving usability in high-stress rural healthcare environments.
- **Data Preservation:** Eliminates the need for users to delete records prematurely, preserving historical inventory data.
- **Hybrid Offline Support:** Seamlessly handles both authenticated Supabase sync and offline guest storage.

**Trade-offs:**
- **Presentation Layer Coupling:** Overriding the status to "safe" is handled dynamically in the frontend (`getExpiryStatus`). If backend-driven reports or notifications are generated in the future, the backend must duplicate this logic to respect the `snoozed_until` timestamp.
- **Hardcoded Duration:** The snooze duration is currently fixed at 3 days, which may not fit all use cases but was chosen to keep the UI simple and avoid configuration bloat.

## Related Issues & PRs

- PR #3006: Adding Snooze Functionality to Tracker
- Issue #2346