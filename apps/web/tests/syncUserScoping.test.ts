import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
/**
 * @jest-environment jsdom
 */
import { clearSyncQueueForLogout, registerCurrentUser } from "@/lib/syncUserScoping";

describe("lib/syncUserScoping", () => {
    const postMessage = jest.fn();

    beforeEach(() => {
        postMessage.mockClear();
        Object.defineProperty(navigator, "serviceWorker", {
            configurable: true,
            value: {
                ready: Promise.resolve({ active: { postMessage } }),
            },
        });
    });

    afterEach(() => {
        Object.defineProperty(navigator, "serviceWorker", {
            configurable: true,
            value: undefined,
        });
    });

    it("registers the current user with the active service worker", async () => {
        registerCurrentUser("user-A");
        await Promise.resolve();
        expect(postMessage).toHaveBeenCalledWith({ type: "SET_CURRENT_USER", userId: "user-A" });
    });

    it("clears the queue and unregisters the user on logout", async () => {
        clearSyncQueueForLogout();
        await Promise.resolve();
        expect(postMessage).toHaveBeenCalledWith({ type: "CLEAR_SYNC_QUEUE" });
        expect(postMessage).toHaveBeenCalledWith({ type: "SET_CURRENT_USER", userId: null });
    });

    it("is a no-op when service worker is unavailable", async () => {
        Object.defineProperty(navigator, "serviceWorker", {
            configurable: true,
            value: undefined,
        });
        registerCurrentUser("user-A");
        clearSyncQueueForLogout();
        await Promise.resolve();
        expect(postMessage).not.toHaveBeenCalled();
    });
});
