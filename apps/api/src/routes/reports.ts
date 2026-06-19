import { Router, Response } from "express";
import { z } from "zod";
import { supabase } from "../db/client";
import { AuthenticatedRequest, optionalAuth, requireAuth, requireRole } from "../middleware/auth";
import { reportLimiter } from "../middleware/rateLimit";
import {
    validateReport,
    computeReportHash,
    anonymizeIp,
} from "../services/reportValidation.service";

const reportsRouter = Router();

// Blocked hostname patterns for image URL SSRF protection.
// z.string().url() only validates URL format, not destination.
// An attacker could supply cloud metadata or internal service URLs that may be
// fetched server-side when the image is processed.
const BLOCKED_IMAGE_URL_PATTERNS = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^::1$/,
    /^fc00:/i,
    /^fe80:/i,
];

function isPublicImageUrl(rawUrl: string): boolean {
    try {
        const { protocol, hostname } = new URL(rawUrl);
        if (protocol !== "https:" && protocol !== "http:") return false;
        return !BLOCKED_IMAGE_URL_PATTERNS.some((p) => p.test(hostname));
    } catch {
        return false;
    }
}

const safeImageUrl = z.string().url().refine(isPublicImageUrl, {
    message:
        "Image URL must use http(s) and must not point to a private, loopback, or link-local address",
});

const createReportSchema = z.object({
    medicineName: z.string().min(2),
    manufacturer: z.string().min(2),
    description: z.string().min(20),
    images: z.array(safeImageUrl).min(1),
    pharmacyName: z.string().min(2),
    address: z.string().min(5),
    city: z.string().min(2),
    state: z.string().min(2),
    pincode: z.string().regex(/^\d{6}$/),
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
    scannedBarcode: z.string().optional(),
    medicineId: z.string().uuid().optional(),
});

const buildReportLocation = (latitude?: number, longitude?: number) => {
    if (typeof latitude !== "number" || typeof longitude !== "number") {
        return null;
    }

    return `POINT(${longitude} ${latitude})`;
};

reportsRouter.post(
    "/",
    reportLimiter,
    optionalAuth,
    async (req: AuthenticatedRequest, res: Response) => {
        const parsed = createReportSchema.safeParse(req.body);

        if (!parsed.success) {
            res.status(400).json({
                error: "Invalid report payload",
                issues: parsed.error.issues,
            });
            return;
        }

        const data = parsed.data;

        try {
            const rawIp =
                req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
                req.socket.remoteAddress;
            const ipAddress = anonymizeIp(rawIp);
            const validationPayload = {
                medicineName: data.medicineName,
                manufacturer: data.manufacturer,
                description: data.description,
                pharmacyName: data.pharmacyName,
                address: data.address,
                city: data.city,
                state: data.state,
                pincode: data.pincode,
                district: data.city,
            };

            const validation = await validateReport(
                validationPayload,
                ipAddress,
                req.user?.id ?? null
            );

            const { data: report, error } = await supabase
                .from("counterfeit_reports")
                .insert({
                    reported_brand_name: data.medicineName,
                    manufacturer: data.manufacturer,
                    description: data.description,
                    photo_url: data.images[0],
                    photo_urls: data.images,
                    pharmacy_name: data.pharmacyName,
                    address: data.address,
                    city: data.city,
                    state: data.state,
                    pincode: data.pincode,
                    district: data.city,
                    report_location: buildReportLocation(data.latitude, data.longitude),
                    reporter_id: req.user?.id ?? null,
                    ip_address: ipAddress,
                    report_hash: computeReportHash(validationPayload),
                    risk_score: validation.riskScore,
                    is_escalated: !validation.passed,
                    duplicate_group_id: validation.duplicateGroupId ?? null,
                    status: "pending",
                    scanned_barcode: data.scannedBarcode ?? null,
                    medicine_id: data.medicineId ?? null,
                })
                .select()
                .single();

            if (error) {
                res.status(500).json({ error: "Failed to submit counterfeit report" });
                return;
            }

            const response: Record<string, unknown> = { report };

            if (!validation.passed) {
                response.warning =
                    "Your report has been flagged for review due to suspicious patterns. It will not appear on public heatmaps until verified.";
                response.validation = {
                    riskScore: validation.riskScore,
                    reasons: validation.reasons,
                };
            }

            res.status(201).json(response);
        } catch (err) {
            console.error("Unexpected error in POST /api/reports:", err);
            res.status(500).json({
                error: "An unexpected error occurred",
                details: err instanceof Error ? err.message : String(err),
                stack: err instanceof Error ? err.stack : undefined,
            });
        }
    }
);

