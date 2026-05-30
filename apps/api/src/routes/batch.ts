import { Router, Request, Response } from "express";
import { z } from "zod";
import { supabase } from "../db/client";
import { batchLimiter } from "../middleware/rateLimit";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function getExpiryStatus(expiryDate: string | null): "green" | "yellow" | "red" | "unknown" {
    if (!expiryDate) return "unknown";
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffMs = expiry.getTime() - now.getTime();
    const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30);

    if (diffMs < 0 || diffMonths < 1) return "red";
    if (diffMonths <= 6) return "yellow";
    return "green";
}

const batchParamSchema = z.object({
    batchNumber: z
        .string()
        .min(3, "Batch number must be at least 3 characters")
        .max(100, "Batch number too long")
        .regex(/^[A-Za-z0-9\-\/]+$/, "Batch number contains invalid characters"),
});

const reportBatchSchema = z.object({
    batchNumber: z.string().min(3),
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
        // ── Step 1: Look up batch record ──────────────────────────────────────
        const { data: batchData, error: batchError } = await supabase
            .from("batches")
            .select(`
                id,
                batch_number,
                manufacturing_date,
                expiry_date,
                recall_status,
                recall_reason,
                quantity_produced,
                medicine_id,
                manufacturer_id
            `)
            .ilike("batch_number", batchNumber)
            .maybeSingle();

        if (batchError) {
            console.error("Batch lookup failed:", batchError);
            res.status(500).json({ error: "Database lookup failed" });
            return;
        }

        // ── Step 2: Fall back to medicines table if no batch record ───────────
        if (!batchData) {
            const escaped = batchNumber
                .replace(/\\/g, "\\\\")
                .replace(/%/g, "\\%")
                .replace(/_/g, "\\_");

            const { data: medicineData, error: medicineError } = await supabase
                .from("medicines")
                .select(
                    "id, brand_name, generic_name, manufacturer, batch_number, manufacturing_date, expiry_date, cdsco_approval_status, is_counterfeit_alert, manufacturer_id"
                )
                .ilike("batch_number", escaped)
                .limit(1)
                .maybeSingle();

            if (medicineError) {
                console.error("Medicine fallback lookup failed:", medicineError);
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

            // Try to get manufacturer details if linked
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

        // ── Step 3: Fetch linked medicine ─────────────────────────────────────
        let medicine = null;
        if (batchData.medicine_id) {
            const { data: med } = await supabase
                .from("medicines")
                .select("id, brand_name, generic_name, cdsco_approval_status, is_counterfeit_alert")
                .eq("id", batchData.medicine_id)
                .maybeSingle();
            medicine = med;
        }

        // ── Step 4: Fetch manufacturer ────────────────────────────────────────
        let manufacturer = null;
        if (batchData.manufacturer_id) {
            const { data: mfr } = await supabase
                .from("manufacturers")
                .select("*")
                .eq("id", batchData.manufacturer_id)
                .maybeSingle();
            manufacturer = mfr;
        }

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
        console.error("Batch traceability error:", message);
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
    const parsed = reportBatchSchema.safeParse(req.body);

    if (!parsed.success) {
        res.status(400).json({
            error: "Invalid request body",
            details: parsed.error.issues,
        });
        return;
    }

    const {
        batchNumber,
        description,
        city,
        state,
        pincode,
        pharmacyName,
    } = parsed.data;

    try {
        // Find medicine_id if we can match the batch
        let medicine_id: string | null = null;

        const { data: medicineMatch } = await supabase
            .from("medicines")
            .select("id")
            .ilike("batch_number", batchNumber)
            .limit(1)
            .maybeSingle();

        if (medicineMatch) {
            medicine_id = medicineMatch.id;
        }

        const { error } = await supabase.from("counterfeit_reports").insert({
            medicine_id,
            scanned_barcode: batchNumber,
            description,
            city: city ?? null,
            state: state ?? null,
            pincode: pincode ?? null,
            pharmacy_name: pharmacyName ?? null,
            status: "pending",
        });

        if (error) {
            console.error("Failed to insert batch report:", error);
            res.status(500).json({ error: "Failed to submit report" });
            return;
        }

        res.status(201).json({
            success: true,
            message: "Batch issue reported successfully. Thank you for helping keep India safe.",
        });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("Batch report error:", message);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;