import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabase } from "../db/client";
import logger from "../utils/logger";
import { redisClient } from "../utils/redis";
import { limiter } from "../middleware/rateLimit";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { FormattedPharmacy, PharmacyRpcResult } from "../types/pharmacy.types";
import { redisCache } from "../middleware/redisCache";
import multer from "multer";
import { buildOrConditions } from "../utils/db";

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

// ── Constants ────────────────────────────────────────────────────────────────

/** Maximum number of pharmacies returned per request */
const MAX_RESULTS = 200;

const GEOSPATIAL_CACHE_CONTROL = "public, max-age=300, s-maxage=300, stale-while-revalidate=600";

const setGeospatialCacheHeaders = (res: Response) => {
    res.setHeader("Cache-Control", GEOSPATIAL_CACHE_CONTROL);
};

import { cacheMiddleware } from "../middleware/cache";

// ── TypeScript interfaces ────────────────────────────────────────────────────

/** Raw pharmacy row returned by Supabase table queries (fallback path) */
interface PharmacyRow {
    id?: string;
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
    updated_at?: string;
    is_active?: boolean;
    deleted_at?: string | null;
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

// Zod schema for validating each individual item inside an uploaded row
const inventoryRowSchema = z.object({
    medicine_name: z.string().min(1, "Medicine name is required"),
    batch_number: z.string().min(1, "Batch number is required"),
    expiry_date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Expiry date must be in YYYY-MM-DD format"),
    quantity: z.preprocess(
        (val) => Number(val),
        z.number().int().nonnegative("Quantity must be a positive number")
    ),
    mrp: z.preprocess((val) => Number(val), z.number().positive("MRP must be a valid price")),
});

// ── Pharmacy registration ────────────────────────────────────────────────────

/**
 * POST /api/pharmacies
 * Register a new pharmacy. Returns 409 if a pharmacy with the same licenseId
 * already exists to prevent duplicate entries.
 */
router.post(
    "/",
    requireAuth,
    limiter,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const parsed = registerPharmacySchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                error: "Invalid pharmacy payload",
                issues: parsed.error.issues,
            });
            return;
        }

        if (!req.user) {
            res.status(401).json({ error: "Unauthorized access" });
            return;
        }

        const data = {
            ...parsed.data,
            created_by: req.user.id,
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
                    location:
                        data.lat !== undefined && data.lng !== undefined
                            ? `POINT(${data.lng} ${data.lat})`
                            : null,
                    is_verified: false,
                    status: "pending",
                    created_by: data.created_by,
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
    }
);

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
        since: z.coerce.date().optional(),
        limit: z.coerce.number().int().min(1).max(1000).default(200),
        offset: z.coerce.number().int().min(0).default(0),
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
        id: p.id,
        name: p.name || "Unknown Pharmacy",
        address: p.address || "Unknown Address",
        lat: coords.lat,
        lng: coords.lng,
        distance: `${distanceKm.toFixed(1)} km`,
        phone_number: p.phone_number || null,
        is_verified: p.is_verified ?? false,
        district: p.district || null,
        state: p.state || null,
        updated_at: p.updated_at,
        is_active: p.is_active,
        deleted_at: p.deleted_at,
    };
}

/**
 * Handles database fetch errors with descriptive error messages and hints.
 */
