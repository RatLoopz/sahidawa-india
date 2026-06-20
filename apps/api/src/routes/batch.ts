import { Router, Request, Response } from "express";
import { z } from "zod";
import { supabase } from "../db/client";
import { batchLimiter } from "../middleware/rateLimit";
import logger from "../utils/logger";
import {
    validateReport,
    anonymizeIp,
    computeReportHash,
} from "../services/reportValidation.service";
import { isAllowedOrigin } from "../utils/originCheck";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function getExpiryStatus(expiryDate: string | null): "green" | "yellow" | "red" | "unknown" {
    if (!expiryDate) return "unknown";
    const now = new Date();
    const expiry = new Date(expiryDate);
    if (isNaN(expiry.getTime())) return "unknown";
    const diffMs = expiry.getTime() - now.getTime();
    const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30);

    if (diffMs < 0 || diffMonths < 1) return "red";
    if (diffMonths <= 6) return "yellow";
    return "green";
}

// Shared batch number validation — alphanumeric only, prevents wildcard injection
const BATCH_NUMBER_SCHEMA = z
    .string()
    .min(3, "Batch number must be at least 3 characters")
    .max(100, "Batch number too long")
    .regex(/^[A-Za-z0-9\-\/]+$/, "Batch number contains invalid characters");

const batchParamSchema = z.object({
    batchNumber: BATCH_NUMBER_SCHEMA,
});

const reportBatchSchema = z.object({
    batchNumber: BATCH_NUMBER_SCHEMA,
    description: z.string().min(10, "Description must be at least 10 characters"),
    reporterName: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pincode: z.string().optional(),
    pharmacyName: z.string().optional(),
});

// ── GET /api/verify/batch/:batchNumber ────────────────────────────────────────

/**
 * @openapi
 * /api/verify/batch/{batchNumber}:
 *   get:
 *     tags:
 *       - Batch Traceability
 *     summary: Get full traceability info for a batch number
 *     description: >
 *       Returns medicine details, manufacturer information, batch recall status,
 *       and expiry color warning for a given batch number.
 *       Results are cached for 2 minutes.
 *     parameters:
 *       - in: path
 *         name: batchNumber
 *         required: true
 *         schema:
 *           type: string
 *           example: "BN2024001"
 *         description: The batch number printed on the medicine packaging
 *     responses:
 *       200:
 *         description: Batch found with full traceability details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 found:
 *                   type: boolean
 *                 batch:
 *                   type: object
 *                 medicine:
 *                   type: object
 *                 manufacturer:
 *                   type: object
 *                 expiry_status:
 *                   type: string
 *                   enum: [green, yellow, red, unknown]
 *       400:
 *         description: Invalid batch number format
 *       404:
 *         description: Batch not found
 *       500:
 *         description: Database error
 */
