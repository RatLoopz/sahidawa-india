import React from "react";
import { describe, it, expect, jest } from "@jest/globals";
import { render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import MapHeaderLoadingIndicator from "../app/[locale]/map/MapHeaderLoadingIndicator";
import PharmacyMapPage from "../app/[locale]/map/page";

jest.mock("next-intl", () => ({
    useLocale: () => "en",
    useTranslations: () => (key: string) => key,
}));

jest.mock("next-intl/server", () => ({
    getTranslations: async () => (key: string) => key,
}));

jest.mock("../app/[locale]/components/PageHeader", () => ({
    PageHeader: ({
        children,
        backHref,
        contentClassName,
    }: {
        children?: React.ReactNode;
        backHref: string;
        contentClassName?: string;
    }) => (
        <header data-testid="page-header">
            <div data-testid="page-header-content" className={contentClassName}>
                <a href={backHref} data-testid="map-back-control">
                    Back
                </a>
                {children}
            </div>
        </header>
    ),
}));

jest.mock("../app/[locale]/map/PharmacyMap", () => ({
    __esModule: true,
    default: () => <div data-testid="mock-pharmacy-map">Mock map</div>,
}));

jest.mock("../hooks/useOfflineStatus", () => ({
    useOfflineStatus: () => ({ isOffline: false }),
}));

jest.mock("../lib/api", () => ({
    fetchVerifiedPharmacies: async () => [],
    fetchVerifiedPharmaciesInBounds: async () => ({
        pharmacies: [],
        syncedAt: "",
        delta: false,
        fromNetwork: true,
    }),
    fetchNearbyAshaWorkers: async () => [],
}));

jest.mock("../app/[locale]/map/overpassApi", () => ({
    fetchPharmacies: async () => [],
    fetchPharmaciesInBounds: async () => [],
}));

jest.mock("../app/[locale]/map/usePharmacyCache", () => ({
    buildNearbyCacheKey: () => "mock-key",
    buildBoundsCacheKey: () => "mock-key",
    loadFromCache: async () => null,
    saveToCache: async () => undefined,
}));

jest.mock("@/lib/offline/pharmacy-sync", () => ({
    getCachedPharmacies: async () => [],
    getLastSyncTimestamp: async () => null,
}));

describe("PharmacyMapPage responsive layout", () => {
    it("renders a premium command header with constrained search and elevated filters", async () => {
        render(<PharmacyMapPage />);

        const commandBar = await screen.findByTestId("pharmacy-map-command-bar");
        expect(commandBar).toBeInTheDocument();
        expect(commandBar.className).toContain("md:max-w-md");

        const search = screen.getByTestId("pharmacy-map-search");
        expect(search).toBeInTheDocument();
        expect(search.className).toContain("rounded-2xl");
        expect(search.className).toContain("focus-within:ring-4");

        const filterShell = screen.getByTestId("pharmacy-filter-shell");
        expect(filterShell).toBeInTheDocument();

        const buttons = within(filterShell).getAllByRole("button");
        expect(buttons.length).toBeGreaterThan(0);
        expect(buttons.some((btn) => btn.className.includes("hover:-translate-y-0.5"))).toBe(true);
        expect(buttons.some((btn) => btn.className.includes("bg-emerald-600"))).toBe(true);
    });

    it("renders a structured header loading indicator instead of plain fetching text", () => {
        const markup = renderToStaticMarkup(<MapHeaderLoadingIndicator />);

        expect(markup).toContain('data-testid="pharmacy-header-loading-card"');
        expect(markup).toContain('role="status"');
        expect(markup).toContain("Finding trusted pharmacies");
        expect(markup).toContain("Checking verified partners and OSM stores");
        expect(markup).toContain("animate-pulse");
        expect(markup).not.toContain("Fetching pharmacies");
    });

    it("renders a split desktop shell and reuses the shared panels outside the map pane", async () => {
        render(<PharmacyMapPage />);

        const layout = await screen.findByTestId("pharmacy-map-layout");
        expect(layout).toBeInTheDocument();
        expect(layout.className).toContain("flex h-full min-h-0 flex-col");
        expect(layout.className).toContain("md:grid");
        expect(layout.className).toContain("md:grid-cols-[minmax(22rem,30rem)_minmax(0,1fr)]");

        expect(screen.getByTestId("desktop-pharmacy-sidebar")).toBeInTheDocument();
        expect(screen.getByTestId("mobile-pharmacy-drawer")).toBeInTheDocument();
        expect(screen.getByTestId("pharmacy-map-pane")).toBeInTheDocument();

        const toggle = screen.getByTestId("mobile-pharmacy-list-toggle");
        expect(toggle).toBeInTheDocument();
        expect(toggle.className).toContain("md:hidden");
        expect(toggle.getAttribute("aria-label")).toBe("Toggle pharmacy list");

        const locateBtns = screen.getAllByRole("button", { name: "Find my location" });
        expect(locateBtns.length).toBeGreaterThan(0);

        const nearbys = screen.getAllByText("Nearby Pharmacies");
        expect(nearbys.length).toBe(2);

        const risks = screen.getAllByText("Risk layers");
        expect(risks.length).toBe(2);

        expect(screen.queryByTestId("floating-risk-layers-card")).toBeNull();
    });
});
