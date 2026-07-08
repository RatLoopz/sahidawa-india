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

jest.mock("../lib/api", () => ({
    verifyMedicine: jest.fn(),
}));

jest.mock("../lib/scanHistoryUtils", () => ({
    recordScanHistory: jest.fn(),
}));

import {
    addToSyncQueue,
    getSyncQueue,
    removeFromSyncQueue,
    clearSyncQueue,
} from "../lib/db/syncQueue";
import { syncPendingScans, isNetworkFailure } from "../lib/scanQueueSync";
import { verifyMedicine } from "../lib/api";
import { recordScanHistory } from "../lib/scanHistoryUtils";

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

        const item = await addToSyncQueue("BATCH-789", "en");
        const synced = await syncPendingScans();

        expect(synced).toBe(1);
        expect(recordScanHistory).toHaveBeenCalled();
        expect(await getSyncQueue()).toHaveLength(0);
        expect(item.barcode).toBe("BATCH-789");
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
});
