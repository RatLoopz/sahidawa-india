import { Router, Request, Response, NextFunction } from "express";
import { supabase } from "../db/client";
import { limiter } from "../middleware/rateLimit";
import logger from "../utils/logger";
import { PharmacyPartnerRegistrationSchema } from "@sahidawa/validators";

const router = Router();

/**
 * @openapi
 * /api/partner/register:
 *   post:
 *     summary: Register a new pharmacy partner
 *     tags:
 *       - Partners
 *     responses:
 *       201:
 *         description: Pharmacy partner registered successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post("/register", limiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const parsed = PharmacyPartnerRegistrationSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                error: "Invalid partner registration payload",
                issues: parsed.error.issues,
            });
            return;
        }

        const { data } = parsed;

        // Insert into Supabase
        const { error } = await supabase.from("pharmacy_partners").insert([
            {
                pharmacy_name: data.pharmacy_name,
                pharmacist_name: data.pharmacist_name,
                license_number: data.license_number,
                phone_number: data.phone_number,
                email: data.email || null,
                address: data.address,
                city: data.city,
                state: data.state,
                pincode: data.pincode,
                latitude: data.latitude || null,
                longitude: data.longitude || null,
                status: "pending",
            },
        ]);

        if (error) {
            if (error.code === "23505") {
                // unique violation on license_number
                res.status(409).json({
                    error: "A pharmacy with this license number is already registered.",
                });
                return;
            }
            logger.error("Failed to register pharmacy partner", { error });
            res.status(500).json({ error: "Failed to register pharmacy partner" });
            return;
        }

        res.status(201).json({ message: "Registration successful. Pending verification." });
    } catch (err) {
        next(err);
    }
});

export default router;
