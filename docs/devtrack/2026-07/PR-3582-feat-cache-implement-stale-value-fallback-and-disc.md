# PR #3582 — feat(cache): Implement stale-value fallback and Discord alerting on Redis stat failures#3579

> **Merged:** 2026-07-14 | **Author:** @hrx01-dev | **Area:** Backend | **Impact Score:** 16 | **Closes:** #3579

## What Changed

We have introduced a stale-value fallback mechanism and Discord alerting for Redis statistic failures in our cache service. This change ensures that our system remains operational even when Redis is unavailable or returns incorrect data. The `getCacheStats` function now polls live stats alongside a stale snapshot using `Promise.allSettled`, allowing it to return the stale snapshot if any live stat fetch fails. Additionally, a Discord alert is sent if all stat fetches fail, indicating a complete Redis failure.

## The Problem Being Solved

Before this PR, our system would fail to return cache statistics if Redis was down or returned incorrect data. This would lead to a poor user experience and make it difficult to diagnose issues. The lack of a fallback mechanism and alerting system meant that our team would not be notified of Redis failures, potentially leading to prolonged downtime.

## Files Modified

- `apps/api/src/services/cache.service.ts`
- `apps/api/src/services/cache.test.ts`

## Implementation Details

The `getCacheStats` function in `cache.service.ts` has been modified to use `Promise.allSettled` to fetch live stats and a stale snapshot concurrently. If any live stat fetch fails, the function returns the stale snapshot. If all stat fetches fail, a Discord alert is sent using the `sendCacheAlertDiscord` function. This function uses the `fetch` API to send a webhook request to the Discord channel specified in the `PG_CRON_MONITOR_WEBHOOK_URL` environment variable. The `lastDiscordAlertTime` variable is used to debounce alerts, preventing multiple alerts from being sent within a 15-minute window.

## Technical Decisions

We chose to use `Promise.allSettled` instead of `Promise.all` to allow the function to return the stale snapshot even if some live stat fetches fail. This approach ensures that our system remains operational even in the presence of partial Redis failures. We also decided to use the `fetch` API to send Discord alerts, as it provides a simple and efficient way to send HTTP requests.

## How To Re-Implement (Contributor Reference)

To re-implement this feature, follow these steps:

1. Modify the `getCacheStats` function in `cache.service.ts` to use `Promise.allSettled` to fetch live stats and a stale snapshot concurrently.
2. Implement the `sendCacheAlertDiscord` function to send a Discord alert using the `fetch` API.
3. Add a debounce mechanism to prevent multiple alerts from being sent within a short time window.
4. Update the `cache.test.ts` file to include tests for the new functionality.

## Impact on System Architecture

This change improves the overall reliability and resilience of our system. By providing a fallback mechanism and alerting system, we can ensure that our system remains operational even in the presence of Redis failures. This change also unlocks future development opportunities, such as implementing more advanced caching strategies and improving our system's ability to handle failures.

## Testing & Verification

We have added comprehensive tests to the `cache.test.ts` file to verify the new functionality. These tests cover the following scenarios:

* Successful fetch of live stats and saving of the snapshot
* Partial failure of live stat fetches, returning the stale snapshot
* Complete failure of live stat fetches, sending a Discord alert and returning default stats

These tests ensure that our system behaves correctly in different scenarios and provide a high level of confidence in the new functionality.