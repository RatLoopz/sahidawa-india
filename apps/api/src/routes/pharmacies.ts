import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabase } from "../db/client";
import { uuidSchema } from "../utils/validation";

import logger from "../utils/logger";
import { limiter } from "../middleware/rateLimit";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { redisCache } from "../middleware/redisCache";
import { cacheMiddleware } from "../middleware/cache";
import multer from "multer";
import { buildOrConditions } from "../utils/db";
import Papa from "papaparse";
import { Readable } from "stream";
import {
    MAX_BULK_UPLOAD_ITEMS,
    MAX_BULK_UPLOAD_FILE_SIZE_BYTES,
    PHARMACY_SEARCH_RADIUS_DEFAULT_KM,
    PHARMACY_SEARCH_RADIUS_MIN_KM,
    PHARMACY_SEARCH_RADIUS_MAX_KM,
} from "@sahidawa/shared";
import { pharmacyService } from "../services/pharmacy.service";
import { FormattedPharmacy, PharmacyRpcResult } from "../types/pharmacy.types";

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BULK_UPLOAD_FILE_SIZE_BYTES },
});

const router = Router();

// ── Constants ────────────────────────────────────────────────────────────────

/** Maximum number of pharmacies returned per request */
const MAX_RESULTS = 200;
const BATCH_SIZE = 500;

const validateInventoryUploadSize = (req: Request, res: Response, next: NextFunction) => {
    const contentLengthHeader = req.headers["content-length"];
    const contentLength = Array.isArray(contentLengthHeader)
        ? contentLengthHeader[0]
        : contentLengthHeader;

    if (!contentLength) {
        res.status(411).json({
            error: "Content-Length header required",
        });
        return;
    }

    const size = Number.parseInt(contentLength, 10);

    if (Number.isNaN(size) || size > MAX_BULK_UPLOAD_FILE_SIZE_BYTES) {
        res.status(413).json({
            error: `File size exceeds maximum allowed size of ${MAX_BULK_UPLOAD_FILE_SIZE_BYTES / 1024 / 1024}MB`,
            maxSize: MAX_BULK_UPLOAD_FILE_SIZE_BYTES,
            providedSize: size,
        });
        return;
    }

    next();
};

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
    operating_hours?: string | null;
    timezone?: string | null;
}

