import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabase } from "../db/client";
import logger from "../utils/logger";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";

const router = Router();

// ── Constants ────────────────────────────────────────────────────────────────

/** Maximum number of pharmacies returned per request */
const MAX_RESULTS = 200;

// ── TypeScript interfaces ────────────────────────────────────────────────────

/** Raw pharmacy row returned by Supabase table queries (fallback path) */
interface PharmacyRow {
    name: string;
    address: string;
    lat?: number;
    lng?: number;
    location?: { type: string; coordinates: number[] } | null;
    phone_number: string | null;
    is_verified: boolean;
    district: string | null;
    state: string | null;
    status?: "pending" | "approved" | "rejected";
}

/** Pharmacy row returned by PostGIS RPC functions */
interface PharmacyRpcResult {
    id: string;
    name: string;
    address: string;
    district: string | null;
    state: string | null;
    phone_number: string | null;
    is_verified: boolean;
    lat: number;
    lng: number;
    distance: number;
}

/** Formatted pharmacy object returned in API responses */
interface FormattedPharmacy {
    name: string;
    address: string;
    lat: number;
    lng: number;
    distance: string;
    phone_number: string | null;
    is_verified: boolean;
    district: string | null;
    state: string | null;
}

/** Internal type used during sorting (includes raw numeric distance) */
interface PharmacyWithRawDistance extends FormattedPharmacy {
    rawDistance: number;
}

// ── Zod validation schemas ───────────────────────────────────────────────────

// Schema for pharmacy registration. licenseId is required and must be unique
// across all registered pharmacies to prevent duplicate records.
const registerPharmacySchema = z.object({
    name: z.string().min(2),
    licenseId: z.string().min(3),
    address: z.string().min(5),
    district: z.string().min(2),
    state: z.string().min(2),
    phone_number: z
        .string()
        .regex(/^\+?[\d\s\-()]{7,15}$/)
        .optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
});

// ── Pharmacy registration ────────────────────────────────────────────────────

/**
 * POST /api/pharmacies
 * Register a new pharmacy. Returns 409 if a pharmacy with the same licenseId
 * already exists to prevent duplicate entries.
 */
router.post("/", requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const parsed = registerPharmacySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid pharmacy payload", issues: parsed.error.issues });
        return;
    }

    if (!req.user) {
        res.status(401).json({ error: "Unauthorized access" });
        return;
    }

    const data = {
        ...parsed.data,
        created_by: req.user.id
    };
    try {
        // Check for an existing pharmacy with the same licenseId before inserting.
        // Without this check concurrent or repeated requests can create duplicate
        // records for the same physical location, corrupting search results and
        // user-facing data.
        const { data: existing, error: lookupError } = await supabase
            .from("pharmacies")
            .select("id")
            .eq("license_id", data.licenseId)
            .maybeSingle();

        if (lookupError) {
            logger.error("Pharmacy duplicate check failed", { error: lookupError });
            next(lookupError);
            return;
        }

        if (existing) {
            res.status(409).json({
                error: "A pharmacy with this license ID is already registered",
            });
            return;
        }

        const { data: pharmacy, error: insertError } = await supabase
            .from("pharmacies")
            .insert({
                name: data.name,
                license_id: data.licenseId,
                address: data.address,
                district: data.district,
                state: data.state,
                phone_number: data.phone_number ?? null,
                location: data.lat !== undefined && data.lng !== undefined ? `POINT(${data.lng} ${data.lat})` : null,
                is_verified: false,
                status: "pending",
            })
            .select()
            .single();

        if (insertError) {
            next(insertError);
            return;
        }

        res.status(201).json({ pharmacy });
    } catch (err) {
        next(err);
    }
});

const nearestQuerySchema = z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    radius: z.coerce.number().min(1).max(200).default(50),
});

const boundsQuerySchema = z
    .object({
        south: z.coerce.number().min(-90).max(90),
        west: z.coerce.number().min(-180).max(180),
        north: z.coerce.number().min(-90).max(90),
        east: z.coerce.number().min(-180).max(180),
    })
    .refine((data) => data.south < data.north, {
        message: "South boundary must be less than North boundary",
        path: ["south"],
    })
    .refine((data) => data.west < data.east, {
        message: "West boundary must be less than East boundary",
        path: ["west"],
    });

// ── Helper functions ─────────────────────────────────────────────────────────

/**
 * Calculates the Haversine distance between two geographic coordinates.
 * Used as a fallback when PostGIS RPC is unavailable.
 *
 * @param lat1 - Latitude of the first point
 * @param lon1 - Longitude of the first point
 * @param lat2 - Latitude of the second point
 * @param lon2 - Longitude of the second point
 * @returns Distance in kilometres
 */
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

