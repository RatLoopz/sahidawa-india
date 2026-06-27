import { Router, Request, Response } from "express";
import logger from "../utils/logger";
import { anonSupabase } from "../db/supabase";

const router = Router();

import { z } from "zod";
import { redisClient } from "../utils/redis";
import { eligibilityLimiter } from "../middleware/rateLimit";

const eligibilitySchema = z.object({
    age: z.number().int().min(0, "Age cannot be negative").optional().default(30),
    annual_income: z.number().min(0, "Income cannot be negative").optional().default(150000),
    family_size: z.number().int().min(1, "Family size must be at least 1").optional().default(4),
    state: z.string().trim().optional().default(""),
    has_bpl_card: z.boolean().optional().default(false),
    has_abha_id: z.boolean().optional().default(false),
});

type EligibilityBody = z.infer<typeof eligibilitySchema>;

/**
 * @openapi
 * /api/v1/scheme-eligibility:
 *   post:
 *     tags:
 *       - Scheme Eligibility
 *     summary: Check eligibility for Ayushman Bharat & State health schemes
 *     description: Determines which public healthcare schemes a user qualifies for based on demographics.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               age:
 *                 type: number
 *                 example: 45
 *               annual_income:
 *                 type: number
 *                 example: 80000
 *               family_size:
 *                 type: number
 *                 example: 5
 *               state:
 *                 type: string
 *                 example: "Maharashtra"
 *               has_bpl_card:
 *                 type: boolean
 *                 example: true
 *               has_abha_id:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Eligible schemes returned
 *       500:
 *         description: Server error
 */
router.post("/", eligibilityLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
        const parseResult = eligibilitySchema.safeParse(req.body);
        if (!parseResult.success) {
            res.status(400).json({
                error: "Invalid request data",
                details: parseResult.error.issues,
            });
            return;
        }

        const { age, annual_income, family_size, state, has_bpl_card, has_abha_id } =
            parseResult.data;

        const income = Number(annual_income);
        const userState = (state || "").trim();

        const eligibleSchemes = [];

        // 1. Ayushman Bharat - PM-JAY (National Scheme)
        // Eligibility: BPL Card OR Annual Income <= 2,50,000 OR ABHA ID (rural integration)
        if (has_bpl_card || income <= 250000 || has_abha_id) {
            eligibleSchemes.push({
                name: "Ayushman Bharat - PM-JAY",
                description:
                    "India's flagship national public health insurance scheme providing cashless secondary and tertiary care hospitalization.",
                coverage:
                    "Cashless coverage of up to ₹5 Lakh (₹5,00,000) per family per year for secondary and tertiary care hospitalizations.",
                how_to_apply:
                    "Visit your nearest Empaneled Hospital or Common Service Center (CSC) with your Aadhar Card, BPL Card/Ration Card, or ABHA Card. You can also self-verify on the PM-JAY Beneficiary Portal.",
                link: "https://beneficiary.nha.gov.in/",
            });
        }

        // 2. State Specific Schemes
        let foundStateScheme = false;

        if (userState) {
            const cacheKey = `schemes:state:${userState.toLowerCase()}`;
            let data: any[] | null = null;

            if (redisClient.isOpen) {
                try {
                    const cached = await redisClient.get(cacheKey);
                    if (cached) {
                        data = JSON.parse(cached);
                    }
                } catch (err) {
                    logger.warn({ message: "Redis get error in eligibility", error: String(err) });
                }
            }

            if (!data) {
                const { data: dbData, error } = await anonSupabase
                    .from("health_schemes")
                    .select("*")
                    .ilike("state_name", `%${userState}%`);

                if (error) {
                    logger.error("Failed to query health_schemes", { error });
                }

                data = dbData as any[] | null;

                if (data && redisClient.isOpen) {
                    try {
                        await redisClient.setEx(cacheKey, 604800, JSON.stringify(data));
                    } catch (err) {
                        logger.warn({
                            message: "Redis set error in eligibility",
                            error: String(err),
                        });
                    }
                }
            }

            if (data && data.length > 0) {
                foundStateScheme = true;
                for (const scheme of data) {
                    eligibleSchemes.push({
                        name: scheme.scheme_name,
                        description: scheme.description,
                        coverage: scheme.coverage,
                        how_to_apply: scheme.how_to_apply,
                        link: scheme.link,
                    });
                }
            }
        }

        if (!foundStateScheme) {
            // General state insurance schemes fallback for other states
            if (income <= 300000 || has_bpl_card) {
                eligibleSchemes.push({
                    name: "State Government Health Insurance (SGHIS)",
                    description:
                        "Cashless state-sponsored healthcare scheme integrated with Central National Health Authority guidelines.",
                    coverage:
                        "Cashless hospitalization benefits up to ₹3 Lakh to ₹5 Lakh per family per year at empaneled government/private hospitals.",
                    how_to_apply:
                        "Visit your local Block Development Office (BDO) or Chief Medical Officer's (CMO) helpdesk with Aadhaar card, income details, and BPL card.",
                    link: "https://nha.gov.in/",
                });
            }
        }

        // 3. PM Jan Aushadhi Scheme (Generic Medicines Support)
        // Eligible for everyone (universal)
        eligibleSchemes.push({
            name: "Pradhan Mantri Bhartiya Janaushadhi Pariyojana (PMBJP)",
            description:
                "A universal campaign by the Government of India to provide quality generic medicines at affordable prices to all citizens.",
            coverage:
                "Saves up to 50% to 90% on essential medicines compared to branded options. Cash purchases available at local PMBJP kendras.",
            how_to_apply:
                "Open to all Indian citizens. Just take your doctor's prescription (branded or generic) to the nearest Jan Aushadhi Store.",
            link: "http://janaushadhi.gov.in/",
        });

        // 4. Senior Citizen Health Insurance Scheme (SCHIS)
        if (age >= 60 && (income <= 300000 || has_bpl_card)) {
            eligibleSchemes.push({
                name: "Rashtriya Vayoshri Yojana & Senior Citizen Health Coverage",
                description:
                    "Central scheme providing physical aids, assisted living devices, and additional top-up medical coverage for elderly citizens.",
                coverage:
                    "Additional health benefits, specialized geriatric care, and free physical aids for senior citizens from low-income groups.",
                how_to_apply:
                    "Apply at District Social Welfare Officer desk or online portals. Bring Senior Citizen certificate (Age proof), Aadhaar card, and BPL ration card.",
                link: "https://socialjustice.gov.in/",
            });
        }

        res.status(200).json({ eligible_schemes: eligibleSchemes });
    } catch (error) {
        logger.error("Error in scheme eligibility evaluation", { error });
        res.status(500).json({ error: "Failed to evaluate scheme eligibility" });
    }
});

export default router;
