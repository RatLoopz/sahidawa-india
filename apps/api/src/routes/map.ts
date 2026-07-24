import { Router, Request, Response } from "express";
import { supabase } from "../db/client";
import { rateLimit } from "express-rate-limit";
import { cacheMiddleware } from "../middleware/cache";
import logger from "../utils/logger";

const router = Router();

/**
 * Rate limiter for map-related endpoints.
 * Prevents DoS and scraping by limiting requests to 30 per minute per IP.
 */
const mapLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    message: { error: "Too many map requests from this IP. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});

interface PharmacyRpcResult {
    id: string;
    name: string | null;
    address: string | null;
    district: string | null;
    state: string | null;
    phone_number: string | null;
    is_verified: boolean | null;
    lat: number;
    lng: number;
    distance: number | null;
}

function formatNearbyPharmacy(pharmacy: PharmacyRpcResult) {
    const isVerified = pharmacy.is_verified ?? false;
    const distanceKm = Number(pharmacy.distance ?? 0);

    return {
        id: pharmacy.id,
        name: pharmacy.name,
        type: "Jan Aushadhi",
        lat: pharmacy.lat,
        lng: pharmacy.lng,
        address: pharmacy.address,
        district: pharmacy.district,
        state: pharmacy.state,
        phone_number: pharmacy.phone_number,
        is_verified: isVerified,
        verified: isVerified,
        distance: distanceKm,
        distance_km: distanceKm,
    };
}

function calculateDistanceKM(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * (Math.PI / 180)) *
            Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Extract lat/lng from a pharmacy row returned by a plain .select() query.
 * The location column is a PostGIS geography stored as a WKB hex string, e.g.
 * "0101000020E61000008CB96B09F9345240DE718A8EE4223340".
 * Handles multiple formats for safety:
 *   1. Explicit lat/lng fields (from RPC results)
 *   2. GeoJSON { coordinates: [lng, lat] }
 *   3. WKT POINT(lng lat) string
 *   4. PostGIS WKB hex (the actual DB storage format)
 */
function extractCoordinatesForNearby(p: any) {
    if (p.lat !== undefined && p.lng !== undefined) {
        return { lat: Number(p.lat), lng: Number(p.lng) };
    }
    if (p.location && typeof p.location === "object" && p.location.coordinates) {
        return { lat: Number(p.location.coordinates[1]), lng: Number(p.location.coordinates[0]) };
    }
    if (p.location && typeof p.location === "string") {
        // WKT POINT format: "POINT(lng lat)"
        const wktMatch = p.location.match(/POINT\s*\(([\-\d.]+)\s+([\-\d.]+)\)/i);
        if (wktMatch) {
            return { lat: parseFloat(wktMatch[2]), lng: parseFloat(wktMatch[1]) };
        }
        // PostGIS WKB hex format (EWKB with SRID): starts with '01' (little-endian)
        // Structure: 1 byte order + 4 type + 4 SRID + 8 X(lng) + 8 Y(lat) = 25 bytes = 50 hex chars
        if (/^[0-9a-fA-F]{50,}$/.test(p.location)) {
            try {
                const buf = Buffer.from(p.location, "hex");
                // Check for EWKB with SRID flag (0x20000000)
                const typeFlag = buf.readUInt32LE(1);
                const hasSRID = (typeFlag & 0x20000000) !== 0;
                const coordOffset = hasSRID ? 9 : 5; // skip SRID 4 bytes if present
                const lng = buf.readDoubleLE(coordOffset);
                const lat = buf.readDoubleLE(coordOffset + 8);
                if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
                    return { lat, lng };
                }
            } catch {
                // ignore decode errors
            }
        }
    }
    return { lat: 0, lng: 0 };
}