/**
 * Extracts latitude and longitude from a pharmacy row.
 * Handles both flat (lat/lng) and GeoJSON (location.coordinates) formats.
 */
function extractCoordinates(p: PharmacyRow): { lat: number; lng: number } {
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

/**
 * Formats a pharmacy row into the standard API response shape.
 */
function formatPharmacy(p: PharmacyRow, distanceKm: number): FormattedPharmacy {
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

/**
 * Handles database fetch errors with descriptive error messages and hints.
 */
function handleFetchError(
    fetchError: { message?: string; code?: string; details?: string; hint?: string },
    res: Response
): void {
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

// ── Routes ───────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/pharmacies/nearest:
 *   get:
 *     summary: Find nearest pharmacies
 *     description: >
 *       Returns nearby Jan Aushadhi Kendra pharmacies sorted by distance
 *       from the given coordinates. Uses PostGIS ST_DWithin for efficient
 *       geospatial queries with automatic fallback to Haversine calculation.
 *     tags:
 *       - Pharmacies
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema:
 *           type: number
 *           minimum: -90
 *           maximum: 90
 *         description: Latitude of the search origin
 *         example: 28.6304
 *       - in: query
 *         name: lng
 *         required: true
 *         schema:
 *           type: number
 *           minimum: -180
 *           maximum: 180
 *         description: Longitude of the search origin
 *         example: 77.2177
 *       - in: query
 *         name: radius
 *         required: false
 *         schema:
 *           type: number
 *           minimum: 1
 *           maximum: 200
 *           default: 50
 *         description: Search radius in kilometres
 *     responses:
 *       200:
 *         description: List of nearby pharmacies sorted by distance
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pharmacies:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                         example: "PMBJAK - AIIMS"
 *                       address:
 *                         type: string
 *                         example: "All India Institute of Medical Sciences, Ansari Nagar, New Delhi"
 *                       lat:
 *                         type: number
 *                         example: 28.5672
 *                       lng:
 *                         type: number
 *                         example: 77.2088
 *                       distance:
 *                         type: string
 *                         example: "2.3 km"
 *                       phone_number:
 *                         type: string
 *                         nullable: true
 *                         example: "011-26588500"
 *                       is_verified:
 *                         type: boolean
 *                         example: true
 *                       district:
 *                         type: string
 *                         nullable: true
 *                         example: "South Delhi"
 *                       state:
 *                         type: string
 *                         nullable: true
 *                         example: "Delhi"
 *       400:
 *         description: Invalid coordinates or radius
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server or database error
 */
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

        // Primary path: PostGIS RPC with server-side radius filtering
        const { data: rpcData, error: rpcError } = await supabase.rpc("get_nearest_pharmacies", {
            query_lat: lat,
            query_lng: lng,
            search_radius_km: radius,
        });

        if (!rpcError && rpcData) {
            const pharmacies: FormattedPharmacy[] = (rpcData as PharmacyRpcResult[])
                .map((p: PharmacyRpcResult) => ({
                    name: p.name || "Unknown Pharmacy",
                    address: p.address || "Unknown Address",
                    lat: p.lat,
                    lng: p.lng,
                    distance: `${Number(p.distance).toFixed(1)} km`,
                    phone_number: p.phone_number || null,
                    is_verified: p.is_verified ?? false,
                    district: p.district || null,
                    state: p.state || null,
                }))
                .slice(0, MAX_RESULTS);

            return res.json({ pharmacies });
        }

        // Fallback path: Haversine calculation in JavaScript
        logger.warn("PostGIS RPC failed or unavailable, falling back to Haversine calculation", {
            error: rpcError?.message,
            code: rpcError?.code,
        });

        const { data: allPharmacies, error: fetchError } = await supabase
            .from("pharmacies")
            .select("name, address, location, phone_number, is_verified, district, state, status")
            .eq("status", "approved")
            .limit(3000);

        if (fetchError) {
            handleFetchError(fetchError, res);
            return;
        }

        const pharmacies: FormattedPharmacy[] = ((allPharmacies || []) as PharmacyRow[])
            .filter((p: PharmacyRow) => p.status === "approved")
            .map((p: PharmacyRow): PharmacyWithRawDistance => {
                const coords = extractCoordinates(p);
                const distanceKm = calculateDistanceKM(lat, lng, coords.lat, coords.lng);
                return { ...formatPharmacy(p, distanceKm), rawDistance: distanceKm };
            })
            .filter(
                (p: PharmacyWithRawDistance) =>
                    p.lat !== 0 && p.lng !== 0 && p.rawDistance <= radius
            )
            .sort(
                (a: PharmacyWithRawDistance, b: PharmacyWithRawDistance) =>
                    a.rawDistance - b.rawDistance
            )
            .slice(0, MAX_RESULTS)
            .map(({ rawDistance, ...rest }: PharmacyWithRawDistance): FormattedPharmacy => rest);

        res.json({ pharmacies });
    } catch (err) {
        next(err);
    }
});

