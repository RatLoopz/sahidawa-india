import { Router, Request, Response } from "express";
import { z } from "zod";

const router = Router();

const analyzeRequestSchema = z.object({
    imageUrl: z.string().url().startsWith("https://", "imageUrl must be an HTTPS URL"),
});

const analyzeResponseSchema = z.object({
    isFake: z.boolean(),
    confidence: z.number().min(0).max(1),
    verdict: z.enum(["likely_genuine", "suspicious", "likely_fake"]),
    details: z.string(),
});

const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://localhost:8000";
const ML_ANALYSIS_TIMEOUT_MS = 8000;

router.post("/analyze", async (req: Request, res: Response) => {
    const parsed = analyzeRequestSchema.safeParse(req.body);

    if (!parsed.success) {
        res.status(400).json({
            error: "Invalid request body",
            details: parsed.error.issues,
        });
        return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ML_ANALYSIS_TIMEOUT_MS);

    try {
        const mlResponse = await fetch(`${ML_SERVICE_URL}/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(parsed.data),
            signal: controller.signal,
        });

        const body = (await mlResponse.json().catch(() => ({}))) as unknown;

        if (!mlResponse.ok) {
            res.status(mlResponse.status).json({
                error: "Image analysis failed",
                details:
                    typeof body === "object" && body !== null && "detail" in body
                        ? (body as { detail?: unknown }).detail
                        : undefined,
            });
            return;
        }

        const analysis = analyzeResponseSchema.safeParse(body);
        if (!analysis.success) {
            res.status(502).json({ error: "Image analysis service returned an invalid response" });
            return;
        }

        res.status(200).json(analysis.data);
    } catch (error) {
        const isAbort = error instanceof Error && error.name === "AbortError";
        res.status(isAbort ? 504 : 502).json({
            error: isAbort ? "Image analysis timed out" : "Image analysis service is unavailable",
        });
    } finally {
        clearTimeout(timeout);
    }
});

export default router;