// GET /api/map/nearby?lat=18.52&lng=73.85&radius_km=10
router.get(
    "/nearby",
    mapLimiter,
    cacheMiddleware(300, 600),
    async (req: Request, res: Response) => {
        const lat = parseFloat(req.query.lat as string);
        const lng = parseFloat(req.query.lng as string);
        const radius_km = parseFloat((req.query.radius_km as string) || "10");

        if (isNaN(lat) || isNaN(lng)) {
            return res.status(400).json({ error: "lat and lng are required query params" });
        }

        // Explicit bounds checking for lat and lng
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return res.status(400).json({
                error: "Latitude must be between -90 and 90, and longitude between -180 and 180.",
            });
        }

        if (!Number.isFinite(radius_km) || radius_km <= 0) {
            return res.status(400).json({ error: "radius_km must be a positive number" });
        }
        const clampedRadius = Math.min(radius_km, 100);

        try {
            // 1. Fetch nearest pharmacies with fallback
            let pharmacies: any[] = [];
            try {
                const { data: rpcData, error: rpcError } = await supabase.rpc("get_nearest_pharmacies", {
                    query_lat: lat,
                    query_lng: lng,
                    search_radius_km: clampedRadius,
                });
                
                if (rpcError) throw rpcError;
                
                pharmacies = Array.isArray(rpcData)
                    ? (rpcData as PharmacyRpcResult[]).map(formatNearbyPharmacy)
                    : [];
            } catch (err: any) {
                logger.warn({ message: "get_nearest_pharmacies RPC failed, falling back to db query", error: err });
                // Note: Only select columns that are guaranteed to exist in the schema.
                // status and is_active may not be present if migrations haven't run yet.
                const { data: fallbackData, error: fallbackError } = await supabase
                    .from("pharmacies")
                    .select("id, name, address, location, phone_number, is_verified, district, state")
                    .limit(1000);
                
                if (fallbackError) {
                    logger.error({ message: "Fallback pharmacies fetch failed", error: fallbackError });
                } else if (fallbackData) {
                    pharmacies = (fallbackData as any[])
                        .map((p) => {
                            const coords = extractCoordinatesForNearby(p);
                            const distanceKm = calculateDistanceKM(lat, lng, coords.lat, coords.lng);
                            return {
                                id: p.id,
                                name: p.name,
                                type: "Jan Aushadhi",
                                lat: coords.lat,
                                lng: coords.lng,
                                address: p.address,
                                district: p.district,
                                state: p.state,
                                phone_number: p.phone_number,
                                is_verified: p.is_verified ?? false,
                                verified: p.is_verified ?? false,
                                distance: distanceKm,
                                distance_km: distanceKm,
                            };
                        })
                        .filter((p) => p.lat !== 0 && p.lng !== 0 && p.distance_km <= clampedRadius)
                        .sort((a, b) => a.distance_km - b.distance_km)
                        .slice(0, 200);
                }
            }

            // 2. Fetch nearest ASHA workers with fallback
            let ashaWorkers: any[] = [];
            try {
                const { data: rpcData, error: rpcError } = await supabase.rpc("get_nearest_asha_workers", {
                    query_lat: lat,
                    query_lng: lng,
                    search_radius_km: clampedRadius,
                });
                
                if (rpcError) throw rpcError;
                
                ashaWorkers = Array.isArray(rpcData) ? rpcData : [];
            } catch (err: any) {
                logger.warn({ message: "get_nearest_asha_workers RPC failed, falling back to db query", error: err });
                const { data: fallbackData, error: fallbackError } = await supabase
                    .from("asha_workers")
                    .select("id, name, district, state, location, phone_number")
                    .limit(1000);
                
                if (fallbackError) {
                    logger.error({ message: "Fallback ASHA workers fetch failed", error: fallbackError });
                } else if (fallbackData) {
                    ashaWorkers = (fallbackData as any[])
                        .map((a) => {
                            const coords = extractCoordinatesForNearby(a);
                            const distanceKm = calculateDistanceKM(lat, lng, coords.lat, coords.lng);
                            return {
                                id: a.id,
                                name: a.name,
                                district: a.district,
                                state: a.state,
                                lat: coords.lat,
                                lng: coords.lng,
                                phone_number: a.phone_number,
                                distance_km: distanceKm,
                            };
                        })
                        .filter((a) => a.lat !== 0 && a.lng !== 0 && a.distance_km <= clampedRadius)
                        .sort((a, b) => a.distance_km - b.distance_km)
                        .slice(0, 200);
                }
            }

            res.json({
                pharmacies,
                asha_workers: ashaWorkers,
            });
        } catch (err) {
            logger.error({ message: "Error fetching nearby facilities", error: err });
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

export default router;
