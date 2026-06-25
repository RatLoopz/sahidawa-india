import { Router, Response } from "express";
import { z } from "zod";
import { supabase } from "../db/client";
import { requireAuth } from "../middleware/auth";
import type { AuthenticatedRequest } from "../middleware/auth";

const router = Router();

const createWatchlistSchema = z.object({
    medicine_id: z.string().uuid("Invalid medicine ID format"),
    notify_price_change: z.boolean().optional().default(true),
    notify_recall: z.boolean().optional().default(true),
    notify_new_alternative: z.boolean().optional().default(true),
    notify_stock_availability: z.boolean().optional().default(true),
});

const updateWatchlistSchema = z.object({
    notify_price_change: z.boolean().optional(),
    notify_recall: z.boolean().optional(),
    notify_new_alternative: z.boolean().optional(),
    notify_stock_availability: z.boolean().optional(),
});

// GET /api/v1/watchlist - List all watched medicines with their details
router.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { data, error } = await supabase
            .from("medicine_watchlist")
            .select(
                `
                id,
                user_id,
                medicine_id,
                notify_price_change,
                notify_recall,
                notify_new_alternative,
                notify_stock_availability,
                created_at,
                medicine:medicines (
                    id,
                    brand_name,
                    generic_name,
                    manufacturer,
                    mrp,
                    jan_aushadhi_price,
                    cdsco_approval_status,
                    is_counterfeit_alert
                )
            `
            )
            .eq("user_id", req.user!.id)
            .order("created_at", { ascending: false });

        if (error) {
            res.status(500).json({ error: "Failed to fetch watchlist" });
            return;
        }

        res.json({ watchlist: data ?? [] });
    } catch (err) {
        res.status(500).json({ error: "An unexpected error occurred" });
    }
});

// POST /api/v1/watchlist - Add or update a medicine in the watchlist
router.post("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const parsed = createWatchlistSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            error: "Invalid request body",
            details: parsed.error.flatten().fieldErrors,
        });
        return;
    }

    const { medicine_id } = parsed.data;

    try {
        // Verify medicine exists
        const { data: medicine, error: medError } = await supabase
            .from("medicines")
            .select("id")
            .eq("id", medicine_id)
            .maybeSingle();

        if (medError || !medicine) {
            res.status(404).json({ error: "Medicine not found" });
            return;
        }

        const { data, error } = await supabase
            .from("medicine_watchlist")
            .upsert(
                {
                    user_id: req.user!.id,
                    medicine_id,
                    notify_price_change: parsed.data.notify_price_change,
                    notify_recall: parsed.data.notify_recall,
                    notify_new_alternative: parsed.data.notify_new_alternative,
                    notify_stock_availability: parsed.data.notify_stock_availability,
                },
                {
                    onConflict: "user_id, medicine_id",
                    ignoreDuplicates: false,
                }
            )
            .select()
            .single();

        if (error) {
            res.status(500).json({ error: "Failed to save to watchlist" });
            return;
        }

        res.status(201).json({ item: data });
    } catch (err) {
        res.status(500).json({ error: "An unexpected error occurred" });
    }
});

// PATCH /api/v1/watchlist/:id - Update notification preferences for a watched item
router.patch("/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const parsed = updateWatchlistSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            error: "Invalid request body",
            details: parsed.error.flatten().fieldErrors,
        });
        return;
    }

    try {
        const { data, error } = await supabase
            .from("medicine_watchlist")
            .update(parsed.data)
            .eq("id", req.params.id)
            .eq("user_id", req.user!.id)
            .select()
            .maybeSingle();

        if (error) {
            res.status(500).json({ error: "Failed to update watchlist item" });
            return;
        }

        if (!data) {
            res.status(404).json({ error: "Watchlist item not found" });
            return;
        }

        res.json({ item: data });
    } catch (err) {
        res.status(500).json({ error: "An unexpected error occurred" });
    }
});

// DELETE /api/v1/watchlist/:id - Remove item from watchlist by watchlist entry ID
router.delete("/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { data, error } = await supabase
            .from("medicine_watchlist")
            .delete()
            .eq("id", req.params.id)
            .eq("user_id", req.user!.id)
            .select()
            .maybeSingle();

        if (error) {
            res.status(500).json({ error: "Failed to delete watchlist item" });
            return;
        }

        if (!data) {
            res.status(404).json({ error: "Watchlist item not found" });
            return;
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "An unexpected error occurred" });
    }
});

// DELETE /api/v1/watchlist/medicine/:medicineId - Remove item from watchlist by medicine ID
router.delete(
    "/medicine/:medicineId",
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const { data, error } = await supabase
                .from("medicine_watchlist")
                .delete()
                .eq("medicine_id", req.params.medicineId)
                .eq("user_id", req.user!.id)
                .select();

            if (error) {
                res.status(500).json({ error: "Failed to delete from watchlist" });
                return;
            }

            if (!data || data.length === 0) {
                res.status(404).json({ error: "Medicine not found in watchlist" });
                return;
            }

            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: "An unexpected error occurred" });
        }
    }
);

export default router;
