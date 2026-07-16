import { Router, Request, Response } from "express";
import { z } from "zod";
import logger from "../utils/logger";
import { anonSupabase } from "../db/supabase";
import { dbConfig } from "../db/client";
import { redisClient } from "../utils/redis";
import { eligibilityLimiter } from "../middleware/rateLimit";
import {
    fetchPmjayEligibility,
    PmjayAuthError,
    PmjayTimeoutError,
    PmjayValidationError,
    PmjayUpstreamError,
    PmjayNetworkError,
} from "../services/governmentEligibility";

const router = Router();

// Static offline fallback — served when Supabase is unreachable.
interface StaticScheme {
    scheme_name: string;
    description: string;
    coverage: string;
    how_to_apply: string;
    link: string;
}

const OFFLINE_STATE_SCHEMES: Record<string, StaticScheme[]> = {
    maharashtra: [
        {
            scheme_name: "Mahatma Jyotiba Phule Jan Arogya Yojana (MJPJAY)",
            description:
                "State-funded cashless health insurance scheme for Below Poverty Line and other vulnerable families in Maharashtra, covering major surgeries and critical illnesses.",
            coverage:
                "Cashless treatment up to ₹1.5 Lakh per family per year (₹2.5 Lakh for defined critical illnesses) at empaneled hospitals.",
            how_to_apply:
                "Visit any empaneled network hospital with your Aadhar card, yellow/orange/antyodaya ration card. The hospital facilitates enrolment on the spot.",
            link: "https://www.jeevandayee.gov.in/",
        },
    ],
    delhi: [
        {
            scheme_name: "Delhi Arogya Kosh (DAK)",
            description:
                "Financial assistance scheme by the Delhi Government for BPL families requiring treatment for serious illnesses at empaneled government hospitals in Delhi.",
            coverage:
                "Up to ₹5 Lakh per annum for serious illnesses at Delhi government hospitals.",
            how_to_apply:
                "Apply through the CMO (Chief Medical Officer) at any empaneled government hospital in Delhi with a BPL ration card and income certificate.",
            link: "https://health.delhi.gov.in/",
        },
    ],
    kerala: [
        {
            scheme_name: "Karunya Arogya Suraksha Padhathi (KASP)",
            description:
                "Kerala's flagship health insurance program replacing Rashtriya Swasthya Bima Yojana (RSBY), providing cashless in-patient care to BPL and vulnerable families.",
            coverage:
                "Cashless secondary and tertiary care up to ₹5 Lakh per family per year at empaneled government and private hospitals.",
            how_to_apply:
                "Enrol through your nearest Akshaya Centre or Primary Health Centre (PHC) with your Aadhaar card and BPL/priority household ration card.",
            link: "https://kasp.kerala.gov.in/",
        },
    ],
    karnataka: [
        {
            scheme_name: "Ayushman Bharat - Arogya Karnataka (AB-ArK)",
            description:
                "Karnataka's integrated health protection scheme combining Ayushman Bharat PM-JAY with state-specific top-ups, covering all residents regardless of income.",
            coverage:
                "Universal coverage up to ₹5 Lakh for BPL families; general (APL) families covered for secondary care up to ₹1.5 Lakh per year.",
            how_to_apply:
                "Visit any empaneled government or private hospital with your Aadhaar card. For APL families, a SSLC certificate or voter ID may be required.",
            link: "https://arogyakarnataka.gov.in/",
        },
    ],
    "uttar pradesh": [
        {
            scheme_name: "Ayushman Bharat - Mukhyamantri Jan Arogya Yojana (AB-MJAY UP)",
            description:
                "Uttar Pradesh's state-extended version of Ayushman Bharat PM-JAY, expanding coverage to additional families not covered under the central scheme.",
            coverage:
                "Cashless hospitalization up to ₹5 Lakh per family per year at empaneled hospitals across Uttar Pradesh.",
            how_to_apply:
                "Check eligibility at the PM-JAY portal or your nearest Common Service Center (CSC) / government hospital with your Aadhaar card and ration card.",
            link: "https://shasya.sects.up.gov.in/",
        },
    ],
    "tamil nadu": [
        {
            scheme_name: "Chief Minister's Comprehensive Health Insurance Scheme (CMCHIS)",
            description:
                "Tamil Nadu's flagship health insurance scheme providing free cashless medical treatment for serious and life-threatening illnesses to BPL and low-income families.",
            coverage:
                "Cashless treatment up to ₹5 Lakh per family per year (₹4 Lakh base + ₹1 Lakh top-up) for 1,027+ procedures at empaneled hospitals.",
            how_to_apply:
                "Register at your nearest Government Hospital or Primary Health Centre with your Aadhaar card and family ration card (any colour).",
            link: "https://www.cmchistn.com/",
        },
    ],
};