// Must be registered BEFORE the admin-only GET '/' so Express matches /mine first.
reportsRouter.get("/mine", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ error: "Unauthenticated" });
        return;
    }

    try {
        const { data, error } = await supabase
            .from("counterfeit_reports")
            .select(
                "id, reported_brand_name, scanned_barcode, photo_url, district, status, created_at"
            )
            .eq("reporter_id", userId)
            .order("created_at", { ascending: false });

        if (error) {
            res.status(500).json({ error: "Failed to fetch your reports" });
            return;
        }

        res.json({ reports: data ?? [] });
    } catch (err) {
        console.error("Unexpected error in GET /api/reports/mine:", err);
        res.status(500).json({ error: "An unexpected error occurred" });
    }
});

reportsRouter.get("/", requireAuth, requireRole("admin"), async (_req, res: Response) => {
    try {
        const { data, error } = await supabase
            .from("counterfeit_reports")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            res.status(500).json({ error: "Failed to fetch counterfeit reports" });
            return;
        }

        res.json({ reports: data });
    } catch (err) {
        console.error("Unexpected error in GET /api/reports:", err);
        res.status(500).json({ error: "An unexpected error occurred" });
    }
});

reportsRouter.patch(
    "/:id/status",
    requireAuth,
    requireRole("admin"),
    async (req, res: Response) => {
        const { status } = req.body as { status?: string };
        const allowedStatuses = ["pending", "verified_fake", "false_alarm"];

        if (!status || !allowedStatuses.includes(status)) {
            res.status(400).json({ error: "Invalid report status" });
            return;
        }

        try {
            // Verify the report exists before updating. Without this check a
            // caller can submit arbitrary IDs and receive a 500 instead of a
            // 404, leaking that the endpoint performs blind updates and
            // enabling IDOR-style enumeration across report IDs.
            const { data: existing, error: fetchError } = await supabase
                .from("counterfeit_reports")
                .select("id")
                .eq("id", req.params.id)
                .single();

            if (fetchError || !existing) {
                res.status(404).json({ error: "Report not found" });
                return;
            }

            const { data, error } = await supabase
                .from("counterfeit_reports")
                .update({ status })
                .eq("id", req.params.id)
                .select()
                .single();

            if (error) {
                res.status(500).json({ error: "Failed to update report status" });
                return;
            }

            // --- DISTRICT ALERT LOGIC ---
            if (status === "verified_fake" && data.district) {
                const { count } = await supabase
                    .from("counterfeit_reports")
                    .select("*", { count: "exact", head: true })
                    .eq("district", data.district)
                    .eq("status", "verified_fake")
                    .eq("is_escalated", false);

                if (count && count >= 5) {
                    const alertLevel = count >= 15 ? "high" : "medium";
                    await supabase.from("district_alerts").upsert(
                        {
                            district: data.district,
                            medicine_name: data.reported_brand_name,
                            alert_level: alertLevel,
                        },
                        { onConflict: "district" }
                    );
                }
            }

            res.json({ report: data });
        } catch (err) {
            console.error("Unexpected error in PATCH /api/reports/:id/status:", err);
            res.status(500).json({ error: "An unexpected error occurred" });
        }
    }
);

export default reportsRouter;
