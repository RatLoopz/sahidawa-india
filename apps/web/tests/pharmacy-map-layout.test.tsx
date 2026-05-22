import { renderToStaticMarkup } from "react-dom/server";

import PharmacyMapPage from "../app/[locale]/map/page";

jest.mock("../app/[locale]/components/PageHeader", () => ({
    PageHeader: ({ children }: { children?: React.ReactNode }) => (
        <header data-testid="page-header">{children}</header>
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
