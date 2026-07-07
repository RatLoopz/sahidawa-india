import { test, expect } from "@playwright/test";

test.describe("Smoke Tests", () => {
    test("homepage should load successfully", async ({ page }) => {
        await page.goto("/en");

        // Check that the page title or content loads without error
        // As a basic smoke test, we check if the body is visible
        await expect(page.locator("body")).toBeVisible();
    });

    test("scan page should load successfully", async ({ page }) => {
        await page.goto("/en/scan");

        // Wait for the page to load
        await expect(page.locator("body")).toBeVisible();
    });

    test("map page should load successfully", async ({ page }) => {
        await page.goto("/en/map");

        // Wait for the page to load
        await expect(page.locator("body")).toBeVisible();
    });
});
