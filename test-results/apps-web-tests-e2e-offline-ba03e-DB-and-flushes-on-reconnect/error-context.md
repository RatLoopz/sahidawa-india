# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: apps/web/tests/e2e/offline.spec.ts >> Offline Scanner and Sync Queue >> intercepts scan when offline, queues it in IndexedDB, and flushes on reconnect
- Location: apps/web/tests/e2e/offline.spec.ts:21:9

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/en/scan", waiting until "load"

```

# Test source

```ts
  1   | import { expect, test } from "@playwright/test";
  2   | 
  3   | test.describe("Offline Scanner and Sync Queue", () => {
  4   |     const testBarcode = "OFFLINE-TEST-BATCH-001";
  5   | 
  6   |     test.beforeEach(async ({ page }) => {
  7   |         // We go to the scan page and delete the offline DB if it exists
  8   |         // to ensure a clean slate before the test.
> 9   |         await page.goto("/en/scan");
      |                    ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  10  |         await page.evaluate(async () => {
  11  |             return new Promise((resolve) => {
  12  |                 const req = indexedDB.deleteDatabase("sahidawa-offline-sync");
  13  |                 req.onsuccess = resolve;
  14  |                 req.onerror = resolve;
  15  |                 req.onblocked = resolve;
  16  |             });
  17  |         });
  18  |         await page.reload();
  19  |     });
  20  | 
  21  |     test("intercepts scan when offline, queues it in IndexedDB, and flushes on reconnect", async ({
  22  |         page,
  23  |         context,
  24  |     }) => {
  25  |         // Wait for page to be fully loaded
  26  |         await expect(page.locator("body")).toBeVisible();
  27  |         await expect(page.locator("#batch-input")).toBeVisible();
  28  | 
  29  |         // Wait for Service Worker to be active so we know it will cache properly
  30  |         await page.evaluate(async () => {
  31  |             if ("serviceWorker" in navigator) {
  32  |                 const registration = await navigator.serviceWorker.ready;
  33  |                 if (!registration.active) {
  34  |                     throw new Error("Service Worker is not active");
  35  |                 }
  36  |                 return true;
  37  |             }
  38  |             throw new Error("Service Worker not supported");
  39  |         });
  40  | 
  41  |         // Go offline programmatically
  42  |         await context.setOffline(true);
  43  |         // Force the browser to dispatch the offline event so React state updates
  44  |         await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  45  | 
  46  |         // Perform a scan
  47  |         const batchInput = page.locator("#batch-input");
  48  |         await batchInput.fill(testBarcode);
  49  | 
  50  |         // Click verify button
  51  |         const submitButton = page.locator('button[type="submit"]');
  52  |         await expect(submitButton).toBeEnabled();
  53  |         await submitButton.click();
  54  | 
  55  |         // Verify it gets queued in IndexedDB and shows in the UI
  56  |         // The pending scan queue should now be visible and contain the barcode
  57  |         await expect(page.getByText(testBarcode)).toBeVisible({ timeout: 10000 });
  58  | 
  59  |         // Setup interception to catch the background sync request when we go online
  60  |         // The sync API calls either ML endpoint (/verify/batch) or Node API (/api/verify)
  61  |         const syncRequestPromise = page.waitForRequest(
  62  |             (request) => {
  63  |                 const url = request.url();
  64  |                 const isVerifyRequest =
  65  |                     url.includes("/api/verify") || url.includes("/verify/batch");
  66  |                 const isPost = request.method() === "POST";
  67  |                 return isVerifyRequest && isPost;
  68  |             },
  69  |             { timeout: 15000 }
  70  |         );
  71  | 
  72  |         // Reconnect the network
  73  |         await context.setOffline(false);
  74  |         // Dispatch online event so the sync queue flush triggers via window listener
  75  |         await page.evaluate(() => window.dispatchEvent(new Event("online")));
  76  | 
  77  |         // Add error handling and logging for manual sync
  78  |         await page.evaluate(async () => {
  79  |             if ("serviceWorker" in navigator) {
  80  |                 const registration = await navigator.serviceWorker.ready;
  81  |                 if ((registration as any).sync) {
  82  |                     try {
  83  |                         await (registration as any).sync.register("flush-sync-queue");
  84  |                     } catch (error) {
  85  |                         console.error("Sync registration failed:", error);
  86  |                     }
  87  |                 }
  88  |             }
  89  |         });
  90  | 
  91  |         let syncRequest = null;
  92  |         try {
  93  |             syncRequest = await syncRequestPromise;
  94  |         } catch (error) {
  95  |             console.warn("Background sync timeout, triggering manual fallback");
  96  |         }
  97  | 
  98  |         // Fallback: Manually trigger the queue flush through the app's sync mechanism
  99  |         if (!syncRequest) {
  100 |             const fallbackPromise = page.waitForRequest(
  101 |                 (request) => {
  102 |                     const url = request.url();
  103 |                     return (
  104 |                         (url.includes("/api/verify") || url.includes("/verify/batch")) &&
  105 |                         request.method() === "POST"
  106 |                     );
  107 |                 },
  108 |                 { timeout: 10000 }
  109 |             );
```