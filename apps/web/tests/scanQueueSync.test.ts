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

const queueStore = new Map<
    string,
    { id: string; barcode: string; timestamp: number; locale: string }
>();

jest.mock("idb", () => ({
    openDB: jest.fn(async () => ({
        put: jest.fn(async (_store: string, item: { id: string }) => {
            queueStore.set(item.id, item);
        }),
        getAll: jest.fn(async () => Array.from(queueStore.values())),
        delete: jest.fn(async (_store: string, id: string) => {
            queueStore.delete(id);
        }),
        clear: jest.fn(async () => {
            queueStore.clear();
        }),
    })),
}));

jest.mock("sonner", () => ({
    toast: {
        success: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
    },
}));

jest.mock("../lib/api", () => {
    class ApiHttpError extends Error {
        readonly status: number;
        constructor(message: string, status: number) {
            super(message);
            this.name = "ApiHttpError";
            this.status = status;
        }
    }
    return {
        verifyMedicine: jest.fn(),
        ApiHttpError,
    };
});

jest.mock("../lib/scanHistoryUtils", () => ({
    recordScanHistory: jest.fn(),
    recordSyncScanHistory: jest.fn(),
}));

import {
    addToSyncQueue,
    getSyncQueue,
    removeFromSyncQueue,
    clearSyncQueue,
} from "../lib/db/syncQueue";
import {
    syncPendingScans,
    isNetworkFailure,
    isRetryableSyncFailure,
    isKnownPermanentFailure,
} from "../lib/scanQueueSync";
import { verifyMedicine, ApiHttpError } from "../lib/api";
import { recordScanHistory, recordSyncScanHistory } from "../lib/scanHistoryUtils";

describe("syncQueue", () => {
    beforeEach(async () => {
        queueStore.clear();
        await clearSyncQueue();
    });

    it("stores and retrieves queued scans", async () => {
        await addToSyncQueue("BATCH-123", "en");
        const queue = await getSyncQueue();

        expect(queue).toHaveLength(1);
        expect(queue[0].barcode).toBe("BATCH-123");
        expect(queue[0].locale).toBe("en");
    });

    it("removes a queued scan by id", async () => {
        const item = await addToSyncQueue("BATCH-456", "hi");
        await removeFromSyncQueue(item.id);

        expect(await getSyncQueue()).toHaveLength(0);
    });
});

