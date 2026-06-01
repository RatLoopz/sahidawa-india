# PR #1021 — feat(pwa): offline-first caching for service worker

> **Merged:** 2026-06-01 | **Author:** @vishali-mp | **Area:** Frontend | **Impact Score:** 6 | **Closes:** #633

## What Changed

This pull request significantly enhances our Progressive Web App (PWA) capabilities by implementing robust offline-first caching strategies within our existing hand-rolled service worker. We've introduced `StaleWhileRevalidate` for critical medicine lookup APIs, `CacheFirst` with expiry for OpenStreetMap tiles, app icons, and the manifest, while maintaining `NetworkFirst` for real-time alerts. Eight new static analysis tests were also added to validate the service worker's structure and caching logic.

## The Problem Being Solved

Prior to this change, our SahiDawa PWA offered limited offline functionality. While a basic service worker existed (v2), it lacked sophisticated caching strategies for dynamic content like API responses and external assets such as map tiles. This meant that users in rural areas with intermittent or no internet connectivity would experience degraded performance or complete unavailability of key features, such as medicine verification or map navigation, when offline. The goal was to provide a more resilient and performant user experience by intelligently caching various types of content.

## Files Modified

- `apps/web/public/sw.js`
- `apps/web/tests/offline.test.ts`

## Implementation Details

We have upgraded our service worker, located at `apps/web/public/sw.js`, to `CACHE_VERSION = "v3"`. This version bump ensures that older caches are purged during the `activate` event, allowing our new caching strategies to take effect cleanly.

Several new named caches have been introduced to segment cached resources logically:
- `MEDICINE_CACHE_NAME`: For medicine-related API responses.
- `ASSETS_CACHE_NAME`: For app icons and the manifest file.
- `TILES_CACHE_NAME`: Specifically for OpenStreetMap raster tiles.

The `activate` event listener has been updated to include these new cache names in its `validCaches` set, ensuring only current caches are retained.

The core of the changes lies within the `fetch` event listener, where we've implemented new routing and caching strategies:

1.  **OpenStreetMap Tiles (Cache-First with Expiry):**
    *   Requests to `*.tile.openstreetmap.org` are now intercepted *before* the same-origin check.
    *   We apply a `cacheFirstWithExpiry` strategy, storing tiles in `TILES_CACHE_NAME` with a 7-day (7 * 24 * 60 * 60 * 1000 ms) time-to-live (TTL). This ensures map tiles are available offline and are refreshed periodically.

2.  **App Assets (Cache-First with Expiry):**
    *   Requests for `/icons/` and `/manifest.json` are now handled with `cacheFirstWithExpiry`.
    *   These assets are stored in `ASSETS_CACHE_NAME` with a 30-day (30 * 24 * 60 * 60 * 1000 ms) TTL, prioritizing offline availability and reducing network requests for static UI elements. The previous explicit skip for `manifest.json` was removed as it's now actively cached.

3.  **Medicine-Lookup API Routes (Stale-While-Revalidate):**
    *   API endpoints crucial for medicine verification and information (`/api/medicines/`, `/api/verify`, `/api/v1/scan/`, `/api/v1/lasa/`) now use the `staleWhileRevalidate` strategy.
    *   These responses are cached in `MEDICINE_CACHE_NAME`. This strategy immediately serves cached data for speed, while simultaneously fetching a fresh response from the network in the background to update the cache for future requests.

4.  **Alert & Other API Routes (Network-First with Cache Fallback):**
    *   General API requests starting with `/api/` (e.g., for alerts, reports) continue to use `networkFirstWithCache` with `API_CACHE_NAME`. This prioritizes fetching the freshest data from the network, falling back to the cache only if the network is unavailable. This is critical for time-sensitive information like health alerts.

5.  **Static Assets (Stale-While-Revalidate):**
    *   Requests for `style`, `script`, `image`, and `font` destinations now explicitly use `staleWhileRevalidate` with `STATIC_CACHE_NAME`. This improves perceived load times for static resources.

A new helper function, `cacheFirstWithExpiry(request, cacheName, maxAgeMs)`, was introduced. This function attempts to retrieve a response from the specified `cacheName`. If a cached response exists and has not expired (checked against a custom `sw-cached-at` header we set), it's returned immediately. Otherwise, it fetches from the network, caches the new response (adding the `sw-cached-at` header), and returns it. It includes a fallback for images (a generic SVG placeholder) and general requests (a "Offline" 503 response) if both cache and network fail.

On the testing front, we've added 8 new static analysis tests in `apps/web/tests/offline.test.ts` within a new `describe("Service Worker")` block. These tests use Node.js `fs` module to read `public/sw.js` and assert its content, verifying:
- The existence of the service worker file and its core event listeners (`install`, `activate`, `fetch`).
- The definition of all expected cache names (`sahidawa-offline-`, `sahidawa-api-`, `sahidawa-medicine-`, `sahidawa-static-`, `sahidawa-assets-`, `sahidawa-tiles-`).
- Correct handling of OSM tile origins and their associated cache.
- The presence of `StaleWhileRevalidate` logic for medicine lookup APIs.
- The `CacheFirst` logic for icons and `manifest.json`.
- The inclusion of `push` and `notificationclick` event handlers for push notifications.
- The `SKIP_WAITING` message handler for service worker updates.

