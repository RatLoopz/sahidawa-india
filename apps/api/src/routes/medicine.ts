import { z } from "zod";
import { Router, Request, Response } from "express";
import multer from "multer";
import { createHash } from "crypto";
import { supabase } from "../db/client";
import {
    getCachedVoiceByAudioHash,
    setCachedVoiceByAudioHash,
    getCachedVoiceResult,
    setCachedVoiceResult,
} from "../services/cache.service";
import { scanQueryLimiter } from "../middleware/rateLimit";
import { escapePostgrest } from "../utils/db";
import { getMlServiceUrl } from "../config/mlService";
import logger from "../utils/logger";

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

const ML_SERVICE_URL = getMlServiceUrl();

export function buildMedicineVoiceSearchFilter(transcribedText: string): string {
    const safeTranscribedText = escapePostgrest(transcribedText);
    return `brand_name.ilike."%${safeTranscribedText}%",generic_name.ilike."%${safeTranscribedText}%"`;
}

/**
 * POST /api/medicine/verify-voice
 * Accepts audio blob from frontend, forwards to Python ML service,
 * verifies with Supabase, caches result in Redis for 1 hour.
 *
 * Cache strategy (two layers):
 *   Layer 1 — Audio hash → Redis: skips ML transcription call entirely on repeat audio.
 *   Layer 2 — Transcribed text → Redis: skips Supabase DB call on repeat medicine name.
 */
router.post(
    "/verify-voice",
    scanQueryLimiter,
    upload.single("audio"),
    async (req: Request, res: Response) => {
        try {
            if (!ML_SERVICE_URL) {
                return res.status(503).json({ success: false, error: "ML service not configured" });
            }

            if (!req.file) {
                return res.status(400).json({ success: false, error: "No audio file provided." });
            }

            // ── Layer 1: Check cache by audio hash BEFORE calling ML service ──────────
            // SHA-256 of the raw audio buffer — deterministic, collision-resistant, fast.
            const audioHash = createHash("sha256").update(req.file.buffer).digest("hex");
            const cachedByAudio = await getCachedVoiceByAudioHash(audioHash);
            if (cachedByAudio) {
                logger.info(`Voice verification served from audio cache (hash: ${audioHash})`);
                return res.json(cachedByAudio);
            }

            // ── Audio not cached — forward to ML service for transcription ─────────────
            const form = new FormData();
            const audioBytes = Uint8Array.from(req.file.buffer);
            const audioBlob = new Blob([audioBytes], { type: req.file.mimetype });
            form.append("audio", audioBlob, "recording.webm");

            const mlResponse = await fetch(`${ML_SERVICE_URL}/voice/verify`, {
                method: "POST",
                body: form,
            });

            if (!mlResponse.ok) {
                const errText = await mlResponse.text();
                return res.status(mlResponse.status).json({ success: false, error: errText });
            }

            // Define schema to ensure 'transcribed' exists
const mlResponseSchema = z.object({
    transcribed: z.string().optional().nullable(),
});

// Parse the ML result
const result = (await mlResponse.json()) as Record<string, any>;
const validation = mlResponseSchema.safeParse(result);

// Validate
if (!validation.success) {
    logger.error("ML response validation failed", validation.error);
    return res.status(500).json({ success: false, error: "Invalid response from ML service." });
}

const transcribedText = String(validation.data.transcribed || "").trim();

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

            if (transcribedText === "") {
                verificationResult = {
                    status: "transcription_failed",
                    cdsco_registered: false,
                    medicine_name_english: transcribedText,
                    medicine_name_regional: transcribedText,
                    manufacturer: "Unknown",
                    category: "Unknown",
                    warnings: ["Audio could not be transcribed. Please try again."],
                };
                result.verification = verificationResult;
                return res.json(result);
            }

            // ── Layer 2: Check cache by transcribed text BEFORE hitting Supabase ───────
            if (transcribedText) {
                const cachedByText = await getCachedVoiceResult(transcribedText);
                if (cachedByText) {
                    logger.info(
                        `Voice verification served from text cache for: "${transcribedText}"`
                    );
                    // Also back-fill the audio hash cache so future identical audio skips ML too
                    await setCachedVoiceByAudioHash(audioHash, cachedByText);
                    return res.json(cachedByText);
                }

                // ── Cache miss — query Supabase ──────────────────────────────────────────
                logger.info(`Voice cache MISS for: "${transcribedText}". Querying Supabase...`);
                const { data: medicines } = await supabase
                    .from("medicines")
                    .select("brand_name, generic_name, manufacturer, is_cdsco_verified")
                    .or(buildMedicineVoiceSearchFilter(transcribedText))
                    .limit(1);

                if (medicines && medicines.length > 0) {
                    const med = medicines[0];
                    verificationResult = {
                        status: med.is_cdsco_verified ? "verified" : "not_found",
                        cdsco_registered: med.is_cdsco_verified || false,
                        medicine_name_english:
                            med.brand_name || med.generic_name || transcribedText,
                        medicine_name_regional: transcribedText,
                        manufacturer: med.manufacturer || "Unknown",
                        category: "Medicine",
                        warnings: [],
                    };
                }

                result.verification = verificationResult;

                // Populate both cache layers for future requests
                await Promise.all([
                    setCachedVoiceResult(transcribedText, result),
                    setCachedVoiceByAudioHash(audioHash, result),
                ]);

                return res.json(result);
            }

            result.verification = verificationResult;
            return res.json(result);
        } catch (err) {
            logger.error("Voice verification error", err);
            return res
                .status(500)
                .json({ success: false, error: "Internal server error. Please try again." });
        }
    }
);

/**
 * GET /api/medicine/languages
 * Returns supported Indian languages from ML service.
 */
router.get("/languages", async (_req: Request, res: Response) => {
    try {
        if (!ML_SERVICE_URL) {
            return res.status(503).json({ error: "ML service not configured" });
        }

        const mlResponse = await fetch(`${ML_SERVICE_URL}/voice/languages`);
        const data = await mlResponse.json();
        res.json(data);
    } catch {
        res.status(500).json({ error: "Could not fetch supported languages." });
    }
});

export default router;
