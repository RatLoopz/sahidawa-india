import { Router, Request, Response } from "express";
import { z } from "zod";
import { supabase } from "../db/client";

const router = Router();

const verifySchema = z.object({
    batchNumber: z
        .string({ message: "batchNumber is required and must be a string" })
        .min(3, "batchNumber must be at least 3 characters long"),
});

router.post("/", async (req: Request, res: Response) => {
    const parsed = verifySchema.safeParse(req.body);

    if (!parsed.success) {
        res.status(400).json({
            error: "Invalid request body",
            details: parsed.error.issues,
        });
        return;
    }

    const { batchNumber } = parsed.data;

    const escaped = batchNumber
        .replace(/\\/g, "\\\\")
        .replace(/%/g, "\\%")
        .replace(/_/g, "\\_");

    const { data, error } = await supabase
        .from("medicines")
        .select(
            "brand_name, generic_name, manufacturer, batch_number, expiry_date, cdsco_approval_status, is_counterfeit_alert"
        )
        .ilike("batch_number", escaped)
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error("Medicine lookup failed:", error);
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
    });
});

export default router;
