import { Router, Request, Response } from "express";
import { supabase } from "../db/client";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { z } from "zod";
import { trackingLimiter } from "../middleware/rateLimit";

const router = Router();

// Validation schema
const trackSchema = z.object({
    medicine_id: z.string(),
    medicine_name: z.string().min(1).max(200),
    batch_number: z.string().max(100).optional(),
    expiry_date: z.string().date(),
});
router.get(
    "/tracked",
    trackingLimiter,
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user!.id;
        const { data, error } = await supabase
            .from("tracked_medicines")
            .select("*")
            .eq("user_id", userId); // Security: Only get current user's data

        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    }
);

router.post(
    "/track",
    trackingLimiter,
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
        const result = trackSchema.safeParse(req.body);
        if (!result.success) return res.status(400).json(result.error);

        const { data: foundMedicine } = await supabase
            .from("medicines")
            .select("id, brand_name, generic_name")
            .eq("id", result.data.medicine_id)
            .maybeSingle();

        const isVerified = foundMedicine != null;

        const userId = req.user!.id;
        const { data, error } = await supabase
            .from("tracked_medicines")
            .insert([{ ...result.data, user_id: userId, is_verified: isVerified }]);

        if (error) return res.status(500).json({ error: error.message });
        res.status(201).json({ message: "Medicine tracked successfully", data });
    }
);

export default router;
