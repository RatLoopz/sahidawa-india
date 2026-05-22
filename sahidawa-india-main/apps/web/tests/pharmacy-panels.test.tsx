import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import PharmacyPanels from "../app/[locale]/map/PharmacyPanels";
import type { HeatmapMode, Pharmacy } from "../app/[locale]/map/PharmacyMap";

const samplePharmacies: Pharmacy[] = [
    {
        id: 101,
        name: "SafeMeds Pharmacy",
        distance: "1.2 km",
        distanceKm: 1.2,
        rating: 4.7,
        status: "Verified Safe Store",
        type: "govt",
        coordinates: { lat: 28.6139, lng: 77.209 },
        address: "Connaught Place, New Delhi",
        phone: "+91 98765 43210",
        isVerified: true,
    },
];

const heatmapOptions: Array<{
    id: HeatmapMode;
    label: string;
    description: string;
}> = [
    {
        id: "none",
        label: "Off",
        description: "Hide risk overlays",
    },
    {
        id: "counterfeit",
        label: "Counterfeit",
        description: "Show counterfeit report clusters",
    },
];

function renderPanels(overrides: Partial<ComponentProps<typeof PharmacyPanels>> = {}): string {
    return renderToStaticMarkup(
        <PharmacyPanels
            pharmacies={samplePharmacies}
            selectedPharmacyId={101}
            heatmapMode="counterfeit"
            heatmapOptions={heatmapOptions}
            isLoading={false}
            riskSummaryText="2 report clusters"
            onSelectPharmacy={() => undefined}
            onHeatmapModeChange={() => undefined}
            {...overrides}
        />
    );
}

describe("PharmacyPanels", () => {
    it("renders the shared heading, risk controls, and pharmacy row markup", () => {
        const markup = renderPanels();

        expect(markup).toContain("Nearby Pharmacies");
        expect(markup).toContain("Risk layers");
        expect(markup).toContain("SafeMeds Pharmacy");
        expect(markup).toContain("Verified Safe Store");
        expect(markup).toContain("2 report clusters");
        expect(markup).toContain('aria-pressed="true"');
    });

    it("renders the empty state when no pharmacies are provided", () => {
        const markup = renderPanels({
            pharmacies: [],
            isLoading: false,
            selectedPharmacyId: null,
        });

        expect(markup).toContain("Nearby Pharmacies");
        expect(markup).toContain("No pharmacies found");
        expect(markup).toContain("Search this area");
    });

    it("renders the loading state when pharmacies are still being fetched", () => {
        const markup = renderPanels({
            isLoading: true,
            pharmacies: [],
            selectedPharmacyId: null,
        });

        expect(markup).toContain("Nearby Pharmacies");
        expect(markup).toContain("Finding nearby pharmacies");
        expect(markup).toContain("Verified stores + OpenStreetMap");
        expect(markup).toContain("Loading nearby verified stores…");
        expect(markup).not.toContain("Search this area to load nearby verified stores.");
        expect(markup).not.toContain("No pharmacies found");
    });
});
