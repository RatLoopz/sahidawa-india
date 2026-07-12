/**
 * SahiDawa Service Worker
 * Implements a layered caching strategy:
 *   - Static assets (CSS, JS, fonts, images): Stale-While-Revalidate
 *   - API calls: Network-first with cache fallback
 *   - Navigation (HTML pages): Network-first with offline fallback page
 *
 * @version 2.0.0
 */

const CACHE_VERSION = "fc27e7bd";

/** Navigation / shell pages */
const OFFLINE_CACHE_NAME = `sahidawa-offline-${CACHE_VERSION}`;

/** General API responses (alerts, reports, etc.) */
const API_CACHE_NAME = `sahidawa-api-${CACHE_VERSION}`;

/** Medicine-lookup API responses (verification, scan, LASA) */
const MEDICINE_CACHE_NAME = `sahidawa-medicine-${CACHE_VERSION}`;

/** App static assets (CSS, JS, fonts) */
const STATIC_CACHE_NAME = `sahidawa-static-${CACHE_VERSION}`;

/** App-owned images & manifest */
const ASSETS_CACHE_NAME = `sahidawa-assets-${CACHE_VERSION}`;

/** OpenStreetMap raster tiles */
const TILES_CACHE_NAME = `sahidawa-tiles-${CACHE_VERSION}`;

/** Next.js RSC payloads (client-side locale switches / soft navigations) */
const RSC_CACHE_NAME = `sahidawa-rsc-${CACHE_VERSION}`;

/** Pages to pre-cache on install so they are available offline immediately */
const PRECACHE_PAGES = [
    "/",
    "/en",
    "/hi",
    "/gu",
    "/ta",
    "/bn",
    "/mr",
    "/te",
    "/en/offline",
    "/hi/offline",
    "/gu/offline",
    "/ta/offline",
    "/en/scan",
    "/hi/scan",
    "/gu/scan",
    "/ta/scan",
];

// ---------------------------------------------------------------------------
// INSTALL — precache core shell pages
// ---------------------------------------------------------------------------
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME).then((cache) =>
            cache.addAll(PRECACHE_PAGES).catch(() => {
                console.log(
                    "[SW] Some shell pages could not be precached; they will be cached on first visit."
                );
            })
        )
    );
    // Activate immediately so the new SW takes control without waiting for a reload
    self.skipWaiting();
});

// ---------------------------------------------------------------------------
// ACTIVATE — purge stale caches from previous versions
// ---------------------------------------------------------------------------
self.addEventListener("activate", (event) => {
    const validCaches = new Set([
        OFFLINE_CACHE_NAME,
        API_CACHE_NAME,
        MEDICINE_CACHE_NAME,
        STATIC_CACHE_NAME,
        ASSETS_CACHE_NAME,
        TILES_CACHE_NAME,
        RSC_CACHE_NAME,
    ]);

    event.waitUntil(
        caches.keys().then((cacheNames) =>
            Promise.all(
                cacheNames
                    .filter((name) => !validCaches.has(name))
                    .map((name) => {
                        console.log(`[SW] Deleting stale cache: ${name}`);
                        return caches.delete(name);
                    })
            )
        )
    );

    // Claim all open clients immediately
    self.clients.claim();
});

