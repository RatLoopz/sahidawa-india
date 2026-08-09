/**
 * SahiDawa Service Worker
 * Implements a layered caching strategy:
 *   - Static assets (CSS, JS, fonts, images): Stale-While-Revalidate
 *   - API calls: Network-first with cache fallback
 *   - Navigation (HTML pages): Network-first with offline fallback page
 *
 * @version 2.0.0
 */

const CACHE_VERSION = "3816-public-api-only";

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

/** Public API reads whose responses are identical for every user. */
const PUBLIC_API_ROUTES = [
    (pathname) => pathname === "/api/v1/alerts",
    (pathname) => pathname === "/api/stats",
    (pathname) => pathname === "/api/medicines/search",
    (pathname) => pathname === "/api/medicine/safety",
    (pathname) => pathname.startsWith("/api/verify/batch/"),
];

/** Shared service-worker caches may contain public data only. */
function isPublicCacheableApiRequest(request, url) {
    if (request.method !== "GET" || request.credentials === "include") return false;
    const authenticationHeaders = [
        "authorization",
        "proxy-authorization",
        // "cookie", // Forbidden header; not readable in service workers.
        "x-api-key",
        "x-api-secret",
        "x-csrf-token",
    ];
    if (authenticationHeaders.some((header) => request.headers.has(header))) return false;

    return PUBLIC_API_ROUTES.some((matches) => matches(url.pathname));
}

function isPublicCacheableApiResponse(response) {
    if (!response?.ok || response.redirected || response.headers.has("set-cookie")) return false;

    const cacheControl = response.headers.get("cache-control")?.toLowerCase() ?? "";
    return !cacheControl.includes("no-store") && !cacheControl.includes("private");
}

function createPublicApiRequest(request) {
    // Public reads never need ambient cookies from the browser's default credentials mode.
    return new Request(request, { credentials: "omit" });
}

