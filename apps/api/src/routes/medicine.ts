import { Router, Request, Response } from "express";
import multer from "multer";
import FormData from "form-data";
import fetch from "node-fetch";
import { createClient } from "redis";
import { supabase } from "../db/client";

const router = Router();

// Multer: store audio in memory (max 10MB)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = ["audio/webm", "audio/wav", "audio/ogg", "audio/mp4", "audio/mpeg"];
        cb(null, allowed.includes(file.mimetype));
    },
});

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Redis client for caching - lazy singleton
let redis: ReturnType<typeof createClient> | null = null;

async function getRedisClient() {
    if (!redis) {
        redis = createClient({ url: REDIS_URL });
        redis.on("error", (err) => console.error("Redis error:", err));
        await redis.connect();
    }
    return redis;
}
/**
 * POST /api/medicine/verify-voice
 * Accepts audio blob from frontend, forwards to Python ML service,
 * verifies with Supabase, caches result in Redis for 1 hour.
 */
router.post("/verify-voice", upload.single("audio"), async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: "No audio file provided." });
        }

        // Forward audio to Python FastAPI ML service
        const form = new FormData();
        form.append("audio", req.file.buffer, {
            filename: "recording.webm",
            contentType: req.file.mimetype,
        });

        const mlResponse = await fetch(`${ML_SERVICE_URL}/voice/verify`, {
            method: "POST",
            body: form,
            headers: form.getHeaders(),
        });

        if (!mlResponse.ok) {
            const errText = await mlResponse.text();
            return res.status(mlResponse.status).json({ success: false, error: errText });
        }

        const result = (await mlResponse.json()) as Record<string, any>;
        const transcribedText = String(result.transcribed || "").trim();

        // Verify against Supabase CDSCO DB
        let verificationResult = {
            status: "not_found",
            cdsco_registered: false,
            medicine_name_english: transcribedText,
            medicine_name_regional: transcribedText,
            manufacturer: "Unknown",
            category: "Unknown",
            warnings: ["Medicine not found in CDSCO database. Consult a pharmacist."],
        };

        if (transcribedText) {
            const { data: medicines } = await supabase
                .from("medicines")
                .select("brand_name, generic_name, manufacturer, is_cdsco_verified")
                .or(`brand_name.ilike.%${transcribedText}%,generic_name.ilike.%${transcribedText}%`)
                .limit(1);

            if (medicines && medicines.length > 0) {
                const med = medicines[0];
                verificationResult = {
                    status: med.is_cdsco_verified ? "verified" : "not_found",
                    cdsco_registered: med.is_cdsco_verified || false,
                    medicine_name_english: med.brand_name || med.generic_name || transcribedText,
                    medicine_name_regional: transcribedText,
                    manufacturer: med.manufacturer || "Unknown",
                    category: "Medicine",
                    warnings: [],
                };
            }
        }

        result.verification = verificationResult;

        // Cache result in Redis (key: transcribed medicine name, TTL: 1 hour)
        try {
            const redisClient = await getRedisClient();
            if (transcribedText) {
                const cacheKey = `medicine:voice:${transcribedText.toLowerCase().replace(/\s+/g, "_")}`;
                await redisClient.setEx(cacheKey, 3600, JSON.stringify(result));
            }
        } catch (cacheErr) {
            console.error("Redis cache error:", cacheErr);
        }

        return res.json(result);
    } catch (err) {
        console.error("Voice verification error:", err);
        return res
            .status(500)
            .json({ success: false, error: "Internal server error. Please try again." });
    }
});

/**
 * GET /api/medicine/languages
 * Returns supported Indian languages from ML service.
 */
router.get("/languages", async (_req: Request, res: Response) => {
    try {
        const mlResponse = await fetch(`${ML_SERVICE_URL}/voice/languages`);
        const data = await mlResponse.json();
        res.json(data);
    } catch {
        res.status(500).json({ error: "Could not fetch supported languages." });
    }
});

export default router;
