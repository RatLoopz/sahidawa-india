import { Request, Response as ExpressResponse, Router } from "express";

const router = Router();

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

async function fetchWithTimeout(url: string, options: RequestInit): Promise<globalThis.Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timeoutId);
    }
}

router.post("/", async (req: Request, res: ExpressResponse) => {
    const cloudinaryUrl = typeof req.body?.cloudinaryUrl === "string" ? req.body.cloudinaryUrl : "";
    const medicineName = typeof req.body?.medicineName === "string" ? req.body.medicineName : undefined;

    if (!cloudinaryUrl) {
        return res.status(400).json({
            success: false,
            error: "cloudinaryUrl is required",
        });
    }

    try {
        const mlResponse = await fetchWithTimeout(`${ML_SERVICE_URL}/api/v1/compare`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                cloudinary_url: cloudinaryUrl,
                medicine_name: medicineName,
            }),
        });

        const responseBody = (await mlResponse.json()) as {
            verdict?: string;
            confidence?: number;
            matched_reference?: string;
            processing_time_ms?: number;
            error?: string;
        };

        if (!mlResponse.ok) {
            throw new Error(responseBody.error || "ML service returned an error");
        }

        return res.json({
            success: true,
            data: {
                verdict: responseBody.verdict || "SUSPICIOUS",
                confidence: responseBody.confidence ?? 0,
                matchedReference: responseBody.matched_reference,
                processingTimeMs: responseBody.processing_time_ms ?? 0,
                error: responseBody.error,
            },
        });
    } catch {
        return res.json({
            success: true,
            data: {
                verdict: "SUSPICIOUS",
                confidence: 0,
                processingTimeMs: 0,
                error: "Analysis service temporarily unavailable. Please try again later.",
            },
        });
    }
});

export default router;
