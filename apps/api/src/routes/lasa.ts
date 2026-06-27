import { Router, Request, Response } from "express";
import { detectLasaConflicts } from "../services/lasa.service";
import { lasaLimiter } from "../middleware/rateLimit";
import logger from "../utils/logger";

// Maximum length for a medicine name search string.
// Real medicine names are at most 100 characters. Accepting unbounded strings
// allows callers to send kilobyte-scale payloads to a full-text similarity RPC,
// amplifying database CPU cost per request.
const MAX_MEDICINE_NAME_LENGTH = 200;

const router = Router();

/**
 * @openapi
 * /api/v1/lasa/check:
 *   post:
 *     tags:
 *       - LASA
 *     summary: Check Look-Alike Sound-Alike medicine conflicts
 *     description: Detects medicines with similar names that may lead to medication errors.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - medicineName
 *             properties:
 *               medicineName:
 *                 type: string
 *                 example: Dopamine
 *     responses:
 *       200:
 *         description: LASA conflicts checked successfully
 *       400:
 *         description: Invalid medicine name
 *       500:
 *         description: Failed to perform LASA check
 */

router.post("/check", lasaLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
        const { medicineName } = req.body;

        if (!medicineName || typeof medicineName !== "string") {
            res.status(400).json({ error: "medicineName is required" });
            return;
        }

        if (medicineName.length > MAX_MEDICINE_NAME_LENGTH) {
            res.status(400).json({
                error: `medicineName must not exceed ${MAX_MEDICINE_NAME_LENGTH} characters`,
            });
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
