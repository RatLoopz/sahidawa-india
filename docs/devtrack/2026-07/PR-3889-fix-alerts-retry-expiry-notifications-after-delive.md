# PR #3889 — fix(alerts): retry expiry notifications after delivery failures

> **Merged:** 2026-07-28 | **Author:** @Shreya-nipunge | **Area:** Backend | **Impact Score:** 6 | **Closes:** #3883

## What Changed

We modified our cron-based alert broadcaster (`broadcastExpiryAlerts`) to defer marking medicine batches as "broadcasted" until after we verify that at least one notification has been successfully delivered. Previously, batches were marked as broadcasted *before* any delivery was attempted, which meant that if the SMS or WhatsApp delivery failed, the system would never retry sending alerts for those expiring medicine batches. We also refactored `sendConsolidatedExpiryNotification` to return a boolean indicating delivery success using `Promise.allSettled`.

## The Problem Being Solved

In rural health contexts, reliable communication is critical; if a community health worker or clinic doesn't receive an alert about an expiring medicine batch, expired drugs might be distributed, or critical stock might go to waste. 

Previously, our system marked batches as `expiry_broadcasted = true` eagerly before dispatching notifications. If our SMS or WhatsApp gateways failed (e.g., due to network dropouts, API downtime, or rate limits), the cron job considered the work "done" and never retried. This led to silent notification failures. We needed a resilient mechanism that retries delivery on subsequent cron runs if all deliveries fail, while avoiding duplicate alerts in partial success scenarios.

## Files Modified

- `apps/api/src/cron/alert-broadcaster.ts`
- `apps/api/tests/alertBroadcaster.test.ts`

## Implementation Details

### 1. Refactoring Notification Dispatch
We updated `sendConsolidatedExpiryNotification` to return a `Promise<boolean>` instead of `Promise<void>`. Inside this function, we collect the dispatch promises from `smsService.send` and `whatsappService.send`. Instead of using `Promise.all` (which rejects entirely if a single channel fails), we now use `Promise.allSettled`:

```typescript
const results = await Promise.allSettled(sendPromises);
return results.some((result) => result.status === "fulfilled" && result.value);
```

This returns `true` if at least one notification channel successfully delivered the message.

### 2. Postponing Database Updates
In `broadcastExpiryAlerts`, we removed the eager update query that set `expiry_broadcasted: true` on the `batches` table. Instead, we perform a read-only validation check (`.select("id")`) to preserve the existing chunking and validation logic.

### 3. Tracking Delivery Success
We introduced a boolean flag `hasSuccessfulDelivery = false` before iterating through subscribers. As we process subscriber chunks, we resolve the notification promises with `Promise.allSettled` and update the flag:

```typescript
const results = await Promise.allSettled(notificationPromises);
hasSuccessfulDelivery ||= results.some(
    (result) => result.status === "fulfilled" && result.value
);
```

### 4. Conditional Batch Marking
After the subscriber loop completes, we check `hasSuccessfulDelivery`. If it remains `false`, we log a warning and return early without updating the database. This leaves the batches eligible for the next cron run. If at least one delivery succeeded, we chunk the batches and update `expiry_broadcasted: true` in Supabase.

## Technical Decisions

- **Promise.allSettled vs Promise.all**: We chose `Promise.allSettled` because we do not want a single failing channel (e.g., WhatsApp API down but SMS working) to fail the entire notification block.
- **At-Least-Once Delivery vs Duplicate Prevention**: In a partial success scenario (e.g., SMS succeeds but WhatsApp fails), we still mark the batch as broadcasted. This is a deliberate trade-off to prevent spamming subscribers who already received the alert via one channel, prioritizing duplicate prevention over absolute multi-channel delivery guarantee.
- **Deferred Chunked Updates**: We deferred the database write to the end of the execution. This ensures that database state accurately reflects real-world delivery attempts.

## How To Re-Implement (Contributor Reference)

If you need to implement a similar retryable notification pattern for other alerts (e.g., stockouts or temperature excursions), follow these steps:

1. **Return Delivery Status**: Ensure your notification dispatch helper returns a `Promise<boolean>` indicating whether at least one channel succeeded.
2. **Avoid Eager State Commits**: Do not update the database status of the entities being broadcasted before the notifications are actually dispatched.
3. **Track Success Across Chunks**: Initialize a `hasSuccessfulDelivery` flag to `false` before processing subscribers.
4. **Use Promise.allSettled**: When dispatching to multiple subscribers or channels, use `Promise.allSettled` to prevent a single failure from halting the execution of other notifications.
5. **Conditionally Commit State**: Only perform the bulk update (e.g., setting `broadcasted = true`) if `hasSuccessfulDelivery` is `true`. Otherwise, log a warning and exit so the cron job picks up the records on the next run.

## Impact on System Architecture

This change shifts our alert system from an "eager, fire-and-forget" model to a "resilient, deferred-commit" model. It ensures high reliability for critical medicine expiry alerts in rural areas where network connectivity to SMS/WhatsApp gateways can be highly volatile. It introduces a pattern of tracking delivery state before committing database state, which can be replicated across other notification crons in SahiDawa.

## Testing & Verification

We added comprehensive regression tests in `apps/api/tests/alertBroadcaster.test.ts` covering:
- **All Deliveries Succeed**: Verifies batches are marked as broadcasted after successful delivery.
- **All Deliveries Fail**: Verifies batches remain unmarked (eligible for retry) when all SMS/WhatsApp sends fail.
- **Partial Success**: Verifies batches are marked as broadcasted if at least one channel (e.g., SMS) succeeds.
- **Order of Operations**: Verifies that subscriber fetching occurs before database updates.