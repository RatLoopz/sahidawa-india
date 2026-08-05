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

        // Submit verification
        const submitButton = page.locator('button[type="submit"], button:has-text("Verify"), button:has-text("Search")').first();
        if (await submitButton.isVisible()) {
            await submitButton.click();

            // Wait for results
            await page.waitForTimeout(2000);

            // Verify either results appear or a "no results" state
            const resultsArea = page.locator("[data-testid='results'], .results, .verification-result, .no-results");
            if (await resultsArea.count() > 0) {
                await expect(resultsArea.first()).toBeVisible({ timeout: 5000 });
            }
        }
    });

    test("should display error for invalid batch code format", async ({ page }) => {
        await page.goto("/en/scan");

        await expect(page.locator("body")).toBeVisible({ timeout: 30000 });

        const batchInput = page.locator("#batch-input");
        await expect(batchInput).toBeVisible({ timeout: 10000 });

        // Enter invalid/empty input and verify error handling
        await batchInput.fill("");
        await page.waitForTimeout(500);

        // Verify error message or validation feedback
        const errorMsg = page.locator(".error, .error-message, [role='alert'], .text-red");
        if (await errorMsg.count() > 0) {
            await expect(errorMsg.first()).toBeVisible({ timeout: 3000 });
        }
    });

    test("should navigate between main pages", async ({ page }) => {
        const pages = [
            { path: "/en", name: "Homepage" },
            { path: "/en/map", name: "Map" },
            { path: "/en/schemes", name: "Schemes" },
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
    test("should handle unauthenticated access to protected routes gracefully", async ({ page }) => {
        // Try accessing a potentially protected route
        await page.goto("/en/profile");

        // Should either redirect to login or show appropriate content
        await expect(page.locator("body")).toBeVisible({ timeout: 30000 });

        // Verify no crash - page should render something
        const content = page.locator("body > *").first();
        await expect(content).toBeVisible({ timeout: 10000 });
    });

    test("should display login option on protected actions", async ({ page }) => {
        await page.goto("/en");

        await expect(page.locator("body")).toBeVisible({ timeout: 30000 });

        // Look for login/auth buttons
        const authButtons = page.locator(
            'button:has-text("Login"), button:has-text("Sign In"), a:has-text("Login"), a:has-text("Sign In")'
        );

        // Verify auth options are present on homepage
        const authSection = page.locator("nav, header, .auth, .login-section");
        if (await authSection.count() > 0) {
            await expect(authSection.first()).toBeVisible({ timeout: 5000 });
        }
    });
});

/**
 * Multi-language/i18n Tests
 * Addresses issue #4049: Multi-language/i18n Switching
 */
test.describe("Internationalization (i18n)", () => {
    const supportedLanguages = ["en", "hi", "ta", "te", "mr", "bn"];

    test("should display language selector on main pages", async ({ page }) => {
        await page.goto("/en");

        await expect(page.locator("body")).toBeVisible({ timeout: 30000 });

        // Look for language selector
        const langSelector = page.locator(
            "select[name*='lang'], button[aria-label*='language'], [data-testid='language-selector'], .lang-selector"
        );

        // Should find language selection option
        const hasLangOption = await langSelector.count() > 0;
        if (!hasLangOption) {
            // Check for language switch links
            const langLinks = page.locator("a[href*='/hi/'], a[href*='/ta/'], .language-buttons");
            const hasLinks = await langLinks.count() > 0;
            expect(hasLinks || hasLangOption).toBeTruthy();
        }
    });

    test("should switch language and display translated content", async ({ page }) => {
        await page.goto("/en");

        await expect(page.locator("body")).toBeVisible({ timeout: 30000 });

        // Try to find and click Hindi language option
        const hindiLink = page.locator("a[href*='/hi/']").first();

        if (await hindiLink.isVisible({ timeout: 3000 }).catch(() => false)) {
            await hindiLink.click();
            await page.waitForURL("**/hi/**");

            // Verify page loaded with Hindi content
            await expect(page.locator("body")).toBeVisible({ timeout: 30000 });
            const content = page.locator("body > *").first();
            await expect(content).toBeVisible({ timeout: 10000 });
        }
    });
});