## Technical Decisions

We made a deliberate decision to continue with a hand-rolled service worker implementation rather than adopting existing solutions like `next-pwa` or `@ducanh2912/next-pwa`. This was primarily because:
1.  `next-pwa` is currently unmaintained, posing a long-term risk.
2.  `@ducanh2912/next-pwa` requires a `--webpack` build flag and does not enable the service worker in development mode, which would significantly hinder our iterative development process and local testing. Our current hand-rolled approach allows the service worker to function immediately in development, providing a more consistent experience.

The choice of caching strategies was driven by the nature of the content:
-   **`StaleWhileRevalidate` for medicine APIs:** This balances freshness with performance. Users get immediate feedback from the cache, which is crucial for a smooth UX, while the background update ensures they eventually receive the most current information without blocking the UI. This is ideal for data that is important but not necessarily real-time critical.
-   **`CacheFirst` with expiry for OSM tiles, icons, and manifest:** These assets are largely static or change infrequently. Prioritizing the cache provides maximum speed and offline availability. The expiry mechanism ensures that eventually, updated versions are fetched, preventing stale content from persisting indefinitely.
-   **`NetworkFirst` for alerts and general APIs:** Alerts are time-sensitive, and other API endpoints might contain critical, rapidly changing data. `NetworkFirst` ensures users always see the freshest information possible, falling back to cached data only when the network is completely unavailable.

The `CACHE_VERSION` bump to `v3` was essential to gracefully transition users from the previous service worker version, ensuring that old, potentially incompatible caches are cleared and the new, optimized caching structure is adopted. The custom `sw-cached-at` header for expiry in `cacheFirstWithExpiry` provides a simple, self-contained mechanism for TTL without introducing external dependencies or complex cache control headers from the server side for these specific assets.

## How To Re-Implement (Contributor Reference)

To re-implement this offline-first caching functionality from scratch, a contributor would follow these steps:

1.  **Create/Update `apps/web/public/sw.js`**:
    *   Define a `CACHE_VERSION` constant (e.g., `v3`).
    *   Declare distinct named caches for different resource types: `OFFLINE_CACHE_NAME`, `API_CACHE_NAME`, `MEDICINE_CACHE_NAME`, `STATIC_CACHE_NAME`, `ASSETS_CACHE_NAME`, `TILES_CACHE_NAME`.
    *   Define `PRECACHE_PAGES` for essential offline routes.

2.  **Implement `install` Event Listener**:
    *   Use `event.waitUntil(caches.open(OFFLINE_CACHE_NAME).then((cache) => cache.addAll(PRECACHE_PAGES)))` to pre-cache critical navigation pages.

3.  **Implement `activate` Event Listener**:
    *   Define a `Set` of `validCaches` containing all current named caches.
    *   Use `event.waitUntil(caches.keys().then((cacheNames) => Promise.all(cacheNames.map((cacheName) => { if (!validCaches.has(cacheName)) return caches.delete(cacheName); }))))` to purge any caches not in the `validCaches` set.

4.  **Implement Caching Strategy Helpers**:
    *   **`cacheFirstWithExpiry(request, cacheName, maxAgeMs)`**:
        *   Open the specified `cacheName`.
        *   Attempt `cache.match(request)`.
        *   If `cachedResponse` exists, extract `sw-cached-at` header, check `Date.now() - cachedTime > maxAgeMs`. If not expired, return `cachedResponse`.
        *   If expired or not cached, `fetch(request)`.
        *   If `networkResponse` is `ok`, clone it, add `sw-cached-at` header with `new Date().toISOString()`, and `cache.put(request, cloned)`.
        *   Return `networkResponse`.
        *   Implement `catch` block for network failures, returning `cachedResponse` if available, or a fallback (e.g., SVG for images, 503 for others).
    *   Ensure `staleWhileRevalidate(request, cacheName)`, `networkFirstWithCache(request, cacheName)`, and `navigateWithOfflineFallback(request)` are also defined (these are assumed to exist from prior SW versions).