const eligibilitySchema = z.object({
    age: z.number().int().min(0, "Age cannot be negative").optional().default(30),
    annual_income: z.number().min(0, "Income cannot be negative").optional().default(150000),
    family_size: z.number().int().min(1, "Family size must be at least 1").optional().default(4),
    state: z
        .string()
        .trim()
        .max(80, "State name is too long")
        .regex(/^[a-zA-Z\s'&-]*$/, "State name contains invalid characters")
        .optional()
        .default(""),
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

        // Try PM-JAY government API if credentials are configured.
        const isPmjayConfigured = !!(process.env.PMJAY_BASE_URL && process.env.PMJAY_API_KEY);
        if (isPmjayConfigured) {
            try {
                const eligible_schemes = await fetchPmjayEligibility({
                    age,
                    annual_income: income,
                    family_size,
                    state: userState,
                    has_bpl_card,
                    has_abha_id,
                });

                logger.info("Returned eligibility from PM-JAY API", {
                    count: eligible_schemes.length,
                });
                res.status(200).json({ eligible_schemes });
                return;
            } catch (err: any) {
                logger.error("Error calling PM-JAY eligibility service", {
                    error: err.message || String(err),
                    name: err.name,
                });

                if (err instanceof PmjayAuthError) {
                    res.status(401).json({
                        error: "Authentication failed with PM-JAY API",
                        details: err.message,
                    });
                    return;
                }
                if (err instanceof PmjayTimeoutError) {
                    res.status(504).json({
                        error: "PM-JAY API request timed out",
                        details: err.message,
                    });
                    return;
                }
                if (err instanceof PmjayValidationError) {
                    res.status(502).json({
                        error: "Invalid response format from PM-JAY API",
                        details: err.message,
                    });
                    return;
                }
                if (err instanceof PmjayUpstreamError) {
                    res.status(502).json({
                        error: `PM-JAY upstream error: ${err.message}`,
                        details: err.message,
                    });
                    return;
                }
                if (err instanceof PmjayNetworkError) {
                    res.status(502).json({
                        error: "Network communication error with PM-JAY API",
                        details: err.message,
                    });
                    return;
                }

                res.status(500).json({
                    error: "Internal server error during eligibility check",
                    details: err.message || String(err),
                });
                return;
            }
        }

        const eligibleSchemes = [];

        // 1. Ayushman Bharat - PM-JAY (National Scheme)
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
                // Use static fallback if Supabase is offline, otherwise query DB.
                if (dbConfig.isSupabaseOffline) {
                    logger.warn(
                        "Supabase is offline — using static offline fallback for state health schemes",
                        { state: userState }
                    );
                    data = OFFLINE_STATE_SCHEMES[userState.toLowerCase()] ?? null;
                } else {
                    try {
                        const { data: dbData, error } = await anonSupabase
                            .from("health_schemes")
                            .select("*")
                            .ilike("state_name", `%${userState}%`);

                        if (error) {
                            // DB error — fall back to static data.
                            logger.error(
                                "Failed to query health_schemes — falling back to offline static data",
                                { error }
                            );
                            data = OFFLINE_STATE_SCHEMES[userState.toLowerCase()] ?? null;
                        } else {
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
                    } catch (dbErr) {
                        // Unexpected DB exception — fall back to static data.
                        logger.error(
                            "Unexpected error querying health_schemes — falling back to offline static data",
                            { error: String(dbErr) }
                        );
                        data = OFFLINE_STATE_SCHEMES[userState.toLowerCase()] ?? null;
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

        if (!foundStateScheme && (income <= 300000 || has_bpl_card)) {
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

        // 3. PM Jan Aushadhi Scheme (universal)
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

        // 4. Senior Citizen Health Coverage
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
