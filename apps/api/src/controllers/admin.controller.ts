import { Response } from "express";
import { z } from "zod";
import { supabase } from "../db/client";
import { logAdminAction } from "../services/audit.service";
import { AuthenticatedRequest } from "../middleware/auth";

const reportStatusSchema = z.object({
    status: z.enum(["pending", "verified_fake", "false_alarm"]),
});

const medicineStatusSchema = z.object({
    status: z.enum(["safe", "suspicious", "recalled", "pending_review"]),
});

const pharmacyStatusSchema = z.object({
    status: z.enum(["approved", "rejected"]),
});

const medicineSchema = z.object({
    brand_name: z.string().min(1),
    generic_name: z.string().min(1),
    manufacturer: z.string().min(1),
    barcode_id: z.string().optional(),
    cdsco_approval_status: z.enum(["approved", "recalled", "banned"]).default("approved"),
    status: z.enum(["safe", "suspicious", "recalled", "pending_review"]).default("safe").optional(),
});

const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
});

interface AdminAuditLog {
    id: string;
    admin_id: string | null;
    action: string;
    target_type: "REPORT" | "MEDICINE" | "PHARMACY";
    target_id: string;
    details: Record<string, unknown> | string | null;
    created_at: string;
}

export const getPendingReports = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const parsed = paginationSchema.safeParse(req.query);

        if (!parsed.success) {
            res.status(400).json({
                error: "Invalid pagination parameters",
                details: parsed.error.issues,
            });
            return;
        }

        const { page, limit } = parsed.data;
        const offset = (page - 1) * limit;

        const { data, error, count } = await supabase
            .from("counterfeit_reports")
            .select("*, medicines(brand_name, generic_name)", {
                count: "exact",
            })
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            res.status(500).json({ error: "Failed to fetch reports" });
            return;
        }

        res.json({
            reports: data,
            meta: {
                total: count || 0,
                page,
                limit,
                totalPages: count ? Math.ceil(count / limit) : 0,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const updateReportStatus = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const parsed = reportStatusSchema.safeParse(req.body);

        if (!parsed.success) {
            res.status(400).json({ error: "Invalid status", details: parsed.error.issues });
            return;
        }

        const { status } = parsed.data;

        const updateFields: Record<string, unknown> = { status };
        if (status === "verified_fake") {
            updateFields.is_escalated = false;
        }

        const { data, error } = await supabase
            .from("counterfeit_reports")
            .update(updateFields)
            .eq("id", id)
            .select()
            .single();

        if (error) {
            // Return 404 when the report does not exist
            if (error.code === "PGRST116") {
                res.status(404).json({ error: "Report not found" });
                return;
            }

            res.status(500).json({ error: "Failed to update report" });
            return;
        }

        if (!data) {
            res.status(404).json({ error: "Report not found" });
            return;
        }

        await logAdminAction(
            req.user!.id,
            `STATUS_${status.toUpperCase()}`,
            "REPORT",
            id as string,
            { status }
        );

        // --- DISTRICT ALERT LOGIC ---
        // Only reports that passed validation (low risk score) contribute to
        // district alerts. Artificially amplified or duplicate reports should
        // not directly escalate public risk indicators.
        if (status === "verified_fake" && data.district) {
            const { count } = await supabase
                .from("counterfeit_reports")
                .select("*", { count: "exact", head: true })
                .eq("district", data.district)
                .eq("status", "verified_fake")
                .eq("is_escalated", false);

            // Increased threshold: require 5 validated reports (was 3) so that
            // a small cluster of reports cannot trigger public panic signals.
            // Also requires is_escalated = false — reports flagged by the
            // validation service (burst/duplicate patterns) are excluded.
            if (count && count >= 5) {
                const alertLevel = count >= 15 ? "high" : "medium";

                // Replace the previous check-then-insert pattern with a single upsert.
                // The old pattern had a TOCTOU race window: two concurrent admin actions
                // on the same district could both pass the existingAlert check and
                // produce duplicate rows. The upsert with onConflict is atomic and
                // eliminates the window. The conflict target must match a unique
                // constraint on (district) in the district_alerts table.
                await supabase.from("district_alerts").upsert(
                    {
                        district: data.district,
                        medicine_name: data.reported_brand_name,
                        alert_level: alertLevel,
                        broadcasted: false,
                    },
                    { onConflict: "district" }
                );
            }
        }

        res.json({ message: "Status updated", report: data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getAllMedicines = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const parsed = paginationSchema.safeParse(req.query);

        if (!parsed.success) {
            res.status(400).json({
                error: "Invalid pagination parameters",
                details: parsed.error.issues,
            });
            return;
        }

        const { page, limit } = parsed.data;
        const offset = (page - 1) * limit;

        const { data, error, count } = await supabase
            .from("medicines")
            .select("*", { count: "exact" })
            .range(offset, offset + limit - 1);

        if (error) {
            res.status(500).json({ error: "Failed to fetch medicines" });
            return;
        }

        res.json({
            medicines: data,
            meta: {
                total: count || 0,
                page,
                limit,
                totalPages: count ? Math.ceil(count / limit) : 0,
            },
        });
    } catch (err) {
        console.error("Error in getAllMedicines:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getPendingPharmacies = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { data, error } = await supabase
            .from("pharmacies")
            .select(
                "id, name, license_id, address, district, state, phone_number, is_verified, status, created_at"
            )
            .eq("status", "pending")
            .order("created_at", { ascending: false });

        if (error) {
            res.status(500).json({ error: "Failed to fetch pending pharmacies" });
            return;
        }

        res.json({ pharmacies: data ?? [] });
    } catch (err) {
        console.error("Error in getPendingPharmacies:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const updatePharmacyStatus = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const parsed = pharmacyStatusSchema.safeParse(req.body);

        if (!parsed.success) {
            res.status(400).json({ error: "Invalid status", details: parsed.error.issues });
            return;
        }

        const { status } = parsed.data;

        const { data, error } = await supabase
            .from("pharmacies")
            .update({
                status,
                is_verified: status === "approved",
            })
            .eq("id", id)
            .select()
            .single();

        if (error) {
            res.status(500).json({ error: "Failed to update pharmacy" });
            return;
        }

        if (!data) {
            res.status(404).json({ error: "Pharmacy not found" });
            return;
        }

        await logAdminAction(
            req.user!.id,
            `PHARMACY_${status.toUpperCase()}`,
            "PHARMACY",
            id as string,
            { status }
        );

        res.json({ message: "Pharmacy status updated", pharmacy: data });
    } catch (err) {
        console.error("Error in updatePharmacyStatus:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const createMedicine = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const parsed = medicineSchema.safeParse(req.body);

        if (!parsed.success) {
            res.status(400).json({ error: "Invalid medicine data", details: parsed.error.issues });
            return;
        }

        const { data, error } = await supabase
            .from("medicines")
            .insert(parsed.data)
            .select()
            .single();

        if (error || !data) {
            res.status(500).json({ error: "Failed to create medicine" });
            return;
        }

        await logAdminAction(req.user!.id, "CREATE_MEDICINE", "MEDICINE", data.id, parsed.data);
        res.status(201).json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getAuditLogs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const parsed = paginationSchema
            .extend({ limit: z.coerce.number().int().min(1).max(100).default(20) })
            .safeParse(req.query);

        if (!parsed.success) {
            res.status(400).json({
                error: "Invalid pagination parameters",
                details: parsed.error.issues,
            });
            return;
        }

        const { page, limit } = parsed.data;
        const offset = (page - 1) * limit;

        const { data, error, count } = await supabase
            .from("audit_logs")
            .select("*", { count: "exact" })
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            res.status(500).json({ error: "Failed to fetch audit logs" });
            return;
        }

        const formatDetails = (log: Pick<AdminAuditLog, "action" | "details">): string => {
            if (!log.details) return log.action;
            try {
                const detailsObj =
                    typeof log.details === "string" ? JSON.parse(log.details) : log.details;
                if (log.action.startsWith("STATUS_")) {
                    return `Updated report status to ${detailsObj.status || "unknown"}`;
                }
                if (log.action === "CREATE_MEDICINE") {
                    return `Created new medicine: ${detailsObj.brand_name || "unknown"} (${detailsObj.generic_name || "unknown"})`;
                }
                return `${log.action}: ${JSON.stringify(detailsObj)}`;
            } catch (e) {
                return log.action;
            }
        };

        const formattedLogs = (data || []).map((log: AdminAuditLog) => ({
            ...log,
            details: formatDetails(log),
        }));

        res.json({
            logs: formattedLogs,
            meta: {
                total: count || 0,
                page,
                limit,
                totalPages: count ? Math.ceil(count / limit) : 0,
            },
        });
    } catch (err) {
        console.error("Error in getAuditLogs:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};
