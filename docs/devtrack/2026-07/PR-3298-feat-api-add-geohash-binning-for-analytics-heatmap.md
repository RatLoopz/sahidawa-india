# PR #3298 — feat(api): add geohash binning for analytics heatmap

> **Merged:** 2026-07-07 | **Author:** @Avinash-sdbegin | **Area:** Backend | **Impact Score:** 9 | **Closes:** #3132

## What Changed

We replaced our naive coordinate-rounding aggregation with a robust, geohash-based binning algorithm in the `/api/analytics/heatmap` endpoint. The API now accepts an optional `precision` query parameter (ranging from 1 to 12, defaulting to 6) to control the clustering resolution. Instead of snapping coordinates to an arbitrary grid, our system aggregates nearby scans into geohash buckets, calculates the exact centroid (average coordinate) for each bucket, and returns the geohash string alongside the aggregated intensity in the GeoJSON properties.

## The Problem Being Solved

Previously, our heatmap endpoint grouped coordinates by rounding latitude and longitude to two decimal places. This approach had several critical flaws:
1. **Grid Artifacts:** It created artificial, blocky grid patterns on the map that did not represent real-world spatial distributions.
2. **Fixed Resolution:** The clustering resolution was hardcoded, meaning the heatmap could not adapt when a user zoomed in or out on the frontend.
3. **Inaccurate Centroids:** Snapping points to a rounded coordinate grid shifted the visual representation away from the actual center of mass of the scan events.
4. **Lack of Spatial Indexing:** The frontend had no standardized spatial keys (like geohashes) to perform client-side caching, filtering, or nested rendering.

## Files Modified

- `apps/api/src/routes/analytics.ts`: Added the `encodeGeohash` helper, updated the Zod query validation schema, refactored the `/heatmap` route handler to aggregate coordinates using geohashes, and calculated centroid coordinates for the GeoJSON output.
- `apps/api/tests/analytics.test.ts`: Updated the test suite to validate geohash-based grouping, centroid calculation accuracy, and response payload structures.

## Implementation Details

### 1. Geohash Encoding Algorithm
We implemented a standard Base32 geohash encoder directly inside `apps/api/src/routes/analytics.ts`:
```typescript
function encodeGeohash(latitude: number, longitude: number, precision: number = 6): string {
    const BASE32_CHARS = "0123456789bcdefghjkmnpqrstuvwxyz";
    let isEven = true;
    let latMin = -90.0, latMax = 90.0;
    let lngMin = -180.0, lngMax = 180.0;
    let geohash = "";
    let bit = 0;
    let ch = 0;

    while (geohash.length < precision) {
        if (isEven) {
            const mid = (lngMin + lngMax) / 2;
            if (longitude > mid) {
                ch |= 1 << (4 - bit);
                lngMin = mid;
            } else {
                lngMax = mid;
            }
        } else {
            const mid = (latMin + latMax) / 2;
            if (latitude > mid) {
                ch |= 1 << (4 - bit);
                latMin = mid;
            } else {
                latMax = mid;
            }
        }

        isEven = !isEven;
        if (bit < 4) {
            bit++;
        } else {
            geohash += BASE32_CHARS[ch];
            bit = 0;
            ch = 0;
        }
    }
    return geohash;
}
```
This function bisects the latitude and longitude ranges repeatedly, building up a 5-bit binary representation for each character in the geohash string.

### 2. Query Schema Validation
We updated the Zod `QuerySchema` to parse and validate the `precision` parameter:
```typescript
const QuerySchema = z.object({
    days: z.coerce.number().int().min(1).max(365).default(30),
    precision: z.coerce.number().int().min(1).max(12).default(6),
});
```

### 3. Centroid Aggregation Logic
Instead of grouping by a stringified rounded coordinate, we group scans using the computed geohash. We track the running sum of latitudes and longitudes to compute the mathematical centroid of the cluster:
```typescript
const geohashGroups = new Map<
    string,
    { totalLat: number; totalLng: number; count: number }
>();

for (const scan of scans || []) {
    const rawLat = parseFloat(scan.latitude as string);
    const rawLng = parseFloat(scan.longitude as string);

    if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng)) continue;
    if (rawLat < -90 || rawLat > 90 || rawLng < -180 || rawLng > 180) continue;

    const hash = encodeGeohash(rawLat, rawLng, precision);
    const group = geohashGroups.get(hash) || { totalLat: 0, totalLng: 0, count: 0 };

    group.totalLat += rawLat;
    group.totalLng += rawLng;
    group.count += 1;
    geohashGroups.set(hash, group);
}
```

