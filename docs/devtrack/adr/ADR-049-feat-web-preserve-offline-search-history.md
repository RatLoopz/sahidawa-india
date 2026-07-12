# ADR — feat(web): preserve offline search history

> **Date:** 2026-07-11 | **PR:** #3500 | **Status:** Accepted

## Context

The SahiDawa platform required a mechanism to preserve offline search history, allowing users to execute saved searches when reconnecting to the internet. This feature aimed to improve the overall user experience, especially in areas with intermittent internet connectivity.

## Decision

The decision was made to implement a system that preserves offline search history by storing queued searches in IndexedDB. When the user reconnects, the system automatically executes the most recent queued search and removes that specific entry after successful execution. The implementation includes an interactive offline-search history UI, allowing users to manually execute saved searches. Duplicate query strings are supported independently through UUID-backed queue entries.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Clearing the entire search queue after reconnect | This approach would result in loss of user data and negatively impact the user experience. |
| Implementing a simple caching mechanism without IndexedDB | This alternative would not provide a robust solution for storing and managing offline search history, potentially leading to data inconsistencies and performance issues. |

## Consequences

**Positive:**
- Improved user experience through preservation of offline search history
- Enhanced functionality with manual execution of saved searches
- Support for duplicate query strings through UUID-backed queue entries

**Trade-offs:**
- Added complexity in managing IndexedDB storage and queue execution
- Potential performance impact due to increased data storage and processing

## Related Issues & PRs

- PR #3500: feat(web): preserve offline search history
- Issue #3494