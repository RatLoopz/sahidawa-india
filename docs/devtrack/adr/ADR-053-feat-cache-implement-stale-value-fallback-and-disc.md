# ADR — feat(cache): Implement stale-value fallback and Discord alerting on Redis stat failures#3579

> **Date:** 2026-07-14 | **PR:** #3582 | **Status:** Accepted

## Context

The SahiDawa platform relies on Redis to track and display cache performance statistics (hit/miss counts, tier breakdowns, and top queried drugs) in the UI. Previously, if any individual Redis stat fetch failed or if the Redis node became entirely unreachable, the API would return incomplete data or fail, causing UI disruptions. Furthermore, there was no automated alerting mechanism to notify the engineering team of Redis node degradation or complete outages in real-time, leading to delayed incident response.

## Decision

We implemented a resilient stale-value fallback mechanism and an automated Discord alerting system within the cache service:

1. **Snapshot Storage:** Aggregated cache statistics are periodically written to a short-lived (5-minute TTL) Redis key: `stats:snapshot:last_known`.
2. **Concurrent Polling:** Modified `getCacheStats()` to poll live statistics concurrently alongside the stale snapshot key using `Promise.allSettled`.
3. **Stale Fallback Strategy:** If any single live stat fetch fails (partial failure), the system returns the retrieved stale snapshot to ensure UI continuity. If all fetches fail or the Redis client is closed (complete failure), the system returns the snapshot (or default zero values as a last resort).
4. **Discord Alerting:** Implemented a `sendCacheAlertDiscord` helper function utilizing the `PG_CRON_MONITOR_WEBHOOK_URL` environment variable. This webhook is triggered on complete Redis node failures.
5. **Alert Debouncing:** Added a 15-minute global debounce (`DISCORD_ALERT_DEBOUNCE_MS`) to prevent webhook rate-limiting and spam during sustained outages.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Direct Database Fallback (PostgreSQL) | Writing transient cache statistics to the primary relational database would introduce unnecessary write overhead and latency, defeating the purpose of using a lightweight cache layer for stats. |
| In-Memory Application Cache for Snapshots | Storing the last known snapshot in the API node's local memory would not scale across multiple containerized API instances, leading to inconsistent stats across different client requests. |

## Consequences

**Positive:**
- Improved UI resilience: The dashboard continues to display coherent, albeit slightly stale, statistics during transient Redis hiccups.
- Proactive monitoring: Real-time Discord alerts notify the team immediately of complete Redis node failures.
- Spam prevention: The 15-minute debounce ensures the alerting channel is not flooded during prolonged outages.

**Trade-offs:**
- If the entire Redis node is down, the snapshot itself cannot be retrieved from Redis, forcing a fallback to default zero values (though alerting still triggers).
- Increased complexity in the `getCacheStats` method due to concurrent polling and manual error handling of `Promise.allSettled` results.

## Related Issues & PRs

- PR #3582: feat(cache): Implement stale-value fallback and Discord alerting on Redis stat failures#3579
- Issue #3579