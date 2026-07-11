# ADR — Feat :  Wired homepage search into the existing offline queue#3437

> **Date:** 2024-02-20 | **PR:** #3437 | **Status:** Accepted

## Context
The SahiDawa application required a mechanism to handle search queries when the user is offline, ensuring a seamless experience by queuing searches and executing them when connectivity is restored.

## Decision
The decision was made to integrate the homepage search functionality with the existing offline queue system. This involved creating a new `searchQueue` database using IndexedDB, developing a `usePendingSearchQueue` hook to manage the queue, and injecting a `<PendingSearchQueue />` component to provide visual feedback. The `handleSearchSubmit` function was updated to check for offline status and route queries to the offline queue accordingly.

## Alternatives Considered
| Alternative | Why Rejected |
|---|---|
| Implementing a separate caching layer for search results | This approach would have added unnecessary complexity and might not have provided the same level of reliability as using the existing offline queue system. |
| Using a different storage solution, such as local storage | IndexedDB was chosen for its ability to store larger amounts of data and provide a more robust offline storage solution, making it a better fit for the application's requirements. |

## Consequences
**Positive:**
- Improved user experience by allowing searches to be queued and executed when the user comes back online.
- Consistent visual feedback is provided through the `<PendingSearchQueue />` component, enhancing the overall usability of the application.

**Trade-offs:**
- Additional complexity was introduced by integrating the search functionality with the offline queue system, requiring careful management of the queue and handling of different network states.

## Related Issues & PRs
- PR #3437: Feat :  Wired homepage search into the existing offline queue#3437
- Issue #3437