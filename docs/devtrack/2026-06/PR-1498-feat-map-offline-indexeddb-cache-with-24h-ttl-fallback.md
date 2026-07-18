# PR #1498 — feat(map): offline IndexedDB cache with 24h TTL fallback

> **Merged:** 2026-06-09 | **Author:** @Mahesh-forcode | **Area:** Frontend | **Impact Score:** 10 | **Closes:** #1297

## What Changed

This pull request introduces offline caching capabilities for the Map page. We now leverage IndexedDB to store pharmacy and ASHA worker data, keyed by rounded geographical coordinates. When a user is offline or experiences network issues, the system will attempt to load the nearest cached data, displaying a clear amber banner to inform the user that they are viewing previously saved information.

## The Problem Being Solved

Previously, the SahiDawa Map page was entirely dependent on a live network connection to fetch pharmacy and ASHA worker data. This created a significant usability barrier for our users, particularly in rural areas where internet connectivity can be unreliable or non-existent. Without an active connection, the map would fail to load any relevant information, rendering a critical feature of the platform unusable when it's needed most. This change ensures continued access to essential health provider location data, improving the platform's resilience and utility in low-connectivity environments.

## Files Modified

- `apps/web/app/[locale]/map/page.tsx`
- `apps/web/app/[locale]/map/usePharmacyCache.ts`
- `package-lock.json`

## Implementation Details

This feature introduces a new client-side caching mechanism using IndexedDB, managed by the `idb` library, to store map data.

1.  **`apps/web/app/[locale]/map/usePharmacyCache.ts` (New File):**
    *   This file defines the core logic for interacting with IndexedDB.
    *   We define `DB_NAME` as `"sahidawa-map-cache"` and `STORE` as `"pharmacy-results"` for our IndexedDB instance.
    *   A `TTL_MS` constant is set to `24 * 60 * 60 * 1000` (24 hours) to manage cache freshness.
    *   The `CacheEntry` interface specifies the structure of cached data: `pharmacies`, `ashaWorkers`, and a `timestamp`.
    *   The `getDB()` asynchronous function initializes and opens the IndexedDB database. It includes an `upgrade` callback to create the `pharmacy-results` object store if it doesn't already exist.
    *   `buildCacheKey(lat: number, lng: number)`: This function generates a string key for caching by rounding the latitude and longitude to two decimal places. This provides approximately 1km precision, effectively grouping nearby locations to optimize cache hits and storage.
    *   `saveToCache(key: string, pharmacies: Pharmacy[], ashaWorkers: AshaWorker[])`: This async function stores the provided pharmacy and ASHA worker data, along with the current timestamp, into the IndexedDB store using the generated `key`. It includes a `try-catch` block to gracefully handle potential IndexedDB errors with a `console.warn`.
    *   `loadFromCache(key: string)`: This async function retrieves a `CacheEntry` from IndexedDB using the given `key`. It checks if the entry exists and, critically, if its `timestamp` is within the `TTL_MS`. If the entry is not found or is stale, it returns `null`. Error handling is also included.

2.  **`apps/web/app/[locale]/map/page.tsx`:**
    *   We import the `WifiOff` icon from `lucide-react` for the offline banner.
    *   The new `usePharmacyCache.ts` functions (`buildCacheKey`, `saveToCache`, `loadFromCache`) are imported.
    *   The existing `useOfflineStatus` hook is utilized to determine the user's network state, and a new `isShowingCached` state variable is introduced to manage the display of cached data indicators.
    *   **Initial Data Fetch (`useEffect` for `fetchPharmaciesAndAshaWorkers`):**
        *   **On Success:** After successfully fetching live pharmacy and ASHA worker data, `saveToCache` is called with the `buildCacheKey` for the current map center and the fetched data. `setIsShowingCached(false)` is set to ensure the UI reflects live data.
        *   **On Error (Offline Fallback):** If the initial fetch fails (e.g., due to network issues), the `catch` block attempts to `loadFromCache` using the same `buildCacheKey`. If cached data is found and is not stale, the component's state (`pharmacies`, `ashaWorkers`, `pharmacyCount`) is updated with the cached data, and `setIsShowingCached(true)` is set.
    *   **Map Bounds Change (`handleMapBoundsChange`):**
        *   Similar logic is applied when the map bounds change. On a successful fetch for new bounds, data is `saveToCache`.
        *   On failure, `loadFromCache` is attempted for the new center coordinates.
    *   **Offline Status Effect:** A `useEffect` hook monitors `isOffline` and `isShowingCached`. If the system comes back online (`!isOffline`) while showing cached data (`isShowingCached`), `setIsShowingCached(false)` is triggered to clear the cached data indicators.
    *   **UI Integration:**
        *   A new conditional `div` element is rendered at the top of the map when `isShowingCached` is `true`. This displays an amber banner with the `WifiOff` icon and the message: "You are offline. Showing previously saved pharmacies near you."
        *   The existing error banner (`locationError || fetchError`) is now conditionally rendered only when `!isShowingCached`, preventing it from conflicting with the offline cache banner.
        *   A small "• Cached" text is appended to the map header's status line when `isShowingCached` is `true`, providing an additional visual cue.
        *   The `PageHeader` component now explicitly sets `showThemeToggle={false}`.

