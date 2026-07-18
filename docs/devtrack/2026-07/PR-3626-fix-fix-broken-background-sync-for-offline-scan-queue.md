# PR #3626 — fix: Fix broken background sync for offline scan queue

> **Merged:** 2026-07-16 | **Author:** @Kirtan-pc | **Area:** Frontend | **Impact Score:** 12 | **Closes:** #3621

## What Changed

We fixed a critical bug in our offline scanning architecture where background sync events failed to flush queued scans. We replaced the complex, duplicate, and misconfigured IndexedDB-reading logic inside our Service Worker (`apps/web/worker/index.js`) with a lightweight client-notification mechanism (`notifyClientsToFlush`). We also enhanced our client-side queue manager (`apps/web/lib/offline/queue.ts`) with a robust cleanup pattern and a 30-second periodic retry safety net.

## The Problem Being Solved

Our offline scan queue was completely broken because of a database mismatch between the client-side code and the Service Worker. The client-side code (`queue.ts`) was writing pending offline scans to the `sahidawa-sync` IndexedDB database under the `pendingScans` store. However, when the browser triggered a background sync event (`"sahidawa-sync-scans"`), the Service Worker attempted to read from a completely different database (`sahidawa-offline-sync`) and store (`sync-queue`).

Because of this mismatch, the Service Worker's `flushQueueFromServiceWorker()` function always read an empty queue, meaning offline scans silently accumulated in the user's browser forever without ever being synchronized to our servers. Additionally, the Service Worker had duplicated 200+ lines of complex verification, history saving, and notification logic that was prone to drift from the main client-side implementation.

## Files Modified

- `apps/web/components/vaccine/DateInitializer.tsx`
- `apps/web/lib/offline/queue.ts`
- `apps/web/worker/index.js`

## Implementation Details

### Service Worker Refactoring
In `apps/web/worker/index.js`, we removed the massive `flushQueueFromServiceWorker()` function along with its helper functions (`openIndexedDB`, `getQueuedScans`, `deleteQueuedScan`, `saveToScanHistory`). We replaced it with a clean, 6-line `notifyClientsToFlush()` function. When the `"sync"` event with tag `"sahidawa-sync-scans"` is fired, the Service Worker queries all active window clients using `self.clients.matchAll({ type: "window" })` and posts a `{ type: "FLUSH_SYNC_QUEUE" }` message to each.

### Client-Side Queue Listener
In `apps/web/lib/offline/queue.ts`, we refactored `initOnlineListener()`. Instead of a fire-and-forget initialization, it now returns a cleanup function (`() => void`) that removes all registered event listeners and clears active intervals.

### Periodic Retry Safety Net
We introduced a `setInterval` inside `initOnlineListener()` that runs every 30,000ms (30 seconds). If the client is online (`navigator.onLine`), it automatically triggers `flushQueue()`. This ensures that even if background sync events are delayed or restricted by the browser's battery-saving policies, scans are still flushed periodically while the application is open.

### DateInitializer Formatting
In `apps/web/components/vaccine/DateInitializer.tsx`, we cleaned up code formatting and line-wrapping for the `title` attribute and the native date picker description paragraph to comply with our codebase's linting standards.

## Technical Decisions

- **Single Source of Truth for Sync Logic:** Instead of maintaining two separate sync engines (one in the Service Worker and one in the client), we decided to centralize all synchronization logic in the client (`queue.ts`). This avoids code duplication, prevents database schema drift, and ensures that complex API calls, ML service routing, and state updates (like saving to scan history) happen in a single, easily testable place.
- **Message-Passing Architecture:** By shifting the Service Worker's role from "executor" to "notifier", we leverage the browser's native background sync capabilities to wake up the client, but let the client handle the actual network requests.
- **Cleanup Pattern for React/App Lifecycle:** Returning a cleanup function from `initOnlineListener()` allows our React components or application bootstrap logic to properly teardown listeners (e.g., during hot-reloads or unmounting), preventing memory leaks and duplicate event listeners.

## How To Re-Implement (Contributor Reference)

If you need to re-implement or extend this offline sync mechanism, follow these steps:

1. **Client-Side Database Setup:** Ensure the client writes offline scans to the correct IndexedDB database (`sahidawa-sync`) and store (`pendingScans`).
2. **Service Worker Sync Listener:** In the Service Worker (`worker/index.js`), listen to the `"sync"` event. Check if `event.tag === "sahidawa-sync-scans"`. If so, call `event.waitUntil(notifyClientsToFlush())`.
3. **Client Notification:** Implement `notifyClientsToFlush()` in the Service Worker:
   ```javascript
   async function notifyClientsToFlush() {
       const clients = await self.clients.matchAll({ type: "window" });
       for (const client of clients) {
           client.postMessage({ type: "FLUSH_SYNC_QUEUE" });
       }
   }
   ```
4. **Client-Side Message Handler:** In `queue.ts`, inside `initOnlineListener()`, listen for messages from the service worker:
   ```typescript
   navigator.serviceWorker.addEventListener("message", (event) => {
       if (event.data && event.data.type === "FLUSH_SYNC_QUEUE") {
           void flushQueue();
       }
   });
   ```
5. **Add Safety Nets & Cleanup:** Add a window `"online"` event listener and a 30s `setInterval` that checks `navigator.onLine` and calls `flushQueue()`. Ensure all three listeners (online, message, interval) are cleared in the returned cleanup function.

## Impact on System Architecture

This change simplifies our Service Worker architecture by stripping out database-accessing code, reducing the worker's bundle size and complexity. It establishes a clear boundary: the Service Worker acts as an event proxy, while the client application owns the business logic and database transactions. This makes our offline sync system significantly more robust, especially in rural Indian environments with highly intermittent network connectivity where background sync events might fire hours after a scan was queued.

## Testing & Verification

### Verification Flow
1. Go offline in browser DevTools.
2. Perform a medicine scan. Verify that the scan is successfully written to the `sahidawa-sync` database under the `pendingScans` store.
3. Close the tab.
4. Go online.
5. Reopen the SahiDawa application. The Service Worker should receive the sync event, notify the client, and trigger `flushQueue()`, successfully uploading the scan and clearing the IndexedDB store.

### Edge Cases Handled
- **No active window:** If the tab is closed when the browser comes online, the background sync event will retry with exponential backoff until the user reopens the page, at which point the notification will successfully reach the client.
- **Memory Leaks:** The cleanup function returned by `initOnlineListener()` prevents duplicate intervals and event listeners from accumulating during hot-reloading or page transitions.