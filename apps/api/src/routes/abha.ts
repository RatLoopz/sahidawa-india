import { Router, Request, Response } from "express";
import {
    generateOTP,
    verifyOTP,
    getPrescriptions,
    uploadVerification,
    unlinkABHA,
} from "../services/abha.service";

const router = Router();

// POST /api/v1/abha/link
// Initiates ABHA linking by generating an OTP for the given ABHA address
router.post("/link", async (req: Request, res: Response): Promise<void> => {
    try {
        const { abhaAddress } = req.body;

        if (!abhaAddress) {
            res.status(400).json({ error: "abhaAddress is required" });
            return;
        }

        const result = await generateOTP(abhaAddress);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Failed to generate OTP",
        });
    }
});

// POST /api/v1/abha/verify-otp
// Verifies the OTP and returns an ABHA token
router.post("/verify-otp", async (req: Request, res: Response): Promise<void> => {
    try {
        const { txnId, otp } = req.body;

        if (!txnId || !otp) {
            res.status(400).json({ error: "txnId and otp are required" });
            return;
        }

        const result = await verifyOTP(txnId, otp);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Failed to verify OTP",
        });
    }
});

// GET /api/v1/abha/prescriptions
// Fetches prescriptions for the current user from abha_records
router.get("/prescriptions", async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.headers["x-user-id"] as string;

        if (!userId) {
            res.status(401).json({ error: "User authentication required" });
            return;
        }

        const result = await getPrescriptions(userId);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Failed to fetch prescriptions",
        });
    }
});

// POST /api/v1/abha/upload-verification
// Uploads a medicine verification result to abha_records for the current user
router.post("/upload-verification", async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.headers["x-user-id"] as string;

        if (!userId) {
            res.status(401).json({ error: "User authentication required" });
            return;
        }

        const { medicineId, verificationResult, scannedAt } = req.body;

        if (!medicineId || !verificationResult || !scannedAt) {
            res.status(400).json({
                error: "medicineId, verificationResult, and scannedAt are required",
            });
            return;
        }

        const result = await uploadVerification(userId, {
            medicineId,
            verificationResult,
            scannedAt,
        });

        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Failed to upload verification",
        });
    }
});

// DELETE /api/v1/abha/unlink
// Soft-deletes the ABHA link for the current user by setting is_active to false
router.delete("/unlink", async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.headers["x-user-id"] as string;

        if (!userId) {
            res.status(401).json({ error: "User authentication required" });
            return;
        }

        const result = await unlinkABHA(userId);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Failed to unlink ABHA",
        });
    }
});

export default router;