// ---------------------------------------------------------------------------
// FETCH — route requests to the appropriate caching strategy
// ---------------------------------------------------------------------------
self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // -------------------------------------------------------------------------
    // Strategy 0 — OpenStreetMap tiles: Cache-First, cross-origin
    // (handled before the same-origin guard so tiles work offline)
    // -------------------------------------------------------------------------
    if (
        url.hostname.endsWith(".tile.openstreetmap.org") ||
        url.hostname === "tile.openstreetmap.org"
    ) {
        event.respondWith(cacheFirstWithExpiry(request, TILES_CACHE_NAME, 7 * 24 * 60 * 60 * 1000));
        return;
    }

    // --- Skip cross-origin requests (analytics, CDN assets, etc.) ---
    if (url.origin !== self.location.origin) return;

    // --- Skip Next.js HMR WebSocket / dev-only endpoints ---
    if (
        request.url.includes("webpack-hmr") ||
        request.url.includes("_next/webpack-hmr") ||
        request.url.includes("__nextjs")
    ) {
        return;
    }

    // --- Skip service worker itself ---
    if (request.url.endsWith("/sw.js")) return;

    // --- Dev mode: skip dynamic JS chunks so HMR keeps working ---
    // (detect dev by checking if the origin is localhost / 127.0.0.1)
    const isDev =
        self.location.hostname === "localhost" ||
        self.location.hostname === "127.0.0.1" ||
        self.location.hostname.startsWith("192.168.");
    if (isDev && request.url.includes("_next/static/chunks/") && request.destination === "script") {
        return;
    }

    // -------------------------------------------------------------------------
    // Strategy 1 — App-owned assets (icons, manifest): Cache-First
    // -------------------------------------------------------------------------
    if (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.json") {
        event.respondWith(
            cacheFirstWithExpiry(request, ASSETS_CACHE_NAME, 30 * 24 * 60 * 60 * 1000)
        );
        return;
    }

    // -------------------------------------------------------------------------
    // Strategy 2 — Medicine-lookup API routes: Stale-While-Revalidate
    // (verify, scan, LASA — show cached result immediately, update in background)
    // -------------------------------------------------------------------------
    if (
        url.pathname.startsWith("/api/medicines/") ||
        url.pathname.startsWith("/api/verify") ||
        url.pathname.startsWith("/api/v1/scan/") ||
        url.pathname.startsWith("/api/v1/lasa/")
    ) {
        event.respondWith(staleWhileRevalidate(request, MEDICINE_CACHE_NAME));
        return;
    }

    // -------------------------------------------------------------------------
    // Strategy 2.5 — Next.js RSC payloads: Network-first, cache fallback
    // (client-side locale switches / soft navigations fetch a translated RSC
    // payload for the same route instead of a full page reload. These were
    // previously uncached and failed outright when the network dropped
    // mid-switch, leaving the UI stuck on the old locale or showing broken
    // translation keys.)
    // -------------------------------------------------------------------------
    if (
        url.searchParams.has("_rsc") ||
        request.headers.get("RSC") === "1" ||
        request.headers.get("Next-Router-State-Tree")
    ) {
        event.respondWith(networkFirstWithCache(request, RSC_CACHE_NAME));
        return;
    }

    // -------------------------------------------------------------------------
    // Strategy 3 — Alert & other API routes: Network-first, cache fallback
    // (alerts must be fresh; other API endpoints like reports)
    // -------------------------------------------------------------------------
    if (url.pathname.startsWith("/api/")) {
        event.respondWith(networkFirstWithCache(request, API_CACHE_NAME));
        return;
    }

    // -------------------------------------------------------------------------
    // Strategy 4 — Navigation (HTML pages): Network-first, offline page fallback
    // -------------------------------------------------------------------------
    if (request.mode === "navigate") {
        event.respondWith(navigateWithOfflineFallback(request));
        return;
    }

    // -------------------------------------------------------------------------
    // Strategy 5 — Static assets (CSS, JS, fonts, images): Stale-While-Revalidate
    // -------------------------------------------------------------------------
    if (
        request.destination === "style" ||
        request.destination === "script" ||
        request.destination === "image" ||
        request.destination === "font"
    ) {
        event.respondWith(staleWhileRevalidate(request, STATIC_CACHE_NAME));
        return;
    }
});

// ---------------------------------------------------------------------------
// Caching Strategy Helpers
// ---------------------------------------------------------------------------

/**
 * Cache-First with Expiry:
 *   1. Serve from cache if available and not expired.
 *   2. If expired or not cached, fetch from network and cache the result.
 */
async function cacheFirstWithExpiry(request, cacheName, maxAgeMs) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
        const cachedTime = new Date(cachedResponse.headers.get("sw-cached-at") || 0).getTime();
        const isExpired = Date.now() - cachedTime > maxAgeMs;

        if (!isExpired) {
            return cachedResponse;
        }
    }

    try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.ok) {
            const headers = new Headers(networkResponse.headers);
            headers.set("sw-cached-at", new Date().toISOString());
            const cloned = new Response(await networkResponse.clone().text(), {
                status: networkResponse.status,
                statusText: networkResponse.statusText,
                headers,
            });
            cache.put(request, cloned).catch(() => {});
        }
        return networkResponse;
    } catch {
        if (cachedResponse) return cachedResponse;

        if (request.destination === "image") {
            return new Response(
                '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#e0e0e0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="12" fill="#9ca3af">Offline</text></svg>',
                { headers: { "Content-Type": "image/svg+xml" } }
            );
        }

        return new Response("Offline", { status: 503 });
    }
}

/**
 * Stale-While-Revalidate:
 *   1. Serve from cache immediately if available (fast).
 *   2. Fetch from network in the background and update the cache.
 *   3. If not in cache, fetch from network and cache the result.
 */