function handleFetchError(
    fetchError: {
        message?: string;
        code?: string;
        details?: string;
        hint?: string;
    },
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
 * /api/pharmacies/search-by-medicine:
 *   get:
 *     summary: Find pharmacies stocking a medicine by name
 *     description: >
 *       Searches the pharmacy_inventory table for pharmacies that stock a
 *       medicine whose name matches the given query. Multi-word queries are
 *       handled correctly: every word in the query is applied as a separate
 *       ILIKE condition joined by OR in a single Supabase `.or()` call,
 *       preventing the silent last-word-only bug that occurred when `.or()`
 *       was chained in a loop.
 *
 *       Results are distinct pharmacies deduplicated by pharmacy_id. Matches
 *       are cached in Redis for 5 minutes.
 *     tags:
 *       - Pharmacies
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *         description: Medicine name (or partial name) to search for
 *         example: "Amoxicillin Clavulanate"
 *     responses:
 *       200:
 *         description: List of matching pharmacies
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
 *                       pharmacy_id:
 *                         type: string
 *                       pharmacy_name:
 *                         type: string
 *                       address:
 *                         type: string
 *                       district:
 *                         type: string
 *                         nullable: true
 *                       state:
 *                         type: string
 *                         nullable: true
 *                       phone_number:
 *                         type: string
 *                         nullable: true
 *                       is_verified:
 *                         type: boolean
 *                       matched_medicines:
 *                         type: array
 *                         items:
 *                           type: string
 *                 query:
 *                   type: string
 *                 total:
 *                   type: integer
 *       400:
 *         description: Missing or invalid query parameter
 *       500:
 *         description: Database error
 */
router.get(
    "/search-by-medicine",
    limiter,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const rawQuery = (req.query.q as string | undefined)?.trim() ?? "";

            if (rawQuery.length < 2) {
                res.status(400).json({
                    error: "Query parameter 'q' must be at least 2 characters long",
                });
                return;
            }

            // Normalise and split into individual search words.
            // Words shorter than 2 characters are dropped to avoid too-broad matches.
            const words = rawQuery
                .toLowerCase()
                .split(/\s+/)
                .map((w) => w.trim())
                .filter((w) => w.length >= 2);

            if (words.length === 0) {
                res.status(400).json({
                    error: "Query contains no searchable words (each word must be at least 2 characters)",
                });
                return;
            }

            // Try Redis cache first
            const cacheKey = `pharmacies:medicine-search:${words.join(":")}`;
            try {
                if (redisClient.isOpen) {
                    const cached = await redisClient.get(cacheKey);
                    if (cached) {
                        logger.info(`Cache HIT for pharmacy medicine search: "${rawQuery}"`);
                        res.json(JSON.parse(cached));
                        return;
                    }
                }
            } catch (cacheErr) {
                logger.warn(`Redis read error for medicine search cache: ${cacheErr}`);
            }

            // Build a single OR filter string so that all words are applied in one
            // .or() call. This is critical: calling .or() in a loop overwrites the
            // previous condition, causing only the last word to be effective
            // (the root cause of issue #2643).
            const orFilter = buildOrConditions(["medicine_name"], words);

            const { data: inventoryRows, error: inventoryError } = await supabase
                .from("pharmacy_inventory")
                .select(
                    "medicine_name, pharmacy_id, pharmacies!inner(id, name, address, district, state, phone_number, is_verified, status)"
                )
                .or(orFilter)
                .limit(500);

            if (inventoryError) {
                logger.error("Pharmacy medicine search DB error", {
                    message: inventoryError.message,
                    code: inventoryError.code,
                    query: rawQuery,
                });
                res.status(500).json({ error: "Database query failed" });
                return;
            }

            // Deduplicate by pharmacy_id, collecting matched medicine names per pharmacy
            const pharmacyMap = new Map<
                string,
                {
                    pharmacy_id: string;
                    pharmacy_name: string;
                    address: string;
                    district: string | null;
                    state: string | null;
                    phone_number: string | null;
                    is_verified: boolean;
                    matched_medicines: Set<string>;
                }
            >();

            for (const row of inventoryRows ?? []) {
                const pharmacy = (row as any).pharmacies;
                if (!pharmacy || pharmacy.status !== "approved") continue;

                const pid: string = pharmacy.id;
                if (!pharmacyMap.has(pid)) {
                    pharmacyMap.set(pid, {
                        pharmacy_id: pid,
                        pharmacy_name: pharmacy.name ?? "Unknown Pharmacy",
                        address: pharmacy.address ?? "Unknown Address",
                        district: pharmacy.district ?? null,
                        state: pharmacy.state ?? null,
                        phone_number: pharmacy.phone_number ?? null,
                        is_verified: pharmacy.is_verified ?? false,
                        matched_medicines: new Set<string>(),
                    });
                }
                if (row.medicine_name) {
                    pharmacyMap.get(pid)!.matched_medicines.add(row.medicine_name);
                }
            }

            const pharmacies = Array.from(pharmacyMap.values()).map(
                ({ matched_medicines, ...rest }) => ({
                    ...rest,
                    matched_medicines: Array.from(matched_medicines),
                })
            );

            const responseBody = {
                pharmacies,
                query: rawQuery,
                total: pharmacies.length,
            };

            // Cache for 5 minutes
            try {
                if (redisClient.isOpen) {
                    await redisClient.set(cacheKey, JSON.stringify(responseBody), { EX: 300 });
                }
            } catch (cacheErr) {
                logger.warn(`Redis write error for medicine search cache: ${cacheErr}`);
            }

            res.json(responseBody);
        } catch (err) {
            next(err);
        }
    }
);

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
router.get(
    "/nearest",
    limiter,
    cacheMiddleware(300, 600),
    redisCache(3600, (req: Request) => {
        const lat = Number(req.query.lat);
        const lng = Number(req.query.lng);
        const radius = Number(req.query.radius ?? 50);

        return `pharmacies:nearest:${lat.toFixed(3)}:${lng.toFixed(3)}:${radius}`;
    }),
    async (req: Request, res: Response, next: NextFunction) => {
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
            const { data: rpcData, error: rpcError } = await supabase.rpc(
                "get_nearest_pharmacies",
                {
                    query_lat: lat,
                    query_lng: lng,
                    search_radius_km: radius,
                }
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

                const responseData = { pharmacies };

                return res.json(responseData);
            }

            // Fallback path: Haversine calculation in JavaScript
            logger.warn(
                "PostGIS RPC failed or unavailable, falling back to Haversine calculation",
                {
                    error: rpcError?.message,
                    code: rpcError?.code,
                }
            );

            const { data: allPharmacies, error: fetchError } = await supabase
                .from("pharmacies")
                .select(
                    "name, address, location, phone_number, is_verified, district, state, status"
                )
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
                .map(
                    ({ rawDistance, ...rest }: PharmacyWithRawDistance): FormattedPharmacy => rest
                );

            const responseData = { pharmacies };

            res.json(responseData);
        } catch (err) {
            next(err);
        }
    }
);

