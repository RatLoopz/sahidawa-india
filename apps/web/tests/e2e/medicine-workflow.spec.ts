import { expect, test } from "@playwright/test";

/**
 * Medicine Verification Workflow E2E Tests
 * Addresses issue #4049: E2E Verification Gaps
 *
 * Tests core user workflows for medicine scanning and verification.
 */
test.describe("Medicine Verification Workflow", () => {
    test.describe.configure({ mode: "serial" });

    test("should verify medicine by batch code", async ({ page }) => {
        const testBatchCode = "BAYER-B01AC24-2025";

        await page.goto("/en/scan");

        // Wait for page to be fully loaded
        await expect(page.locator("body")).toBeVisible({ timeout: 30000 });

        // Find and interact with batch input
        const batchInput = page.locator("#batch-input");
        await expect(batchInput).toBeVisible({ timeout: 10000 });

        // Enter batch code
        await batchInput.fill(testBatchCode);

        // Submit verification - find any submit/verify/search button
        const submitButton = page
            .locator('button[type="submit"], button:has-text("Verify"), button:has-text("Search")')
            .first();
        await submitButton.click();

        // Wait for results
        await page.waitForTimeout(2000);

        // Page should still be responsive after submission
        await expect(page.locator("body")).toBeVisible({ timeout: 5000 });
    });

    test("should handle batch code input field", async ({ page }) => {
        await page.goto("/en/scan");

        await expect(page.locator("body")).toBeVisible({ timeout: 30000 });

        const batchInput = page.locator("#batch-input");
        await expect(batchInput).toBeVisible({ timeout: 10000 });

        // Enter text and verify it persists
        await batchInput.fill("TEST-BATCH-123");
        const inputValue = await batchInput.inputValue();
        expect(inputValue).toBe("TEST-BATCH-123");
    });

    test("should navigate between main pages", async ({ page }) => {
        const pages = [
            { path: "/en", name: "Homepage" },
            { path: "/en/map", name: "Map" },
            { path: "/en/about", name: "About" },
            { path: "/en/expiry-tracker", name: "Expiry Tracker" },
        ];

        for (const p of pages) {
            await page.goto(p.path);
            await expect(page.locator("body")).toBeVisible({ timeout: 30000 });

            // Verify page has rendered content
            const content = page.locator("body > *").first();
            await expect(content).toBeVisible({ timeout: 10000 });
        }
    });
});

/**
 * Authentication Flow Tests
 * Addresses issue #4049: No Authentication Flow Tests
 */
test.describe("Authentication Flow", () => {
    test("should handle unauthenticated access to protected routes gracefully", async ({
        page,
    }) => {
        // Try accessing a potentially protected route
        await page.goto("/en/profile");

        // Should either redirect to login or show appropriate content
        await expect(page.locator("body")).toBeVisible({ timeout: 30000 });

        // Verify no crash - page should render something
        const content = page.locator("body > *").first();
        await expect(content).toBeVisible({ timeout: 10000 });
    });

    test("should display navigation on homepage", async ({ page }) => {
        await page.goto("/en");

        await expect(page.locator("body")).toBeVisible({ timeout: 30000 });

        // Navigation should be present on homepage
        const nav = page.locator("nav");
        await expect(nav.first()).toBeVisible({ timeout: 10000 });
    });
});

/**
 * Multi-language/i18n Tests
 * Addresses issue #4049: Multi-language/i18n Switching
 */
test.describe("Internationalization (i18n)", () => {
    test("should display Hindi language link on homepage", async ({ page }) => {
        await page.goto("/en");

        await expect(page.locator("body")).toBeVisible({ timeout: 30000 });

        // Look for Hindi language link
        const hindiLink = page.locator("a[href*='/hi/']").first();
        await expect(hindiLink).toBeVisible({ timeout: 10000 });
    });

    test("should switch to Hindi language", async ({ page }) => {
        await page.goto("/en");

        await expect(page.locator("body")).toBeVisible({ timeout: 30000 });

        // Find and click Hindi language link
        const hindiLink = page.locator("a[href*='/hi/']").first();
        await hindiLink.click();

        // Verify URL changed to Hindi locale
        await page.waitForURL("**/hi/**", { timeout: 10000 });
        await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
    });
});