3.  **`package-lock.json`:**
    *   This file was updated to reflect the addition of the `idb` library as a dependency, along with any transitive dependency resolutions.

## Technical Decisions

1.  **IndexedDB for Caching:** We chose IndexedDB over `localStorage` or `sessionStorage` because it is designed for storing larger amounts of structured data, which is suitable for our pharmacy and ASHA worker datasets. It also offers better performance for complex queries and is asynchronous, preventing UI blocking.
2.  **`idb` Library:** The `idb` library was selected as a lightweight, promise-based wrapper around the native IndexedDB API. This significantly simplifies IndexedDB interactions, making the code cleaner and easier to maintain compared to using the raw API directly.
3.  **24-Hour TTL:** A 24-hour Time-To-Live (TTL) for cached data was chosen as a pragmatic balance. It ensures that users have access to reasonably fresh data for a full day while offline, without risking the display of excessively outdated information that could be misleading.
4.  **Rounded Lat/Lng Cache Keys:** Rounding latitude and longitude to two decimal places for cache keys (approximately 1km precision) is a deliberate choice. This strategy optimizes cache hit rates by allowing slight map movements to still retrieve relevant cached data, reducing the number of unique cache entries and improving performance without sacrificing too much geographical accuracy for the purpose of caching.
5.  **Offline-First Fallback:** The implementation prioritizes live network data. Only when a network request fails or the `useOfflineStatus` hook indicates an offline state do we attempt to load from the cache. This ensures users always get the most up-to-date information when available.
6.  **Reusing `useOfflineStatus`:** By integrating with the existing `useOfflineStatus` hook, we maintain a single source of truth for network connectivity detection across the application, promoting consistency and reducing code duplication.
7.  **Clear UI Feedback:** Providing explicit visual cues (amber banner, `WifiOff` icon, "• Cached" text) is crucial for user experience. It clearly communicates to the user why certain data is being displayed and its source, managing expectations and building trust.

## How To Re-Implement (Contributor Reference)

To re-implement this offline caching feature for a map component:

1.  **Add `idb` Dependency:** First, add the `idb` library to your project's `package.json` dependencies and install it.
    ```bash
    npm install idb
    # or yarn add idb
    ```
2.  **Create a Cache Service File:**
    *   Create a new TypeScript file, e.g., `useMapDataCache.ts`.
    *   Define constants for your IndexedDB database name, object store name, and a suitable TTL (e.g., 24 hours).
    *   Implement an `openDB` wrapper function to initialize IndexedDB, ensuring your object store is created during the `upgrade` event.
    *   Create a `buildCacheKey(lat: number, lng: number)` function that rounds coordinates to a desired precision (e.g., `toFixed(2)`) to generate a unique, location-based key.
    *   Implement `saveToCache(key: string, data: any, timestamp: number)`: This function should store your data object (e.g., `pharmacies`, `ashaWorkers`) along with `Date.now()` as a timestamp into the IndexedDB store. Include `try-catch` for robust error handling.
    *   Implement `loadFromCache(key: string)`: This function should retrieve data by `key`, check if it exists, and verify its freshness against the TTL. Return the data if valid, otherwise `null`. Again, include `try-catch`.
