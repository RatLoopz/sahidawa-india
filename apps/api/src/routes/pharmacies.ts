import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import supabase from "../db/supabase";
import logger from "../utils/logger";

const router = Router();

const MAX_RESULTS = 200;

const nearestQuerySchema = z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    radius: z.coerce.number().min(1).max(200).default(50),
});

const boundsQuerySchema = z.object({
    south: z.coerce.number().min(-90).max(90),
    west: z.coerce.number().min(-180).max(180),
    north: z.coerce.number().min(-90).max(90),
    east: z.coerce.number().min(-180).max(180),
});

function calculateDistanceKM(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
            Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function extractCoordinates(p: any): { lat: number; lng: number } {
    if (p.lat !== undefined && p.lng !== undefined) {
        return { lat: Number(p.lat), lng: Number(p.lng) };
    }
    if (p.location && typeof p.location === "object" && p.location.coordinates) {
        return {
            lat: Number(p.location.coordinates[1]),
            lng: Number(p.location.coordinates[0]),
        };
    }
    return { lat: 0, lng: 0 };
}

function formatPharmacy(p: any, distanceKm: number) {
    const coords = extractCoordinates(p);
    return {
        name: p.name || "Unknown Pharmacy",
        address: p.address || "Unknown Address",
        lat: coords.lat,
        lng: coords.lng,
        distance: `${distanceKm.toFixed(1)} km`,
        phone_number: p.phone_number || null,
        is_verified: p.is_verified ?? false,
        district: p.district || null,
        state: p.state || null,
    };
}

function validateSupabaseConfig(res: Response): boolean {
    const hasUrl = !!process.env.SUPABASE_URL;
    const hasKey = !!(process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);

    if (!hasUrl || !hasKey) {
        logger.error("Missing Supabase credentials in pharmacies route", {
            missingVars: { SUPABASE_URL: !hasUrl, SUPABASE_KEY: !hasKey },
        });
        res.status(500).json({
            error: "Server Configuration Error",
            message: "The backend is missing database credentials.",
            hint: "Please ensure SUPABASE_URL and SUPABASE_ANON_KEY are set in your root .env file.",
        });
        return false;
    }
    return true;
}

function handleFetchError(fetchError: any, res: Response): void {
    logger.error("Database query failed", {
        message: fetchError.message,
        code: fetchError.code,
        details: fetchError.details,
        hint: fetchError.hint,
    });

    const errMsg = fetchError.message?.toLowerCase() || "";
    let hint = "Check your SUPABASE_URL and ensure your database is running.";

    if (errMsg.includes("api key") || errMsg.includes("jwt")) {
        hint = "Your Supabase API key is invalid or expired. Check your .env setup.";
    } else if (
        errMsg.includes('relation "public.pharmacies" does not exist') ||
        fetchError.code === "42P01"
    ) {
        hint =
            'The "pharmacies" table is missing. Did you forget to run the Supabase migrations/seeds?';
    }

    res.status(500).json({
        error: "Database Query Failed",
        details: fetchError.message,
        code: fetchError.code || "UNKNOWN",
        hint,
    });
}

router.get("/nearest", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = nearestQuerySchema.safeParse(req.query);

        if (!result.success) {
            res.status(400).json({
                error: "Invalid coordinates",
                details: result.error.flatten().fieldErrors,
            });
            return;
        }

        const { lat, lng, radius } = result.data;

        if (!validateSupabaseConfig(res)) return;

        const { data: rpcData, error: rpcError } = await supabase.rpc("get_nearest_pharmacies", {
            query_lat: lat,
            query_lng: lng,
        });

        if (!rpcError && rpcData) {
            const pharmacies = rpcData
                .map((p: any) => {
                    const distanceKm = Number(p.distance);
                    return { ...formatPharmacy(p, distanceKm), rawDistance: distanceKm };
                })
                .filter((p: any) => p.rawDistance <= radius)
                .sort((a: any, b: any) => a.rawDistance - b.rawDistance)
                .slice(0, MAX_RESULTS)
                .map(({ rawDistance, ...rest }: any) => rest);

            return res.json({ pharmacies });
        }

        logger.warn("PostGIS RPC failed or unavailable, falling back to Haversine calculation", {
            error: rpcError?.message,
            code: rpcError?.code,
        });

        const { data: allPharmacies, error: fetchError } = await supabase
            .from("pharmacies")
            .select("*");

        if (fetchError) {
            handleFetchError(fetchError, res);
            return;
        }

        const pharmacies = (allPharmacies || [])
            .map((p: any) => {
                const coords = extractCoordinates(p);
                const distanceKm = calculateDistanceKM(lat, lng, coords.lat, coords.lng);
                return { ...formatPharmacy(p, distanceKm), rawDistance: distanceKm };
            })
            .filter((p: any) => p.lat !== 0 && p.lng !== 0 && p.rawDistance <= radius)
            .sort((a: any, b: any) => a.rawDistance - b.rawDistance)
            .slice(0, MAX_RESULTS)
            .map(({ rawDistance, ...rest }: any) => rest);

        res.json({ pharmacies });
    } catch (err) {
        next(err);
    }
});

router.get("/in-bounds", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = boundsQuerySchema.safeParse(req.query);

        if (!result.success) {
            res.status(400).json({
                error: "Invalid bounds",
                details: result.error.flatten().fieldErrors,
            });
            return;
        }

        const { south, west, north, east } = result.data;

        if (!validateSupabaseConfig(res)) return;

        const centerLat = (south + north) / 2;
        const centerLng = (west + east) / 2;

        // Try PostGIS spatial query via raw SQL
        const { data: rpcData, error: rpcError } = await supabase.rpc(
            "get_pharmacies_in_bounds" as any,
            { bound_south: south, bound_west: west, bound_north: north, bound_east: east }
        );

        if (!rpcError && rpcData) {
            const pharmacies = (rpcData as any[])
                .map((p: any) => {
                    const coords = extractCoordinates(p);
                    const distanceKm = calculateDistanceKM(
                        centerLat,
                        centerLng,
                        coords.lat,
                        coords.lng
                    );
                    return formatPharmacy(p, distanceKm);
                })
                .slice(0, MAX_RESULTS);
            return res.json({ pharmacies });
        }

        logger.warn("PostGIS bounds RPC unavailable, falling back to in-memory filter", {
            error: rpcError?.message,
        });

        const { data: allPharmacies, error: fetchError } = await supabase
            .from("pharmacies")
            .select("*");

        if (fetchError) {
            handleFetchError(fetchError, res);
            return;
        }

        const pharmacies = (allPharmacies || [])
            .map((p: any) => {
                const coords = extractCoordinates(p);
                const distanceKm = calculateDistanceKM(
                    centerLat,
                    centerLng,
                    coords.lat,
                    coords.lng
                );
                return { ...formatPharmacy(p, distanceKm), coords };
            })
            .filter(
                (p: any) =>
                    p.coords.lat !== 0 &&
                    p.coords.lng !== 0 &&
                    p.coords.lat >= south &&
                    p.coords.lat <= north &&
                    p.coords.lng >= west &&
                    p.coords.lng <= east
            )
            .slice(0, MAX_RESULTS)
            .map(({ coords, ...rest }: any) => rest);

        res.json({ pharmacies });
    } catch (err) {
        next(err);
    }
});

export default router;
