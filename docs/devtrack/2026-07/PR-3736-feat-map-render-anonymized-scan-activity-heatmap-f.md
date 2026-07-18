# PR #3736 — feat(map): render anonymized scan-activity heatmap from /analytics/heatmap

> **Merged:** 2026-07-18 | **Author:** @skypank-coder | **Area:** Frontend | **Impact Score:** 10 | **Closes:** #3688

## What Changed

We integrated our frontend map with the privacy-safe `/api/analytics/heatmap` endpoint to render anonymized scan-activity heatmaps. This PR updates the map page to fetch server-binned geohash centroids, normalize their aggregated scan counts, and render them as a distinct "Scan Activity" layer using Leaflet. The UI dynamically adapts to the user's authorization level, only displaying the scan activity toggle if the authenticated user has permission to view the data.

## The Problem Being Solved

Previously, our system lacked a way to visualize medicine scan activity on the client-side map without compromising user privacy. Exposing raw, high-precision GPS coordinates of individual scans poses severe security and privacy risks for patients in rural areas. 

While the backend was updated in issue #3688 to bin coordinates into geohash centroids with aggregated intensity counts, the frontend map was not consuming this endpoint. Instead, it relied on a separate `riskHotspots` source that only covered density and counterfeit reports. We needed a secure, performant way to fetch, normalize, and render these anonymized scan clusters while ensuring unauthorized users (non-admins/non-moderators) do not experience broken UI elements or empty map states.

## Files Modified

- `apps/web/app/[locale]/map/PharmacyMap.tsx`
- `apps/web/app/[locale]/map/page.tsx`

## Implementation Details

### 1. Data Fetching & Normalization (`apps/web/app/[locale]/map/page.tsx`)
We introduced a dedicated fetch function, `fetchScanActivityHotspots`, which queries the `/api/analytics/heatmap` endpoint. 

*   **Query Parameters:** We set `SCAN_HEATMAP_PRECISION = 6` (which corresponds to geohash cells of approximately 1 km x 1 km) and `SCAN_HEATMAP_DAYS = 90` (a 90-day lookback window).
*   **Graceful Degradation:** Because this endpoint is restricted to administrators and moderators, any unauthorized response (e.g., `401 Unauthorized` or `403 Forbidden`) or network failure is caught and silently handled, returning an empty array `[]`.
*   **Intensity Normalization:** The map's rendering layer expects an intensity value between `0` and `1`. We calculate the maximum intensity across all returned features using `Math.max(1, ...features.map(...))` and normalize each centroid's intensity:
    $$\text{intensity} = \frac{\text{count}}{\text{maxIntensity}}$$
*   **Data Adaptation:** The GeoJSON `FeatureCollection` is mapped to our internal `RiskHotspot` interface:
    ```typescript
    return {
        id: `scan-${f.properties?.geohash ?? `${lat}:${lng}`}`,
        label: `${count} anonymized scan${count === 1 ? "" : "s"} in this area`,
        coordinates: { lat, lng },
        intensity: count / maxIntensity,
        category: "scans" as const,
        details: "Location-binned scan activity — exact coordinates are not exposed.",
    };
    ```

### 2. State Management & Lifecycle
*   We added a `scanHotspots` state array to `PharmacyMapPage`.
*   A `useEffect` hook triggers the fetch once on mount. It utilizes an `AbortController` to cancel the in-flight HTTP request if the component unmounts before the response resolves, preventing memory leaks and state updates on unmounted components.
*   The `riskHotspots` array is memoized using `useMemo`, combining `densityHotspots`, `COUNTERFEIT_REPORT_HOTSPOTS`, and the newly fetched `scanHotspots`.
*   The `"scans"` option is conditionally appended to the `HEATMAP_OPTIONS` array *only* if `scanHotspots.length > 0`. This ensures that regular users who are unauthorized to view scan data never see an empty or non-functional "Scan Activity" toggle.

### 3. Leaflet Layer Rendering (`apps/web/app/[locale]/map/PharmacyMap.tsx`)
We extended the map's rendering engine to support the `"scans"` category:
*   **Type Definitions:** Extended `HeatmapMode` and `RiskHotspot["category"]` to accept the `"scans"` literal.
*   **Styling Engine:** Added a dedicated style configuration for the `"scans"` category inside the Leaflet circle-drawing loop:
    *   **Color Palette:** Uses our brand secondary CSS variables: `var(--color-brand-secondary)` for the border and `var(--color-brand-secondary-bright)` for the fill.
    *   **Opacity:** Set to `0.16` fill opacity and `0.42` stroke opacity to match our design system's density layer styling.
    *   **Radius Scaling:** Calculated dynamically as `900 + normalizedIntensity * 2600` meters, ensuring higher-density scan areas are visually prominent.

