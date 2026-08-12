/**
 * Overpass API utility for fetching real pharmacy data from OpenStreetMap
 * Free, no API key required — aligns with SahiDawa's open-source philosophy
 * Uses multiple mirrors for reliability
 */

const OVERPASS_MIRRORS = [
    "https://overpass.osm.ch/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
];

interface OverpassResponse {
    version?: number;
    generator?: string;
    osm3s?: {
        timestamp_osm_base: string;
        copyright: string;
    };
    elements: Array<OverpassElement & { center?: { lat: number; lon: number } }>;
}

async function queryOverpass(query: string): Promise<OverpassResponse> {
    // 1. Primary Path: Parallel client-side GET requests (races the first 2 mirrors for maximum speed)
    const clientMirrors = OVERPASS_MIRRORS.slice(0, 2);
    const requests = clientMirrors.map((mirror) => {
        const controller = new AbortController();
        const promise = (async () => {
            const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout per mirror client-side

            try {
                const url = `${mirror}?data=${encodeURIComponent(query)}`;
                const response = await fetch(url, {
                    method: "GET",
                    headers: {
                        Accept: "application/json",
                    },
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(`Mirror ${mirror} returned status ${response.status}`);
                }

                const data = await response.json();
                if (!data || !Array.isArray(data.elements)) {
                    throw new Error(`Mirror ${mirror} returned invalid data structure`);
                }

                if (data.elements.length === 0) {
                    throw new Error(
                        `Mirror ${mirror} returned 0 elements, rejecting to wait for global mirrors`
                    );
                }

                return { controller, data };
            } finally {
                clearTimeout(timeoutId);
            }
        })();

        return { controller, promise };
    });

    try {
        const winner = await Promise.any(requests.map((request) => request.promise));
        requests.forEach((request) => {
            if (request.controller !== winner.controller && !request.controller.signal.aborted) {
                request.controller.abort();
            }
        });
        return winner.data;
    } catch {
        // Silent fallback — direct browser calls failed (e.g., CORS or adblocker). Proceeding to proxy.
    }

    // 2. Fallback Path: Server-side Vercel Proxy
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout for proxy fallback

    try {
        const response = await fetch("/api/overpass", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            if (data && data.elements) {
                return data;
            }
        }
    } catch (err) {
        clearTimeout(timeoutId);
        console.error("Fallback proxy failed:", err);
    }

    throw new Error("All Overpass mirrors and proxy failed to respond");
}

export interface OverpassPharmacy {
    id: number;
    name: string;
    lat: number;
    lng: number;
    type: "govt" | "private";
    address?: string;
    phone?: string;
    openingHours?: string;
    website?: string;
    operator?: string;
    brand?: string;
}

interface OverpassElement {
    type: string;
    id: number;
    lat: number;
    lon: number;
    tags?: {
        name?: string;
        "name:en"?: string;
        "name:hi"?: string;
        amenity?: string;
        phone?: string;
        "contact:phone"?: string;
        opening_hours?: string;
        operator?: string;
        brand?: string;
        "addr:street"?: string;
        "addr:city"?: string;
        "addr:district"?: string;
        "addr:state"?: string;
        "addr:full"?: string;
        healthcare?: string;
        description?: string;
        [key: string]: string | undefined;
    };
}

// Keywords that indicate a government / Jan Aushadhi pharmacy
const GOVT_KEYWORDS = [
    "jan aushadhi",
    "janaushadhi",
    "pmbjp",
    "pradhan mantri",
    "government",
    "govt",
    "sarkari",
    "civil hospital",
    "district hospital",
    "phc",
    "chc",
    "primary health",
    "community health",
];

function isGovernmentPharmacy(element: OverpassElement): boolean {
    const tags = element.tags || {};
    const searchText = [
        tags.name,
        tags["name:en"],
        tags["name:hi"],
        tags.operator,
        tags.brand,
        tags.description,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    return GOVT_KEYWORDS.some((keyword) => searchText.includes(keyword));
}

function buildAddress(tags: OverpassElement["tags"]): string | undefined {
    if (!tags) return undefined;

    if (tags["addr:full"]) return tags["addr:full"];

    const parts = [
        tags["addr:street"],
        tags["addr:city"] || tags["addr:district"],
        tags["addr:state"],
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(", ") : undefined;
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function formatDistance(km: number): string {
    if (km < 1) {
        return `${Math.round(km * 1000)} m`;
    }
    return `${km.toFixed(1)} km`;
}

export async function fetchPharmacies(
    lat: number,
    lng: number,
    radiusMeters: number = 10000
): Promise<OverpassPharmacy[]> {
    // Overpass QL query: find all pharmacy nodes, ways, and relations within radius
    const query = `
    [out:json][timeout:15];
    (
      nwr["amenity"="pharmacy"](around:${radiusMeters},${lat},${lng});
      nwr["healthcare"="pharmacy"](around:${radiusMeters},${lat},${lng});
      nwr["shop"="chemist"](around:${radiusMeters},${lat},${lng});
      nwr["amenity"="hospital"](around:${radiusMeters},${lat},${lng});
      nwr["amenity"="clinic"](around:${radiusMeters},${lat},${lng});
      nwr["healthcare"="clinic"](around:${radiusMeters},${lat},${lng});
      nwr["healthcare"="hospital"](around:${radiusMeters},${lat},${lng});
    );
    out center;
  `;

    const data = await queryOverpass(query);
    const elements: Array<OverpassElement & { center?: { lat: number; lon: number } }> =
        data.elements || [];

    // Transform OSM data into our pharmacy format
    const pharmacies: OverpassPharmacy[] = elements
        .filter((el) => (el.lat && el.lon) || (el.center && el.center.lat && el.center.lon))
        .map((el) => {
            const tags = el.tags || {};
            const elLat = el.lat ?? el.center?.lat ?? 0;
            const elLon = el.lon ?? el.center?.lon ?? 0;
            const distance = calculateDistance(lat, lng, elLat, elLon);

            let defaultName = "Local Pharmacy";
            if (tags.amenity === "hospital" || tags.healthcare === "hospital")
                defaultName = "Local Hospital (Pharmacy)";
            else if (tags.amenity === "clinic" || tags.healthcare === "clinic")
                defaultName = "Local Clinic (Pharmacy)";

            return {
                id: el.id,
                name: tags.name || tags["name:en"] || tags["name:hi"] || tags.brand || defaultName,
                lat: elLat,
                lng: elLon,
                type: isGovernmentPharmacy(el) ? "govt" : "private",
                address: buildAddress(tags),
                phone: tags.phone || tags["contact:phone"],
                openingHours: tags.opening_hours,
                website: tags.website || tags["contact:website"],
                operator: tags.operator,
                brand: tags.brand,
                _distance: distance,
                _distanceFormatted: formatDistance(distance),
            } as OverpassPharmacy & { _distance: number; _distanceFormatted: string };
        })
        // Sort by distance (nearest first)
        .sort(
            (
                a: OverpassPharmacy & { _distance: number },
                b: OverpassPharmacy & { _distance: number }
            ) => a._distance - b._distance
        );

    return pharmacies;
}

export async function fetchPharmaciesInBounds(
    south: number,
    west: number,
    north: number,
    east: number
): Promise<OverpassPharmacy[]> {
    const query = `
    [out:json][timeout:15];
    (
      nwr["amenity"="pharmacy"](${south},${west},${north},${east});
      nwr["healthcare"="pharmacy"](${south},${west},${north},${east});
      nwr["shop"="chemist"](${south},${west},${north},${east});
      nwr["amenity"="hospital"](${south},${west},${north},${east});
      nwr["amenity"="clinic"](${south},${west},${north},${east});
      nwr["healthcare"="clinic"](${south},${west},${north},${east});
      nwr["healthcare"="hospital"](${south},${west},${north},${east});
    );
    out center;
  `;

    const data = await queryOverpass(query);
    const elements: Array<OverpassElement & { center?: { lat: number; lon: number } }> =
        data.elements || [];

    const centerLat = (south + north) / 2;
    const centerLng = (west + east) / 2;

    return elements
        .filter((el) => (el.lat && el.lon) || (el.center && el.center.lat && el.center.lon))
        .map((el) => {
            const tags = el.tags || {};
            const elLat = el.lat ?? el.center?.lat ?? 0;
            const elLon = el.lon ?? el.center?.lon ?? 0;
            const distance = calculateDistance(centerLat, centerLng, elLat, elLon);

            let defaultName = "Local Pharmacy";
            if (tags.amenity === "hospital" || tags.healthcare === "hospital")
                defaultName = "Local Hospital (Pharmacy)";
            else if (tags.amenity === "clinic" || tags.healthcare === "clinic")
                defaultName = "Local Clinic (Pharmacy)";

            return {
                id: el.id,
                name: tags.name || tags["name:en"] || tags["name:hi"] || tags.brand || defaultName,
                lat: elLat,
                lng: elLon,
                type: isGovernmentPharmacy(el) ? "govt" : "private",
                address: buildAddress(tags),
                phone: tags.phone || tags["contact:phone"],
                openingHours: tags.opening_hours,
                website: tags.website || tags["contact:website"],
                operator: tags.operator,
                brand: tags.brand,
                _distance: distance,
                _distanceFormatted: formatDistance(distance),
            } as OverpassPharmacy & { _distance: number; _distanceFormatted: string };
        })
        .sort(
            (
                a: OverpassPharmacy & { _distance: number },
                b: OverpassPharmacy & { _distance: number }
            ) => a._distance - b._distance
        );
}
