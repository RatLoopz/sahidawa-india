import { Router, Request, Response } from "express";
import { z } from "zod";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import logger from "../utils/logger";
import { getMlServiceUrl, MISSING_ML_SERVICE_URL_MESSAGE } from "../config/mlService";
import {
    MULTER_SCAN_FILE_SIZE_CUTOFF_BYTES,
    validateUploadSize,
} from "../middleware/uploadSizeValidator";
import { uploadRateLimiter } from "../middleware/uploadRateLimit";
import { scanQueryLimiter } from "../middleware/rateLimit";
import { redisClient } from "../utils/redis";
import { supabase } from "../db/client";

import { optionalAuth } from "../middleware/auth";
import { escapeIlike, escapePostgrest, buildOrConditions } from "../utils/db";
import { scanService } from "../services/scan.service";

const router = Router();

// ── Allowed image MIME types ─────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/bmp",
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "audio/aac",
]);

const UPLOAD_DIR = path.join(__dirname, "../../temp-uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true, mode: 0o700 });
} else {
    // mode only applies on creation — enforce on every boot in case the
    // directory already existed with looser permissions from a prior run
    fs.chmodSync(UPLOAD_DIR, 0o700);
}

// Security: reject non-image uploads before they reach the ML container
const upload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => {
            cb(null, UPLOAD_DIR);
        },
        filename: (_req, file, cb) => {
            const uniqueName = `${crypto.randomUUID()}-${Date.now()}${path.extname(file.originalname)}`;
            cb(null, uniqueName);
        },
    }),
    limits: { fileSize: MULTER_SCAN_FILE_SIZE_CUTOFF_BYTES },
    fileFilter(_req, file, cb) {
        if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
            cb(null, true);
        } else {
            // Pass error — multer will forward it to our error handler below
            cb(
                Object.assign(
                    new Error(
                        `Invalid file type "${file.mimetype}". Only supported image and audio formats are accepted.`
                    ),
                    { code: "INVALID_MIME" }
                )
            );
        }
    },
});

/**
 * @openapi
 * /api/v1/scan/extract:
 *   post:
 *     tags:
 *       - Medicine Scanner
 *     summary: Extract medicine text from a packaging photo via OCR
 *     description: >
 *       Accepts a medicine packaging image (JPEG, PNG, WEBP, GIF, BMP — max 10MB),
 *       proxies it to the FastAPI ML OCR microservice, performs fuzzy brand/generic
 *       name matching against the CDSCO medicines database, and returns parsed fields
 *       (batch number, expiry date, brand name) alongside the full medicine record if matched.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Medicine packaging image (JPEG/PNG/WEBP/GIF/BMP, max 10MB)
 *     responses:
 *       200:
 *         description: OCR extraction successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 text:
 *                   type: string
 *                   example: "Dolo 650 Batch No. BN2024001 Exp 12/2026"
 *                 confidence:
 *                   type: number
 *                   example: 0.94
 *                 filename:
 *                   type: string
 *                   example: "medicine.jpg"
 *                 parsed:
 *                   type: object
 *                   properties:
 *                     batch:
 *                       type: string
 *                       example: "BN2024001"
 *                     expiry:
 *                       type: string
 *                       example: "2026-12-01"
 *                     brandName:
 *                       type: string
 *                       example: "Dolo 650"
 *                 medicine:
 *                   $ref: '#/components/schemas/Medicine'
 *                 matched:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Invalid or missing image file
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       503:
 *         description: ML OCR service unavailable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "OCR service is currently unavailable. Please verify manually."
 *                 details:
 *                   type: string
 */
