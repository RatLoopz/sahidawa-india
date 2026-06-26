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

function countOccurrences(markup: string, text: string): number {
    return markup.split(text).length - 1;
}

describe("PharmacyMapPage responsive layout", () => {
    it("renders a premium command header with constrained search and elevated filters", () => {
        const markup = renderToStaticMarkup(<PharmacyMapPage />);

        expect(markup).toContain('data-testid="pharmacy-map-command-bar"');
        expect(markup).toContain("max-w-4xl");
        expect(markup).toContain('data-testid="pharmacy-map-search"');
        expect(markup).toContain("focus-within:ring-4");
        expect(markup).toContain('data-testid="pharmacy-filter-shell"');
        expect(markup).toContain("rounded-[1.35rem]");
        expect(markup).toContain("hover:-translate-y-0.5");
        expect(markup).toContain("bg-emerald-600");
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

    it("renders a split desktop shell and reuses the shared panels outside the map pane", () => {
        const markup = renderToStaticMarkup(<PharmacyMapPage />);

        expect(markup).toContain('data-testid="pharmacy-map-layout"');
        expect(markup).toContain("flex h-full min-h-0 flex-col");
        expect(markup).toContain("md:grid");
        expect(markup).toContain("md:grid-cols-[minmax(22rem,30rem)_minmax(0,1fr)]");
        expect(markup).toContain('data-testid="desktop-pharmacy-sidebar"');
        expect(markup).toContain('data-testid="mobile-pharmacy-drawer"');
        expect(markup).toContain('data-testid="pharmacy-map-pane"');
        expect(markup).toContain('data-testid="mobile-pharmacy-list-toggle"');
        expect(markup).toContain('aria-label="Toggle pharmacy list"');
        expect(markup).toContain('aria-label="Find my location"');
        expect(markup).toContain("md:hidden");
        expect(countOccurrences(markup, "Nearby Pharmacies")).toBe(2);
        expect(countOccurrences(markup, "Risk layers")).toBe(2);
        expect(markup).not.toContain('data-testid="floating-risk-layers-card"');
    });
});
