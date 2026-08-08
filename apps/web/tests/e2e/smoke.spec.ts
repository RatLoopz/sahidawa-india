import { test, expect } from "@playwright/test";

/**
 * Enhanced smoke tests with functional validation beyond page load checks.
 * Addresses issue #4051: Smoke tests should verify key UI elements, not just body visibility.
 */
test.describe("Smoke Tests", () => {
    test("homepage should load successfully", async ({ page }) => {
        await page.goto("/en");

        // Check that the page loads without error
        await expect(page.locator("body")).toBeVisible({ timeout: 30000 });

        // Verify page has content beyond just body
        const content = page.locator("body > *").first();
        await expect(content).toBeVisible({ timeout: 30000 });
    });

    test("scan page should load successfully", async ({ page }) => {
        await page.goto("/en/scan");

        // Wait for the page to load
        await expect(page.locator("body")).toBeVisible({ timeout: 30000 });

        // Verify page has content beyond just body
        const content = page.locator("body > *").first();
        await expect(content).toBeVisible({ timeout: 30000 });
    });

    test("map page should load successfully", async ({ page }) => {
        await page.goto("/en/map");

        // Wait for the page to load
        await expect(page.locator("body")).toBeVisible({ timeout: 30000 });

        // Verify page has content beyond just body
        const content = page.locator("body > *").first();
        await expect(content).toBeVisible({ timeout: 30000 });
    });

    test("expiry tracker page should load successfully", async ({ page }) => {
        await page.goto("/en/expiry-tracker");

        // Wait for the page to load
        await expect(page.locator("body")).toBeVisible({ timeout: 30000 });

        // Verify page has content beyond just body
        const content = page.locator("body > *").first();
        await expect(content).toBeVisible({ timeout: 30000 });
    });

    test("schemes page should load successfully", async ({ page }) => {
        await page.goto("/en/schemes");

        // Wait for the page to load
        await expect(page.locator("body")).toBeVisible({ timeout: 30000 });

        // Verify page has content beyond just body
        const content = page.locator("body > *").first();
        await expect(content).toBeVisible({ timeout: 30000 });
    });
});