### 4. GeoJSON Feature Mapping
We map the aggregated groups back to a GeoJSON `FeatureCollection`. The coordinates are calculated as the average of all points in that geohash bucket, rounded to 5 decimal places (approximately 1.1 meters of precision):
```typescript
const features = Array.from(geohashGroups.entries()).map(([hash, data]) => {
    const centroidLat = data.totalLat / data.count;
    const centroidLng = data.totalLng / data.count;

    return {
        type: "Feature" as const,
        geometry: {
            type: "Point" as const,
            coordinates: [
                Math.round(centroidLng * 100000) / 100000,
                Math.round(centroidLat * 100000) / 100000,
            ],
        },
        properties: {
            intensity: data.count,
            geohash: hash,
        },
    };
});
```

## Technical Decisions

- **In-Memory Custom Geohash Encoder:** We chose to write a lightweight, vanilla TypeScript geohash encoder rather than importing an external library like `ngeohash` or `latlon-geohash`. This keeps our dependency tree clean, reduces cold-start times for our API, and ensures compatibility across serverless environments.
- **Centroid vs. Geohash Bounds Center:** We decided to calculate the mathematical centroid of the actual points falling within a geohash bucket rather than returning the center point of the geohash bounding box. This preserves the true spatial distribution of our medicine scans, preventing visual drift on the heatmap.
- **5-Decimal Coordinate Rounding:** We round the final centroid coordinates to 5 decimal places (`Math.round(val * 100000) / 100000`). This eliminates floating-point precision noise (e.g., `77.20900000000001`) in the JSON payload while maintaining sub-meter accuracy.

## How To Re-Implement (Contributor Reference)

If you need to re-implement or modify this spatial aggregation logic, follow these steps:

1. **Define the Geohash Utility:** Implement a bisection-based geohash encoder. Ensure that even bits correspond to longitude and odd bits correspond to latitude. Use the standard Base32 alphabet (`0123456789bcdefghjkmnpqrstuvwxyz`).
2. **Validate Input Parameters:** Use Zod to coerce and validate the `precision` query parameter. Restrict it to a safe range (e.g., 1 to 12) to prevent denial-of-service attacks via extremely high-precision geohash calculations.
3. **Filter and Clean Coordinates:** Always validate that incoming coordinates are finite numbers and fall within valid geographic boundaries (Latitude: `[-90, 90]`, Longitude: `[-180, 180]`).
4. **Aggregate with a Map:** Loop through your coordinate dataset. Generate the geohash key for each point, and accumulate both the count and the sum of the coordinates in a Map.
5. **Calculate Centroids:** Divide the accumulated coordinate sums by the count to find the centroid. Round the resulting coordinates to 5 decimal places before constructing the GeoJSON `Point` geometry.
6. **Expose the Geohash:** Always include the geohash string in the GeoJSON `properties` object so that client-side applications can leverage it for nested rendering or spatial indexing.

## Impact on System Architecture

- **Dynamic Resolution Heatmaps:** The frontend can now dynamically adjust the `precision` parameter based on the map's current zoom level. For example, it can request `precision=3` (regional) when zoomed out, and `precision=8` (street-level) when zoomed in.
- **Payload Optimization:** By binning coordinates on the backend, we significantly reduce the size of the GeoJSON payload sent to the client in high-density areas, preventing browser lag during rendering.
- **Future Spatial Caching:** Returning the geohash in the properties allows us to implement efficient edge-caching strategies where heatmap tiles can be cached by their geohash prefixes.

## Testing & Verification

We updated our test suite in `apps/api/tests/analytics.test.ts` to verify the new geohash binning behavior:
- **Centroid Verification:** We verified that multiple coordinates falling within the same geohash bucket are collapsed into a single feature, and that the returned coordinates match the mathematical average of the inputs using Jest's `toBeCloseTo` matcher.
- **Precision Validation:** We verified that the returned geohash strings match the requested precision length.
- **Boundary and Null Handling:** We ensured that scans with null, out-of-bounds, or malformed coordinates are safely ignored and do not crash the aggregation pipeline.