/**
 * @openapi
 * /api/pharmacies/in-bounds:
 *   get:
 *     summary: Find pharmacies within map bounds
 *     description: >
 *       Returns pharmacies whose location falls inside the given bounding box.
 *       Uses PostGIS ST_Intersects with ST_MakeEnvelope for efficient spatial
 *       queries with automatic fallback to in-memory filtering.
 *
 *       When `since` is provided, only pharmacies created or updated after
 *       that timestamp are returned (delta sync, #2260). This is intended
 *       for repeat requests over a bounding box the client has already
 *       synced — e.g. re-fetching after panning back to a previously seen
 *       area — to avoid re-downloading unchanged records. Deletions are not
 *       reported by this endpoint; pharmacies are hard-deleted today and
 *       there is no tombstone mechanism yet.
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
 *       - in: query
 *         name: since
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *         description: >
 *           ISO timestamp from a previous response's `syncedAt` field. When
 *           provided, only pharmacies changed after this time are returned.
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
 *                       id:
 *                         type: string
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
 *                       updated_at:
 *                         type: string
 *                         nullable: true
 *                 syncedAt:
 *                   type: string
 *                   description: >
 *                     Server timestamp to pass back as `since` on the next
 *                     request to this bounding box.
 *                 delta:
 *                   type: boolean
 *                   description: True if this response only contains changes since `since`.
 *       400:
 *         description: Invalid bounds
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server or database error
 */
