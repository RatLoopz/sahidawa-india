# PR #3006 — Adding Snooze Functionality to Tracker

> **Merged:** 2026-07-04 | **Author:** @CopperFlame14 | **Area:** Frontend | **Impact Score:** 25 | **Closes:** #2346

## What Changed

We introduced a "Snooze for 3 days" feature for expiring or expired medicines within our Expiry Tracker. This allows users to temporarily dismiss urgent warnings from their active notifications and dashboard views without having to delete the medicine record entirely. The change spans our database schema, state management hooks, filtering logic, and the user interface.

## The Problem Being Solved

Before this PR, users tracking their medicines faced a binary choice when a medicine expired or was close to expiring: either delete the medicine record entirely to clear the urgent red/amber alerts, or tolerate persistent visual noise on their dashboard. This visual noise often led to alert fatigue, particularly in rural health settings where users might not have immediate access to replacement medicines but still need to keep a record of what they have. We needed a mechanism to temporarily suppress these alerts while preserving the historical and inventory data of the medicine.

## Files Modified

- `apps/web/app/[locale]/expiry-tracker/components/ExpiryTable.tsx`
- `apps/web/app/[locale]/expiry-tracker/page.tsx`
- `apps/web/hooks/useMedicineTracker.ts`
- `supabase/migrations/20260701000000_add_snoozed_until_to_expiry_tracker.sql`

## Implementation Details

### 1. Database Schema Update
We created a migration script `20260701000000_add_snoozed_until_to_expiry_tracker.sql` to add a nullable `snoozed_until` column of type `TIMESTAMPTZ` to the `expiry_tracker_items` table. This stores the exact timestamp until which the alerts should be suppressed.

### 2. State & Hooks (`useMedicineTracker.ts`)
- **Type Extension:** We updated the `Medicine` interface to include an optional `snoozedUntil?: string` ISO timestamp.
- **Data Mapping:** We modified the Supabase data mapper to read and populate `snoozedUntil` from the database column `snoozed_until`.
- **State Preservation:** We updated the `editMedicine` function to ensure that when a user edits a medicine's attributes (like its name or batch number), any existing `snoozedUntil` timestamp is preserved rather than overwritten or wiped out.
- **Snooze Action:** We implemented and exported a new `snoozeMedicine(id, days = 3)` callback. This function:
  1. Calculates a future timestamp based on the current date plus the specified number of days.
  2. Updates the database via Supabase if the user is authenticated.
  3. Updates local storage via `lsWrite` if the user is a guest.
  4. Triggers `cancelNotificationsForMedicine(id)` to clear any scheduled local notifications for that item.

### 3. List Filtering & Status Logic (`page.tsx`)
- We refactored `getExpiryStatus` to accept the entire `Medicine` object instead of just a date string.
- Inside `getExpiryStatus`, we added a check: if `med.snoozedUntil` exists and is in the future (`new Date(med.snoozedUntil) > new Date()`), we override the operational status to `"safe"`. This returns a green badge with the `CheckCircle2` icon and the text `statusSafe`.
- Because the status key is overridden to `"safe"`, these items are automatically filtered out of urgent dashboard lists like "expired" or "expiring soon" views.

### 4. User Interface (`ExpiryTable.tsx`)
- We imported the `BellOff` icon from `lucide-react`.
- We added a Snooze action button next to the edit and delete options in the table.
- We conditioned the visibility of this button so that it only displays for medicines whose current active status is `"expired"` or `"expiringSoon"`. Clicking this button triggers the `onSnooze` handler.

## Technical Decisions

- **Use of `TIMESTAMPTZ`:** We chose `TIMESTAMPTZ` for the database column to ensure that snooze expirations are calculated and handled correctly across different timezones in India, preventing edge cases where a snooze might expire early or late due to server-client timezone mismatches.
- **Status Override Pattern:** Instead of introducing a complex new state machine or adding a separate "snoozed" status category throughout the UI, we chose to map snoozed items to the existing `"safe"` status. This allowed us to reuse all existing filtering, styling, and rendering pipelines with minimal code changes.
- **Notification Cancellation:** We decided to explicitly call `cancelNotificationsForMedicine` when an item is snoozed. This ensures that the user's explicit action to silence an alert is immediately respected across both the UI and the device's notification system.

## How To Re-Implement (Contributor Reference)

If you need to re-implement or extend this snooze functionality in another tracker module, follow these steps:

1. **Database Migration:**
   Add a nullable timestamp column to your target table:
   ```sql
   ALTER TABLE public.your_table_name ADD COLUMN snoozed_until TIMESTAMPTZ;
   ```

2. **Type Definitions:**
   Extend your frontend data models to include `snoozedUntil?: string`.

3. **Data Mapping:**
   Ensure your database-to-frontend mapping layer correctly reads `snoozed_until` and maps it to camelCase `snoozedUntil`.

4. **Snooze Logic in Hook:**
   Implement a callback that calculates the future date and updates the state. Ensure you handle both authenticated and guest (local storage) states:
   ```typescript
   const snoozeMedicine = useCallback(async (id: string, days: number = 3) => {
       const snoozeDate = new Date();
       snoozeDate.setDate(snoozeDate.getDate() + days);
       const snoozedUntil = snoozeDate.toISOString();
       
       if (userId) {
           await supabase.from("your_table").update({ snoozed_until: snoozedUntil }).eq("id", id);
       } else {
           // Update local storage state
       }
       // Cancel any scheduled notifications
       await cancelNotificationsForMedicine(id);
   }, [userId]);
   ```

5. **Preserve State on Edit:**
   When writing edit/update functions, make sure you fetch the existing item first and carry over the `snoozedUntil` value so it isn't lost during standard updates.

6. **Status Evaluation:**
   In your status resolution helper, check the snooze timestamp before checking the actual expiry date:
   ```typescript
   if (item.snoozedUntil && new Date(item.snoozedUntil) > new Date()) {
       return { key: "safe", ...styles };
   }
   ```

7. **UI Trigger:**
   Add a button (using `BellOff` or a similar icon) to your table or card component. Only render it if the item's natural status is warning/critical, and bind it to your snooze callback.

## Impact on System Architecture

This change introduces a clean pattern for temporary state overrides within our local-first state architecture. By supporting both Supabase and local storage, we maintain our offline-first capability, which is critical for rural health workers operating in low-connectivity areas. Additionally, it establishes a reusable pattern for notification suppression that can be applied to other modules, such as dosage reminders or refill alerts.

## Testing & Verification

- **Snooze Expiration:** Verified that once the current system time passes the `snoozedUntil` timestamp, the medicine automatically reverts to its correct `"expired"` or `"expiringSoon"` status without requiring any manual database updates.
- **Guest Mode:** Verified that guest users (not logged in) have their snooze states correctly written to and read from `localStorage`.
- **Edit Integrity:** Verified that editing a snoozed medicine's notes or batch number does not clear or reset the active snooze window.
- **Notification Suppression:** Confirmed that calling `snoozeMedicine` successfully invokes `cancelNotificationsForMedicine` to prevent unwanted local alerts.