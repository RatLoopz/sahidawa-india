import { Router, Request, Response } from "express";
import { z } from "zod";
import { supabase } from "../db/client";
import { verifyLimiter } from "../middleware/rateLimit";
import { optionalAuth } from "../middleware/auth";
import logger from "../utils/logger";
import { lookupDrugByBatch, ServiceUnavailableError } from "../services/drugLookup.service";
import { escapeIlike } from "../utils/db";
import { isAllowedOrigin } from "../utils/originCheck";
import { medicineNameNormalizer } from "../utils/medicineNameNormalizer";

function getBatchStatus(recallStatus: string | null | undefined): "safe" | "recalled" | "unknown" {
    if (!recallStatus || recallStatus === "none") return "safe";
    if (recallStatus === "recalled") return "recalled";
    return "unknown";
}

function maskClientIp(ip: string | undefined): string | null {
    if (!ip) return null;

    // Express behind proxies sometimes gives ::ffff:x.x.x.x
    const normalized = ip.replace(/^::ffff:/, "");

    // IPv4
    if (normalized.includes(".")) {
        const parts = normalized.split(".");
        if (parts.length === 4) {
            parts[3] = "0";
            return parts.join(".");
        }
    }

    // IPv6
    if (normalized.includes(":")) {
        const parts = normalized.split(":");
        return parts.slice(0, 4).concat(["0000", "0000", "0000", "0000"]).join(":");
    }

    return null;
}

const router = Router();

const verifySchema = z
    .object({
        batchNumber: z
            .string({ message: "batchNumber is required and must be a string" })
            .min(3, "batchNumber must be at least 3 characters long"),
        brandName: z.string().optional(),
        barcodeId: z.string().optional(),
        latitude: z
            .number()
            .min(-90, "Latitude must be between -90 and 90")
            .max(90, "Latitude must be between -90 and 90")
            .optional(),
        longitude: z
            .number()
            .min(-180, "Longitude must be between -180 and 180")
            .max(180, "Longitude must be between -180 and 180")
            .optional(),
    })
    .refine((data) => data.brandName || data.barcodeId, {
        message: "Either brandName or barcodeId must be provided",
        path: ["brandName", "barcodeId"],
    });

/**
 * @openapi
 * /api/verify:
 *   post:
 *     tags:
 *       - Medicine Verification
 *     summary: Verify a medicine by batch number
 *     description: >
 *       Looks up a medicine in the CDSCO database using its batch number.
 *       Returns full medicine details including approval status and counterfeit alert flag.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - batchNumber
 *             properties:
 *               batchNumber:
 *                 type: string
 *                 minLength: 3
 *                 example: "BN2024001"
 *                 description: The batch number printed on the medicine packaging
 *               latitude:
 *                 type: number
 *                 format: float
 *                 example: 23.0355
 *                 description: Optional latitude of the scanner device when available
 *               longitude:
 *                 type: number
 *                 format: float
 *                 example: 72.5116
 *                 description: Optional longitude of the scanner device when available
 *     responses:
 *       200:
 *         description: Medicine found and verified
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 verified:
 *                   type: boolean
 *                   example: true
 *                 medicine:
 *                   $ref: '#/components/schemas/Medicine'
 *                 scanMeta:
 *                   type: object
 *                   properties:
 *                     recentScanCount24h:
 *                       type: integer
 *                       example: 3
 *                     recentScanCount7d:
 *                       type: integer
 *                       example: 12
 *                     suspicious:
 *                       type: boolean
 *                       example: true
 *                     suspicionReasons:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example:
 *                         - "This batch has been scanned multiple times in the last 24 hours."
 *       400:
 *         description: Invalid request body
 *         content:
 *             application/json:
 *               schema:
 *                 $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Medicine not found in database
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 verified:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Medicine not found"
 *       503:
 *         description: Both Redis and Supabase are unreachable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 verified:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "errors.serviceUnavailable"
 *                     message:
 *                       type: string
 *                       example: "Service temporarily unavailable. Please try again later."
 *       500:
 *         description: Database lookup failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 verified:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Database lookup failed"
 */