router.get(
    "/in-bounds",
    limiter,
    cacheMiddleware(300, 600),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = boundsQuerySchema.safeParse(req.query);

            if (!result.success) {
                res.status(400).json({
                    error: "Invalid bounds",
                    details: result.error.flatten().fieldErrors,
                });
                return;
            }

            const { south, west, north, east, since, limit, offset } = result.data;
            const syncedAt = new Date().toISOString();

            const centerLat = (south + north) / 2;
            const centerLng = (west + east) / 2;

            let rpcData, rpcError;
            if (since) {
                const { data, error } = await supabase.rpc("get_pharmacies_in_bounds_delta", {
                    bound_south: south,
                    bound_west: west,
                    bound_north: north,
                    bound_east: east,
                    since: since.toISOString(),
                });
                rpcData = data;
                rpcError = error;
            } else {
                const { data, error } = await supabase.rpc("get_pharmacies_in_bounds", {
                    bound_south: south,
                    bound_west: west,
                    bound_north: north,
                    bound_east: east,
                    query_limit: limit,
                    query_offset: offset,
                });
                rpcData = data;
                rpcError = error;
            }

            if (!rpcError && rpcData) {
                const pharmacies: FormattedPharmacy[] = (rpcData as PharmacyRpcResult[])
                    .map((p: PharmacyRpcResult) => ({
                        id: p.id,
                        name: p.name || "Unknown Pharmacy",
                        address: p.address || "Unknown Address",
                        lat: p.lat,
                        lng: p.lng,
                        distance: `${Number(p.distance).toFixed(1)} km`,
                        phone_number: p.phone_number || null,
                        is_verified: p.is_verified ?? false,
                        district: p.district || null,
                        state: p.state || null,
                        updated_at: p.updated_at,
                        is_active: p.is_active ?? true,
                        deleted_at: p.deleted_at ?? null,
                    }))
                    .slice(0, MAX_RESULTS);
                setGeospatialCacheHeaders(res);
                return res.json({
                    pharmacies,
                    syncedAt,
                    delta: since !== undefined,
                });
            }

            // Fallback path: in-memory bounding box filter
            logger.warn("PostGIS bounds RPC unavailable, falling back to in-memory filter", {
                error: rpcError?.message,
            });

            let query;
            if (since) {
                query = supabase
                    .from("pharmacies")
                    .select(
                        "id, name, address, location, phone_number, is_verified, district, state, status, updated_at, is_active, deleted_at"
                    )
                    .eq("status", "approved")
                    .gt("updated_at", since.toISOString());
            } else {
                query = supabase
                    .from("pharmacies")
                    .select(
                        "id, name, address, location, phone_number, is_verified, district, state, status, updated_at, is_active, deleted_at"
                    )
                    .eq("status", "approved");
            }

            const { data: allPharmacies, error: fetchError } = await query.limit(3000);

            if (fetchError) {
                handleFetchError(fetchError, res);
                return;
            }

            const pharmacies: FormattedPharmacy[] = ((allPharmacies || []) as PharmacyRow[])
                .filter((p: PharmacyRow) => {
                    if (p.status !== "approved") return false;
                    if (!since && p.is_active === false) return false;
                    return true;
                })
                .map((p: PharmacyRow) => {
                    const coords = extractCoordinates(p);
                    const distanceKm = calculateDistanceKM(
                        centerLat,
                        centerLng,
                        coords.lat,
                        coords.lng
                    );
                    return {
                        id: p.id,
                        name: p.name || "Unknown Pharmacy",
                        address: p.address || "Unknown Address",
                        lat: coords.lat,
                        lng: coords.lng,
                        distance: `${distanceKm.toFixed(1)} km`,
                        phone_number: p.phone_number || null,
                        is_verified: p.is_verified ?? false,
                        district: p.district || null,
                        state: p.state || null,
                        updated_at: p.updated_at,
                        is_active: p.is_active,
                        deleted_at: p.deleted_at,
                        coords,
                    };
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

            setGeospatialCacheHeaders(res);
            res.json({
                pharmacies,
                syncedAt,
                delta: since !== undefined,
            });
        } catch (err) {
            next(err);
        }
    }
);
router.post(
    "/bulk-upload",
    requireAuth,
    limiter,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) {
                res.status(401).json({ error: "Unauthorized access" });
                return;
            }

            const { fileContent } = req.body;
            if (!fileContent || typeof fileContent !== "string") {
                res.status(400).json({ error: "No valid file data content provided." });
                return;
            }

            const { data: pharmacy, error: pharmError } = await supabase
                .from("pharmacies")
                .select("id")
                .eq("created_by", req.user.id)
                .maybeSingle();

            if (pharmError || !pharmacy) {
                res.status(404).json({
                    error: "No registered pharmacy found for this authorized user.",
                });
                return;
            }

            const lines = fileContent
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean);
            if (lines.length <= 1) {
                res.status(400).json({ error: "The file appears empty or is missing rows." });
                return;
            }

            if (lines.length > 501) {
                res.status(400).json({
                    error: "Bulk upload exceeds the maximum limit of 500 items per request.",
                });
                return;
            }

            const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
            const rowsToInsert: any[] = [];
            const failedRows: Array<{ row: number; reason: string }> = [];

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i]
                    .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
                    .map((v) => v.replace(/^"|"$/g, "").trim());

                const rowData: Record<string, any> = {};
                headers.forEach((header, index) => {
                    // Safe guard indexing length bounds gracefully
                    const val = values[index];
                    rowData[header] = val === "" || val === undefined ? undefined : val;
                });

                const validationResult = inventoryRowSchema.safeParse(rowData);
                if (!validationResult.success) {
                    const errorMessage = validationResult.error.issues
                        .map((e: { message: string }) => e.message)
                        .join(", ");
                    failedRows.push({ row: i + 1, reason: errorMessage });
                    continue;
                }

                rowsToInsert.push({
                    pharmacy_id: pharmacy.id,
                    medicine_name: validationResult.data.medicine_name,
                    batch_number: validationResult.data.batch_number,
                    expiry_date: validationResult.data.expiry_date,
                    quantity: validationResult.data.quantity,
                    mrp: validationResult.data.mrp,
                });
            }

            let successfulInserts = 0;
            if (rowsToInsert.length > 0) {
                const { error } = await supabase.from("pharmacy_inventory").insert(rowsToInsert);
                if (error) {
                    logger.error(`Database bulk insertion failed: ${error.message}`);
                    res.status(500).json({ error: "Database operation failed during insertion." });
                    return;
                }
                successfulInserts = rowsToInsert.length;
            }

            res.status(200).json({
                totalRows: lines.length - 1,
                successCount: successfulInserts,
                failedCount: failedRows.length,
                errors: failedRows,
            });
        } catch (error: any) {
            logger.error(`Exception in bulk operations handler: ${error.message}`);
            next(error);
        }
    }
);