// ---------------------------------------------------------------------------
// INSTALL — precache core shell pages
// ---------------------------------------------------------------------------
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME).then((cache) =>
            cache.addAll(PRECACHE_PAGES).catch(() => {
                console.info(
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
    const legacyUnsafeApiCaches = new Set(["apis"]);

    event.waitUntil(
        caches.keys().then((cacheNames) =>
            Promise.all(
                cacheNames
                    .filter(
                        (name) =>
                            legacyUnsafeApiCaches.has(name) ||
                            (name.startsWith("sahidawa-") && !validCaches.has(name))
                    )
                    .map((name) => {
                        console.info(`[SW] Deleting stale cache: ${name}`);
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

    // --- Cache Tesseract/OCR CDN assets for fast, offline accessibility ---
    if (
        url.hostname.includes("jsdelivr.net") ||
        url.hostname.includes("unpkg.com") ||
        url.hostname.includes("projectnaptha.com")
    ) {
        event.respondWith(
            cacheFirstWithExpiry(request, STATIC_CACHE_NAME, 30 * 24 * 60 * 60 * 1000)
        );
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
    // Strategy 2 — Medicine-lookup API routes: Network-first with cache fallback
    // (verify, scan, LASA — users must always see the latest safety status)
    // -------------------------------------------------------------------------
    if (
        url.pathname.startsWith("/api/medicines/") ||
        url.pathname.startsWith("/api/verify") ||
        url.pathname.startsWith("/api/v1/scan/") ||
        url.pathname.startsWith("/api/v1/lasa/")
    ) {
        event.respondWith(handleApiRequest(request, url, MEDICINE_CACHE_NAME));
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
        event.respondWith(handleApiRequest(request, url, API_CACHE_NAME));
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
            // Use blob() (not text()) so binary bodies — map tiles, PNG icons —
            // are preserved byte-for-byte. text() decodes as UTF-8, replacing
            // invalid byte sequences with U+FFFD, which corrupts the cached
            // image and leaves offline reloads blank even with a cache hit.
            const cloned = new Response(await networkResponse.clone().blob(), {
                status: networkResponse.status,
                statusText: networkResponse.statusText,
                headers,
            });
            cache
                .put(request, cloned)
                .then(() => {
                    if (cacheName === TILES_CACHE_NAME) {
                        limitCacheSize(TILES_CACHE_NAME, 200);
                    }
                })
                .catch(() => console.warn("[SW] Failed to cache asset in cacheFirstWithExpiry"));
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
 * Limit cache size by deleting the oldest entries in FIFO order.
 */
async function limitCacheSize(cacheName, maxItems) {
    try {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        if (keys.length > maxItems) {
            const numberToDelete = keys.length - maxItems;
            for (let i = 0; i < numberToDelete; i++) {
                await cache.delete(keys[i]);
            }
        }
    } catch (e) {
        console.warn(`[SW] Failed to limit cache size for ${cacheName}`, e);
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
                cache
                    .put(request, networkResponse.clone())
                    .catch(() => console.warn("[SW] Failed to cache in staleWhileRevalidate"));
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
async function handleApiRequest(request, url, cacheName) {
    if (!isPublicCacheableApiRequest(request, url)) {
        return fetchWithoutCache(request);
    }

    return networkFirstWithCache(createPublicApiRequest(request), cacheName);
}

async function fetchWithoutCache(request) {
    const clonedRequest = ["POST", "PUT", "DELETE", "PATCH"].includes(request.method)
        ? request.clone()
        : null;

    try {
        return await fetchWithTimeout(request);
    } catch {
        if (clonedRequest) {
            await saveFailedRequest(clonedRequest);
            if ("sync" in self.registration) {
                try {
                    await self.registration.sync.register("sahidawa-sync-mutations");
                } catch (e) {
                    console.warn("[SW] Sync registration failed", e);
                }
            }
            return new Response(
                JSON.stringify({
                    error: "You are offline. Request queued for sync.",
                    offline: true,
                    queued: true,
                }),
                { status: 503, headers: { "Content-Type": "application/json" } }
            );
        }
        return createOfflineApiResponse();
    }
}

async function fetchWithTimeout(request) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
        return await fetch(request, { signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
}

function createOfflineApiResponse() {
    return new Response(
        JSON.stringify({
            error: "You are offline and this data is not cached.",
            offline: true,
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
    );
}

async function networkFirstWithCache(request, cacheName) {
    const cache = await caches.open(cacheName);

    try {
        // 8s timeout for API calls — important for slow networks
        const networkResponse = await fetchWithTimeout(request);

        // ── CSRF 403 optimization ─────────────────────────────────────────
        // If the API returns a 403 CSRF error for a GET request, don't make
        // the UI wait for the client's token-refresh-and-retry cycle.
        // Serve stale cached data immediately (if we have it) and let the
        // client silently refresh the token in the background.
        if (request.method === "GET" && networkResponse.status === 403) {
            const clonedForCheck = networkResponse.clone();
            const bodyText = await clonedForCheck.text().catch(() => "");
            const isCsrfError =
                bodyText.toLowerCase().includes("csrf") || bodyText.toLowerCase().includes("token");

            if (isCsrfError) {
                const cachedResponse = await cache.match(request);
                if (cachedResponse) {
                    notifyClientsCsrfRefresh();
                    return cachedResponse;
                }
                // No cache available — fall through and return the 403 as-is
                // so the client's existing refresh-and-retry logic handles it.
            }
        }

        if (isPublicCacheableApiResponse(networkResponse)) {
            cache
                .put(request, networkResponse.clone())
                .catch(() =>
                    console.warn("[SW] Failed to cache API response in networkFirstWithCache")
                );
        }
        return networkResponse;
    } catch {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) return cachedResponse;

        return createOfflineApiResponse();
    }
}

// ---------------------------------------------------------------------------
// CSRF REFRESH NOTIFY — tell open clients to silently refresh the CSRF token
// after we've served stale cached data for a 403 CSRF response.
// ---------------------------------------------------------------------------
async function notifyClientsCsrfRefresh() {
    const clients = await self.clients.matchAll({ type: "window" });
    for (const client of clients) {
        client.postMessage({ type: "CSRF_REFRESH_NEEDED" });
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
            cache
                .put(request, networkResponse.clone())
                .catch(() =>
                    console.warn("[SW] Failed to cache page in navigateWithOfflineFallback")
                );
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
// MESSAGE — allow pages to communicate with the SW
//   - SKIP_WAITING: activate a newly installed worker immediately
//   - SET_CURRENT_USER: record which user is signed in (for queue scoping)
//   - CLEAR_SYNC_QUEUE: drop queued mutations (on sign-out)
// ---------------------------------------------------------------------------
self.addEventListener("message", (event) => {
    if (event.data?.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
    if (event.data?.type === "SET_CURRENT_USER") {
        event.waitUntil?.(setMetaValue("current-user-id", event.data.userId ?? null));
    }
    if (event.data?.type === "CLEAR_SYNC_QUEUE") {
        event.waitUntil?.(clearQueuedRequests());
    }
});

// ---------------------------------------------------------------------------
// BACKGROUND SYNC — notify clients to flush offline scan queue
// ---------------------------------------------------------------------------
self.addEventListener("sync", (event) => {
    if (event.tag === "sahidawa-sync-scans") {
        event.waitUntil(notifyClientsToFlush());
    }
    if (event.tag === "sahidawa-sync-mutations") {
        event.waitUntil(flushMutationsQueue());
    }
});

async function notifyClientsToFlush() {
    const clients = await self.clients.matchAll({ type: "window" });
    for (const client of clients) {
        client.postMessage({ type: "FLUSH_SYNC_QUEUE" });
    }
}

// ---------------------------------------------------------------------------
// SYNC QUEUE HELPERS FOR MUTATING REQUESTS
// ---------------------------------------------------------------------------
function openSyncDb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open("sahidawa-sync-db", 2);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains("requests")) {
                db.createObjectStore("requests", { keyPath: "id", autoIncrement: true });
            }
            if (!db.objectStoreNames.contains("meta")) {
                db.createObjectStore("meta", { keyPath: "key" });
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = () => reject("Failed to open sync DB");
    });
}

function setMetaValue(key, value) {
    return openSyncDb()
        .then((db) => {
            return new Promise((resolve, reject) => {
                if (!db.objectStoreNames.contains("meta")) {
                    db.close();
                    return resolve();
                }
                const tx = db.transaction("meta", "readwrite");
                tx.objectStore("meta").put({ key, value });
                tx.oncomplete = () => {
                    db.close();
                    resolve();
                };
                tx.onerror = () => {
                    db.close();
                    reject("Failed to write sync DB meta");
                };
            });
        })
        .catch((e) => console.error("[SW] Failed to write sync DB meta", e));
}

function getMetaValue(key) {
    return openSyncDb()
        .then((db) => {
            return new Promise((resolve, reject) => {
                if (!db.objectStoreNames.contains("meta")) {
                    db.close();
                    return resolve(null);
                }
                const tx = db.transaction("meta", "readonly");
                const req = tx.objectStore("meta").get(key);
                req.onsuccess = () => {
                    db.close();
                    resolve(req.result ? req.result.value : null);
                };
                req.onerror = () => {
                    db.close();
                    reject("Failed to read sync DB meta");
                };
            });
        })
        .catch(() => null);
}

/** The user id the page has most recently told us is signed in (or null). */
function getCurrentUserId() {
    return getMetaValue("current-user-id");
}

/**
 * Derive the owning user id for a queued mutation from its Authorization
 * bearer token (a Supabase JWT whose `sub` claim is the user id). When we
 * later replay the stored headers verbatim, we must only do so while the same
 * user is signed in — replaying with a stored token under a different session
 * would submit an action as the wrong user.
 */
function extractUserIdFromRequest(request) {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) return null;
    const match = /^Bearer\s+(.+)$/i.exec(authHeader);
    if (!match) return null;
    try {
        const encodedPayload = match[1].split(".")[1];
        if (!encodedPayload) return null;
        const base64 = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
        const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
        const payload = JSON.parse(atob(padded));
        return payload?.sub || payload?.user_id || payload?.user?.id || null;
    } catch {
        return null;
    }
}

async function saveFailedRequest(request) {
    try {
        const db = await openSyncDb();
        const headers = {};
        for (const [key, value] of request.headers.entries()) {
            // content-length is recomputed by fetch when the body is replayed,
            // so drop it here to avoid desyncing from the reconstructed body.
            if (key.toLowerCase() === "content-length") continue;
            headers[key] = value;
        }
        // Persist the raw bytes (ArrayBuffer) instead of request.text(), which
        // UTF-8-decodes the body and silently corrupts multipart uploads
        // (medicine photos, voice recordings) so the evidence is lost on replay.
        const body = await request.arrayBuffer();
        const serialized = {
            url: request.url,
            method: request.method,
            headers,
            body,
            timestamp: Date.now(),
            // Bind this entry to the user who created it so it is never
            // replayed under a different session. Prefer the explicit token in
            // the request; fall back to the currently registered session user.
            userId: extractUserIdFromRequest(request) || (await getCurrentUserId()) || null,
        };

        return new Promise((resolve, reject) => {
            const tx = db.transaction("requests", "readwrite");
            tx.objectStore("requests").add(serialized);
            tx.oncomplete = () => {
                db.close();
                resolve();
            };
            tx.onerror = () => {
                db.close();
                reject();
            };
        });
    } catch (e) {
        console.error("[SW] Failed to save request to sync queue", e);
    }
}

function deleteQueuedRequest(db, id) {
    return new Promise((resolve) => {
        const tx = db.transaction("requests", "readwrite");
        tx.objectStore("requests").delete(id);
        tx.oncomplete = resolve;
    });
}

async function readErrorBody(response) {
    try {
        const text = await response.clone().text();
        return text.length > 500 ? `${text.slice(0, 500)}…` : text;
    } catch {
        return "";
    }
}

/**
 * Refresh the CSRF credentials for a queued mutation and retry it once.
 * Used when a flush hits a 401/403 (session/CSRF token expired). The worker
 * rotates the token via /api/csrf-token, stamps it onto a copy of the queued
 * request's headers, and re-sends the mutation. Returns { ok } on success, or
 * { ok: false, status, error } if the retry still failed.
 */
async function refreshCredentialsAndRetry(reqData) {
    try {
        const csrfResponse = await fetch("/api/csrf-token", {
            method: "GET",
            credentials: "include",
        });
        if (!csrfResponse.ok) {
            return {
                ok: false,
                status: csrfResponse.status,
                error: await readErrorBody(csrfResponse),
            };
        }
        const payload = await csrfResponse.json();
        const token = payload?.csrfToken || payload?.csrf_token;
        if (!token) {
            return { ok: false, status: 403, error: "No CSRF token returned by server" };
        }

        const headers = { ...reqData.headers };
        headers["x-csrf-token"] = token;

        const retryResponse = await fetch(reqData.url, {
            method: reqData.method,
            headers,
            body: reqData.method !== "GET" && reqData.method !== "HEAD" ? reqData.body : undefined,
        });

        if (retryResponse.ok) {
            return { ok: true };
        }
        return {
            ok: false,
            status: retryResponse.status,
            error: await readErrorBody(retryResponse),
        };
    } catch {
        return { ok: false, status: 401, error: "" };
    }
}

async function flushMutationsQueue() {
    try {
        const db = await openSyncDb();
        const requests = await new Promise((resolve, reject) => {
            const tx = db.transaction("requests", "readonly");
            const req = tx.objectStore("requests").getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject();
        });

        if (!requests || requests.length === 0) {
            db.close();
            return;
        }

        const rejected = [];
        let flushedAny = false;
        let authFailure = false;

        // User-scoping guard: a mutation bound to a specific user must only be
        // replayed while that same user is authenticated. Never replay queued
        // actions under a different session (or under login as another user),
        // because the stored headers carry credentials for the original owner.
        const currentUserId = await getCurrentUserId();

        for (const reqData of requests) {
            if (reqData.userId && currentUserId !== reqData.userId) {
                console.warn(
                    "[SW] Skipping queued mutation owned by a different user (current session mismatch)"
                );
                continue;
            }
            try {
                const response = await fetch(reqData.url, {
                    method: reqData.method,
                    headers: reqData.headers,
                    body:
                        reqData.method !== "GET" && reqData.method !== "HEAD"
                            ? reqData.body
                            : undefined,
                });

                // Only a confirmed successful response may remove the queued action.
                // A 401/403/409/422/5xx must NEVER be treated as "synced" — dropping
                // the entry would silently destroy a counterfeiter report or
                // medication action the user believed was safely queued.
                if (response.ok) {
                    await deleteQueuedRequest(db, reqData.id);
                    flushedAny = true;
                    continue;
                }

                // Authentication/CSRF failure — refresh credentials and retry once.
                if (response.status === 401 || response.status === 403) {
                    const recovery = await refreshCredentialsAndRetry(reqData);
                    if (recovery.ok) {
                        await deleteQueuedRequest(db, reqData.id);
                        flushedAny = true;
                        continue;
                    }
                    authFailure = true;
                    rejected.push({
                        id: reqData.id,
                        status: recovery.status,
                        url: reqData.url,
                        method: reqData.method,
                        authFailure: true,
                        error: recovery.error || "",
                    });
                    continue;
                }

                // Validation / conflict / server errors — keep the entry queued and
                // surface it so the user can retry, edit, or discard. Never lose data.
                rejected.push({
                    id: reqData.id,
                    status: response.status,
                    url: reqData.url,
                    method: reqData.method,
                    authFailure: false,
                    error: await readErrorBody(response),
                });
            } catch (e) {
                // Network failure (still offline) — leave the entry queued for a
                // later sync. Each queued request is independent, so keep going.
                console.warn("[SW] Sync flush fetch failed (still offline?)", e);
            }
        }
        db.close();

        // Ask open clients to refresh their in-memory CSRF token/session so the
        // next real request (or manual retry) uses fresh credentials.
        if (authFailure) {
            notifyClientsCsrfRefresh();
        }
        const clients = await self.clients.matchAll({ type: "window" });
        for (const client of clients) {
            if (flushedAny) {
                client.postMessage({ type: "SYNC_QUEUE_FLUSHED" });
            }
            client.postMessage({ type: "SYNC_QUEUE_REJECTED", entries: rejected });
        }
    } catch (e) {
        console.error("[SW] Sync flush error", e);
    }
}

/** Drop every queued mutation (used when the user signs out). */
async function clearQueuedRequests() {
    try {
        const db = await openSyncDb();
        if (!db.objectStoreNames.contains("requests")) {
            db.close();
            return;
        }
        await new Promise((resolve) => {
            const tx = db.transaction("requests", "readwrite");
            tx.objectStore("requests").clear();
            tx.oncomplete = resolve;
            tx.onerror = resolve;
        });
        db.close();
        console.log("[SW] Cleared queued mutations after sign-out");
    } catch (e) {
        console.error("[SW] Failed to clear queued mutations", e);
    }
}
