import type { AshaWorker, Pharmacy } from "../app/[locale]/map/PharmacyMap";
import type * as PharmacyCache from "../app/[locale]/map/usePharmacyCache";

let buildCacheKey: typeof PharmacyCache.buildCacheKey;
let loadFromCache: typeof PharmacyCache.loadFromCache;
let saveToCache: typeof PharmacyCache.saveToCache;
let openDBMock: jest.Mock;

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

describe("usePharmacyCache", () => {
    beforeEach(async () => {
        jest.resetModules();
        openDBMock = jest.fn();
        (jest as any).unstable_mockModule(
            "idb",
            () => ({
                openDB: openDBMock,
            }),
            { virtual: true }
        );

        ({ buildCacheKey, loadFromCache, saveToCache } =
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

        const key = buildCacheKey(28.6139, 77.209);
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
            "28.61_77.21"
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

    it("returns cached markers when live network loading fails", async () => {
        const entry = {
            pharmacies: samplePharmacies,
            ashaWorkers: sampleAshaWorkers,
            timestamp: 1_800_000_000_000,
        };
        const get = jest.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(entry);
        openDBMock.mockResolvedValue({
            get,
            objectStoreNames: { contains: jest.fn() },
            createObjectStore: jest.fn(),
        } as never);

        await expect(loadFromCache("28.99_77.99")).resolves.toEqual(entry);
        expect(get).toHaveBeenNthCalledWith(1, "pharmacy-results", "28.99_77.99");
        expect(get).toHaveBeenNthCalledWith(2, "pharmacy-results", "last-search");
    });
});
