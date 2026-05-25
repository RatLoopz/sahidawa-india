import { Router, Request, Response } from "express";
import { detectLasaConflicts } from "../services/lasa.service";
import logger from "../utils/logger";

const router = Router();

router.post("/check", async (req: Request, res: Response): Promise<void> => {
    try {
        const { medicineName } = req.body;

        if (!medicineName || typeof medicineName !== "string") {
            res.status(400).json({ error: "medicineName is required" });
            return;
        }

        const matches = await detectLasaConflicts(medicineName);

        res.status(200).json({
            hasConflicts: matches.length > 0,
            matches,
        });
    } catch (error) {
        logger.error("Error in LASA check", { error });
        res.status(500).json({ error: "Failed to perform LASA check" });
    }
});

export default router;