async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    // Kick off a background network fetch regardless of cache hit
    const networkFetch = fetch(request)
        .then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
                cache.put(request, networkResponse.clone()).catch(() => {});
            }
            return networkResponse;
        })
        .catch(() => null);

    // Return cached response immediately, or wait for network
    if (cachedResponse) {
        // Return stale response right away; background update already in flight
        return cachedResponse;
    }

    // Nothing in cache — wait for network response (may be null on failure)
    const networkResponse = await networkFetch;
    if (networkResponse) return networkResponse;

    // Ultimate fallback for images
    if (request.destination === "image") {
        return new Response(
            '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#e0e0e0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="12" fill="#9ca3af">Offline</text></svg>',
            { headers: { "Content-Type": "image/svg+xml" } }
        );
    }

    return new Response("Offline", { status: 503 });
}

/**
 * Network-First with Cache Fallback:
 *   1. Try the network.
 *   2. On success: update the cache and return.
 *   3. On failure: serve from cache (if available) or return a 503 JSON.
 */
async function networkFirstWithCache(request, cacheName) {
    const cache = await caches.open(cacheName);

    try {
        // 8s timeout for API calls — important for slow networks
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const networkResponse = await fetch(request, {
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone()).catch(() => {});
        }
        return networkResponse;
    } catch {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) return cachedResponse;

        return new Response(
            JSON.stringify({
                error: "You are offline and this data is not cached.",
                offline: true,
            }),
            { status: 503, headers: { "Content-Type": "application/json" } }
        );
    }
}

/**
 * Navigation with Offline Fallback:
 *   1. Try the network for the requested page.
 *   2. On success: cache the page HTML and return.
 *   3. On failure: serve the cached version of the page (if available).
 *   4. If no cache: serve the /offline page.
 */
async function navigateWithOfflineFallback(request) {
    const cache = await caches.open(OFFLINE_CACHE_NAME);

    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone()).catch(() => {});
        }
        return networkResponse;
    } catch {
        // Try the specific page from cache first
        const cachedPage = await cache.match(request);
        if (cachedPage) return cachedPage;

        // Try locale-aware offline pages
        const url = new URL(request.url);
        const pathParts = url.pathname.split("/").filter(Boolean);
        const SUPPORTED_LOCALES = [
            "en",
            "ta",
            "bn",
            "te",
            "mr",
            "gu",
            "ur",
            "or",
            "hi",
            "kn",
            "pa",
            "as",
            "ks",
            "kok",
            "mai",
            "ml",
            "sa",
        ];
        const locale = SUPPORTED_LOCALES.includes(pathParts[0]) ? pathParts[0] : "en";

        const offlinePage =
            (await cache.match(`/${locale}/offline`)) ||
            (await cache.match("/en/offline")) ||
            (await cache.match("/offline")) ||
            (await cache.match("/"));

        if (offlinePage) return offlinePage;

        // Absolute last resort: inline HTML
        return new Response(
            `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SahiDawa — Offline</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: #e2e8f0; text-align: center; padding: 1rem; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; color: #10b981; }
    p  { color: #94a3b8; margin-bottom: 1.5rem; }
    button { background: #10b981; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-size: 1rem; cursor: pointer; }
  </style>
</head>
<body>
  <div>
    <h1>📡 You're Offline</h1>
    <p>SahiDawa cannot load right now.<br/>Please check your internet connection.</p>
    <button onclick="window.location.reload()">Try Again</button>
  </div>
</body>
</html>`,
            { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
        );
    }
}

// ---------------------------------------------------------------------------
// PUSH NOTIFICATIONS — medicine recall alerts
// ---------------------------------------------------------------------------
self.addEventListener("push", (event) => {
    const payload = event.data
        ? event.data.json()
        : {
              title: "Medicine Recall Alert",
              body: "A medicine recall alert was issued.",
              url: "/en/alerts",
          };

    event.waitUntil(
        self.registration.showNotification(payload.title || "Medicine Recall Alert", {
            body: payload.body || payload.recallReason,
            icon: "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
            data: {
                url: payload.url || "/en/alerts",
                medicineName: payload.medicineName,
                recallReason: payload.recallReason,
            },
            tag: payload.medicineName ? `recall-${payload.medicineName}` : "medicine-recall",
            requireInteraction: payload.severity === "critical",
        })
    );
});

