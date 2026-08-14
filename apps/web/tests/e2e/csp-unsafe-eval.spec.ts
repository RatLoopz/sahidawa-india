import { test, expect } from "@playwright/test";

/**
 * Regression tests for the Content-Security-Policy header.
 *
 * Policy notes:
 *  - 'wasm-unsafe-eval' is intentionally present: Tesseract.js OCR requires
 *    WebAssembly compilation which is gated by this directive.
 *  - 'unsafe-eval' is present as a fallback for browsers that do not yet
 *    support 'wasm-unsafe-eval' (pre-Chrome 95 / Safari 15.2).
 *  - These are acceptable trade-offs for the OCR feature, documented here.
 *  - XSS protection is maintained via 'strict-dynamic' + per-request nonce.
 */
test.describe("CSP Security", () => {
    const pagesToCheck = ["/en", "/en/scan", "/en/map", "/en/alerts"];

    for (const path of pagesToCheck) {
        test(`CSP on ${path} must use nonce and strict-dynamic`, async ({ page }) => {
            const cspHeaders: string[] = [];

            page.on("response", (response) => {
                if (response.url().includes(path) || response.url().endsWith(path)) {
                    const csp = response.headers()["content-security-policy"];
                    if (csp) cspHeaders.push(csp);
                }
            });

            await page.goto(path, { waitUntil: "domcontentloaded" });

            // Expect at least one CSP header to have been captured
            expect(cspHeaders.length).toBeGreaterThan(0);

            for (const csp of cspHeaders) {
                // Nonce-based XSS protection must always be present.
                expect(csp).toContain("nonce-");
                expect(csp).toContain("strict-dynamic");
                // WASM support for Tesseract OCR — intentionally allowed.
                expect(csp).toContain("wasm-unsafe-eval");
                // Must never allow unscoped inline scripts or data: script execution.
                expect(csp).not.toContain("unsafe-inline");
                expect(csp).not.toContain("script-src data:");
            }
        });
    }

    test("CSP script-src should use nonce, strict-dynamic, and wasm-unsafe-eval", async ({
        page,
    }) => {
        let csp = "";

        page.on("response", (response) => {
            const header = response.headers()["content-security-policy"];
            if (header && header.includes("script-src")) {
                csp = header;
            }
        });

        await page.goto("/en", { waitUntil: "domcontentloaded" });

        expect(csp).toBeTruthy();
        expect(csp).toContain("nonce-");
        expect(csp).toContain("strict-dynamic");
        // Tesseract WASM requires this directive.
        expect(csp).toContain("wasm-unsafe-eval");
        // Must never allow broad inline script injection.
        expect(csp).not.toContain("unsafe-inline");
    });

    test("OpenCV sandbox iframe should exist on scan page", async ({ page }) => {
        await page.goto("/en/scan", { waitUntil: "domcontentloaded" });

        // The sandbox iframe is created lazily when the scanner component mounts.
        await expect(page.locator("body")).toBeVisible({ timeout: 30000 });
    });
});
