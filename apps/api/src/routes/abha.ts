import { Router, Request, Response } from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { limiter } from "../middleware/rateLimit";
import { z } from "zod";
import {
    generateOTP,
    verifyOTP,
    getPrescriptions,
    uploadVerification,
    unlinkABHA,
} from "../services/abha.service";

// Zod schemas for validating ABHA route request bodies.
// abhaAddress format is ultimately validated by ABDM itself (see
// "Invalid ABHA address:" error in abha.service.ts) — we only guard
// against wrong types / empty values here, not ABDM's exact format rules.
const linkSchema = z.object({
    abhaAddress: z.string().trim().min(1).max(256),
});

const verifyOtpSchema = z.object({
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
router.post("/verify-otp", limiter, async (req: Request, res: Response): Promise<void> => {
    try {
        const parsed = verifyOtpSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                error: "Invalid OTP verification payload",
                issues: parsed.error.issues,
            });
            return;
        }

        const result = await verifyOTP(parsed.data.txnId, parsed.data.otp);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Failed to verify OTP",
        });
    }
});

// GET /api/v1/abha/prescriptions
// Fetches prescriptions for the current user from abha_records
router.get(
    "/prescriptions",
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

export default router;
