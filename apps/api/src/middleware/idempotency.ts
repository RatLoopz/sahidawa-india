import { Request, Response, NextFunction } from "express";
import { redisClient } from "../utils/redis";
import { supabase } from "../db/client";
import logger from "../utils/logger";

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

    // Durable reservation: rely on the PRIMARY KEY constraint on idempotency_key
    // to atomically claim this key before any processing begins. This closes the
    // TOCTOU window that previously existed between a "does this key exist?"
    // read here and the write at the end of the /submit handler — two concurrent
    // requests for the same key can no longer both pass this check.
    //
    // scan_id is not yet known at this point (the handler derives/generates it
    // from the request body), so we reserve with scan_id: null and the handler
    // fills it in once the submission is resolved.
    const { error: reserveError } = await supabase
        .from("submission_idempotency")
        .insert({ idempotency_key: key, scan_id: null });

    if (!reserveError) {
        // We won the race — this request owns the key.
        (req as any).idempotencyKey = key;
        return next();
    }

    if (reserveError.code !== "23505") {
        // Unexpected DB failure — fail closed rather than silently letting the
        // request proceed without a durable idempotency guarantee.
        logger.error("Idempotency reservation failed", { error: reserveError, key });
        return res.status(500).json({ error: "Server error while checking Idempotency-Key" });
    }

    // Unique violation: another request already reserved (or completed) this key.
    const { data } = await supabase
        .from("submission_idempotency")
        .select("scan_id")
        .eq("idempotency_key", key)
        .maybeSingle();

    if (data?.scan_id) {
        // The prior request has already finished — return its durable result.
        const parts = await getPartsStatus(data.scan_id);
        return res.status(200).json({ scanId: data.scan_id, parts });
    }

    // scan_id is still null: another request with the same key is currently
    // in-flight. Short-circuit instead of letting this request also run the
    // submission pipeline.
    return res.status(409).json({
        error: "A request with this Idempotency-Key is already being processed",
    });
};

async function getPartsStatus(scanId: string) {
    const { data } = await supabase
        .from("scan_submission_parts")
        .select("part_type, status")
        .eq("scan_id", scanId);

    return Object.fromEntries((data ?? []).map((p) => [p.part_type, p.status]));
}