router.post(
    "/",
    optionalAuth,
    verifyLimiter,
    (req: Request, res: Response, next) => {
        if (!isAllowedOrigin(req)) {
            res.status(403).json({ error: "Access denied: unrecognized origin" });
            return;
        }
        next();
    },
    async (req: Request, res: Response) => {
        const parsed = verifySchema.safeParse(req.body);

        if (!parsed.success) {
            res.status(400).json({
                error: "Invalid request body",
                details: parsed.error.issues,
            });
            return;
        }

        const { batchNumber, brandName, barcodeId, latitude, longitude } = parsed.data;

        // Normalize medicine name from OCR or user input to improve search accuracy
        const normalizedBrandName = brandName
            ? medicineNameNormalizer.normalize(brandName).normalized
            : undefined;

        const upperBatch = batchNumber.toUpperCase();
        const ALLOWED_MOCK_BATCHES = new Set([
            "DOLO 650",
            "DOLO-650",
            "MOCK-DOLO-650",
            "BN2024001",
            "AUG625D",
        ]);

        if (
            process.env.NODE_ENV !== "production" &&
            process.env.VERIFY_ENABLE_MOCKS === "true" &&
            ALLOWED_MOCK_BATCHES.has(upperBatch)
        ) {
            const brandName = upperBatch.includes("DOLO")
                ? "Dolo 650"
                : upperBatch === "AUG625D"
                  ? "Augmentin 625"
                  : "Mock Medicine";
            const genericName = upperBatch.includes("DOLO")
                ? "Paracetamol"
                : upperBatch === "AUG625D"
                  ? "Amoxicillin + Clavulanic Acid"
                  : "Mock Generic";

            const mockMedicine = {
                id: "mock-id-dolo",
                barcode_id: "8901148220042",
                brand_name: brandName,
                generic_name: genericName,
                manufacturer: "Micro Labs Ltd",
                batch_number: upperBatch,
                expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 2).toISOString(),
                cdsco_approval_status: "approved",
                is_counterfeit_alert: false,
                is_cdsco_verified: true,
                cdsco_match_score: 100,
                matched_cdsco_product: brandName,
                matched_cdsco_manufacturer: "Micro Labs Ltd",
                product_match_score: 100,
                manufacturer_match_score: 100,
            };
            res.status(200).json({
                verified: true,
                medicine: mockMedicine,
                scanMeta: {
                    recentScanCount24h: 1,
                    recentScanCount7d: 1,
                    suspicious: false,
                    suspicionReasons: [],
                },
            });
            return;
        }

        try {
            const data = await lookupDrugByBatch(batchNumber, {
                brand_name: normalizedBrandName,
                barcode_id: barcodeId,
            });

            if (!data) {
                res.status(404).json({
                    verified: false,
                    message: "Medicine not found",
                });
                return;
            }

            // Look up batch recall status from batches table
            const { data: batchData } = await supabase
                .from("batches")
                .select("recall_status")
                .eq("batch_number", batchNumber)
                .maybeSingle();
            const batch_status = getBatchStatus(batchData?.recall_status);

            const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

            const [{ count: count24h = 0 }, { count: count7d = 0 }] = (await Promise.all([
                supabase
                    .from("scan_history")
                    .select("id", { count: "exact", head: true })
                    .eq("batch_number", data.batch_number)
                    .gte("created_at", since24h),
                supabase
                    .from("scan_history")
                    .select("id", { count: "exact", head: true })
                    .eq("batch_number", data.batch_number)
                    .gte("created_at", since7d),
            ])) as Array<{ count: number | null }>;

            const recentScanCount24h = (count24h ?? 0) + 1;
            const recentScanCount7d = (count7d ?? 0) + 1;
            const suspicionReasons: string[] = [];
            let suspicious = false;

            if (data.is_counterfeit_alert) {
                suspicious = true;
                suspicionReasons.push(
                    "This batch is already flagged as a counterfeit alert in the official database."
                );
            }
            if (recentScanCount24h >= 3) {
                suspicious = true;
                suspicionReasons.push(
                    "This batch has been scanned multiple times in the last 24 hours, which may indicate barcode reuse or sticker cloning."
                );
            }
            if (recentScanCount7d >= 10) {
                suspicious = true;
                suspicionReasons.push(
                    "This batch has unusually high scan volume in the last week, increasing the risk of counterfeit reuse."
                );
            }

            const { error: insertError } = await supabase.from("scan_history").insert([
                {
                    batch_number: data.batch_number,
                    medicine_id: data.id,
                    barcode_id: data.barcode_id,
                    client_ip: maskClientIp(req.ip),
                    origin: req.headers.origin ?? null,
                    user_agent: req.headers["user-agent"] ?? null,
                    latitude: latitude ?? null,
                    longitude: longitude ?? null,
                },
            ]);
            if (insertError) {
                logger.error({
                    message: "Failed to record scan history",
                    error: insertError,
                    route: "/api/verify",
                });
            }

            res.status(200).json({
                verified: true,
                batch_status,
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
                scanMeta: {
                    recentScanCount24h,
                    recentScanCount7d,
                    suspicious,
                    suspicionReasons,
                },
            });
        } catch (err) {
            // ServiceUnavailableError means both Redis and Supabase are unreachable
            if (err instanceof ServiceUnavailableError) {
                logger.error({
                    message: "Both Redis and Supabase unreachable in /api/verify",
                    code: err.code,
                    route: "/api/verify",
                });
                res.status(503).json({
                    verified: false,
                    error: {
                        code: err.code,
                        message: err.message,
                    },
                });
                return;
            }

            logger.error({
                message: "Unexpected error in /api/verify",
                error: err,
                route: "/api/verify",
            });
            res.status(500).json({
                verified: false,
                message: "An unexpected error occurred",
            });
        }
    }
);

export default router;
