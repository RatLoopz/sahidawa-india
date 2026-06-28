/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor, within } from "@testing-library/react";

import PharmacyMapPage from "../app/[locale]/map/page";
import type { Pharmacy } from "../app/[locale]/map/PharmacyMap";
import { buildCacheKey, loadFromCache, saveToCache } from "../app/[locale]/map/usePharmacyCache";
import {
    fetchNearbyAshaWorkers,
    fetchVerifiedPharmacies,
    fetchVerifiedPharmaciesInBounds,
} from "../lib/api";
import { fetchPharmacies, fetchPharmaciesInBounds } from "../app/[locale]/map/overpassApi";
import { getCachedPharmacies, getLastSyncTimestamp } from "../lib/offline/pharmacy-sync";

jest.mock("next-intl", () => ({
    useLocale: () => "en",
    useTranslations: () => (key: string) => key,
}));

jest.mock("next-intl/server", () => ({
    getTranslations: async () => (key: string) => key,
}));

jest.mock("../app/[locale]/components/PageHeader", () => ({
    PageHeader: ({ children }: { children?: React.ReactNode }) => (
        <header data-testid="page-header">{children}</header>
    ),
}));

jest.mock("../app/[locale]/map/PharmacyMap", () => ({
    __esModule: true,
    default: ({
        pharmacies,
        onMapMoveEnd,
        onMapReady,
    }: {
        pharmacies: Pharmacy[];
        onMapMoveEnd?: (bounds: {
            south: number;
            west: number;
            north: number;
            east: number;
            center: { lat: number; lng: number };
        }) => void;
        onMapReady?: () => void;
    }) => (
        <div data-testid="mock-pharmacy-map">
            <button type="button" onClick={onMapReady}>
                Mock map ready
            </button>
            <button
                type="button"
                onClick={() =>
                    onMapMoveEnd?.({
                        south: 28.5,
                        west: 77.1,
                        north: 28.7,
                        east: 77.3,
                        center: { lat: 28.6139, lng: 77.209 },
                    })
                }
            >
                Mock map moved
            </button>
            {pharmacies.map((pharmacy) => (
                <span key={pharmacy.id}>{pharmacy.name}</span>
            ))}
        </div>
    ),
}));

jest.mock("../hooks/useOfflineStatus", () => ({
    useOfflineStatus: () => ({ isOffline: true }),
}));

jest.mock("../lib/api", () => ({
    fetchVerifiedPharmacies: jest.fn(),
    fetchVerifiedPharmaciesInBounds: jest.fn(),
    fetchNearbyAshaWorkers: jest.fn(),
}));

jest.mock("../app/[locale]/map/overpassApi", () => ({
    fetchPharmacies: jest.fn(),
    fetchPharmaciesInBounds: jest.fn(),
}));

jest.mock("../app/[locale]/map/usePharmacyCache", () => ({
    buildCacheKey: jest.fn((lat: number, lng: number) => `${lat.toFixed(2)}_${lng.toFixed(2)}`),
    loadFromCache: jest.fn(),
    saveToCache: jest.fn(),
}));

jest.mock("../lib/offline/pharmacy-sync", () => ({
    getCachedPharmacies: jest.fn(),
    getLastSyncTimestamp: jest.fn(),
    mergePharmacyDelta: jest.fn((existing, delta) => [...existing, ...delta]),
    setCachedPharmacies: jest.fn(),
    setLastSyncTimestamp: jest.fn(),
}));

const fetchVerifiedPharmaciesMock = jest.mocked(fetchVerifiedPharmacies);
const fetchVerifiedPharmaciesInBoundsMock = jest.mocked(fetchVerifiedPharmaciesInBounds);
const fetchNearbyAshaWorkersMock = jest.mocked(fetchNearbyAshaWorkers);
const fetchPharmaciesMock = jest.mocked(fetchPharmacies);
const fetchPharmaciesInBoundsMock = jest.mocked(fetchPharmaciesInBounds);
const getCachedPharmaciesMock = jest.mocked(getCachedPharmacies);
const getLastSyncTimestampMock = jest.mocked(getLastSyncTimestamp);
const loadFromCacheMock = jest.mocked(loadFromCache);
const saveToCacheMock = jest.mocked(saveToCache);
const buildCacheKeyMock = jest.mocked(buildCacheKey);

