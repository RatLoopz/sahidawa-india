import { Router, Response } from "express";
import { z } from "zod";
import { promises as dns } from "node:dns";
import { getMlServiceUrl, MISSING_ML_SERVICE_URL_MESSAGE } from "../config/mlService";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import logger from "../utils/logger";

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

const PRIVATE_IP_RE =
    /^(127\.\d{1,3}\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3}|::1|::ffff:127\.\d{1,3}\.\d{1,3}\.\d{1,3}|0\.0\.0\.0)$/;

const LINK_LOCAL_HOSTNAMES = [".local", ".internal", ".nip.io", ".localtest.me"];

const PRIVATE_HOSTNAME_RE =
    /^(localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3}|::1|::ffff:127\.\d{1,3}\.\d{1,3}\.\d{1,3}|0\.0\.0\.0)$/;

function isPrivateIp(ip: string): boolean {
    return PRIVATE_IP_RE.test(ip);
}

async function isPrivateHostname(urlStr: string): Promise<boolean> {
    try {
        const hostname = new URL(urlStr).hostname;
        if (PRIVATE_HOSTNAME_RE.test(hostname)) return true;
        if (LINK_LOCAL_HOSTNAMES.some((s) => hostname.endsWith(s))) return true;

        const addresses = await dns.resolve4(hostname);
        return addresses.some((addr) => isPrivateIp(addr));
    } catch {
        return true;
    }
}

const ML_ANALYSIS_TIMEOUT_MS = 8000;

router.post("/analyze", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const parsed = analyzeRequestSchema.safeParse(req.body);

    if (!parsed.success) {
        res.status(400).json({
            error: "Invalid request body",
            details: parsed.error.issues,
        });
        return;
    }

    if (await isPrivateHostname(parsed.data.imageUrl)) {
        logger.warn("SSRF attempt blocked", {
            imageUrl: parsed.data.imageUrl,
            caller: req.user?.email ?? req.user?.id,
        });
        res.status(400).json({
            error: "Invalid request body",
            details: [{ message: "imageUrl must point to a public HTTPS resource" }],
        });
        return;
    }

    const mlServiceUrl = getMlServiceUrl();
    if (!mlServiceUrl) {
        logger.error(MISSING_ML_SERVICE_URL_MESSAGE, { route: "/api/ml/analyze" });
        res.status(500).json({
            error: "Image analysis service is not configured.",
            code: "ML_SERVICE_URL_MISSING",
        });
        return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ML_ANALYSIS_TIMEOUT_MS);

    try {
        const mlResponse = await fetch(`${mlServiceUrl}/analyze`, {
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
