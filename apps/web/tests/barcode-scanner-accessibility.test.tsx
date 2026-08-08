import { renderToStaticMarkup } from "react-dom/server";

jest.mock("../components/scanner/usePackagingHint", () => ({
    usePackagingHint: () => false,
}));

import { BarcodeScanner } from "../components/scanner/BarcodeScanner";

describe("BarcodeScanner accessibility", () => {
    it("names the scanner region and live video for assistive tech", () => {
        const markup = renderToStaticMarkup(
            <BarcodeScanner onScan={() => undefined} onRetry={() => undefined} />
        );

        expect(markup).toContain('role="region"');
        expect(markup).toContain("Barcode scanner camera");
        expect(markup).toContain('aria-label="Live camera preview for barcode scanning"');
        expect(markup).toContain("aria-labelledby=");
        expect(markup).toContain("aria-describedby=");
        expect(markup).toContain("Starting camera...");
    });

    it("exposes keyboard-operable retry controls on verification failure", () => {
        const markup = renderToStaticMarkup(
            <BarcodeScanner
                onScan={() => undefined}
                onRetry={() => undefined}
                apiError="Network unavailable"
            />
        );

        expect(markup).toContain("Verification Failed");
        expect(markup).toContain('type="button"');
        expect(markup).toContain("Retry Verification");
    });
});
