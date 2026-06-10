import { Router, Request, Response } from "express";
import { supabase } from "../db/client";
import { rateLimit } from "express-rate-limit";

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

// GET /api/map/nearby?lat=18.52&lng=73.85&radius_km=10
router.get("/nearby", mapLimiter, async (req: Request, res: Response) => {
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
        const pharmaciesRes = await supabase.rpc("get_nearest_pharmacies", {
            query_lat: lat,
            query_lng: lng,
            search_radius_km: clampedRadius,
        });

        if (pharmaciesRes.error) throw pharmaciesRes.error;

        const pharmacies = Array.isArray(pharmaciesRes.data)
            ? (pharmaciesRes.data as PharmacyRpcResult[]).map(formatNearbyPharmacy)
            : [];

        res.json({
            pharmacies,
            // Canonical Supabase migrations currently define pharmacy geo RPCs only.
            // Keep the legacy response key stable until an ASHA schema/RPC exists.
            asha_workers: [],
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
