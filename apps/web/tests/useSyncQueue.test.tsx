import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useSyncQueue } from "@/hooks/useSyncQueue";

const QUEUE_DB = "sahidawa-sync-db";

async function deleteQueueDb(): Promise<void> {
    await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(QUEUE_DB);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
    });
}

async function openQueueDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(QUEUE_DB, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains("requests")) {
                db.createObjectStore("requests", { keyPath: "id", autoIncrement: true });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function seedQueue(entries: Array<Record<string, unknown>>): Promise<void> {
    const db = await openQueueDb();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("requests", "readwrite");
        for (const entry of entries) tx.objectStore("requests").add(entry);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

async function countQueue(): Promise<number> {
    const db = await openQueueDb();
    const count = await new Promise<number>((resolve, reject) => {
        const tx = db.transaction("requests", "readonly");
        const req = tx.objectStore("requests").count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    db.close();
    return count;
}

type MessageHandler = (event: { data: unknown }) => void;

let messageHandlers: MessageHandler[] = [];
let syncRegister: jest.Mock;

beforeEach(async () => {
    messageHandlers = [];
    syncRegister = jest.fn().mockResolvedValue(undefined);

    Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: {
            ready: Promise.resolve({ sync: { register: syncRegister } }),
            addEventListener: jest.fn((_type: string, cb: MessageHandler) => {
                messageHandlers.push(cb);
            }),
            removeEventListener: jest.fn(),
        },
    });
});

afterEach(async () => {
    await deleteQueueDb();
});

function sendMessage(data: unknown) {
    act(() => {
        for (const handler of messageHandlers) handler({ data });
    });
}

describe("useSyncQueue", () => {
    it("surfaces server-rejected queued actions with an actionable status and error", async () => {
        await seedQueue([{ url: "https://x.test/api", method: "POST", body: "{}" }]);
        const { result } = renderHook(() => useSyncQueue());
        await waitFor(() => expect(result.current.pendingCount).toBe(1));

        sendMessage({
            type: "SYNC_QUEUE_REJECTED",
            entries: [
                {
                    id: 1,
                    status: 422,
                    url: "https://x.test/api",
                    method: "POST",
                    error: "Batch number is invalid",
                },
            ],
        });

        await waitFor(() => expect(result.current.rejected).toHaveLength(1));
        expect(result.current.rejected[0]).toMatchObject({
            status: 422,
            error: "Batch number is invalid",
        });
    });

    it("discard() removes the rejected action from the queue permanently", async () => {
        await seedQueue([{ url: "https://x.test/api", method: "POST", body: "{}" }]);
        const { result } = renderHook(() => useSyncQueue());
        await waitFor(() => expect(result.current.pendingCount).toBe(1));

        sendMessage({
            type: "SYNC_QUEUE_REJECTED",
            entries: [
                { id: 1, status: 422, url: "https://x.test/api", method: "POST", error: "bad" },
            ],
        });
        await waitFor(() => expect(result.current.rejected).toHaveLength(1));

        act(() => {
            result.current.discard(1);
        });

        await waitFor(() => expect(result.current.pendingCount).toBe(0));
        expect(result.current.rejected).toHaveLength(0);
        expect(await countQueue()).toBe(0);
    });

    it("retry() re-registers the background sync so queued actions are attempted again", async () => {
        await seedQueue([{ url: "https://x.test/api", method: "POST", body: "{}" }]);
        const { result } = renderHook(() => useSyncQueue());

        sendMessage({
            type: "SYNC_QUEUE_REJECTED",
            entries: [
                {
                    id: 1,
                    status: 401,
                    url: "https://x.test/api",
                    method: "POST",
                    authFailure: true,
                },
            ],
        });
        await waitFor(() => expect(result.current.rejected).toHaveLength(1));

        act(() => {
            result.current.retry();
        });

        await waitFor(() => expect(syncRegister).toHaveBeenCalledWith("sahidawa-sync-mutations"));
        expect(result.current.rejected).toHaveLength(0);
    });

    it("refreshes the pending count when the worker reports a successful flush", async () => {
        await seedQueue([{ url: "https://x.test/api", method: "POST", body: "{}" }]);
        const { result } = renderHook(() => useSyncQueue());
        await waitFor(() => expect(result.current.pendingCount).toBe(1));

        await deleteQueueDb();

        sendMessage({ type: "SYNC_QUEUE_FLUSHED" });

        await waitFor(() => expect(result.current.pendingCount).toBe(0));
    });
});
