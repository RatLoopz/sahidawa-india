import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import {
    generateOTP,
    verifyOTP,
    getPrescriptions,
    uploadVerification,
    unlinkABHA,
} from "../services/abha.service";

const router = Router();

const abhaLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later" },
});

router.post("/link", abhaLimiter, async (req: Request, res: Response): Promise<void> => {
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

router.post("/verify-otp", abhaLimiter, async (req: Request, res: Response): Promise<void> => {
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

router.get("/prescriptions", async (_req: Request, res: Response): Promise<void> => {
    try {
        const result = await getPrescriptions();
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Failed to fetch prescriptions",
        });
    }
});

router.post("/upload-verification", async (_req: Request, res: Response): Promise<void> => {
    try {
        const result = await uploadVerification();
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Failed to upload verification",
        });
    }
});

router.delete("/unlink", async (_req: Request, res: Response): Promise<void> => {
    try {
        const result = await unlinkABHA();
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Failed to unlink ABHA",
        });
    }
});

export default router;