router.post("/extract", uploadRateLimiter, validateUploadSize, (req: Request, res: Response) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (upload.single("file") as any)(req, res, async (multerErr: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const file: Express.Multer.File | undefined = (req as any).file;

        // Capture the path FIRST, before checking multerErr — multer's disk
        // storage engine may have already written the file even when an error
        // (e.g. a fileFilter rejection or size-limit) is reported afterward.
        // Security: path.basename + path.join still guards against traversal (CodeQL).
        const tempFilePath: string | undefined = file?.filename
            ? path.join(UPLOAD_DIR, path.basename(file.filename))
            : undefined;

        const cleanupTempFile = () => {
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                try {
                    fs.unlinkSync(tempFilePath);
                    logger.info(`Cleaned up temp file: ${tempFilePath}`);
                } catch (err) {
                    logger.error(`Failed to delete temp file ${tempFilePath}:`, err);
                }
            }
        };

        // Guarantees cleanup on every response outcome — success, thrown error,
        // or the client disconnecting before a response is ever sent.
        res.on("finish", cleanupTempFile);
        res.on("close", cleanupTempFile);

        if (multerErr) {
            const msg = multerErr instanceof Error ? multerErr.message : "File upload error";
            logger.warn(`File upload rejected: ${msg}`);
            res.status(400).json({ error: msg });
            return;
        }

        if (!file || !file.filename) {
            res.status(400).json({ error: "No image file provided." });
            return;
        }

        if (!tempFilePath) {
            // Should be unreachable given the check above, but keeps TS's
            // narrowing happy and guards against a future refactor breaking the invariant
            logger.error("tempFilePath unexpectedly undefined after file validation");
            res.status(500).json({ error: "Internal upload error" });
            return;
        }

        const mlServiceUrl = getMlServiceUrl();
        if (!mlServiceUrl) {
            logger.error(MISSING_ML_SERVICE_URL_MESSAGE, { route: "/api/v1/scan/extract" });

            res.status(500).json({
                error: "OCR service is not configured.",
                code: "ML_SERVICE_URL_MISSING",
            });
            return;
        }

        const targetUrl = `${mlServiceUrl}/ocr/extract`;

        logger.info(
            `Proxying image "${file.originalname}" (${file.size} bytes, ${file.mimetype}) → ${targetUrl}`
        );

        try {
            const fileBuffer = await fs.promises.readFile(tempFilePath);
            const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
            const cacheKey = `ocr_extract:${fileHash}`;

            let data: { text?: string; confidence?: number; filename?: string } | null = null;

            try {
                if (redisClient.isOpen) {
                    const cached = await redisClient.get(cacheKey);
                    if (cached) {
                        data = JSON.parse(cached);
                        logger.info(`OCR Cache HIT for image hash ${fileHash}`);
                    }
                }
            } catch (cacheErr) {
                logger.error(`Redis cache check error: ${cacheErr}`);
            }

            if (!data) {
                const formData = new FormData();
                const blob = new Blob([fileBuffer], {
                    type: file.mimetype,
                });
                formData.append("file", blob, file.originalname);

                const response = await fetch(targetUrl, {
                    method: "POST",
                    body: formData,
                    signal: AbortSignal.timeout(30_000), // 30 s hard timeout
                });

                if (!response.ok) {
                    let errorDetail = `ML service returned HTTP ${response.status}`;
                    try {
                        const body = (await response.json()) as { detail?: string };
                        if (body.detail) errorDetail = body.detail;
                    } catch {
                        // Non-JSON body — keep generic message
                    }
                    logger.error(`ML OCR error: ${errorDetail}`);
                    res.status(response.status).json({ error: errorDetail });
                    return;
                }

                data = (await response.json()) as {
                    text?: string;
                    confidence?: number;
                    filename?: string;
                };

                try {
                    if (redisClient.isOpen) {
                        // Cache the ML response for 24 hours (86400 seconds)
                        await redisClient.set(cacheKey, JSON.stringify(data), { EX: 86400 });
                        logger.info(`OCR Cache SET for image hash ${fileHash}`);
                    }
                } catch (cacheErr) {
                    logger.error(`Redis cache set error: ${cacheErr}`);
                }
            }
            logger.info(`OCR extraction successful for "${file.originalname}"`);

            const rawText = data.text || "";
            const confidence = data.confidence ?? 0;

            const {
                parsedBatch,
                parsedExpiry,
                matchedName,
                matchScore,
                matchSource,
                medicineResponse,
            } = await scanService.matchMedicineFromOcrText(rawText, mlServiceUrl);

            res.status(200).json({
                text: rawText,
                confidence: confidence,
                filename: data.filename || file.originalname,
                parsed: {
                    batch: parsedBatch,
                    expiry: parsedExpiry,
                    brandName: medicineResponse?.brand_name || matchedName,
                },
                medicine: medicineResponse,
                matched: !!medicineResponse,
                matchScore: matchedName ? matchScore : null,
                matchSource: matchedName ? matchSource : null,
            });
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "Unknown error";
            logger.error(`Could not reach ML OCR service: ${msg}`);
            res.status(503).json({
                error: "OCR service is currently unavailable. Please verify manually.",
                details: msg,
            });
        }
    });
});