5.  **Implement `fetch` Event Listener**:
    *   **Cross-origin OSM Tiles (Cache-First with Expiry):**
        *   Check `url.hostname.endsWith(".tile.openstreetmap.org")`.
        *   `event.respondWith(cacheFirstWithExpiry(request, TILES_CACHE_NAME, 7 * 24 * 60 * 60 * 1000));`
    *   **Same-Origin Guard**: `if (url.origin !== self.location.origin) return;`
    *   **Dev Mode Bypass**: `if (isDev && request.url.includes("/_next/static/chunks/pages/")) return;`
    *   **App Assets (Cache-First with Expiry):**
        *   Check `url.pathname.startsWith("/icons/") || url.pathname === "/manifest.json"`.
        *   `event.respondWith(cacheFirstWithExpiry(request, ASSETS_CACHE_NAME, 30 * 24 * 60 * 60 * 1000));`
    *   **Medicine APIs (Stale-While-Revalidate):**
        *   Check `url.pathname.startsWith("/api/medicines/") || url.pathname.startsWith("/api/verify") || url.pathname.startsWith("/api/v1/scan/") || url.pathname.startsWith("/api/v1/lasa/")`.
        *   `event.respondWith(staleWhileRevalidate(request, MEDICINE_CACHE_NAME));`
    *   **General APIs (Network-First):**
        *   Check `url.pathname.startsWith("/api/")`.
        *   `event.respondWith(networkFirstWithCache(request, API_CACHE_NAME));`
    *   **Navigation (Network-First with Offline Fallback):**
        *   Check `request.mode === "navigate"`.
        *   `event.respondWith(navigateWithOfflineFallback(request));`
    *   **Static Assets (Stale-While-Revalidate):**
        *   Check `request.destination === "style" || request.destination === "script" || request.destination === "image" || request.destination === "font"`.
        *   `event.respondWith(staleWhileRevalidate(request, STATIC_CACHE_NAME));`

6.  **Implement Push and Notification Click Handlers**: Ensure `push` and `notificationclick` event listeners are present for PWA notification functionality.

7.  **Add Static Analysis Tests (`apps/web/tests/offline.test.ts`)**:
    *   Use `require("fs")` and `path.join(process.cwd(), "public/sw.js")` to read the service worker file content.
    *   Write `it` blocks for each caching strategy and key service worker feature, asserting that specific strings (e.g., cache names, URL patterns, function calls) are present in the `swContent`.

## Impact on System Architecture

This change significantly elevates SahiDawa's Progressive Web App capabilities, moving it towards a truly offline-first experience.
-   **Enhanced User Experience:** Users, especially in areas with unreliable internet, will now experience faster load times and uninterrupted access to critical features like medicine verification and map navigation, even when offline. This directly supports our mission of rural health.
-   **Reduced Server Load:** By caching API responses and static assets at the client level, we reduce the number of requests hitting our backend servers, leading to improved scalability and potentially lower operational costs.
-   **Foundation for Future PWA Features:** The robust caching infrastructure provides a solid base for implementing more advanced PWA features, such as background synchronization or more sophisticated offline data management.
-   **Maintainability:** By sticking with a hand-rolled service worker, we retain full control and avoid external dependencies that might become unmaintained or introduce unwanted build complexities, aligning with our open-source ethos.
-   **No New Dependencies:** The implementation leverages native Service Worker APIs, ensuring a lean and performant solution without adding to our project's dependency footprint.

## Testing & Verification

Verification of this feature involved both automated static analysis and manual acceptance testing.

**Automated Testing:**
We added 8 new static analysis tests within `apps/web/tests/offline.test.ts`. These tests directly inspect the content of `apps/web/public/sw.js` to ensure:
-   The service worker file is correctly structured and contains the necessary event listeners (`install`, `activate`, `fetch`).
-   All new and existing named caches (`sahidawa-offline-`, `sahidawa-api-`, `sahidawa-medicine-`, `sahidawa-static-`, `sahidawa-assets-`, `sahidawa-tiles-`) are correctly defined.
-   The specific URL patterns for OpenStreetMap tiles, medicine APIs (`/api/medicines/`, `/api/verify`, `/api/v1/scan/`, `/api/v1/lasa/`), and app assets (`/icons/`, `/manifest.json`) are correctly identified and routed to their respective caching strategies.
-   The service worker includes handlers for `push` and `notificationclick` events, as well as the `SKIP_WAITING` message, confirming its full PWA lifecycle support.
All 143 existing tests, including these new ones, passed successfully.

**Manual Verification:**
The author performed manual verification to ensure all acceptance criteria were met:
-   The application was run locally, and the service worker's behavior was observed in browser developer tools (Application tab).
-   Network requests for medicine lookups, map tiles, icons, and the manifest were checked to confirm they were served from the cache when offline or via the specified caching strategies.
-   Offline functionality was tested by simulating network disconnection and verifying that cached content was accessible.
-   Prettier checks confirmed code formatting compliance.

**Edge Cases:**
-   **Network Failure:** The `cacheFirstWithExpiry` helper includes specific fallbacks for images (a placeholder SVG) and general requests (a 503 "Offline" response) when both cache and network fail.
-   **Cross-Origin Requests:** The service worker explicitly skips requests originating from domains other than `self.location.origin` (except for OpenStreetMap tiles, which are explicitly handled), preventing unintended caching of third-party resources.
-   **Development Mode:** Dynamic JavaScript chunks are intentionally skipped in development mode to ensure Hot Module Replacement (HMR) continues to function correctly, preventing developer friction.
-   **Cache Expiry:** The `sw-cached-at` header and `maxAgeMs` parameter in `cacheFirstWithExpiry` ensure that cached assets are eventually refreshed, preventing indefinite serving of stale content.