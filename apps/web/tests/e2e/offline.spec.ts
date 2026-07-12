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
                if (!registration.active) {
                    throw new Error("Service Worker is not active");
                }
                return true;
            }
            throw new Error("Service Worker not supported");
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

        // Add error handling and logging for manual sync
        await page.evaluate(async () => {
            if ("serviceWorker" in navigator) {
                const registration = await navigator.serviceWorker.ready;
                if ((registration as any).sync) {
                    try {
                        await (registration as any).sync.register("flush-sync-queue");
                    } catch (error) {
                        console.error("Sync registration failed:", error);
                    }
                }
            }
        });

        let syncRequest = null;
        try {
            syncRequest = await syncRequestPromise;
        } catch (error) {
            console.warn("Background sync timeout, triggering manual fallback");
        }

        // Fallback: Manually trigger the queue flush through the app's sync mechanism
        if (!syncRequest) {
            const fallbackPromise = page.waitForRequest(
                (request) => {
                    const url = request.url();
                    return (
                        (url.includes("/api/verify") || url.includes("/verify/batch")) &&
                        request.method() === "POST"
                    );
                },
                { timeout: 10000 }
            );

            // Trigger the actual queue flush endpoint instead of a bare POST
            await page.evaluate(async () => {
                // Call the app's sync handler to properly flush queued items
                const event = new Event("online");
                window.dispatchEvent(event);
                // Give the sync queue handler time to process
                await new Promise((resolve) => setTimeout(resolve, 1000));
            });

            try {
                syncRequest = await fallbackPromise;
            } catch (error) {
                console.warn("Fallback sync also timed out");
            }
        }

        expect(syncRequest?.url()).toMatch(/verify/);

        // Verify the queue cleared in IndexedDB
        const queueCleared = await page.evaluate(async () => {
            return new Promise((resolve) => {
                const req = indexedDB.open("sahidawa-offline-sync");
                req.onsuccess = (event) => {
                    const db = (event.target as any).result;
                    const objectStore = db
                        .transaction(["pendingScans"])
                        .objectStore("pendingScans");
                    const countRequest = objectStore.count();
                    countRequest.onsuccess = () => resolve(countRequest.result === 0);
                };
                req.onerror = () => resolve(false);
            });
        });

        expect(queueCleared).toBe(true);

        // After successful flush, the queue should clear and the barcode should disappear
        await expect(page.getByText(testBarcode)).toBeHidden({ timeout: 20000 });
    });
});