3.  **Integrate into Your Map Page Component:**
    *   Import your cache service functions and your application's `useOfflineStatus` hook (or implement a basic one using `navigator.onLine` and `online`/`offline` events).
    *   Introduce a state variable, such as `isShowingCached`, initialized to `false`.
    *   **Modify Data Fetching Logic:**
        *   Wrap your primary data fetching function (e.g., `fetchPharmaciesAndAshaWorkers`) in a `try-catch` block.
        *   **Inside `try` (on successful fetch):**
            *   Call `saveToCache` with the current map center's `buildCacheKey` and the newly fetched data.
            *   Set `isShowingCached(false)`.
        *   **Inside `catch` (on fetch error/offline):**
            *   Call `loadFromCache` with the current map center's `buildCacheKey`.
            *   If `loadFromCache` returns data, update your component's state with this cached data and set `isShowingCached(true)`.
    *   **Handle Online/Offline Transitions:** Add a `useEffect` hook that depends on your `isOffline` status and `isShowingCached`. If `isOffline` becomes `false` while `isShowingCached` is `true`, reset `isShowingCached` to `false` to clear the cached data indicators.
    *   **Update UI for Cached State:**
        *   Conditionally render a banner or message (e.g., an amber `div` with a `WifiOff` icon) when `isShowingCached` is `true`, informing the user they are viewing cached data.
        *   Ensure that any error messages related to network failures are suppressed or replaced by the cached data message when `isShowingCached` is `true`.
        *   Optionally, add a subtle indicator (e.g., "• Cached") near the map's status display.

## Impact on System Architecture

This change significantly enhances the robustness and user experience of the SahiDawa platform, particularly for the Map page.

*   **Offline-First Capabilities:** This PR marks our first significant step towards an "offline-first" approach for critical data, enabling users to access essential information even without an active internet connection. This is vital for our mission in rural health.
*   **Improved UX in Low-Connectivity Areas:** By providing cached data, we prevent frustrating blank screens or error messages, ensuring continuous access to pharmacy and ASHA worker locations, which directly impacts the platform's utility and user satisfaction.
*   **Client-Side Data Persistence Layer:** We've introduced IndexedDB as a new client-side data persistence layer for feature-specific data. This pattern can be extended to other parts of the application where offline access or improved performance through local caching is beneficial.
*   **Reduced Server Load (Minor):** While not the primary goal, serving cached data reduces the frequency of API calls for repeat visits to the same geographical areas, potentially leading to a minor reduction in server load.
*   **New Frontend Dependency:** The `idb` library is now a core frontend dependency, adding to our client-side technology stack.

## Testing & Verification

Verification of this feature involved several scenarios to ensure correct behavior under varying network conditions:

*   **Online Data Fetch:** Verified that when online, the map correctly fetches and displays live pharmacy and ASHA worker data.
*   **Offline Fallback (Cached Data Available):**
    1.  Navigated to the Map page while online, allowing data to be cached.
    2.  Disconnected from the internet (using browser developer tools to simulate offline mode).
    3.  Refreshed the Map page or navigated back to it.
    4.  Verified that the previously viewed pharmacy and ASHA worker data was displayed.
    5.  Confirmed the presence of the amber banner: "You are offline. Showing previously saved pharmacies near you." with the `WifiOff` icon.
    6.  Confirmed the "• Cached" text appeared in the map header.
*   **Offline Fallback (No Cached Data):**
    1.  Cleared browser cache/IndexedDB.
    2.  Disconnected from the internet.
    3.  Navigated to the Map page.
    4.  Verified that no data was displayed and an appropriate error message (e.g., "Could not load pharmacies. Try again.") was shown, as no cached data was available.
*   **Reconnecting Online:**
    1.  While viewing cached data offline, reconnected to the internet.
    2.  Verified that the offline banner and "• Cached" indicator disappeared.
    3.  Confirmed that the map attempted to fetch live data again.
*   **Cache TTL Expiration:** Tested that data older than 24 hours was correctly considered stale and not loaded from the cache, forcing a network request when online or an "no data" state when offline.
*   **Data Overwriting:** Verified that a successful online fetch for a given location correctly overwrites any existing cached data for that location, ensuring freshness.

Automated testing for this specific caching logic was not documented in this PR.