const cachedPharmacy: Pharmacy = {
    id: 301,
    name: "Last Online Pharmacy",
    distance: "900 m",
    distanceKm: 0.9,
    rating: 0,
    status: "OSM Verified",
    type: "private",
    coordinates: { lat: 28.614, lng: 77.208 },
    address: "Cached market road",
};

describe("PharmacyMapPage offline pharmacy cache", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Object.defineProperty(window.navigator, "geolocation", {
            configurable: true,
            value: undefined,
        });
        fetchNearbyAshaWorkersMock.mockResolvedValue([]);
        saveToCacheMock.mockResolvedValue(undefined);
        loadFromCacheMock.mockResolvedValue(null);
        getCachedPharmaciesMock.mockResolvedValue([]);
        getLastSyncTimestampMock.mockResolvedValue(null);
        fetchVerifiedPharmaciesInBoundsMock.mockResolvedValue({
            pharmacies: [],
            syncedAt: "2026-06-22T12:00:00.000Z",
            delta: false,
            fromNetwork: true,
        });
        fetchPharmaciesInBoundsMock.mockResolvedValue([]);
    });

    it("caches successful API pharmacy results after the initial nearby search", async () => {
        fetchVerifiedPharmaciesMock.mockResolvedValue([
            {
                name: "Verified Partner",
                address: "Janpath",
                lat: 28.6139,
                lng: 77.209,
                distance: "1.0 km",
                phone_number: null,
                is_verified: true,
                district: "New Delhi",
                state: "Delhi",
            },
        ]);
        fetchPharmaciesMock.mockResolvedValue([
            {
                id: 901,
                name: "OSM Chemist",
                lat: 28.625,
                lng: 77.22,
                type: "private",
                address: "Outer circle",
            },
        ]);

        render(<PharmacyMapPage />);

        await waitFor(() => {
            expect(saveToCacheMock).toHaveBeenCalledWith(
                "28.61_77.21",
                expect.arrayContaining([
                    expect.objectContaining({ name: "Verified Partner" }),
                    expect.objectContaining({ name: "OSM Chemist" }),
                ]),
                []
            );
        });
    });

    it("restores cached pharmacy markers when offline live loading returns no API markers", async () => {
        fetchVerifiedPharmaciesMock.mockResolvedValue([]);
        fetchPharmaciesMock.mockRejectedValue(new Error("network offline"));
        loadFromCacheMock.mockResolvedValue({
            pharmacies: [cachedPharmacy],
            ashaWorkers: [],
            timestamp: Date.now(),
        });

        render(<PharmacyMapPage />);

        expect(await screen.findAllByText("Last Online Pharmacy")).not.toHaveLength(0);
        expect(
            within(screen.getByTestId("mock-pharmacy-map")).getByText("Last Online Pharmacy")
        ).toBeTruthy();
        expect(buildCacheKeyMock).toHaveBeenCalledWith(28.6139, 77.209);
        expect(loadFromCacheMock).toHaveBeenCalledWith("28.61_77.21");
        expect(screen.queryByText("Could not load pharmacies. Try again.")).toBeNull();
    });

    it("does not send a stale delta timestamp when no synced pharmacies are cached", async () => {
        getCachedPharmaciesMock.mockResolvedValue([]);
        getLastSyncTimestampMock.mockResolvedValue("2026-06-22T11:00:00.000Z");
        fetchVerifiedPharmaciesMock.mockResolvedValue([]);
        fetchPharmaciesMock.mockResolvedValue([]);

        render(<PharmacyMapPage />);

        await screen.findByTestId("mock-pharmacy-map");
        screen.getByRole("button", { name: "Mock map ready" }).click();
        await waitFor(() => {
            expect(saveToCacheMock).toHaveBeenCalled();
        });
        screen.getByRole("button", { name: "Mock map moved" }).click();
        await screen.findByRole("button", { name: "Search this area" });
        screen.getByRole("button", { name: "Search this area" }).click();

        await waitFor(() => {
            expect(fetchVerifiedPharmaciesInBoundsMock).toHaveBeenCalledWith(
                expect.any(Number),
                expect.any(Number),
                expect.any(Number),
                expect.any(Number),
                undefined
            );
        });
        expect(getLastSyncTimestampMock).not.toHaveBeenCalled();
    });
});
