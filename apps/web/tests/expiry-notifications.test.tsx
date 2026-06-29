/**
 * @jest-environment jsdom
 */
import {
    getNotificationTargets,
    syncMedicinesToIndexedDB,
    cancelNotificationsForMedicine,
    checkAndTriggerLocalNotifications,
    type ExpiryMedicine,
} from "../lib/expiry-notifications";

// Mock idb library
const dbMap = new Map<string, ExpiryMedicine>();
const mockStore = {
    clear: jest.fn(async () => {
        dbMap.clear();
    }),
    put: jest.fn(async (item: ExpiryMedicine) => {
        dbMap.set(item.id, item);
    }),
    get: jest.fn(async (id: string) => {
        return dbMap.get(id);
    }),
    getAll: jest.fn(async () => {
        return Array.from(dbMap.values());
    }),
};

const mockTx = {
    store: mockStore,
    done: Promise.resolve(),
};

const mockDb = {
    transaction: jest.fn(() => mockTx),
};

jest.mock("idb", () => ({
    openDB: jest.fn(async () => mockDb),
}));

// Mock toast and navigator
jest.mock("sonner", () => ({
    toast: {
        success: jest.fn(),
        error: jest.fn(),
    },
}));

describe("Expiry Tracker Notifications Library", () => {
    let mockGetNotifications: any;
    let mockShowNotification: any;

    beforeEach(() => {
        jest.clearAllMocks();
        dbMap.clear();

        // Mock Notification permission
        Object.defineProperty(global, "Notification", {
            writable: true,
            value: jest.fn(),
        });
        (global.Notification as any).permission = "granted";
        (global.Notification as any).requestPermission = jest.fn().mockResolvedValue("granted");

        // Mock Service Worker registration
        mockShowNotification = jest.fn();
        mockGetNotifications = jest.fn().mockResolvedValue([]);

        Object.defineProperty(global.navigator, "serviceWorker", {
            writable: true,
            value: {
                getRegistration: jest.fn().mockResolvedValue({
                    showNotification: mockShowNotification,
                    getNotifications: mockGetNotifications,
                }),
            },
        });
    });

    describe("getNotificationTargets", () => {
        it("calculates exact target dates 7 days and 1 day before expiry at 9:00 AM", () => {
            const expiryDateStr = "2026-07-10T00:00:00.000Z";
            const { sevenDaysBefore, oneDayBefore } = getNotificationTargets(expiryDateStr);

            expect(sevenDaysBefore.getFullYear()).toBe(2026);
            expect(sevenDaysBefore.getMonth()).toBe(6); // July (0-indexed is 6)
            expect(sevenDaysBefore.getDate()).toBe(3); // 10 - 7 = 3
            expect(sevenDaysBefore.getHours()).toBe(9);

            expect(oneDayBefore.getFullYear()).toBe(2026);
            expect(oneDayBefore.getMonth()).toBe(6);
            expect(oneDayBefore.getDate()).toBe(9); // 10 - 1 = 9
            expect(oneDayBefore.getHours()).toBe(9);
        });
    });

    describe("syncMedicinesToIndexedDB", () => {
        it("saves medicines to IndexedDB and preserves notified flags for existing items", async () => {
            // Setup pre-existing items in IndexedDB with notified flag true
            dbMap.set("med-1", {
                id: "med-1",
                name: "Aspirin",
                expiryDate: "2026-07-10",
                notified7Days: true,
            });

            const newMedicines: ExpiryMedicine[] = [
                { id: "med-1", name: "Aspirin", expiryDate: "2026-07-10" },
                { id: "med-2", name: "Paracetamol", expiryDate: "2026-07-15" },
            ];

            await syncMedicinesToIndexedDB(newMedicines);

            expect(mockStore.clear).toHaveBeenCalledTimes(1);
            expect(mockStore.put).toHaveBeenCalledTimes(2);

            // Check that notified7Days flag was preserved for med-1
            const syncedMed1 = dbMap.get("med-1");
            expect(syncedMed1?.notified7Days).toBe(true);

            // Check that new med-2 has notified flags initialized to false
            const syncedMed2 = dbMap.get("med-2");
            expect(syncedMed2?.notified7Days).toBe(false);
            expect(syncedMed2?.notified1Day).toBe(false);
        });
    });

    describe("cancelNotificationsForMedicine", () => {
        it("resets notified flags in DB and closes active notifications", async () => {
            dbMap.set("med-1", {
                id: "med-1",
                name: "Aspirin",
                expiryDate: "2026-07-10",
                notified7Days: true,
                notified1Day: true,
            });

            mockGetNotifications.mockResolvedValue([
                { tag: "med-1-7days", close: jest.fn() },
                { tag: "med-2-7days", close: jest.fn() },
            ]);

            await cancelNotificationsForMedicine("med-1");

            // Verify flags reset
            const item = dbMap.get("med-1");
            expect(item?.notified7Days).toBe(false);
            expect(item?.notified1Day).toBe(false);

            // Verify Sw notifications were fetched and closed
            expect(mockGetNotifications).toHaveBeenCalledWith({ includeTriggered: true });
            const notifications = await mockGetNotifications();
            expect(notifications[0].close).toHaveBeenCalledTimes(1);
            expect(notifications[1].close).not.toHaveBeenCalled();
        });
    });

    describe("checkAndTriggerLocalNotifications", () => {
        it("sends a notification and updates the notified flag if current time falls in the 7 days warning window", async () => {
            // Target expiry exactly 7 days from now
            const now = new Date();
            now.setHours(12, 0, 0, 0); // force time after 9:00 AM to avoid timezone flakes
            const expiry = new Date(now);
            expiry.setDate(now.getDate() + 7);
            expiry.setHours(0, 0, 0, 0);

            const testMed: ExpiryMedicine = {
                id: "med-1",
                name: "Aspirin",
                expiryDate: expiry.toISOString(),
            };
            dbMap.set("med-1", testMed);

            // Mock current time so it falls exactly in the window
            jest.useFakeTimers();
            // Setup target notification target checks
            const checkTime = new Date(now);
            checkTime.setDate(now.getDate() + 0.1); // just a bit ahead of sevenDaysBefore trigger
            jest.setSystemTime(checkTime);

            await checkAndTriggerLocalNotifications([testMed]);

            // Notification should be triggered
            expect(mockShowNotification).toHaveBeenCalledTimes(1);
            expect(mockShowNotification.mock.calls[0][0]).toContain(
                "Medicine Expiring Soon: Aspirin"
            );

            // Flag should be updated in database
            const item = dbMap.get("med-1");
            expect(item?.notified7Days).toBe(true);

            jest.useRealTimers();
        });
    });
});