// ---------------------------------------------------------------------------
// NOTIFICATION CLICK — focus existing window or open new one
// ---------------------------------------------------------------------------
self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || "/en/alerts";

    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
            for (const client of clients) {
                if ("focus" in client) {
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }
            return self.clients.openWindow(targetUrl);
        })
    );
});

// ---------------------------------------------------------------------------
// PERIODIC SYNC — check for medicine expiries in the background
// ---------------------------------------------------------------------------
self.addEventListener("periodicsync", (event) => {
    if (event.tag === "check-expiry") {
        event.waitUntil(checkExpiryAndNotify());
    }
});

function checkExpiryAndNotify() {
    return new Promise((resolve) => {
        const request = indexedDB.open("sahidawa-expiry-db", 1);
        request.onerror = () => resolve();
        request.onsuccess = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains("medicines")) {
                db.close();
                return resolve();
            }

            const transaction = db.transaction("medicines", "readwrite");
            const store = transaction.objectStore("medicines");
            const getAllRequest = store.getAll();

            getAllRequest.onerror = () => resolve();
            getAllRequest.onsuccess = () => {
                const medicines = getAllRequest.result || [];
                const now = new Date();
                const promises = [];

                for (const med of medicines) {
                    const expiry = new Date(med.expiryDate);
                    expiry.setHours(0, 0, 0, 0);

                    const sevenDaysBefore = new Date(expiry);
                    sevenDaysBefore.setDate(expiry.getDate() - 7);
                    sevenDaysBefore.setHours(9, 0, 0, 0);

                    const oneDayBefore = new Date(expiry);
                    oneDayBefore.setDate(expiry.getDate() - 1);
                    oneDayBefore.setHours(9, 0, 0, 0);

                    const notified7Days = med.notified7Days || false;
                    const notified1Day = med.notified1Day || false;
                    let updated = false;

                    if (now >= sevenDaysBefore && now < oneDayBefore && !notified7Days) {
                        promises.push(
                            self.registration.showNotification(
                                `Medicine Expiring Soon: ${med.name}`,
                                {
                                    body: `Your tracked medicine ${med.name} will expire in 7 days (on ${expiry.toLocaleDateString()}).`,
                                    tag: `${med.id}-7days`,
                                    icon: "/icons/icon-192.png",
                                    badge: "/icons/icon-192.png",
                                    data: { url: "/en/expiry-tracker", medicineId: med.id },
                                }
                            )
                        );
                        med.notified7Days = true;
                        updated = true;
                    }

                    if (now >= oneDayBefore && !notified1Day) {
                        const expiryCutoff = new Date(expiry);
                        expiryCutoff.setDate(expiry.getDate() + 7);
                        if (now <= expiryCutoff) {
                            promises.push(
                                self.registration.showNotification(
                                    `Medicine Expiring Tomorrow: ${med.name}`,
                                    {
                                        body: `Your tracked medicine ${med.name} will expire tomorrow (on ${expiry.toLocaleDateString()}).`,
                                        tag: `${med.id}-1day`,
                                        icon: "/icons/icon-192.png",
                                        badge: "/icons/icon-192.png",
                                        data: { url: "/en/expiry-tracker", medicineId: med.id },
                                    }
                                )
                            );
                            med.notified1Day = true;
                            updated = true;
                        }
                    }

                    if (updated) {
                        store.put(med);
                    }
                }

                Promise.all(promises).finally(() => {
                    db.close();
                    resolve();
                });
            };
        };
    });
}

// ---------------------------------------------------------------------------
// MESSAGE — allow pages to communicate with the SW (e.g. skip waiting)
// ---------------------------------------------------------------------------
self.addEventListener("message", (event) => {
    if (event.data?.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

// ---------------------------------------------------------------------------
// BACKGROUND SYNC — offline submissions
// ---------------------------------------------------------------------------
self.addEventListener("sync", (event) => {
    if (event.tag === "sahidawa-sync-scans") {
        event.waitUntil(flushQueueFromServiceWorker());
    }
});

function openIndexedDB(dbName, version, upgradeCallback) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, version);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = () => {
            if (upgradeCallback) upgradeCallback(request.result);
        };
    });
}

async function getQueuedScans() {
    try {
        const db = await openIndexedDB("sahidawa-offline-sync", 1);
        if (!db.objectStoreNames.contains("sync-queue")) {
            db.close();
            return [];
        }
        return new Promise((resolve, reject) => {
            const transaction = db.transaction("sync-queue", "readonly");
            const store = transaction.objectStore("sync-queue");
            const request = store.getAll();
            request.onsuccess = () => {
                db.close();
                resolve(request.result || []);
            };
            request.onerror = () => {
                db.close();
                reject(request.error);
            };
        });
    } catch (e) {
        console.error("[SW] Failed to get queued scans", e);
        return [];
    }
}