// ── Fuzzy Brand Matching & Verification Helper ────────────────────────────────

/**
 * @openapi
 * /api/v1/scan/match:
 *   post:
 *     tags:
 *       - Medicine Scanner
 *     summary: Fuzzy match a medicine brand or generic name
 *     description: Matches a query name against valid medicine names in the database using Levenshtein distance.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *     responses:
 *       200:
 *         description: Match suggestions found
 */
router.post("/match", scanQueryLimiter, async (req: Request, res: Response) => {
    const matchSchema = z.object({ query: z.string() }).strict();
    const parsed = matchSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            error: "query parameter is required and must be a string or unknown fields present",
        });
        return;
    }
    const { query } = parsed.data;

    const normalizedQuery = query.trim().toLowerCase();
    const cacheKey = `match_cache:${normalizedQuery}`;

    try {
        if (redisClient.isOpen) {
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                logger.info(`Cache HIT for match query: "${query}"`);
                res.status(200).json(JSON.parse(cached));
                return;
            }
        }
    } catch (cacheErr) {
        logger.error(`Redis error reading cache for match query: ${cacheErr}`);
    }

    try {
        const { data, error } = await supabase.rpc("search_medicines_text", {
            query_text: query,
            match_count: 3,
        });

        if (error) {
            logger.error(`Database error during match: ${error.message}`);
            res.status(500).json({ error: "Database query failed" });
            return;
        }

        if (!data || data.length === 0) {
            const words = query
                .trim()
                .split(/\s+/)
                .filter((w: string) => w.length > 2);
            if (words.length > 1) {
                const orConditions = buildOrConditions(["brand_name", "generic_name"], words);

                const { data: fallback } = await supabase
                    .from("medicines")
                    .select("brand_name, generic_name")
                    .or(orConditions)
                    .limit(3);
                if (fallback && fallback.length > 0) {
                    const fallbackResult = fallback.map(
                        (m: { brand_name: string | null; generic_name: string }) => ({
                            name: m.brand_name || m.generic_name,
                            score: 60,
                        })
                    );

                    try {
                        if (redisClient.isOpen)
                            await redisClient.set(cacheKey, JSON.stringify(fallbackResult), {
                                EX: 3600,
                            });
                    } catch (err) {
                        /* ignore */
                    }

                    res.status(200).json(fallbackResult);
                    return;
                }
            }

            try {
                if (redisClient.isOpen)
                    await redisClient.set(cacheKey, JSON.stringify([]), { EX: 3600 });
            } catch (err) {
                /* ignore */
            }

            res.status(200).json([]);
            return;
        }

        const matches = data.map(
            (medicine: {
                brand_name: string | null;
                generic_name: string;
                similarity: number | null;
            }) => ({
                name: medicine.brand_name || medicine.generic_name,
                score: Math.round((medicine.similarity ?? 0) * 100),
            })
        );

        try {
            if (redisClient.isOpen)
                await redisClient.set(cacheKey, JSON.stringify(matches), { EX: 3600 });
        } catch (err) {
            /* ignore */
        }

        res.status(200).json(matches);
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        logger.error(`Error during fuzzyMatchBrand: ${msg}`);
        res.status(500).json({ error: "Fuzzy matching failed", details: msg });
    }
});

