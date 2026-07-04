import { Request, Response, NextFunction } from "express";
import { redisClient } from "../utils/redis";
import { supabase } from "../db/client";

export const idempotencyMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const rawKey = req.headers["idempotency-key"] as string;
    if (!rawKey) {
        return res.status(400).json({ error: "Idempotency-Key header required" });
    }

    // Sanitize the key to prevent Redis injection or path traversal (expecting UUID-like string)
    const key = String(rawKey).replace(/[^a-zA-Z0-9-]/g, "");
    if (!key) {
        return res.status(400).json({ error: "Invalid Idempotency-Key format" });
    }

    try {
        if (redisClient.isOpen) {
            const redisResult = await redisClient.get(`idem:${key}`);
            if (redisResult) {
                return res.status(200).json(JSON.parse(redisResult));
            }
        }
    } catch (err) {
        // If Redis fails, gracefully fall back to Supabase
    }

    // Durable fallback check in case Redis evicted the key or is unavailable
    const { data } = await supabase
        .from("submission_idempotency")
        .select("scan_id")
        .eq("idempotency_key", key)
        .maybeSingle();

    if (data) {
        const parts = await getPartsStatus(data.scan_id);
        return res.status(200).json({ scanId: data.scan_id, parts });
    }

    (req as any).idempotencyKey = key;
    next();
};

async function getPartsStatus(scanId: string) {
    const { data } = await supabase
        .from("scan_submission_parts")
        .select("part_type, status")
        .eq("scan_id", scanId);

    return Object.fromEntries((data ?? []).map((p) => [p.part_type, p.status]));
}
