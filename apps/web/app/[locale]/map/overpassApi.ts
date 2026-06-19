/**
 * Overpass API utility for fetching real pharmacy data from OpenStreetMap
 * Free, no API key required — aligns with SahiDawa's open-source philosophy
 * Uses multiple mirrors for reliability
 */

const OVERPASS_MIRRORS = [
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
];

async function queryOverpass(query: string): Promise<any> {
    // 1. Primary Path: Parallel client-side GET requests (races the first 2 mirrors for maximum speed)
    const clientMirrors = OVERPASS_MIRRORS.slice(0, 2);
    const fetchPromises = clientMirrors.map(async (mirror) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout per mirror client-side

        try {
            const url = `${mirror}?data=${encodeURIComponent(query)}`;
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    Accept: "*/*",
                },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Mirror ${mirror} returned status ${response.status}`);
            }

            const data = await response.json();
            if (!data || !data.elements) {
                throw new Error(`Mirror ${mirror} returned invalid data structure`);
            }

            return data;
        } catch (err) {
            clearTimeout(timeoutId);
            throw err;
        }
    });

    try {
        return await Promise.any(fetchPromises);
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

/**
 * Fetch pharmacies near a given location using the Overpass API
 * @param lat Center latitude
 * @param lng Center longitude
 * @param radiusMeters Search radius in meters (default 10km)
 */
export async function fetchPharmacies(
    lat: number,
    lng: number,
    radiusMeters: number = 10000
): Promise<OverpassPharmacy[]> {
    // Overpass QL query: find all pharmacy nodes within radius
    const query = `
    [out:json][timeout:15];
    (
      node["amenity"="pharmacy"](around:${radiusMeters},${lat},${lng});
      node["healthcare"="pharmacy"](around:${radiusMeters},${lat},${lng});
      node["shop"="chemist"](around:${radiusMeters},${lat},${lng});
    );
    out body;
  `;

    const data = await queryOverpass(query);
    const elements: OverpassElement[] = data.elements || [];

    // Transform OSM data into our pharmacy format
    const pharmacies: OverpassPharmacy[] = elements
        .filter((el) => el.lat && el.lon)
        .map((el) => {
            const tags = el.tags || {};
            const distance = calculateDistance(lat, lng, el.lat, el.lon);

            return {
                id: el.id,
                name: tags.name || tags["name:en"] || tags["name:hi"] || tags.brand || "Pharmacy",
                lat: el.lat,
                lng: el.lon,
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
        .sort((a: any, b: any) => a._distance - b._distance);

    return pharmacies;
}

/**
 * Fetch pharmacies within a bounding box (for "Search this area" feature)
 */
export async function fetchPharmaciesInBounds(
    south: number,
    west: number,
    north: number,
    east: number
): Promise<OverpassPharmacy[]> {
    const query = `
    [out:json][timeout:15];
    (
      node["amenity"="pharmacy"](${south},${west},${north},${east});
      node["healthcare"="pharmacy"](${south},${west},${north},${east});
      node["shop"="chemist"](${south},${west},${north},${east});
    );
    out body;
  `;

    const data = await queryOverpass(query);
    const elements: OverpassElement[] = data.elements || [];

    const centerLat = (south + north) / 2;
    const centerLng = (west + east) / 2;

    return elements
        .filter((el) => el.lat && el.lon)
        .map((el) => {
            const tags = el.tags || {};
            const distance = calculateDistance(centerLat, centerLng, el.lat, el.lon);

            return {
                id: el.id,
                name: tags.name || tags["name:en"] || tags["name:hi"] || tags.brand || "Pharmacy",
                lat: el.lat,
                lng: el.lon,
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
        .sort((a: any, b: any) => a._distance - b._distance);
}