/**
 * @openapi
 * /api/v1/scan/verify-brand:
 *   post:
 *     tags:
 *       - Medicine Scanner
 *     summary: Verify a medicine by brand name
 *     description: Looks up a medicine by its brand name with exact or substring matching.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - brandName
 *             properties:
 *               brandName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Medicine verified successfully
 */
router.post("/verify-brand", scanQueryLimiter, async (req: Request, res: Response) => {
    const MAX_BRAND_NAME_LENGTH = 200;
    const brandSchema = z.object({ brandName: z.string().max(MAX_BRAND_NAME_LENGTH) }).strict();
    const parsed = brandSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            error: `brandName must be a valid string (max ${MAX_BRAND_NAME_LENGTH} chars) and no unknown fields allowed`,
        });
        return;
    }
    const { brandName } = parsed.data;
    const normalizedBrand = brandName.trim().toLowerCase();
    const cacheKey = `brand_cache:${normalizedBrand}`;

    try {
        if (redisClient.isOpen) {
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                logger.info(`Cache HIT for verify-brand: "${brandName}"`);
                res.status(200).json(JSON.parse(cached));
                return;
            }
        }
    } catch (cacheErr) {
        logger.error(`Redis error reading cache for verify-brand: ${cacheErr}`);
    }

    try {
        const { data, error } = await supabase
            .from("medicines")
            .select(
                "id, brand_name, generic_name, manufacturer, batch_number, expiry_date, cdsco_approval_status, is_counterfeit_alert, is_cdsco_verified, cdsco_match_score, matched_cdsco_product, matched_cdsco_manufacturer, product_match_score, manufacturer_match_score"
            )
            .or(
                `brand_name.ilike."%${escapePostgrest(brandName)}%",generic_name.ilike."%${escapePostgrest(brandName)}%"`
            )
            .limit(1)
            .maybeSingle();

        if (error) {
            logger.error(`Database lookup error for verify-brand: ${error.message}`);
            res.status(500).json({
                verified: false,
                message: "Database lookup failed",
            });
            return;
        }

        if (!data) {
            res.status(404).json({
                verified: false,
                message: "Medicine not found",
            });
            return;
        }

        const responseData = {
            verified: true,
            medicine: {
                id: data.id,
                brand_name: data.brand_name,
                generic_name: data.generic_name,
                manufacturer: data.manufacturer,
                batch_number: data.batch_number,
                expiry_date: data.expiry_date,
                cdsco_approval_status: data.cdsco_approval_status,
                is_counterfeit_alert: data.is_counterfeit_alert,
                is_cdsco_verified: data.is_cdsco_verified,
                cdsco_match_score: data.cdsco_match_score,
                matched_cdsco_product: data.matched_cdsco_product,
                matched_cdsco_manufacturer: data.matched_cdsco_manufacturer,
                product_match_score: data.product_match_score,
                manufacturer_match_score: data.manufacturer_match_score,
            },
        };

        try {
            if (redisClient.isOpen)
                await redisClient.set(cacheKey, JSON.stringify(responseData), { EX: 86400 }); // 24 hours
        } catch (err) {
            /* ignore */
        }

        res.status(200).json(responseData);
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        logger.error(`Error during verify-brand: ${msg}`);
        res.status(500).json({
            verified: false,
            message: "Server error during brand verification",
        });
    }
});
import { idempotencyMiddleware } from "../middleware/idempotency";
import { resolveConflict, InvalidClientTimestampError } from "../utils/conflictResolution";