/** Internal type used during sorting (includes raw numeric distance) */
interface PharmacyWithRawDistance extends FormattedPharmacy {
    rawDistance: number;
}
interface InventoryInsertRow {
    pharmacy_id: string;
    medicine_name: string;
    batch_number: string;
    expiry_date: string;
    quantity: number;
    mrp: number;
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
// Zod schema for validating pharmacy update payloads (PUT /:id)
// Mirrors registerPharmacySchema but all fields optional, since a client
// may only send the fields they want to change.
const updatePharmacySchema = z
    .object({
        name: z.string().min(2).optional(),
        licenseId: z.string().min(3).optional(),
        address: z.string().min(5).optional(),
        district: z.string().min(2).optional(),
        state: z.string().min(2).optional(),
        phone_number: z
            .string()
            .regex(/^\+?[\d\s\-()]{7,15}$/)
            .optional(),
        lat: z.number().min(-90).max(90).optional(),
        lng: z.number().min(-180).max(180).optional(),
    })
    .strict(); // reject unknown keys outright, don't silently drop them

// Admin-only fields — validated and merged in separately, never from a
// non-admin request body.
const adminOnlyPharmacyFieldsSchema = z
    .object({
        status: z.enum(["pending", "approved", "rejected"]).optional(),
        is_verified: z.boolean().optional(),
    })
    .strict();

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

// Reusable incremental CSV parsing helper using PapaParse step mode
async function parseCsvIncremental(
    fileInput: string | NodeJS.ReadableStream,
    pharmacyId: string,
    onProgress?: (stats: {
        successfulInserts: number;
        totalRows: number;
        failedRows: number;
    }) => void
) {
    return new Promise<{
        successfulInserts: number;
        failedRows: Array<{ row: number; reason: string }>;
        totalRows: number;
        error?: string;
    }>((resolve) => {
        let rowsToInsert: any[] = [];
        const failedRows: Array<{ row: number; reason: string }> = [];
        // csvRecordPos: increments for every row (including empty) — used for logical row numbering
        let csvRecordPos = 0;
        // nonEmptyDataRows: increments only for non-empty rows — used for totalRows and the row limit
        let nonEmptyDataRows = 0;
        let successfulInserts = 0;
        let isDone = false;

        const finishWithError = (errMsg: string, parser: any) => {
            if (isDone) return;
            isDone = true;
            if (parser) parser.abort();
            resolve({ successfulInserts, failedRows, totalRows: nonEmptyDataRows, error: errMsg });
        };

        Papa.parse<Record<string, string>>(fileInput as any, {
            header: true,
            // Do NOT skip empty lines so we can count them for correct row numbers
            skipEmptyLines: false,
            transformHeader: (h) => h.trim().toLowerCase(),
            transform: (v) => v.trim(),
            step: (results, parser) => {
                if (isDone) return;

                const rowData = results.data;
                const errors = results.errors;
                csvRecordPos++;
                const logicalRow = csvRecordPos + 1; // +1 to account for header line (row 1)

                // Detect an entirely empty record (all fields empty strings or undefined)
                const allEmpty = Object.values(rowData).every((v) => v === "" || v === undefined);
                if (allEmpty) {
                    // Advance position counter only; do not count toward data rows
                    return;
                }

                // Non-empty row: count it regardless of validity
                nonEmptyDataRows++;

                if (nonEmptyDataRows > MAX_BULK_UPLOAD_ITEMS) {
                    finishWithError(
                        `Bulk upload exceeds the maximum limit of ${MAX_BULK_UPLOAD_ITEMS} items per request.`,
                        parser
                    );
                    return;
                }

                if (errors && errors.length > 0) {
                    const reason = errors.map((e) => e.message).join(", ");
                    failedRows.push({ row: logicalRow, reason });
                    return;
                }

                // Normalise empty strings to undefined for Zod optional fields
                const normalised: Record<string, any> = {};
                for (const key of Object.keys(rowData)) {
                    const val = rowData[key];
                    normalised[key] = val === "" ? undefined : val;
                }

                const validationResult = inventoryRowSchema.safeParse(normalised);
                if (!validationResult.success) {
                    const reason = validationResult.error.issues.map((i) => i.message).join(", ");
                    failedRows.push({ row: logicalRow, reason });
                    return;
                }

                rowsToInsert.push({
                    pharmacy_id: pharmacyId,
                    medicine_name: validationResult.data.medicine_name,
                    batch_number: validationResult.data.batch_number,
                    expiry_date: validationResult.data.expiry_date,
                    quantity: validationResult.data.quantity,
                    mrp: validationResult.data.mrp,
                });

                if (rowsToInsert.length >= BATCH_SIZE) {
                    parser.pause();
                    const batch = [...rowsToInsert];
                    rowsToInsert = []; // Free up heap memory

                    Promise.resolve(supabase.from("pharmacy_inventory").insert(batch))
                        .then(({ error }) => {
                            if (error) {
                                logger.error(`Database bulk insertion failed: ${error.message}`);
                                finishWithError(
                                    "Database operation failed during insertion.",
                                    parser
                                );
                            } else {
                                successfulInserts += batch.length;
                                if (onProgress) {
                                    onProgress({
                                        successfulInserts,
                                        totalRows: nonEmptyDataRows,
                                        failedRows: failedRows.length,
                                    });
                                }
                                if (!isDone) parser.resume();
                            }
                        })
                        .catch((err: any) => {
                            logger.error(
                                `Database bulk insertion error: ${err instanceof Error ? err.message : String(err)}`
                            );
                            finishWithError("Database operation failed during insertion.", parser);
                        });
                }
            },
            complete: () => {
                if (isDone) return;

                if (rowsToInsert.length > 0) {
                    Promise.resolve(supabase.from("pharmacy_inventory").insert(rowsToInsert))
                        .then(({ error }) => {
                            if (isDone) return;
                            isDone = true;
                            if (error) {
                                logger.error(`Database bulk insertion failed: ${error.message}`);
                                resolve({
                                    successfulInserts,
                                    failedRows,
                                    totalRows: nonEmptyDataRows,
                                    error: "Database operation failed during insertion.",
                                });
                            } else {
                                successfulInserts += rowsToInsert.length;
                                resolve({
                                    successfulInserts,
                                    failedRows,
                                    totalRows: nonEmptyDataRows,
                                });
                            }
                        })
                        .catch((err: any) => {
                            if (isDone) return;
                            isDone = true;
                            logger.error(
                                `Database bulk insertion error: ${err instanceof Error ? err.message : String(err)}`
                            );
                            resolve({
                                successfulInserts,
                                failedRows,
                                totalRows: nonEmptyDataRows,
                                error: "Database operation failed during insertion.",
                            });
                        });
                } else {
                    isDone = true;
                    resolve({ successfulInserts, failedRows, totalRows: nonEmptyDataRows });
                }
            },
            error: (err, parser) => {
                const errMsg = err instanceof Error ? err.message : String(err);
                finishWithError(errMsg || "CSV Parsing error", parser);
            },
        });
    });
}
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
        try {
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

            const pharmacy = await pharmacyService.registerPharmacy(parsed.data, req.user.id);
            res.status(201).json({ pharmacy });
        } catch (err: any) {
            if (err.status) {
                res.status(err.status).json({ error: err.message });
                return;
            }
            next(err);
        }
    }
);

