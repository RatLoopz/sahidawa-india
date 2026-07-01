# PR #2855 — Fix : Counterfeit reports reviewed and approved by admin are excluded from district alert tallies#2817

> **Merged:** 2026-07-01 | **Author:** @hrx01-dev | **Area:** Backend | **Impact Score:** 9 | **Closes:** #2817

## What Changed

We updated the PATCH route `/:id/status` in our reports API to automatically inject `is_escalated = false` into the database update payload when an administrator approves a report as either `"verified_fake"` or `"false_alarm"`. This change ensures that once an escalated report is resolved by an admin, its escalation flag is cleared, allowing it to be correctly included in the district-level counterfeit tallies. We also added a comprehensive integration test to verify that the database payload is updated correctly and that the subsequent district alert threshold query is executed.

## The Problem Being Solved

In our system, we track counterfeit medicine reports across different rural districts to trigger localized health alerts. When a report was flagged as escalated (`is_escalated = true`), it required admin review. However, when an admin approved the report (marking it as `"verified_fake"` or `"false_alarm"`), the `is_escalated` flag remained `true` in the database. 

Our district alert threshold query calculates the total number of verified fake reports in a district by filtering for `.eq("is_escalated", false)`. Because resolved reports still had `is_escalated` set to `true`, they were excluded from this tally. This caused a critical bug: verified counterfeit medicines were not counting toward the threshold of 5 reports required to trigger a district alert and fire push notifications, leaving rural communities unaware of localized counterfeit surges.

## Files Modified

- `apps/api/src/routes/reports.ts`
- `apps/api/tests/reports.test.ts`

## Implementation Details

In `apps/api/src/routes/reports.ts`, inside the PATCH handler for `/:id/status`, we introduced a dynamic `updatePayload` object instead of directly passing `{ status }` to the Supabase client:

```typescript
const updatePayload: Record<string, unknown> = { status };
if (status === "verified_fake" || status === "false_alarm") {
    updatePayload.is_escalated = false;
}
```

We then perform the database update using this payload:

```typescript
const { data, error } = await supabase
    .from("counterfeit_reports")
    .update(updatePayload)
    .eq("id", req.params.id)
    .select()
    .single();
```

This database update triggers the downstream threshold logic. The threshold logic queries the count of reports where `is_escalated` is `false`. Since the updated report now matches this filter, the count increments correctly. If the count reaches 5, it upserts into the `district_alerts` table and triggers push notifications.

In `apps/api/tests/reports.test.ts`, we added a new test case: `"escalated reports that are approved as verified_fake increment the district's verified counterfeit count"`. This test mocks the Supabase client to simulate an escalated report (`is_escalated: true`) being updated to `"verified_fake"`. It asserts that the update payload contains `is_escalated: false` and that the subsequent count query (which filters for `is_escalated: false`) is executed and returns the correct count to trigger the district alert upsert.

## Technical Decisions

- **Inline Payload Mutation vs. Separate Query:** We chose to update `is_escalated` in the same single database update payload (`updatePayload`) rather than running a separate query or database trigger. This minimizes database roundtrips and maintains transactional integrity within the route handler.
- **Explicit Status Check:** We restricted the automatic de-escalation to `"verified_fake"` and `"false_alarm"` statuses. This ensures that if a report is moved to other intermediate statuses, the escalation flag is not prematurely cleared.
- **Mock-Based Integration Testing:** We utilized Jest mock implementations for the Supabase client to assert both the payload structure and the execution of the subsequent count query, ensuring that we don't hit the live database during unit/integration tests while still validating the exact query chain.

## How To Re-Implement (Contributor Reference)

To re-implement or modify this behavior, follow these steps:

1. Locate the PATCH route handler for updating a report's status in `apps/api/src/routes/reports.ts`.
2. Before executing the database update, initialize a payload object: `const updatePayload: Record<string, unknown> = { status };`.
3. Add a conditional check: if the status is `"verified_fake"` or `"false_alarm"`, set `updatePayload.is_escalated = false;`.
4. Pass `updatePayload` to the Supabase `.update()` call instead of a static `{ status }` object.
5. Ensure that the downstream logic queries the `counterfeit_reports` table filtering by `.eq("is_escalated", false)` to aggregate the count of active, verified reports for the district.
6. If the count is greater than or equal to 5, perform an upsert on the `district_alerts` table.
7. Write a test in `apps/api/tests/reports.test.ts` that mocks Supabase's `from` method, intercepts the `update` call to verify `is_escalated: false` is present, and verifies that the subsequent count query is executed.

## Impact on System Architecture

This fix restores the integrity of our real-time alerting pipeline. By ensuring that resolved escalations flow back into the standard report pool (where `is_escalated` is `false`), our district-level aggregation queries now reflect the true state of counterfeit distribution. This unlocks reliable, automated push notifications for rural health workers and pharmacies when a district crosses the critical threshold of 5 verified counterfeit reports.

## Testing & Verification

We verified this change using Jest integration tests in `apps/api/tests/reports.test.ts`. 

The test mocks a report with an initial state of `is_escalated: true`. It triggers the PATCH `/api/reports/report-id-123/status` endpoint with `{ status: "verified_fake" }`.

We assert that:
1. The HTTP response status is `200`.
2. The update payload sent to Supabase contains `is_escalated: false`.
3. The subsequent count query (filtering for `is_escalated: false`) is successfully executed (`countQueryExecuted === true`).
4. The `district_alerts` upsert is triggered when the count threshold is met.