## Technical Decisions

### Client-Side Relative Normalization
Instead of hardcoding static thresholds for scan counts, we dynamically normalize intensities relative to the maximum count in the current dataset (`maxIntensity`). This ensures that the heatmap remains visually informative and scales correctly regardless of whether the highest-density area has 10 scans or 10,000 scans.

### Geohash Precision Level 6
We chose a geohash precision of `6` (~1 km boundaries). This provides a high enough resolution for regional healthcare planning and supply-chain monitoring while mathematically guaranteeing that individual patient home coordinates cannot be reverse-engineered from the map.

### Feature-Flagging via API Capability
Rather than checking user roles on the client side (which can be bypassed or become out of sync with backend permissions), we let the API response drive the UI. If the API returns data, the "Scan Activity" option is displayed. If it returns a `403` or fails, the option is omitted. This keeps our frontend decoupled from role-to-permission mapping logic.

## How To Re-Implement (Contributor Reference)

If you need to re-implement or extend this heatmap layer pattern, follow these steps:

1.  **Define the Category and Types:**
    In `apps/web/app/[locale]/map/PharmacyMap.tsx`, add your new category literal to the `HeatmapMode` and `RiskHotspot` types:
    ```typescript
    export type HeatmapMode = "none" | "density" | "counterfeit" | "combined" | "your_new_category";
    ```

2.  **Add Leaflet Styles:**
    In the `PharmacyMap` component, locate the `.forEach((hotspot) => { ... })` loop over the active layer group. Add a style mapping for your category:
    ```typescript
    const style = hotspot.category === "your_new_category" 
        ? {
              color: "var(--your-stroke-color)",
              fillColor: "var(--your-fill-color)",
              fillOpacity: 0.16,
              radius: 900 + normalizedIntensity * 2600,
          }
        : // ... existing styles
    ```

3.  **Implement the Fetch Function:**
    In `apps/web/app/[locale]/map/page.tsx`, write an asynchronous fetch function that calls your endpoint. Ensure you wrap the fetch in a `try/catch` block and return an empty array on failure to maintain graceful degradation:
    ```typescript
    async function fetchYourNewHotspots(signal?: AbortSignal): Promise<RiskHotspot[]> {
        try {
            const res = await fetch(`${API_BASE}/api/your-endpoint`, { credentials: "include", signal });
            if (!res.ok) return [];
            const data = await res.json();
            // Map data to RiskHotspot shape and normalize intensity to [0, 1]
        } catch {
            return [];
        }
    }
    ```

4.  **Wire Up State and Effects:**
    Initialize state in `PharmacyMapPage` and fetch the data on mount using an `AbortController`:
    ```typescript
    const [newHotspots, setNewHotspots] = useState<RiskHotspot[]>([]);
    useEffect(() => {
        const controller = new AbortController();
        fetchYourNewHotspots(controller.signal).then((data) => {
            if (!controller.signal.aborted) setNewHotspots(data);
        });
        return () => controller.abort();
    }, []);
    ```

5.  **Merge and Expose UI Controls:**
    Combine your new state array into the memoized `riskHotspots` array and conditionally append your control option to `HEATMAP_OPTIONS` based on whether data was successfully returned.

## Impact on System Architecture

*   **Security & Privacy:** Establishes a strict boundary where raw scan coordinates are never transmitted to or processed by the client application.
*   **UI Resilience:** The application remains fully functional for unauthorized or offline users, as the map gracefully hides administrative layers without throwing runtime exceptions.
*   **Performance:** By offloading the heavy spatial binning and geohashing operations to the database/backend, the client only has to render a pre-aggregated, lightweight GeoJSON payload, keeping map interactions smooth even on low-end mobile devices in rural areas.

## Testing & Verification

*   **Role-Based Access Control (RBAC):** Verified that logging in as a regular user hides the "Scan Activity" option and prevents any unauthorized console errors. Verified that logging in as an administrator or moderator successfully fetches the data and displays the toggle.
*   **Network Resilience:** Simulated offline mode and slow network connections. The map loads successfully using cached pharmacy data, and the scan activity layer fails silently without blocking the primary map render.
*   **Component Unmounting:** Verified that navigating away from the map page while the `/api/analytics/heatmap` request is pending correctly aborts the fetch request, preventing state updates on unmounted components.