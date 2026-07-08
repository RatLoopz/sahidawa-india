import { expect, test } from "@playwright/test";

test.describe("Offline Scanner and Sync Queue", () => {
    const testBarcode = "OFFLINE-TEST-BATCH-001";

    test.beforeEach(async ({ page }) => {
        // We go to the scan page and delete the offline DB if it exists
        // to ensure a clean slate before the test.
        await page.goto("/en/scan");
        await page.evaluate(async () => {
            return new Promise((resolve) => {
                const req = indexedDB.deleteDatabase("sahidawa-offline-sync");
                req.onsuccess = resolve;
                req.onerror = resolve;
                req.onblocked = resolve;
            });
        });
        await page.reload();
    });

    test("intercepts scan when offline, queues it in IndexedDB, and flushes on reconnect", async ({
        page,
        context,
    }) => {
        // Wait for page to be fully loaded
        await expect(page.locator("body")).toBeVisible();
        await expect(page.locator("#batch-input")).toBeVisible();

        // Wait for Service Worker to be active so we know it will cache properly
        await page.evaluate(async () => {
            if ("serviceWorker" in navigator) {
                const registration = await navigator.serviceWorker.ready;
                return registration.active?.state === "activated";
            }
            return false;
        });

        // Go offline programmatically
        await context.setOffline(true);
        // Force the browser to dispatch the offline event so React state updates
        await page.evaluate(() => window.dispatchEvent(new Event("offline")));

        // Perform a scan
        const batchInput = page.locator("#batch-input");
        await batchInput.fill(testBarcode);

        // Click verify button
        const submitButton = page.locator('button[type="submit"]');
        await expect(submitButton).toBeEnabled();
        await submitButton.click();

        // Verify it gets queued in IndexedDB and shows in the UI
        // The pending scan queue should now be visible and contain the barcode
        await expect(page.getByText(testBarcode)).toBeVisible({ timeout: 10000 });

        // Setup interception to catch the background sync request when we go online
        // The sync API calls either ML endpoint (/verify/batch) or Node API (/api/verify)
        const syncRequestPromise = page.waitForRequest(
            (request) => {
                const url = request.url();
                const isVerifyRequest =
                    url.includes("/api/verify") || url.includes("/verify/batch");
                const isPost = request.method() === "POST";
                return isVerifyRequest && isPost;
            },
            { timeout: 15000 }
        );

        // Reconnect the network
        await context.setOffline(false);
        // Dispatch online event so the sync queue flush triggers via window listener
        await page.evaluate(() => window.dispatchEvent(new Event("online")));

        // Wait for sync with explicit delay
        await page.waitForTimeout(1000);
        const syncRequest = await syncRequestPromise;
        expect(syncRequest.url()).toMatch(/verify/);

        // After successful flush, the queue should clear and the barcode should disappear
        await expect(page.getByText(testBarcode)).toBeHidden({ timeout: 15000 });
    });
});