/**
 * @openapi
 * /api/pharmacies/in-bounds:
 *   get:
 *     summary: Find pharmacies within map bounds
 *     description: >
 *       Returns pharmacies whose location falls inside the given bounding box.
 *       Uses PostGIS ST_Intersects with ST_MakeEnvelope for efficient spatial
 *       queries with automatic fallback to in-memory filtering.
 *     tags:
 *       - Pharmacies
 *     parameters:
 *       - in: query
 *         name: south
 *         required: true
 *         schema:
 *           type: number
 *           minimum: -90
 *           maximum: 90
 *         description: Southern latitude boundary
 *         example: 28.5
 *       - in: query
 *         name: west
 *         required: true
 *         schema:
 *           type: number
 *           minimum: -180
 *           maximum: 180
 *         description: Western longitude boundary
 *         example: 77.0
 *       - in: query
 *         name: north
 *         required: true
 *         schema:
 *           type: number
 *           minimum: -90
 *           maximum: 90
 *         description: Northern latitude boundary
 *         example: 28.8
 *       - in: query
 *         name: east
 *         required: true
 *         schema:
 *           type: number
 *           minimum: -180
 *           maximum: 180
 *         description: Eastern longitude boundary
 *         example: 77.4
 *     responses:
 *       200:
 *         description: List of pharmacies within the bounding box
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pharmacies:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       address:
 *                         type: string
 *                       lat:
 *                         type: number
 *                       lng:
 *                         type: number
 *                       distance:
 *                         type: string
 *                       phone_number:
 *                         type: string
 *                         nullable: true
 *                       is_verified:
 *                         type: boolean
 *                       district:
 *                         type: string
 *                         nullable: true
 *                       state:
 *                         type: string
 *                         nullable: true
 *       400:
 *         description: Invalid bounds
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server or database error
 */
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

        const centerLat = (south + north) / 2;
        const centerLng = (west + east) / 2;

        // Primary path: PostGIS spatial query via RPC
        const { data: rpcData, error: rpcError } = await supabase.rpc(
            "get_pharmacies_in_bounds" as string,
            { bound_south: south, bound_west: west, bound_north: north, bound_east: east }
        );

        if (!rpcError && rpcData) {
            const pharmacies: FormattedPharmacy[] = (rpcData as PharmacyRpcResult[])
                .map((p: PharmacyRpcResult) => ({
                    name: p.name || "Unknown Pharmacy",
                    address: p.address || "Unknown Address",
                    lat: p.lat,
                    lng: p.lng,
                    distance: `${Number(p.distance).toFixed(1)} km`,
                    phone_number: p.phone_number || null,
                    is_verified: p.is_verified ?? false,
                    district: p.district || null,
                    state: p.state || null,
                }))
                .slice(0, MAX_RESULTS);
            return res.json({ pharmacies });
        }

        // Fallback path: in-memory bounding box filter
        logger.warn("PostGIS bounds RPC unavailable, falling back to in-memory filter", {
            error: rpcError?.message,
        });

        const { data: allPharmacies, error: fetchError } = await supabase
            .from("pharmacies")
            .select("name, address, location, phone_number, is_verified, district, state, status")
            .eq("status", "approved")
            .limit(3000);

        if (fetchError) {
            handleFetchError(fetchError, res);
            return;
        }

        const pharmacies: FormattedPharmacy[] = ((allPharmacies || []) as PharmacyRow[])
            .filter((p: PharmacyRow) => p.status === "approved")
            .map((p: PharmacyRow) => {
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
                (p) =>
                    p.coords.lat !== 0 &&
                    p.coords.lng !== 0 &&
                    p.coords.lat >= south &&
                    p.coords.lat <= north &&
                    p.coords.lng >= west &&
                    p.coords.lng <= east
            )
            .slice(0, MAX_RESULTS)
            .map(({ coords, ...rest }) => rest);

        res.json({ pharmacies });
    } catch (err) {
        next(err);
    }
});

export default router;
