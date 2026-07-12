import {
    describe,
    it,
    expect,
    jest,
    beforeEach,
    afterEach,
    beforeAll,
    afterAll,
} from "@jest/globals";
/**
 * @jest-environment jsdom
 */

jest.mock("uuid", () => ({
    v4: () => "test-uuid",
}));
import { enqueueScan, flushQueue, initOnlineListener } from "../../lib/offline/queue";
import { getSyncDB } from "../../lib/offline/db";

describe("Offline Queue Integration", () => {
    // Mock network requuest made during queue synchronization.
    const fetchMock = jest.fn();

    beforeEach(async () => {
        // Rset fetch mock before every test.
        globalThis.fetch = fetchMock as any;
        fetchMock.mockReset();

        // Start every test in offline mode.
        Object.defineProperty(navigator, "onLine", {
            configurable: true,
            writable: true,
            value: false,
        });

        // Clear IndexedDB , so tests dont affect each other.
        const db = await getSyncDB();
        await db.clear("pendingScans");

        localStorage.clear();
    });

    afterEach(async () => {
        const db = await getSyncDB();
        await db.clear("pendingScans");
    });

    it("queues a scan while offline", async () => {
        await enqueueScan({
            metadata: {
                barcode: "123456",
            },
        });

        const db = await getSyncDB();
        const items = await db.getAll("pendingScans");

        // The scan should be stored locally.
        expect(items).toHaveLength(1);

        // No network request should be attempted while offline.
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("flushes queued scans when back online", async () => {
        await enqueueScan({
            metadata: {
                barcode: "654321",
            },
        });

        // Mock a successful server response.
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                parts: {
                    metadata: "synced",
                    image: "skipped",
                    voice: "skipped",
                },
            }),
        });

        // Simulate reconnecting.
        Object.defineProperty(navigator, "onLine", {
            configurable: true,
            writable: true,
            value: true,
        });

        await flushQueue();

        expect(fetchMock).toHaveBeenCalledTimes(1);

        const db = await getSyncDB();
        const items = await db.getAll("pendingScans");

        // Successfully synced entries should be removed.
        expect(items).toHaveLength(0);
    });

    it("syncs automatically when the browser comes online", async () => {
        await enqueueScan({
            metadata: {
                barcode: "999999",
            },
        });

        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                parts: {
                    metadata: "synced",
                    image: "skipped",
                    voice: "skipped",
                },
            }),
        });

        // Register the online event listener.
        initOnlineListener();

        Object.defineProperty(navigator, "onLine", {
            configurable: true,
            writable: true,
            value: true,
        });

        window.dispatchEvent(new Event("online"));

        // Allow async event handlers to complete.
        for (let i = 0; i < 10; i++) {
            await new Promise((resolve) => setTimeout(resolve, 10));
            if (fetchMock.mock.calls.length > 0) break;
        }

        expect(fetchMock).toHaveBeenCalled();

        const db = await getSyncDB();
        const items = await db.getAll("pendingScans");

        expect(items).toHaveLength(0);
    });

    it("keeps the scan in the queue when sync fails", async () => {
        await enqueueScan({
            metadata: {
                barcode: "111111",
            },
        });

        // Simulate a server error.
        fetchMock.mockResolvedValue({
            ok: false,
            status: 500,
        });

        Object.defineProperty(navigator, "onLine", {
            configurable: true,
            writable: true,
            value: true,
        });

        await flushQueue();

        const db = await getSyncDB();
        const items = await db.getAll("pendingScans");
        // Failed entries should remain in the queue
        expect(items).toHaveLength(1);

        // Retry count should increase after a failed sync
        expect(items[0].attemptCount).toBe(1);
    });
});