const nearestQuerySchema = z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    radius: z.coerce
        .number()
        .min(PHARMACY_SEARCH_RADIUS_MIN_KM)
        .max(PHARMACY_SEARCH_RADIUS_MAX_KM)
        .default(PHARMACY_SEARCH_RADIUS_DEFAULT_KM),
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
        operating_hours: p.operating_hours ?? null,
        timezone: p.timezone ?? null,
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
    cacheMiddleware(300, 600),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const rawQuery = (req.query.q as string | undefined)?.trim() ?? "";

            if (rawQuery.length < 2) {
                res.status(400).json({
                    error: "Query parameter 'q' must be at least 2 characters long",
                });
                return;
            }

            const result = await pharmacyService.searchByMedicine(rawQuery);
            res.json(result);
        } catch (err: any) {
            if (err.status) {
                res.status(err.status).json({ error: err.message });
                return;
            }
            logger.error("Pharmacy medicine search failed", { error: err.message });
            res.status(500).json({ error: "Database query failed" });
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
        const radius = Number(req.query.radius ?? PHARMACY_SEARCH_RADIUS_DEFAULT_KM);

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
            const data = await pharmacyService.getNearest(lat, lng, radius);
            res.json(data);
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

            const data = await pharmacyService.getInBounds(result.data);
            res.setHeader(
                "Cache-Control",
                "public, max-age=60, s-maxage=300, stale-while-revalidate=86400"
            );
            res.json(data);
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

            const result = await pharmacyService.bulkUploadByUser(req.user.id, fileContent);
            res.status(200).json(result);
        } catch (err: any) {
            if (err.status) {
                res.status(err.status).json({ error: err.message });
                return;
            }
            logger.error(`Exception in bulk operations handler: ${err.message}`);
            next(err);
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
        const parsedId = uuidSchema.safeParse(req.params.id);
        if (!parsedId.success) {
            res.status(400).json({ error: "Invalid UUID format" });
            return;
        }
        try {
            const pharmacyId = String(req.params.id);
            const pharmacy = await pharmacyService.updatePharmacy(
                pharmacyId,
                req.user!.id,
                req.user!.role,
                req.body
            );
            res.status(200).json({ pharmacy });
        } catch (err: any) {
            if (err.status) {
                res.status(err.status).json({ error: err.message });
                return;
            }
            next(err);
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
        const parsedId = uuidSchema.safeParse(req.params.id);
        if (!parsedId.success) {
            res.status(400).json({ error: "Invalid UUID format" });
            return;
        }
        try {
            const pharmacyId = String(req.params.id);
            await pharmacyService.deletePharmacy(pharmacyId, req.user!.id, req.user!.role);
            res.status(200).json({ message: "Pharmacy deleted successfully" });
        } catch (err: any) {
            if (err.status) {
                res.status(err.status).json({ error: err.message });
                return;
            }
            next(err);
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
            if (!req.file || !req.file.buffer) {
                res.status(400).json({ error: "No valid file data content provided." });
                return;
            }

            const pharmacyId = String(req.params.id);
            const fileContent = req.file.buffer.toString("utf-8");
            const result = await pharmacyService.uploadInventoryForPharmacy(
                pharmacyId,
                req.user!.id,
                req.user!.role,
                fileContent
            );
            res.status(200).json(result);
        } catch (err: any) {
            if (err.status) {
                res.status(err.status).json({ error: err.message });
                return;
            }
            logger.error(`Exception in specific pharmacy upload handler: ${err.message}`);
            next(err);
        }
    }
);

export default router;