router.post(
    "/submit",
    optionalAuth,
    uploadRateLimiter,
    validateUploadSize,
    upload.fields([{ name: "image" }, { name: "voice" }]),
    idempotencyMiddleware,
    async (req: Request, res: Response) => {
        const idempotencyKey = (req as any).idempotencyKey;
        const submitSchema = z
            .object({
                deviceId: z.string().optional(),
                clientUpdatedAt: z
                    .string()
                    .trim()
                    .min(1, "clientUpdatedAt is required")
                    .regex(
                        /^\d+$/,
                        "clientUpdatedAt must be a numeric timestamp string (milliseconds since epoch)"
                    ),
                metadata: z.string().optional(),
            })
            .strict();

        const parsedBody = submitSchema.safeParse(req.body);
        if (!parsedBody.success) {
            res.status(400).json({
                error: "Invalid form data or unknown fields",
                details: parsedBody.error,
            });
            return;
        }

        const { deviceId, clientUpdatedAt } = parsedBody.data;
        let metadata = null;
        if (parsedBody.data.metadata) {
            try {
                metadata = JSON.parse(parsedBody.data.metadata, (key, value) => {
                    if (key === "__proto__" || key === "constructor" || key === "prototype") {
                        return undefined;
                    }
                    return value;
                });
            } catch (e) {
                // Ignore parse errors
            }
        }

        // Use a generated scanId from metadata or fallback to a new one
        const scanId = metadata?.id || crypto.randomUUID();

        try {
            // Note: we require a user to be authenticated in a real app, assuming auth.uid() is available
            const userId = (req as any).user?.id || (req as any).session?.user?.id;
            if (!userId && process.env.NODE_ENV === "production") {
                res.status(401).json({ error: "Authentication is required to submit scan data" });
                return;
            }

            const resolvedScanId = await resolveConflict({
                scanId,
                metadata,
                deviceId: deviceId ?? "",
                clientUpdatedAt,
                userId,
            });

            const parts: Record<string, "synced" | "failed" | "skipped"> = {};

            // metadata part
            parts.metadata = metadata ? "synced" : "skipped";

            // image part (stubbed for Cloudinary/external upload)
            const imageFile = (req.files as any)?.image?.[0];
            if (imageFile) {
                try {
                    // await uploadToCloudinary(imageFile.buffer, resolvedScanId);
                    parts.image = "synced";
                } catch {
                    parts.image = "failed";
                }
            } else {
                parts.image = "skipped";
            }

            // voice part (stubbed for Whisper/external transcribe)
            const voiceFile = (req.files as any)?.voice?.[0];
            if (voiceFile) {
                try {
                    // await transcribeVoice(voiceFile.buffer, resolvedScanId);
                    parts.voice = "synced";
                } catch {
                    parts.voice = "failed";
                }
            } else {
                parts.voice = "skipped";
            }

            // record parts status
            const rows = Object.entries(parts).map(([part_type, status]) => ({
                scan_id: resolvedScanId,
                part_type,
                status,
            }));
            await supabase
                .from("scan_submission_parts")
                .upsert(rows, { onConflict: "scan_id,part_type" });

            const result = { scanId: resolvedScanId, parts };

            if (redisClient.isOpen) {
                await redisClient.set(`idem:${idempotencyKey}`, JSON.stringify(result), {
                    EX: 60 * 60 * 24, // 24h
                });
            }

            const { error: idemUpdateError } = await supabase
                .from("submission_idempotency")
                .update({ scan_id: resolvedScanId })
                .eq("idempotency_key", idempotencyKey);

            if (idemUpdateError) {
                logger.error("Failed to persist idempotency record", {
                    error: idemUpdateError,
                    idempotencyKey,
                    scanId: resolvedScanId,
                });
            }

            res.status(200).json(result);
        } catch (err) {
            if (err instanceof InvalidClientTimestampError) {
                res.status(400).json({ error: err.message });
                return;
            }
            logger.error(
                `Error during offline scan submit: ${err instanceof Error ? err.message : err}`
            );

            if (idempotencyKey) {
                try {
                    await supabase
                        .from("submission_idempotency")
                        .delete()
                        .eq("idempotency_key", idempotencyKey);
                } catch {
                    /* best-effort cleanup; ignore secondary failures */
                }
            }

            res.status(500).json({ error: "Server error during scan submission" });
        }
    }
);

export default router;
