import { Router, Request, Response } from "express";
import { supabase } from "../db/client";
import { requireAuth } from "../middleware/auth"; // Ensure this matches your project
import { z } from "zod";

const router = Router();

// Validation schema
const trackSchema = z.object({
    medicine_id: z.string(),
    medicine_name: z.string().min(1),
    batch_number: z.string().optional(),
    expiry_date: z.string(), // or .datetime()
});

router.get("/tracked", requireAuth, async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { data, error } = await supabase
        .from("tracked_medicines")
        .select("*")
        .eq("user_id", userId); // Security: Only get current user's data

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.post("/track", requireAuth, async (req: Request, res: Response) => {
    const result = trackSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json(result.error);

    const userId = (req as any).user.id;
    const { data, error } = await supabase
        .from("tracked_medicines")
        .insert([{ ...result.data, user_id: userId }]);

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ message: "Medicine tracked successfully", data });
});

export default router;
