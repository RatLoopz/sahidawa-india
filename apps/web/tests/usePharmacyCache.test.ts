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
import type { AshaWorker, Pharmacy } from "../app/[locale]/map/PharmacyMap";
import type * as PharmacyCache from "../app/[locale]/map/usePharmacyCache";

let buildNearbyCacheKey: typeof PharmacyCache.buildNearbyCacheKey;
let buildBoundsCacheKey: typeof PharmacyCache.buildBoundsCacheKey;
let loadFromCache: typeof PharmacyCache.loadFromCache;
let saveToCache: typeof PharmacyCache.saveToCache;
const openDBMock = jest.fn();

const samplePharmacies: Pharmacy[] = [
    {
        id: 101,
        name: "Cached SafeMeds",
        distance: "1.1 km",
        distanceKm: 1.1,
        rating: 0,
        status: "OSM Verified",
        type: "private",
        coordinates: { lat: 28.6139, lng: 77.209 },
        address: "Connaught Place, New Delhi",
    },
];

const sampleAshaWorkers: AshaWorker[] = [
    {
        id: 12,
        name: "Asha Sharma",
        district: "Central Delhi",
        coordinates: { lat: 28.612, lng: 77.21 },
        contact: "+91 99999 99999",
        distanceKm: 1.4,
    },
];

jest.mock("idb", () => ({
    openDB: (...args: any[]) => openDBMock(...args),
}));

describe("usePharmacyCache", () => {
    beforeEach(async () => {
        jest.resetModules();
        openDBMock.mockReset();

        ({ buildNearbyCacheKey, buildBoundsCacheKey, loadFromCache, saveToCache } =
            await import("../app/[locale]/map/usePharmacyCache"));
        jest.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("stores successful pharmacy API results in the sahidawa offline cache database", async () => {
        const put = jest.fn().mockResolvedValue(undefined);
        openDBMock.mockResolvedValue({
            put,
            objectStoreNames: { contains: jest.fn() },
            createObjectStore: jest.fn(),
        } as never);

        const key = buildNearbyCacheKey(28.6139, 77.209, 10_000);
        await saveToCache(key, samplePharmacies, sampleAshaWorkers);

        expect(openDBMock).toHaveBeenCalledWith(
            "sahidawa_offline_cache",
            1,
            expect.objectContaining({ upgrade: expect.any(Function) })
        );
        expect(put).toHaveBeenCalledWith(
            "pharmacy-results",
            {
                pharmacies: samplePharmacies,
                ashaWorkers: sampleAshaWorkers,
                timestamp: 1_800_000_000_000,
            },
            "nearby:28.61:77.21:r:10"
        );
        expect(put).toHaveBeenCalledWith(
            "pharmacy-results",
            {
                pharmacies: samplePharmacies,
                ashaWorkers: sampleAshaWorkers,
                timestamp: 1_800_000_000_000,
            },
            "last-search"
        );
    });

    it("returns cached markers for matching search parameters", async () => {
        const entry = {
            pharmacies: samplePharmacies,
            ashaWorkers: sampleAshaWorkers,
            timestamp: 1_800_000_000_000,
        };
        const get = jest.fn().mockResolvedValueOnce(entry);
        openDBMock.mockResolvedValue({
            get,
            objectStoreNames: { contains: jest.fn() },
            createObjectStore: jest.fn(),
        } as never);

        const key = buildNearbyCacheKey(28.6139, 77.209, 10_000);

        await expect(loadFromCache(key)).resolves.toEqual(entry);
        expect(get).toHaveBeenCalledTimes(1);
        expect(get).toHaveBeenCalledWith("pharmacy-results", "nearby:28.61:77.21:r:10");
    });

    it("scopes cache keys by radius and bounds", () => {
        expect(buildNearbyCacheKey(28.6139, 77.209, 1_000)).toBe("nearby:28.61:77.21:r:1");
        expect(buildNearbyCacheKey(28.6139, 77.209, 25_000)).toBe("nearby:28.61:77.21:r:25");
        expect(
            buildBoundsCacheKey({
                south: 28.60123,
                west: 77.19876,
                north: 28.68987,
                east: 77.27891,
            })
        ).toBe("bounds:28.601:77.199:28.690:77.279");
    });

    it("does not restore an unrelated last-search entry for a scoped cache miss", async () => {
        const get = jest.fn().mockResolvedValueOnce(undefined);
        openDBMock.mockResolvedValue({
            get,
            objectStoreNames: { contains: jest.fn() },
            createObjectStore: jest.fn(),
        } as never);

        await expect(loadFromCache("nearby:28.61:77.21:r:25")).resolves.toBeNull();
        expect(get).toHaveBeenCalledTimes(1);
        expect(get).toHaveBeenCalledWith("pharmacy-results", "nearby:28.61:77.21:r:25");
    });
});
