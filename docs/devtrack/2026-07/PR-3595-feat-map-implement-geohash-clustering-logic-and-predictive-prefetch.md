# PR #3595 — feat(map): implement geohash clustering logic and predictive prefetch…

> **Merged:** 2026-07-14 | **Author:** @Avinash-sdbegin | **Area:** Frontend | **Impact Score:** 5 | **Closes:** #3305

## What Changed

We refactored our primary map component (`MapView.tsx`) to render backend-precomputed geohash clusters instead of raw, individual pharmacy and ASHA worker records. We removed client-side HTML entity decoding and individual marker rendering, replacing them with a single, unified rendering loop that maps over aggregated geohash centroids. We also updated the map UI to display cluster-level metadata, including geohash identifiers and aggregated intensity weights inside the Leaflet popups.

## The Problem Being Solved

Previously, our frontend fetched raw arrays of individual pharmacies and ASHA workers (`data.pharmacies` and `data.asha_workers`). The client had to normalize these datasets, decode HTML entities on the fly using a hidden DOM `textarea` element (which is slow and causes layout thrashing), and render hundreds of individual Leaflet `Marker` instances. 

In rural regions with high densities of healthcare facilities or ASHA workers, rendering individual markers severely degraded map responsiveness, caused UI lag during panning/zooming, and increased memory consumption on low-end mobile devices common in rural India. Furthermore, the client-side HTML entity decoding logic (`decodeHtmlEntities`) introduced unnecessary complexity and potential XSS vectors if not handled carefully, despite using `textContent`.

## Files Modified

- `apps/web/components/map/MapView.tsx`

## Implementation Details

### 1. Data Structure Refactoring
We introduced the `GeohashCluster` interface to represent aggregated spatial buckets:
```typescript
interface GeohashCluster {
    geohash: string;
    lat: number;
    lng: number;
    intensity: number; // Cluster aggregation weight
    type: "Jan Aushadhi" | "private" | "asha";
}
```
This replaces the legacy `Pharmacy` and `AshaWorker` interfaces within the map rendering pipeline.

### 2. State and Fetching Logic
We replaced the individual state hooks for `pharmacies` and `ashaWorkers` with a single `clusters` state array:
```typescript
const [clusters, setClusters] = useState<GeohashCluster[]>([]);
```
Inside the fetch effect, we extract `data.geohash_clusters` instead of raw arrays. If the fetch is successful and not aborted, we update the state via `setClusters(fetchedClusters)`.

### 3. Optimized Rendering Loop
We replaced the separate mapping loops for pharmacies and ASHA workers with a single, highly optimized loop over the `clusters` array:
* **Filtering**: We filter the array based on the active UI toggles (`showAsha` and `showPharmacies`).
* **Dynamic Icon Assignment**: We assign Leaflet icons dynamically: `blueIcon` for ASHA worker clusters, `greenIcon` for Jan Aushadhi clusters, and `orangeIcon` for private pharmacies.
* **Reconciliation**: We use the unique `cluster.geohash` as the React `key` to ensure efficient DOM reconciliation during map updates.
* **Popup Rendering**: The popup renders the cluster type, the geohash identifier, and the total intensity (e.g., `Total Intensity: {cluster.intensity} units`).

### 4. Removal of Legacy Helpers
We completely eliminated the `decodeHtmlEntities` helper function and its associated `decodeTextareaRef` ref, as the backend now provides pre-sanitized, aggregated cluster data.

## Technical Decisions

- **Backend-Driven Clustering over Client-Side (Supercluster)**: We chose to offload spatial clustering to the backend using geohashes rather than running client-side clustering algorithms like Supercluster. This drastically reduces the CPU and memory footprint on the client, which is critical for our target demographic in rural India who often use budget smartphones with limited processing power.
- **Geohash Centroids**: Using precomputed geohash centroids allows us to represent high-density areas with a single marker while preserving spatial accuracy at the current zoom level.
- **Removal of DOM-based Decoding**: By shifting to pre-sanitized, aggregated backend data, we completely eliminated the `decodeHtmlEntities` helper function. This removed the need to dynamically instantiate a `textarea` element, preventing layout thrashing and reducing the frontend's vulnerability surface.
- **Predictive Prefetching Integration**: The exact predictive prefetch implementation details outside of `MapView.tsx` are not documented in this PR, but the refactor ensures that prefetching hooks (`usePredictivePrefetch`) can fetch lightweight geohash tiles ahead of user panning, minimizing network payload sizes.

## How To Re-Implement (Contributor Reference)

If you need to re-implement or extend this clustering logic, follow these steps:

1. **Define the Cluster Interface**: Ensure your data structure matches the `GeohashCluster` interface, containing `geohash`, `lat`, `lng`, `intensity`, and `type`.
2. **Update State and Fetching**: Replace any raw entity states with a unified `clusters` state. Update the API response parser to extract `geohash_clusters`. Ensure abort controller checks are maintained to prevent race conditions.
3. **Clean up Legacy Helpers**: Remove client-side normalization and DOM-based HTML decoding functions.
4. **Implement the Filtered Render Loop**:
   * Filter the `clusters` array: 
     ```typescript
     clusters.filter((c) => {
         if (c.type === "asha") return showAsha;
         return showPharmacies;
     })
     ```
   * Map each cluster to a Leaflet `<Marker>` component.
   * Assign the `key` prop to `cluster.geohash`.
   * Determine the icon dynamically based on `cluster.type`.
5. **Update Popups**: Render a clean, semantic popup displaying the cluster type, geohash string, and aggregated intensity.

> ⚠️ **Gotcha**: Ensure that the backend returns unique geohashes per cluster type to avoid duplicate React keys when rendering mixed clusters in the same spatial bucket.

## Impact on System Architecture

- **Frontend Offloading**: Shifts SahiDawa's map architecture from a heavy data-processing client to a lightweight, presentation-focused layer.
- **Scalability**: Prepares the platform to scale to millions of verified pharmacies and ASHA workers across India without degrading frontend performance.
- **Network Efficiency**: Reduces payload sizes significantly by sending aggregated cluster centroids instead of thousands of individual records with redundant metadata.

## Testing & Verification

- **Visual Verification**: Verified that cluster markers render at their correct centroid coordinates with appropriate color-coded icons (green, orange, blue).
- **Toggle Functionality**: Confirmed that toggling "ASHA Worker Cluster" and "Pharmacies" correctly filters the rendered geohash markers.
- **Popup Validation**: Verified that clicking a marker displays the correct aggregated intensity and geohash string.
- **Performance Profiling**: Observed a significant reduction in scripting time and layout recalculations during map pan/zoom operations due to the removal of individual marker rendering and DOM-based decoding.