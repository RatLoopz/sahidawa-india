/**
 * SahiDawa Service Worker
 * @version 2.0.0
 */

const CACHE_VERSION = "v3";
const OFFLINE_CACHE_NAME = `sahidawa-offline-${CACHE_VERSION}`;
const API_CACHE_NAME = `sahidawa-api-${CACHE_VERSION}`;
const MEDICINE_CACHE_NAME = `sahidawa-medicine-${CACHE_VERSION}`;
const STATIC_CACHE_NAME = `sahidawa-static-${CACHE_VERSION}`;
const ASSETS_CACHE_NAME = `sahidawa-assets-${CACHE_VERSION}`;
const TILES_CACHE_NAME = `sahidawa-tiles-${CACHE_VERSION}`;
const RSC_CACHE_NAME = `sahidawa-rsc-${CACHE_VERSION}`;

const PRECACHE_PAGES = [
    "/", "/en", "/hi", "/gu", "/ta", "/bn", "/mr", "/te",
    "/en/offline", "/hi/offline", "/gu/offline", "/ta/offline",
    "/en/scan", "/hi/scan", "/gu/scan", "/ta/scan",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME).then((cache) =>
            cache.addAll(PRECACHE_PAGES).catch(() => {})
        )
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    const validCaches = new Set([
        OFFLINE_CACHE_NAME, API_CACHE_NAME, MEDICINE_CACHE_NAME,
        STATIC_CACHE_NAME, ASSETS_CACHE_NAME, TILES_CACHE_NAME, RSC_CACHE_NAME,
    ]);
    event.waitUntil(
        caches.keys().then((cacheNames) =>
            Promise.all(cacheNames.filter((name) => !validCaches.has(name)).map((name) => caches.delete(name)))
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (url.hostname.endsWith(".tile.openstreetmap.org") || url.hostname === "tile.openstreetmap.org") {
        event.respondWith(cacheFirstWithExpiry(request, TILES_CACHE_NAME, 7 * 24 * 60 * 60 * 1000));
        return;
    }
    if (url.origin !== self.location.origin) return;
    if (request.url.includes("webpack-hmr") || request.url.includes("_next/webpack-hmr") || request.url.includes("__nextjs")) return;
    if (request.url.endsWith("/sw.js")) return;

    const isDev = self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1" || self.location.hostname.startsWith("192.168.");
    if (isDev && request.url.includes("_next/static/chunks/") && request.destination === "script") return;

    if (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.json") {
        event.respondWith(cacheFirstWithExpiry(request, ASSETS_CACHE_NAME, 30 * 24 * 60 * 60 * 1000));
        return;
    }
    if (url.pathname.startsWith("/api/medicines/") || url.pathname.startsWith("/api/verify") || url.pathname.startsWith("/api/v1/scan/") || url.pathname.startsWith("/api/v1/lasa/")) {
        event.respondWith(staleWhileRevalidate(request, MEDICINE_CACHE_NAME));
        return;
    }
    if (url.searchParams.has("_rsc") || request.headers.get("RSC") === "1" || request.headers.get("Next-Router-State-Tree")) {
        event.respondWith(networkFirstWithCache(request, RSC_CACHE_NAME));
        return;
    }
    if (url.pathname.startsWith("/api/")) {
        event.respondWith(networkFirstWithCache(request, API_CACHE_NAME));
        return;
    }
    if (request.mode === "navigate") {
        event.respondWith(navigateWithOfflineFallback(request));
        return;
    }
    if (["style", "script", "image", "font"].includes(request.destination)) {
        event.respondWith(staleWhileRevalidate(request, STATIC_CACHE_NAME));
        return;
    }
});

/* --- Caching Strategy Helpers --- */
async function cacheFirstWithExpiry(request, cacheName, maxAgeMs) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
        const cachedTime = new Date(cachedResponse.headers.get("sw-cached-at") || 0).getTime();
        if (Date.now() - cachedTime < maxAgeMs) return cachedResponse;
    }
    try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.ok) {
            const headers = new Headers(networkResponse.headers);
            headers.set("sw-cached-at", new Date().toISOString());
            const cloned = new Response(await networkResponse.clone().text(), { status: networkResponse.status, statusText: networkResponse.statusText, headers });
            cache.put(request, cloned).catch(() => {});
        }
        return networkResponse;
    } catch { return cachedResponse || new Response("Offline", { status: 503 }); }
}

async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    const networkFetch = fetch(request).then((res) => {
        if (res && res.ok) cache.put(request, res.clone()).catch(() => {});
        return res;
    }).catch(() => null);
    return cachedResponse || networkFetch;
}

async function networkFirstWithCache(request, cacheName) {
    const cache = await caches.open(cacheName);
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const networkResponse = await fetch(request, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (networkResponse.ok) cache.put(request, networkResponse.clone()).catch(() => {});
        return networkResponse;
    } catch {
        const cachedResponse = await cache.match(request);
        return cachedResponse || new Response(JSON.stringify({ error: "Offline", offline: true }), { status: 503, headers: { "Content-Type": "application/json" } });
    }
}

async function navigateWithOfflineFallback(request) {
    const cache = await caches.open(OFFLINE_CACHE_NAME);
    try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone()).catch(() => {});
        return response;
    } catch {
        const cachedPage = await cache.match(request);
        if (cachedPage) return cachedPage;
        return new Response("<!DOCTYPE html><html><body><h1>Offline</h1></body></html>", { status: 503, headers: { "Content-Type": "text/html" } });
    }
}

/* --- Sync & Notifications --- */
self.addEventListener("sync", (event) => {
    if (event.tag === "sahidawa-sync-scans") {
        event.waitUntil(flushQueueFromServiceWorker());
    }
});

async function flushQueueFromServiceWorker() {
    const queue = await getQueuedScans();
    for (const item of queue) {
        try {
            const res = await fetch(item.apiUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item.body) });
            if (!res.ok && res.status < 500) { await deleteQueuedScan(item.id); continue; }
            if (!res.ok) throw new Error("Retry");

            // FIX: Using crypto.randomUUID() to satisfy security requirements
            const uuid = self.crypto.randomUUID();
            await saveToScanHistory({ id: uuid, timestamp: Date.now(), medicineName: item.barcode, status: "VERIFIED" });
            await deleteQueuedScan(item.id);
        } catch (e) { throw e; }
    }
}

/* --- Database Helpers --- */
function openIndexedDB(dbName, version) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, version);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getQueuedScans() {
    const db = await openIndexedDB("sahidawa-offline-sync", 1);
    return new Promise((resolve) => {
        const tx = db.transaction("sync-queue", "readonly");
        const req = tx.objectStore("sync-queue").getAll();
        req.onsuccess = () => { db.close(); resolve(req.result || []); };
    });
}

async function deleteQueuedScan(id) {
    const db = await openIndexedDB("sahidawa-offline-sync", 1);
    const tx = db.transaction("sync-queue", "readwrite");
    tx.objectStore("sync-queue").delete(id);
    db.close();
}

async function saveToScanHistory(entry) {
    const db = await openIndexedDB("sahidawa-history", 1);
    const tx = db.transaction("scan-history", "readwrite");
    tx.objectStore("scan-history").put(entry);
    db.close();
}