async function deleteQueuedScan(id) {
    try {
        const db = await openIndexedDB("sahidawa-offline-sync", 1);
        if (!db.objectStoreNames.contains("sync-queue")) {
            db.close();
            return;
        }
        return new Promise((resolve, reject) => {
            const transaction = db.transaction("sync-queue", "readwrite");
            const store = transaction.objectStore("sync-queue");
            const request = store.delete(id);
            request.onsuccess = () => {
                db.close();
                resolve();
            };
            request.onerror = () => {
                db.close();
                reject(request.error);
            };
        });
    } catch (e) {
        console.error("[SW] Failed to delete queued scan", e);
    }
}

async function saveToScanHistory(entry) {
    try {
        const db = await openIndexedDB("sahidawa-history", 1, (db) => {
            if (!db.objectStoreNames.contains("scan-history")) {
                db.createObjectStore("scan-history", { keyPath: "id" });
            }
        });
        return new Promise((resolve, reject) => {
            const transaction = db.transaction("scan-history", "readwrite");
            const store = transaction.objectStore("scan-history");
            const request = store.put(entry);
            request.onsuccess = () => {
                db.close();
                resolve();
            };
            request.onerror = () => {
                db.close();
                reject(request.error);
            };
        });
    } catch (e) {
        console.error("[SW] Failed to save scan history", e);
    }
}

async function flushQueueFromServiceWorker() {
    const queue = await getQueuedScans();
    if (queue.length === 0) return;

    let syncedCount = 0;

    for (const item of queue) {
        try {
            // Determine if the URL is ML service or regular API
            const apiUrl = item.apiUrl || "/api/verify";
            const isMl = apiUrl.includes("/verify/batch");
            const body = isMl
                ? JSON.stringify({ batch_number: item.barcode })
                : JSON.stringify({ batchNumber: item.barcode });

            const res = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body,
            });

            if (!res.ok) {
                // If it is a 5xx or server/network error, we retry later by throwing
                if (res.status >= 500) {
                    throw new Error(`Server returned status ${res.status}`);
                }

                // Discard from queue for other client/unresolvable errors (like 400 or 404)
                await deleteQueuedScan(item.id);
                continue;
            }

            const data = await res.json();

            // Format result
            let title = "Medicine Verification";
            let bodyText = "";
            let historyStatus = "SUSPICIOUS";
            let medicineName = item.barcode;

            if (data.verified) {
                const med = data.medicine;
                medicineName = med.brand_name || item.barcode;
                if (med.is_counterfeit_alert) {
                    title = "⚠️ Counterfeit Alert!";
                    bodyText = `Warning: Medicine "${medicineName}" (Batch: ${med.batch_number}) is flagged as counterfeit.`;
                    historyStatus = "FAKE";
                } else {
                    title = "✅ Medicine Verified Genuine";
                    bodyText = `Medicine "${medicineName}" (Batch: ${med.batch_number}) has been verified.`;
                    historyStatus = "VERIFIED";
                }
            } else {
                title = "❌ Verification Failed";
                bodyText = `Medicine batch ${item.barcode} could not be verified in the CDSCO database.`;
                historyStatus = "SUSPICIOUS";
            }

            // Save to scan history
            const uuid =
                self.crypto && self.crypto.randomUUID
                    ? self.crypto.randomUUID()
                    : Date.now().toString(36) + Math.random().toString(36).substr(2);
            await saveToScanHistory({
                id: uuid,
                timestamp: Date.now(),
                medicineName,
                status: historyStatus,
            });

            // Remove from queue
            await deleteQueuedScan(item.id);
            syncedCount++;

            // Trigger notification
            if (self.registration && "showNotification" in self.registration) {
                await self.registration.showNotification(title, {
                    body: bodyText,
                    icon: "/icons/icon-192.png",
                    badge: "/icons/icon-192.png",
                    data: { url: `/${item.locale || "en"}/history` },
                });
            }
        } catch (error) {
            console.error("[SW] Failed to sync scan: ", error);
            // Re-throw so Background Sync retries later
            throw error;
        }
    }

    // Notify clients that sync finished
    const clientsList = await self.clients.matchAll();
    clientsList.forEach((client) => {
        client.postMessage({
            type: "SYNC_QUEUE_UPDATED",
            count: syncedCount,
        });
    });
}