router.get("/:batchNumber", batchLimiter, async (req: Request, res: Response) => {
    const parsed = batchParamSchema.safeParse({ batchNumber: req.params.batchNumber });

    if (!parsed.success) {
        res.status(400).json({
            error: "Invalid batch number",
            details: parsed.error.issues,
        });
        return;
    }

    const { batchNumber } = parsed.data;

    try {
        // ── Single query with joins (fixes N+1) ───────────────────────────────
        const { data: batchData, error: batchError } = await supabase
            .from("batches")
            .select(
                `
                *,
                medicine:medicines(id, brand_name, generic_name, cdsco_approval_status, is_counterfeit_alert, is_cdsco_verified, cdsco_match_score, matched_cdsco_product, matched_cdsco_manufacturer, product_match_score, manufacturer_match_score),
                manufacturer:manufacturers(*)
            `
            )
            .eq("batch_number", batchNumber)
            .maybeSingle();

        if (batchError) {
            logger.error({
                message: "Batch lookup failed",
                error: batchError,
                route: "/api/verify/batch",
            });
            res.status(500).json({ error: "Database lookup failed" });
            return;
        }

        // ── Fall back to medicines table if no dedicated batch record ─────────
        if (!batchData) {
            const { data: medicineData, error: medicineError } = await supabase
                .from("medicines")
                .select(
                    "id, brand_name, generic_name, manufacturer, batch_number, manufacturing_date, expiry_date, cdsco_approval_status, is_counterfeit_alert, is_cdsco_verified, cdsco_match_score, matched_cdsco_product, matched_cdsco_manufacturer, product_match_score, manufacturer_match_score, manufacturer_id"
                )
                .eq("batch_number", batchNumber)
                .limit(1)
                .maybeSingle();

            if (medicineError) {
                logger.error({
                    message: "Medicine fallback lookup failed",
                    error: medicineError,
                    route: "/api/verify/batch",
                });
                res.status(500).json({ error: "Database lookup failed" });
                return;
            }

            if (!medicineData) {
                res.status(404).json({
                    found: false,
                    message: "No batch or medicine record found for this batch number.",
                });
                return;
            }

            // Fetch manufacturer if linked — single query
            let manufacturerData = null;
            if (medicineData.manufacturer_id) {
                const { data: mfr } = await supabase
                    .from("manufacturers")
                    .select("*")
                    .eq("id", medicineData.manufacturer_id)
                    .maybeSingle();
                manufacturerData = mfr;
            }

            res.status(200).json({
                found: true,
                source: "medicines",
                batch: {
                    batch_number: medicineData.batch_number,
                    manufacturing_date: medicineData.manufacturing_date ?? null,
                    expiry_date: medicineData.expiry_date ?? null,
                    recall_status: "none",
                    recall_reason: null,
                },
                medicine: {
                    id: medicineData.id,
                    brand_name: medicineData.brand_name,
                    generic_name: medicineData.generic_name,
                    cdsco_approval_status: medicineData.cdsco_approval_status,
                    is_counterfeit_alert: medicineData.is_counterfeit_alert,
                    is_cdsco_verified: medicineData.is_cdsco_verified,
                    cdsco_match_score: medicineData.cdsco_match_score,
                    matched_cdsco_product: medicineData.matched_cdsco_product,
                    matched_cdsco_manufacturer: medicineData.matched_cdsco_manufacturer,
                    product_match_score: medicineData.product_match_score,
                    manufacturer_match_score: medicineData.manufacturer_match_score,
                },
                manufacturer: manufacturerData
                    ? {
                          name: manufacturerData.name,
                          license_number: manufacturerData.license_number,
                          address: manufacturerData.address,
                          city: manufacturerData.city,
                          state: manufacturerData.state,
                          pincode: manufacturerData.pincode,
                          phone: manufacturerData.phone,
                          email: manufacturerData.email,
                          website: manufacturerData.website,
                          gmp_certified: manufacturerData.gmp_certified,
                          coordinates: manufacturerData.location
                              ? {
                                    lat: manufacturerData.location.coordinates?.[1],
                                    lng: manufacturerData.location.coordinates?.[0],
                                }
                              : null,
                      }
                    : {
                          name: medicineData.manufacturer,
                          license_number: null,
                          address: null,
                          city: null,
                          state: null,
                          pincode: null,
                          phone: null,
                          email: null,
                          website: null,
                          gmp_certified: false,
                          coordinates: null,
                      },
                expiry_status: getExpiryStatus(medicineData.expiry_date),
            });
            return;
        }

        // ── Batch found with joined data ──────────────────────────────────────
        const medicine = batchData.medicine as any;
        const manufacturer = batchData.manufacturer as any;

        res.status(200).json({
            found: true,
            source: "batches",
            batch: {
                batch_number: batchData.batch_number,
                manufacturing_date: batchData.manufacturing_date,
                expiry_date: batchData.expiry_date,
                recall_status: batchData.recall_status,
                recall_reason: batchData.recall_reason,
                quantity_produced: batchData.quantity_produced,
            },
            medicine: medicine
                ? {
                      id: medicine.id,
                      brand_name: medicine.brand_name,
                      generic_name: medicine.generic_name,
                      cdsco_approval_status: medicine.cdsco_approval_status,
                      is_counterfeit_alert: medicine.is_counterfeit_alert,
                      is_cdsco_verified: medicine.is_cdsco_verified,
                      cdsco_match_score: medicine.cdsco_match_score,
                      matched_cdsco_product: medicine.matched_cdsco_product,
                      matched_cdsco_manufacturer: medicine.matched_cdsco_manufacturer,
                      product_match_score: medicine.product_match_score,
                      manufacturer_match_score: medicine.manufacturer_match_score,
                  }
                : null,
            manufacturer: manufacturer
                ? {
                      name: manufacturer.name,
                      license_number: manufacturer.license_number,
                      address: manufacturer.address,
                      city: manufacturer.city,
                      state: manufacturer.state,
                      pincode: manufacturer.pincode,
                      phone: manufacturer.phone,
                      email: manufacturer.email,
                      website: manufacturer.website,
                      gmp_certified: manufacturer.gmp_certified,
                      coordinates: manufacturer.location
                          ? {
                                lat: manufacturer.location.coordinates?.[1],
                                lng: manufacturer.location.coordinates?.[0],
                            }
                          : null,
                  }
                : null,
            expiry_status: getExpiryStatus(batchData.expiry_date),
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        logger.error({
            message: "Batch traceability error",
            error: message,
            route: "/api/verify/batch",
        });
        res.status(500).json({ error: "Internal server error" });
    }
});

// ── POST /api/verify/batch/report ─────────────────────────────────────────────

/**
 * @openapi
 * /api/verify/batch/report:
 *   post:
 *     tags:
 *       - Batch Traceability
 *     summary: Report a batch issue
 *     description: Creates a counterfeit report entry for a specific batch number.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - batchNumber
 *               - description
 *             properties:
 *               batchNumber:
 *                 type: string
 *                 example: "BN2024001"
 *               description:
 *                 type: string
 *                 example: "Tablet colour was different from usual"
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               pharmacyName:
 *                 type: string
 *     responses:
 *       201:
 *         description: Report submitted successfully
 *       400:
 *         description: Invalid request body
 *       500:
 *         description: Failed to submit report
 */
router.post("/report", batchLimiter, async (req: Request, res: Response) => {
    if (!isAllowedOrigin(req)) {
        res.status(403).json({ error: "Access denied: unrecognized origin" });
        return;
    }

    const parsed = reportBatchSchema.safeParse(req.body);

    if (!parsed.success) {
        res.status(400).json({
            error: "Invalid request body",
            details: parsed.error.issues,
        });
        return;
    }

    const { batchNumber, description, city, state, pincode, pharmacyName } = parsed.data;
    const hashedIp = anonymizeIp(req.ip);

    const reportPayload = {
        medicineName: batchNumber,
        manufacturer: "",
        description,
        pharmacyName: pharmacyName ?? "",
        address: "",
        city: city ?? "",
        state: state ?? "",
        pincode: pincode ?? "",
        district: city ?? "",
    };

    const validation = await validateReport(reportPayload, hashedIp, null);

    if (!validation.passed) {
        logger.warn({
            message: "Batch report rejected by abuse safeguards",
            risk_score: validation.riskScore,
            reasons: validation.reasons,
            ip_address: hashedIp ?? "unknown",
            batch_number: batchNumber,
            duplicate_group_id: validation.duplicateGroupId ?? null,
            route: "/api/verify/batch/report",
        });
        res.status(429).json({
            error: "Report rejected due to abuse safeguards.",
            reasons: validation.reasons,
        });
        return;
    }
    try {
        // Use .eq() instead of .ilike() — exact match, no wildcard risk
        let medicine_id: string | null = null;
        const { data: medicineMatch } = await supabase
            .from("medicines")
            .select("id")
            .eq("batch_number", batchNumber)
            .limit(1)
            .maybeSingle();

        if (medicineMatch) {
            medicine_id = medicineMatch.id;
        }

        const { error } = await supabase.from("counterfeit_reports").insert({
            medicine_id,
            scanned_barcode: batchNumber,
            reported_brand_name: batchNumber,
            description,
            city: city ?? null,
            state: state ?? null,
            pincode: pincode ?? null,
            pharmacy_name: pharmacyName ?? null,
            status: "pending",
            ip_address: hashedIp ?? null,
            report_hash: computeReportHash(reportPayload),
            risk_score: validation.riskScore,
            is_escalated: validation.riskScore >= 0.6,
            duplicate_group_id: validation.duplicateGroupId ?? null,
        });

        if (error) {
            logger.error({
                message: "Failed to insert batch report",
                error,
                route: "/api/verify/batch/report",
            });
            res.status(500).json({ error: "Failed to submit report" });
            return;
        }

        res.status(201).json({
            success: true,
            message: "Batch issue reported successfully. Thank you for helping keep India safe.",
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        logger.error({
            message: "Batch report error",
            error: message,
            route: "/api/verify/batch/report",
        });
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
