import { Router, Request, Response } from "express";
import { z } from "zod";
import { supabase } from "../db/client";
import { verifyLimiter } from "../middleware/rateLimit";
import { optionalAuth } from "../middleware/auth";
import logger from "../utils/logger";
import { escapeIlike } from "../utils/db";

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

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
    : [
          "http://localhost:3000",
          "http://localhost:5173",
          "https://sahidawa.vercel.app",
          "https://sahidawa-india.vercel.app",
          "https://sahidawa.goswav.in",
      ];

const router = Router();

function isAllowedOrigin(req: Request): boolean {
    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const source = origin || (referer ? new URL(referer).origin : null);
    if (!source) return true; // Allow requests with no Origin/Referer header
    return ALLOWED_ORIGINS.includes(source);
}

const verifySchema = z.object({
    batchNumber: z
        .string({ message: "batchNumber is required and must be a string" })
        .min(3, "batchNumber must be at least 3 characters long"),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
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
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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

        const { batchNumber, latitude, longitude } = parsed.data;

        const escaped = escapeIlike(batchNumber);

        try {
            const { data, error } = await supabase
                .from("medicines")
                .select(
                    "id, barcode_id, brand_name, generic_name, manufacturer, batch_number, expiry_date, cdsco_approval_status, is_counterfeit_alert"
                )
                .ilike("batch_number", escaped)
                .limit(1)
                .maybeSingle();

            if (error) {
                logger.error({ message: "Medicine lookup failed", error, route: "/api/verify" });
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
                medicine: {
                    brand_name: data.brand_name,
                    generic_name: data.generic_name,
                    manufacturer: data.manufacturer,
                    batch_number: data.batch_number,
                    expiry_date: data.expiry_date,
                    cdsco_approval_status: data.cdsco_approval_status,
                    is_counterfeit_alert: data.is_counterfeit_alert,
                },
                scanMeta: {
                    recentScanCount24h,
                    recentScanCount7d,
                    suspicious,
                    suspicionReasons,
                },
            });
        } catch (err) {
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
