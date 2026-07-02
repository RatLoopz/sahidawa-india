# PR #2980 — fix(#2974): handle child vaccine sync failures

> **Merged:** 2026-07-02 | **Author:** @Shreya-nipunge | **Area:** Frontend | **Impact Score:** 8 | **Closes:** #2974

## What Changed

We introduced robust error handling, user-facing error states, and a manual retry mechanism for the Child Vaccination Tracker's cloud synchronization process. Previously, database write failures to Supabase were unhandled, leading to silent synchronization failures where the UI state diverged from the backend database state.

## The Problem Being Solved

Before this PR, if a user marked a vaccine dose as completed or uncompleted while offline or during a database hiccup, the local UI updated immediately, but the corresponding Supabase write (`insert` or `delete` on `child_completed_vaccinations`) could fail silently. Crucially, the component updated its internal tracking ref (`cloudCompletedDoseIdsRef.current`) *before* verifying if the network request succeeded. This meant our system assumed the cloud was in sync when it wasn't, preventing subsequent automatic retries and leaving the user unaware that their child's vaccination records were not safely backed up to our cloud database.

## Files Modified

- `apps/web/components/vaccine/ChildVaccinationTracker.tsx`
- `apps/web/tests/child-vaccination-cloud-sync.test.tsx`

## Implementation Details

### State Management & Synchronization Flow
We introduced two new state variables inside `ChildVaccinationTracker`:
- `syncError` (`string | null`): Tracks the user-facing error message when a network or database write fails.
- `syncRetryToken` (`number`): A counter used to force-trigger the synchronization `useEffect` hook when the user clicks the "Try again" button.

### Safe Ref Updates & Error Detection
We modified the synchronization `useEffect` hook to prevent silent failures:
1. **Deferred Ref Updates:** We moved the assignment of `cloudCompletedDoseIdsRef.current = nextCompletedDoseIds` to occur *only* after a successful `Promise.all` resolution of all Supabase operations.
2. **Explicit Error Checking:** Because the Supabase JS client does not throw errors by default on failed queries (it returns an object containing an `error` property), we added an explicit check:
   ```typescript
   const failedResult = results.find((result) => result.error);
   if (failedResult?.error) {
       throw failedResult.error;
   }
   ```
3. **Race Condition Prevention:** We implemented an `isActive` boolean flag inside the effect. If the component unmounts or the effect re-runs before the Supabase promises resolve, `isActive` is set to `false` in the cleanup function, preventing state updates on unmounted components.

### UI Feedback
If an error is caught, the catch block sets a user-friendly error message: *"We couldn't save this vaccination change to your account. Your change is still shown here, but please try syncing again."* This is rendered in a red alert banner with an `AlertCircle` icon and a "Try again" button that increments the `syncRetryToken`.

## Technical Decisions

- **Why `syncRetryToken` instead of a boolean?** A numeric token allows us to trigger the synchronization effect repeatedly even if the error state remains the same, bypassing React's shallow comparison optimization.
- **Why `isActive` flag?** Standard React cleanup pattern to prevent memory leaks and "state update on unmounted component" warnings if the user navigates away or toggles doses rapidly while a network request is in flight.
- **Why `Promise.all`?** To execute all batch inserts and deletes concurrently, minimizing total latency for multi-dose updates, while still ensuring that a single failure rejects the entire batch sync attempt.

## How To Re-Implement (Contributor Reference)

If you need to implement a similar cloud synchronization pattern for another tracker in our system, follow these steps:

1. **Define Sync States:**
   ```typescript
   const [syncError, setSyncError] = useState<string | null>(null);
   const [syncRetryToken, setSyncRetryToken] = useState(0);
   ```

2. **Structure the Sync Effect:**
   Include the local state, the cloud profile ID, and the retry token in the dependency array:
   ```typescript
   useEffect(() => {
       let isActive = true;
       
       // Calculate diffs (added/removed items)
       if (!added.length && !removed.length) {
           setSyncError(null);
           return;
       }

       const syncData = async () => {
           try {
               const results = await Promise.all([
                   // Map your Supabase insert/delete promises here
               ]);

               const failedResult = results.find((r) => r.error);
               if (failedResult?.error) throw failedResult.error;

               if (!isActive) return;

               // Update your local tracking ref ONLY on success
               cloudRef.current = nextState;
               setSyncError(null);
           } catch (err) {
               if (!isActive) return;
               setSyncError("Your custom error message here.");
           }
       };

       syncData();

       return () => {
           isActive = false;
       };
   }, [cloudProfileId, syncRetryToken, localState]);
   ```

3. **Render the Error Banner:**
   Ensure the banner is accessible, uses semantic HTML, and provides a button to increment the retry token:
   ```tsx
   {syncError && (
       <div>
           <p>{syncError}</p>
           <button type="button" onClick={() => setSyncRetryToken(t => t + 1)}>
               Try again
           </button>
       </div>
   )}
   ```

## Impact on System Architecture

This change hardens our offline-first and cloud-sync synchronization layer. By ensuring that local refs only advance when the remote database is confirmed to be in sync, we prevent data drift between the local client and our Supabase backend. This establishes a reliable pattern for other tracker modules (e.g., medicine adherence, growth charts) to handle network failures gracefully.

## Testing & Verification

We added a comprehensive integration test in `apps/web/tests/child-vaccination-cloud-sync.test.tsx`:
- **Test Case:** `"shows a retryable error when completed dose sync fails"`
- **Flow Verified:**
  1. Mock a failed Supabase insert (`mocks.completedInsert.mockResolvedValueOnce({ error: new Error("insert failed") })`).
  2. Simulate marking a vaccine (e.g., BCG) as completed.
  3. Assert that the error message is displayed in the UI.
  4. Simulate clicking the "Try again" button.
  5. Assert that the insert is re-attempted and succeeds, and the error banner is removed.

*Note: The PR author noted that local test execution was blocked by pre-existing repository dependency issues (missing `@testing-library/dom` config and localization JSON syntax issues), but the logic itself was verified via code review and static analysis.*