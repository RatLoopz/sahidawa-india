import { Router, Request, Response } from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { limiter } from "../middleware/rateLimit";
import { z } from "zod";
import crypto from "crypto";
import {
    generateOTP,
    verifyOTP,
    getPrescriptions,
    uploadVerification,
    unlinkABHA,
    getAbhaStatus,
    generatePkcePair,
    getAuthorizationUrl,
    exchangeAuthCode,
    downloadHealthRecords,
} from "../services/abha.service";

// In-memory token storage tracker mapping short lived state criteria
const pkceSessionStore = new Map<string, { codeVerifier: string; userId: string }>();

// Zod schemas for validating ABHA route request bodies.
// abhaAddress format is ultimately validated by ABDM itself (see
// "Invalid ABHA address:" error in abha.service.ts) — we only guard
// against wrong types / empty values here, not ABDM's exact format rules.
const linkSchema = z.object({
    abhaAddress: z.string().trim().min(1).max(256),
});

const verifyOtpSchema = z.object({
    abhaAddress: z.string().trim().min(1).max(256),
    txnId: z.string().trim().min(1),
    otp: z
        .string()
        .trim()
        .regex(/^\d{4,8}$/, "OTP must be 4-8 digits"),
});

const uploadVerificationSchema = z.object({
    medicineId: z.string().trim().min(1),
    verificationResult: z.string().trim().min(1),
    scannedAt: z.string().datetime(),
});

const router = Router();

// POST /api/v1/abha/link
// Initiates ABHA linking by generating an OTP for the given ABHA address
router.post("/link", limiter, async (req: Request, res: Response): Promise<void> => {
    try {
        const parsed = linkSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                error: "Invalid link payload",
                issues: parsed.error.issues,
            });
            return;
        }

        const result = await generateOTP(parsed.data.abhaAddress);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Failed to generate OTP",
        });
    }
});

// POST /api/v1/abha/verify-otp
// Verifies the OTP and returns an ABHA token
router.post(
    "/verify-otp",
    limiter,
    requireAuth,
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            const parsed = verifyOtpSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({
                    error: "Invalid OTP verification payload",
                    issues: parsed.error.issues,
                });
                return;
            }

            const result = await verifyOTP(
                userId,
                parsed.data.abhaAddress,
                parsed.data.txnId,
                parsed.data.otp
            );
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : "Failed to verify OTP",
            });
        }
    }
);

// GET /api/v1/abha/status
// Checks if the user has an active ABHA link
router.get(
    "/status",
    limiter,
    requireAuth,
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            const result = await getAbhaStatus(userId);
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : "Failed to check ABHA status",
            });
        }
    }
);

// GET /api/v1/abha/prescriptions
// Fetches prescriptions for the current user from abha_records
router.get(
    "/prescriptions",
    limiter,
    requireAuth,
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            const result = await getPrescriptions(userId);
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : "Failed to fetch prescriptions",
            });
        }
    }
);

// POST /api/v1/abha/upload-verification
// Uploads a medicine verification result to abha_records for the current user
router.post(
    "/upload-verification",
    limiter,
    requireAuth,
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            const parsed = uploadVerificationSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({
                    error: "Invalid verification upload payload",
                    issues: parsed.error.issues,
                });
                return;
            }

            const result = await uploadVerification(userId, parsed.data);

            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : "Failed to upload verification",
            });
        }
    }
);

// DELETE /api/v1/abha/unlink
// Soft-deletes the ABHA link for the current user by setting is_active to false
router.delete(
    "/unlink",
    limiter,
    requireAuth,
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            const result = await unlinkABHA(userId);
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : "Failed to unlink ABHA",
            });
        }
    }
);

// GET /api/v1/abha/authorize
// Generates authorization target payload URL
router.get("/authorize", limiter, requireAuth, async (req: any, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const { codeVerifier, codeChallenge } = generatePkcePair();
        const state = crypto.randomBytes(16).toString("hex");

        // Save session data for verification within callback boundary
        pkceSessionStore.set(state, { codeVerifier, userId });

        // Auto flush trace tokens after 5 mins safely
        setTimeout(() => pkceSessionStore.delete(state), 5 * 60 * 1000);

        const authUrl = await getAuthorizationUrl(codeChallenge, state);
        res.status(200).json({ url: authUrl, state });
    } catch (error: any) {
        res.status(500).json({
            error: error.message || "Failed to configure authentication link parameters",
        });
    }
});

// GET /api/v1/abha/callback
// Handles ABDM redirect execution flow
router.get("/callback", limiter, async (req: Request, res: Response): Promise<void> => {
    try {
        const { code, state } = req.query;
        if (!code || !state) {
            res.status(400).json({
                error: "Missing authorization code structure or state token mismatch",
            });
            return;
        }

        const cachedSession = pkceSessionStore.get(state as string);
        if (!cachedSession) {
            res.status(400).json({
                error: "Stale state transaction configuration or session timeout error",
            });
            return;
        }

        pkceSessionStore.delete(state as string); // Explicit single use assertion logic

        await exchangeAuthCode(cachedSession.userId, code as string, cachedSession.codeVerifier);
        res.status(200).json({
            message: "ABHA profiles bound via secure PKCE handshake successfully",
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || "PKCE exchange process failed" });
    }
});

// GET /api/v1/abha/health-records
// Syncs and downlinks FHIR metrics
router.get(
    "/health-records",
    limiter,
    requireAuth,
    async (req: any, res: Response): Promise<void> => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            const metricsResult = await downloadHealthRecords(userId);
            res.status(200).json(metricsResult);
        } catch (error: any) {
            res.status(500).json({
                error: error.message || "Records processing engine encountered an error",
            });
        }
    }
);

export default router;