// ── Pharmacy Mutation Endpoints ──────────────────────────────────────────────

/**
 * Update pharmacy details (PUT /:id)
 */
router.put(
    "/:id",
    requireAuth,
    limiter,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const pharmacyId = req.params.id;

            const { data: pharmacy, error: findError } = await supabase
                .from("pharmacies")
                .select("id, created_by, status")
                .eq("id", pharmacyId)
                .maybeSingle();

            if (findError || !pharmacy) {
                res.status(404).json({ error: "Pharmacy not found" });
                return;
            }

            const isOwner = pharmacy.created_by === req.user!.id;
            const isAdmin = req.user!.role === "admin" || req.user!.role === "moderator";

            if (!isOwner && !isAdmin) {
                res.status(403).json({ error: "You can only update pharmacies you own" });
                return;
            }

            const updateData = req.body;
            // Ensure we don't accidentally update restricted fields unless admin
            delete updateData.id;
            delete updateData.created_by;
            if (!isAdmin) {
                delete updateData.status;
                delete updateData.is_verified;
            }

            const { data: updatedPharmacy, error: updateError } = await supabase
                .from("pharmacies")
                .update(updateData)
                .eq("id", pharmacyId)
                .select()
                .single();

            if (updateError) {
                logger.error(`Pharmacy update failed: ${updateError.message}`);
                res.status(500).json({ error: "Database operation failed during update." });
                return;
            }

            res.status(200).json({ pharmacy: updatedPharmacy });
        } catch (error: any) {
            next(error);
        }
    }
);

/**
 * Soft delete pharmacy (DELETE /:id)
 */