describe("scanQueueSync", () => {
    beforeEach(async () => {
        queueStore.clear();
        await clearSyncQueue();
        jest.clearAllMocks();
        Object.defineProperty(window.navigator, "onLine", {
            configurable: true,
            value: true,
        });
    });

    it("detects network-related failures", () => {
        expect(isNetworkFailure(new Error("You are currently offline"))).toBe(true);
        expect(isNetworkFailure(new Error("Invalid batch"))).toBe(false);
    });

    it("syncs queued scans when online", async () => {
        const mockedVerify = verifyMedicine as jest.MockedFunction<typeof verifyMedicine>;
        mockedVerify.mockResolvedValue({
            verified: true,
            medicine: {
                brand_name: "TestMed",
                generic_name: "Test",
                manufacturer: "Maker",
                batch_number: "BATCH-789",
                expiry_date: "2027-01-01",
                cdsco_approval_status: "approved",
                is_counterfeit_alert: false,
            },
        } as any);

        const item = await addToSyncQueue("BATCH-789", "en", "https://queued.example/api/verify");
        const synced = await syncPendingScans();

        expect(synced).toBe(1);
        expect(mockedVerify).toHaveBeenCalledWith(
            "BATCH-789",
            undefined,
            "https://queued.example/api/verify"
        );
        expect(recordSyncScanHistory).toHaveBeenCalled();
        expect(await getSyncQueue()).toHaveLength(0);
        expect(item.barcode).toBe("BATCH-789");
    });

    it("uses the current endpoint for legacy queued scans without an apiUrl", async () => {
        const mockedVerify = verifyMedicine as jest.MockedFunction<typeof verifyMedicine>;
        mockedVerify.mockResolvedValue({ verified: false, message: "Medicine not found" });

        const item = await addToSyncQueue("BATCH-LEGACY", "en");
        delete item.apiUrl;
        queueStore.set(item.id, item);

        const synced = await syncPendingScans();

        expect(synced).toBe(1);
        expect(mockedVerify).toHaveBeenCalledWith("BATCH-LEGACY", undefined, undefined);
        expect(await getSyncQueue()).toHaveLength(0);
    });

    it("skips syncing while offline", async () => {
        Object.defineProperty(window.navigator, "onLine", {
            configurable: true,
            value: false,
        });

        await addToSyncQueue("BATCH-OFFLINE", "en");
        const synced = await syncPendingScans();

        expect(synced).toBe(0);
        expect(await getSyncQueue()).toHaveLength(1);
    });

    it("syncs queued scans deterministically in oldest-first order", async () => {
        const mockedVerify = verifyMedicine as jest.MockedFunction<typeof verifyMedicine>;
        mockedVerify.mockResolvedValue({ verified: true, medicine: {} } as any);

        // The queue store is keyed by random UUID, so IndexedDB order == insertion
        // order, NOT scan order. Timestamps are deliberately out of insertion order
        // to simulate scans made on a device and synced later.
        const oldest = await addToSyncQueue("BATCH-OLD", "en", "https://x/api/verify");
        const newest = await addToSyncQueue("BATCH-NEW", "en", "https://x/api/verify");
        oldest.timestamp = 100;
        newest.timestamp = 300;
        queueStore.set(oldest.id, oldest);
        queueStore.set(newest.id, newest);

        await syncPendingScans();

        // Oldest scan must be verified and recorded before the newest one.
        expect(mockedVerify.mock.calls[0][0]).toBe("BATCH-OLD");
        expect(mockedVerify.mock.calls[1][0]).toBe("BATCH-NEW");
        expect((recordSyncScanHistory as jest.Mock).mock.calls[0][0]).toBe(oldest.id);
        expect((recordSyncScanHistory as jest.Mock).mock.calls[1][0]).toBe(newest.id);
    });

    it("preserves the original scan timestamp for each synced medicine result", async () => {
        const mockedVerify = verifyMedicine as jest.MockedFunction<typeof verifyMedicine>;
        mockedVerify.mockResolvedValue({ verified: true, medicine: {} } as any);

        const item = await addToSyncQueue("BATCH-TS", "en", "https://x/api/verify");
        item.timestamp = 123456789;
        queueStore.set(item.id, item);

        await syncPendingScans();

        // The result must be written to the linked history row (same id) using the
        // ORIGINAL scan timestamp, not the sync time — otherwise an older scan that
        // syncs later would appear as the newest verification.
        expect(recordSyncScanHistory).toHaveBeenCalledWith(
            item.id,
            123456789,
            expect.anything(),
            "BATCH-TS"
        );
    });

    it("does not run concurrent flushes that would process entries twice", async () => {
        const mockedVerify = verifyMedicine as jest.MockedFunction<typeof verifyMedicine>;
        mockedVerify.mockResolvedValue({ verified: true, medicine: {} } as any);

        await addToSyncQueue("BATCH-CONCURRENT", "en", "https://x/api/verify");

        // Fire two sync triggers on the same tick (e.g. "online" event + service
        // worker flush). The lock is claimed before the first await, so only the
        // first call may proceed; the second bails out and verifies nothing.
        const [first, second] = await Promise.all([syncPendingScans(), syncPendingScans()]);

        expect(first).toBe(1);
        expect(second).toBe(0);
        expect(mockedVerify).toHaveBeenCalledTimes(1);
        expect(await getSyncQueue()).toHaveLength(0);
    });

    it("keeps queued item when verifyMedicine throws HTTP 500", async () => {
        const mockedVerify = verifyMedicine as jest.MockedFunction<typeof verifyMedicine>;
        mockedVerify.mockRejectedValue(new ApiHttpError("Internal Server Error", 500));

        await addToSyncQueue("BATCH-500", "en");
        const synced = await syncPendingScans();

        expect(synced).toBe(0);
        expect(await getSyncQueue()).toHaveLength(1);
    });

    it("keeps queued item when verifyMedicine throws HTTP 502", async () => {
        const mockedVerify = verifyMedicine as jest.MockedFunction<typeof verifyMedicine>;
        mockedVerify.mockRejectedValue(new ApiHttpError("Bad Gateway", 502));

        await addToSyncQueue("BATCH-502", "en");
        const synced = await syncPendingScans();

        expect(synced).toBe(0);
        expect(await getSyncQueue()).toHaveLength(1);
    });

    it("keeps queued item when verifyMedicine throws HTTP 503", async () => {
        const mockedVerify = verifyMedicine as jest.MockedFunction<typeof verifyMedicine>;
        mockedVerify.mockRejectedValue(new ApiHttpError("Service Unavailable", 503));

        await addToSyncQueue("BATCH-503", "en");
        const synced = await syncPendingScans();

        expect(synced).toBe(0);
        expect(await getSyncQueue()).toHaveLength(1);
    });

    it("keeps queued item when verifyMedicine throws HTTP 504", async () => {
        const mockedVerify = verifyMedicine as jest.MockedFunction<typeof verifyMedicine>;
        mockedVerify.mockRejectedValue(new ApiHttpError("Gateway Timeout", 504));

        await addToSyncQueue("BATCH-504", "en");
        const synced = await syncPendingScans();

        expect(synced).toBe(0);
        expect(await getSyncQueue()).toHaveLength(1);
    });

    it("keeps queued item when verifyMedicine throws network failure", async () => {
        const mockedVerify = verifyMedicine as jest.MockedFunction<typeof verifyMedicine>;
        mockedVerify.mockRejectedValue(new Error("Failed to fetch"));

        await addToSyncQueue("BATCH-NET", "en");
        const synced = await syncPendingScans();

        expect(synced).toBe(0);
        expect(await getSyncQueue()).toHaveLength(1);
    });

    it("removes scan from queue on successful verification", async () => {
        const mockedVerify = verifyMedicine as jest.MockedFunction<typeof verifyMedicine>;
        mockedVerify.mockResolvedValue({
            verified: true,
            medicine: {
                brand_name: "GenuineMed",
                generic_name: "Gen",
                manufacturer: "Maker",
                batch_number: "BATCH-OK",
                expiry_date: "2028-01-01",
                cdsco_approval_status: "approved",
                is_counterfeit_alert: false,
            },
        } as any);

        await addToSyncQueue("BATCH-OK", "en");
        const synced = await syncPendingScans();

        expect(synced).toBe(1);
        expect(await getSyncQueue()).toHaveLength(0);
    });

    it("removes scan from queue on known permanent failure (e.g. HTTP 400 Bad Request)", async () => {
        const mockedVerify = verifyMedicine as jest.MockedFunction<typeof verifyMedicine>;
        mockedVerify.mockRejectedValue(new ApiHttpError("Bad Request", 400));

        await addToSyncQueue("BATCH-400", "en");
        const synced = await syncPendingScans();

        expect(synced).toBe(0);
        expect(await getSyncQueue()).toHaveLength(0);
    });

    it("keeps queued item and logs error on unknown/unclassified error", async () => {
        const mockedVerify = verifyMedicine as jest.MockedFunction<typeof verifyMedicine>;
        mockedVerify.mockRejectedValue(new Error("Unclassified error message"));
        const spyError = jest.spyOn(console, "error").mockImplementation(() => {});

        await addToSyncQueue("BATCH-UNKNOWN", "en");
        const synced = await syncPendingScans();

        expect(synced).toBe(0);
        expect(await getSyncQueue()).toHaveLength(1);
        expect(spyError).toHaveBeenCalled();
        spyError.mockRestore();
    });
});
