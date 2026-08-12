/**
 * Client-side helpers for scoping the background-sync mutation queue to the
 * signed-in user. The service worker replays queued mutations, so it must
 * know who is currently signed in (and must never replay actions bound to a
 * different user — see worker/index.js).
 */

export const SET_CURRENT_USER = "SET_CURRENT_USER";
export const CLEAR_SYNC_QUEUE = "CLEAR_SYNC_QUEUE";

async function postToServiceWorker(message: Record<string, unknown>): Promise<void> {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    try {
        const registration = await navigator.serviceWorker.ready;
        registration.active?.postMessage(message);
    } catch {
        // No active service worker — nothing to notify.
    }
}

/** Tell the service worker which user is signed in so queued mutations are scoped. */
export function registerCurrentUser(userId: string | null): void {
    void postToServiceWorker({ type: SET_CURRENT_USER, userId });
}

/** Called on sign-out: drop the queue and clear the registered user. */
export function clearSyncQueueForLogout(): void {
    void postToServiceWorker({ type: CLEAR_SYNC_QUEUE });
    void postToServiceWorker({ type: SET_CURRENT_USER, userId: null });
}
