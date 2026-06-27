/**
 * @jest-environment jsdom
 */

import type { PharmacySyncRecord } from "../lib/offline/pharmacy-sync";

const basePharmacy: PharmacySyncRecord = {
    id: "pharmacy-1",
    name: "Base Pharmacy",
    address: "Old Road",
    lat: 28.6139,
    lng: 77.209,
    distance: "1.0 km",
    phone_number: null,
    is_verified: true,
    district: "New Delhi",
    state: "Delhi",
    updated_at: "2026-06-21T10:00:00.000Z",
};

describe("pharmacy-sync", () => {
    it("merges changed pharmacies and keeps existing records", async () => {
        const { mergePharmacyDelta } = await import("../lib/offline/pharmacy-sync");
        const changed: PharmacySyncRecord = {
            ...basePharmacy,
            address: "New Road",
            updated_at: "2026-06-22T10:00:00.000Z",
        };
        const added: PharmacySyncRecord = {
            ...basePharmacy,
            id: "pharmacy-2",
            name: "Added Pharmacy",
        };

        expect(mergePharmacyDelta([basePharmacy], [changed, added])).toEqual([changed, added]);
    });

    it("removes soft-deleted pharmacies from delta payloads", async () => {
        const { mergePharmacyDelta } = await import("../lib/offline/pharmacy-sync");
        const deletedByFlag: PharmacySyncRecord = {
            ...basePharmacy,
            is_active: false,
        };
        const deletedByTimestamp: PharmacySyncRecord = {
            ...basePharmacy,
            id: "pharmacy-2",
            deleted_at: "2026-06-22T10:00:00.000Z",
        };

        expect(
            mergePharmacyDelta(
                [
                    basePharmacy,
                    {
                        ...basePharmacy,
                        id: "pharmacy-2",
                        name: "Second Pharmacy",
                    },
                ],
                [deletedByFlag, deletedByTimestamp]
            )
        ).toEqual([]);
    });

    it("stores cached pharmacies and last sync timestamp in IndexedDB", async () => {
        const put = jest.fn().mockResolvedValue(undefined);
        const get = jest
            .fn()
            .mockResolvedValueOnce({ pharmacies: [basePharmacy] })
            .mockResolvedValueOnce("2026-06-22T12:00:00.000Z");

        jest.resetModules();
        jest.doMock("idb", () => ({
            openDB: jest.fn().mockResolvedValue({
                get,
                put,
                objectStoreNames: { contains: jest.fn(() => true) },
                createObjectStore: jest.fn(),
            }),
        }));

        const storage = await import("../lib/offline/pharmacy-sync");

        await storage.setCachedPharmacies([basePharmacy], "28.61_77.21");
        await storage.setLastSyncTimestamp(new Date("2026-06-22T12:00:00.000Z"), "28.61_77.21");

        await expect(storage.getCachedPharmacies("28.61_77.21")).resolves.toEqual([basePharmacy]);
        await expect(storage.getLastSyncTimestamp("28.61_77.21")).resolves.toBe(
            "2026-06-22T12:00:00.000Z"
        );
        expect(put).toHaveBeenCalledWith(
            "verified-pharmacies",
            expect.objectContaining({
                key: "28.61_77.21",
                pharmacies: [basePharmacy],
            })
        );
        expect(put).toHaveBeenCalledWith(
            "sync-metadata",
            "2026-06-22T12:00:00.000Z",
            "28.61_77.21:last-sync"
        );
    });
});
