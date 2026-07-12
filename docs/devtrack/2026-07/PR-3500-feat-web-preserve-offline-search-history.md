# PR #3500 — feat(web): preserve offline search history

> **Merged:** 2026-07-11 | **Author:** @Shreya-nipunge | **Area:** Frontend | **Impact Score:** 24 | **Closes:** #3494

## What Changed

We have introduced a new feature to preserve offline search history in our SahiDawa web application. This change allows users to save their searches even when they are offline, and automatically execute the most recent queued search when the user comes back online. The search history is persisted in IndexedDB, and users can manually execute saved searches from the search queue. We have also added an interactive offline-search history UI to display the saved searches.

## The Problem Being Solved

Before this PR, our application did not have the ability to preserve search history when the user was offline. This meant that any searches performed while offline would be lost when the user came back online. This was inefficient and frustrating for users, especially those with intermittent internet connections. By preserving the search history, we can now provide a better user experience and ensure that users can access their previous searches even when they are offline.

## Files Modified

- `apps/web/app/[locale]/page.tsx`
- `apps/web/components/SearchBar/PendingSearchQueue.tsx`
- `apps/web/hooks/usePendingSearchQueue.ts`
- `apps/web/tests/PendingSearchQueue.test.tsx`
- `apps/web/tests/searchQueue.test.ts`
- `apps/web/tests/usePendingSearchQueue.test.tsx`

## Implementation Details

To implement this feature, we modified the `usePendingSearchQueue` hook to use the `getSearchQueue` and `removeFromSearchQueue` functions from the `@/lib/db/searchQueue` module to interact with the search queue stored in IndexedDB. We also added a new `execute` function to the hook, which takes a `QueuedSearch` item as an argument and executes the search using the `onSync` callback. The `execute` function is debounced to prevent multiple executions of the same search. We also updated the `PendingSearchQueue` component to display the saved searches and allow users to manually execute them.

The `usePendingSearchQueue` hook now returns an object with the following properties:

* `pendingSearches`: an array of `QueuedSearch` items
* `isSyncing`: a boolean indicating whether the search queue is being synced
* `isLoading`: a boolean indicating whether the search queue is being loaded
* `executingId`: the ID of the currently executing search, or `null` if no search is being executed
* `execute`: a function to execute a saved search
* `refresh`: a function to refresh the search queue

## Technical Decisions

We chose to use IndexedDB to store the search queue because it provides a robust and efficient way to store data locally in the browser. We also decided to use the `usePendingSearchQueue` hook to manage the search queue, as it provides a centralized way to interact with the search queue and execute searches. We used the `getSearchQueue` and `removeFromSearchQueue` functions from the `@/lib/db/searchQueue` module to interact with the search queue, as they provide a simple and efficient way to store and retrieve data from IndexedDB.

## How To Re-Implement (Contributor Reference)

To re-implement this feature, you would need to:

1. Create a new hook, `usePendingSearchQueue`, that interacts with the search queue stored in IndexedDB.
2. Modify the `PendingSearchQueue` component to display the saved searches and allow users to manually execute them.
3. Update the `page.tsx` file to use the `usePendingSearchQueue` hook and display the search queue.
4. Add tests to verify that the search queue is being stored and retrieved correctly, and that the `execute` function is working as expected.

## Impact on System Architecture

This change affects the overall SahiDawa system by providing a more robust and efficient way to handle search history. It unlocks the ability to provide a better user experience, especially for users with intermittent internet connections. The use of IndexedDB to store the search queue also provides a scalable and efficient way to store data locally in the browser.

## Testing & Verification

We tested this change by verifying that the search queue is being stored and retrieved correctly, and that the `execute` function is working as expected. We also tested the `PendingSearchQueue` component to ensure that it is displaying the saved searches correctly and allowing users to manually execute them. The tests were written using Jest and the `@testing-library/react` library.