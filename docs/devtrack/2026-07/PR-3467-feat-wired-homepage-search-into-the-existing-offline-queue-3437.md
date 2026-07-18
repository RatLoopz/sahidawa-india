# PR #3467 — Feat :  Wired homepage search into the existing offline queue#3437

> **Merged:** 2026-07-11 | **Author:** @hrx01-dev | **Area:** Frontend | **Impact Score:** 19 | **Closes:** #3437

## What Changed

We have introduced a new feature that integrates the homepage search functionality with the existing offline queue. This change enables users to queue their searches when they are offline, and the system will automatically execute the search when the user comes back online. The implementation includes a new `PendingSearchQueue` component, a `usePendingSearchQueue` hook, and modifications to the `page.tsx` file to handle offline search submissions.

## The Problem Being Solved

Before this PR, the system did not handle offline search submissions gracefully. When a user attempted to search for something while offline, the system would fail to fetch the results, leading to a poor user experience. This change addresses this issue by providing a seamless offline search experience, allowing users to queue their searches and receive results when they come back online.

## Files Modified

- `apps/web/app/[locale]/page.tsx`
- `apps/web/components/SearchBar/PendingSearchQueue.tsx`
- `apps/web/hooks/usePendingSearchQueue.ts`
- `apps/web/lib/db/searchQueue.ts`

## Implementation Details

The implementation involves several key components:
- The `PendingSearchQueue` component displays a list of queued searches and provides visual feedback to the user.
- The `usePendingSearchQueue` hook manages the queued searches, listens for the window's online event, and flushes the queue when the user comes back online.
- The `page.tsx` file has been modified to use the `useOfflineStatus` hook to check if the user is offline and to handle search submissions accordingly.
- The `searchQueue.ts` file provides functions for adding, retrieving, and clearing queued searches from the IndexedDB storage.

The `usePendingSearchQueue` hook uses the `getSearchQueue` function from `searchQueue.ts` to retrieve the queued searches and the `clearSearchQueue` function to clear the queue when the user comes back online. The hook also uses the `toast` function from `sonner` to display a success notification when a queued search is executed.

## Technical Decisions

We chose to use IndexedDB for storing queued searches because it provides a robust and efficient way to store data locally in the browser. We also decided to reuse the `useOfflineStatus` hook to check for offline status, as it is already implemented and tested in the system. The `PendingSearchQueue` component was designed to mimic the existing `PendingScanQueue` component for consistency and to provide a familiar user experience.

## How To Re-Implement (Contributor Reference)

To re-implement this feature, follow these steps:
1. Create a new component `PendingSearchQueue` to display the queued searches.
2. Implement the `usePendingSearchQueue` hook to manage the queued searches and listen for the window's online event.
3. Modify the `page.tsx` file to use the `useOfflineStatus` hook and handle search submissions accordingly.
4. Create a new file `searchQueue.ts` to provide functions for adding, retrieving, and clearing queued searches from the IndexedDB storage.
5. Use the `idb` library to interact with IndexedDB and store the queued searches.

## Impact on System Architecture

This change enhances the overall user experience by providing a seamless offline search experience. It also demonstrates the system's ability to adapt to different network conditions, making it more robust and reliable. This implementation unlocks future development opportunities, such as integrating other features with the offline queue and improving the system's overall performance.

## Testing & Verification

The change was tested by verifying that queued searches are executed when the user comes back online and that the `PendingSearchQueue` component displays the correct information. Edge cases, such as multiple queued searches and searches with special characters, were also tested to ensure the system handles them correctly. Additionally, the system's behavior was verified when the user is offline and then comes back online, ensuring that the queued searches are executed as expected.