router.delete(
    "/:id",
    requireAuth,
    limiter,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const pharmacyId = req.params.id;

            const { data: pharmacy, error: findError } = await supabase
                .from("pharmacies")
                .select("id, created_by, status")
                .eq("id", pharmacyId)
                .maybeSingle();

            if (findError || !pharmacy) {
                res.status(404).json({ error: "Pharmacy not found" });
                return;
            }

            const isOwner = pharmacy.created_by === req.user!.id;
            const isAdmin = req.user!.role === "admin" || req.user!.role === "moderator";

            if (!isOwner && !isAdmin) {
                res.status(403).json({ error: "You can only delete pharmacies you own" });
                return;
            }

            // Soft delete by updating status
            const { error: deleteError } = await supabase
                .from("pharmacies")
                .update({ status: "rejected" }) // or whatever soft delete status is appropriate
                .eq("id", pharmacyId);

            if (deleteError) {
                logger.error(`Pharmacy delete failed: ${deleteError.message}`);
                res.status(500).json({ error: "Database operation failed during delete." });
                return;
            }

            res.status(200).json({ message: "Pharmacy deleted successfully" });
        } catch (error: any) {
            next(error);
        }
    }
);

/**
 * Inventory Bulk Upload (POST /:id/inventory/upload) using Multer
 */
router.post(
    "/:id/inventory/upload",
    requireAuth,
    limiter,
    upload.single("file"),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const pharmacyId = req.params.id;

            const { data: pharmacy, error: findError } = await supabase
                .from("pharmacies")
                .select("id, created_by, status")
                .eq("id", pharmacyId)
                .maybeSingle();

            if (findError || !pharmacy) {
                res.status(404).json({ error: "Pharmacy not found" });
                return;
            }

            // Ownership check: must be creator OR admin
            const isOwner = pharmacy.created_by === req.user!.id;
            const isAdmin = req.user!.role === "admin" || req.user!.role === "moderator";

            if (!isOwner && !isAdmin) {
                res.status(403).json({
                    error: "You can only upload inventory for pharmacies you own",
                });
                return;
            }

            // Multer file processing
            if (!req.file || !req.file.buffer) {
                res.status(400).json({ error: "No valid file data content provided." });
                return;
            }

            const fileContent = req.file.buffer.toString("utf-8");

            const lines = fileContent
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean);
            if (lines.length <= 1) {
                res.status(400).json({ error: "The file appears empty or is missing rows." });
                return;
            }

            if (lines.length > 501) {
                res.status(400).json({
                    error: "Bulk upload exceeds the maximum limit of 500 items per request.",
                });
                return;
            }

            const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
            const rowsToInsert: any[] = [];
            const failedRows: Array<{ row: number; reason: string }> = [];

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i]
                    .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
                    .map((v) => v.replace(/^"|"$/g, "").trim());

                const rowData: Record<string, any> = {};
                headers.forEach((header, index) => {
                    const val = values[index];
                    rowData[header] = val === "" || val === undefined ? undefined : val;
                });

                const validationResult = inventoryRowSchema.safeParse(rowData);
                if (!validationResult.success) {
                    const errorMessage = validationResult.error.issues
                        .map((e: { message: string }) => e.message)
                        .join(", ");
                    failedRows.push({ row: i + 1, reason: errorMessage });
                    continue;
                }

                rowsToInsert.push({
                    pharmacy_id: pharmacyId,
                    medicine_name: validationResult.data.medicine_name,
                    batch_number: validationResult.data.batch_number,
                    expiry_date: validationResult.data.expiry_date,
                    quantity: validationResult.data.quantity,
                    mrp: validationResult.data.mrp,
                });
            }

            let successfulInserts = 0;
            if (rowsToInsert.length > 0) {
                const { error } = await supabase.from("pharmacy_inventory").insert(rowsToInsert);
                if (error) {
                    logger.error(`Database bulk insertion failed: ${error.message}`);
                    res.status(500).json({ error: "Database operation failed during insertion." });
                    return;
                }
                successfulInserts = rowsToInsert.length;
            }

            res.status(200).json({
                totalRows: lines.length - 1,
                successCount: successfulInserts,
                failedCount: failedRows.length,
                errors: failedRows,
            });
        } catch (error: any) {
            logger.error(`Exception in specific pharmacy upload handler: ${error.message}`);
            next(error);
        }
    }
);

export default router;
