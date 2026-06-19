import { Router, Request, Response } from "express";
import logger from "../utils/logger";

const router = Router();

interface EligibilityBody {
    age?: number;
    annual_income?: number;
    family_size?: number;
    state?: string;
    has_bpl_card?: boolean;
    has_abha_id?: boolean;
}

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
router.post("/", async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            age = 30,
            annual_income = 150000,
            family_size = 4,
            state = "",
            has_bpl_card = false,
            has_abha_id = false,
        } = req.body as EligibilityBody;

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
        const normalizedState = userState.toLowerCase();

        if (normalizedState.includes("maharashtra")) {
            if (has_bpl_card || income <= 150000) {
                eligibleSchemes.push({
                    name: "Mahatma Jyotirao Phule Jan Arogya Yojana (MJPJAY)",
                    description:
                        "Cashless health insurance scheme by the Government of Maharashtra for low-income families and identified vulnerable categories.",
                    coverage:
                        "Cashless healthcare services for identified specialty services up to ₹1.5 Lakh to ₹5 Lakh per family per year.",
                    how_to_apply:
                        "Visit a network hospital or District General Hospital. Speak to the 'Arogyamitra' helper desk with your yellow/orange ration card, Aadhaar card, and income certificate.",
                    link: "https://www.jeevandayee.gov.in/",
                });
            }
        } else if (normalizedState.includes("gujarat")) {
            if (income <= 400000) {
                eligibleSchemes.push({
                    name: "Mukhyamantri Amrutam (MA) Yojana",
                    description:
                        "Cashless tertiary care treatment program for Below Poverty Line (BPL) and middle-income families in Gujarat.",
                    coverage:
                        "Cashless treatment up to ₹5 Lakh per family per year for major illnesses including cardiac surgery, oncology, and renal diseases.",
                    how_to_apply:
                        "Visit the civic center or taluka office. Submit your income certificate, Aadhaar card, and family details to get your MA Card.",
                    link: "http://www.magujarat.com/",
                });
            }
        } else if (normalizedState.includes("tamil nadu")) {
            if (income <= 120000 || has_bpl_card) {
                eligibleSchemes.push({
                    name: "Chief Minister's Comprehensive Health Insurance Scheme (CMCHIS)",
                    description:
                        "State-funded cashless hospital services program in Tamil Nadu for eligible low-income families.",
                    coverage:
                        "Quality medical care up to ₹5 Lakh per family per year through empaneled government and private hospitals.",
                    how_to_apply:
                        "Apply at the District Collectorate Office. Bring your Smart Family Card, Income Certificate, and Identity Proof to receive your biometric CMCHIS card.",
                    link: "https://www.cmchistn.com/",
                });
            }
        } else if (normalizedState.includes("karnataka")) {
            eligibleSchemes.push({
                name: "Ayushman Bharat - Arogya Karnataka (AB-Ark)",
                description:
                    "Integrated health insurance scheme combining PM-JAY and state benefits for residents of Karnataka.",
                coverage:
                    "Cashless treatment up to ₹5 Lakh per year for BPL (eligible) families, and co-payment benefits for APL (general) families.",
                how_to_apply:
                    "Visit any government primary health center or hospital. Present your Ration Card (BPL/APL) and Aadhaar card to generate your AB-Ark Health ID.",
                link: "https://arogya.karnataka.gov.in/",
            });
        } else if (normalizedState.includes("kerala")) {
            if (has_bpl_card || income <= 300000) {
                eligibleSchemes.push({
                    name: "Karunya Arogya Suraksha Padhathi (KASP)",
                    description:
                        "Universal healthcare scheme of Kerala offering cashless treatments for families in need.",
                    coverage:
                        "Comprehensive coverage of up to ₹5 Lakh per family per year for secondary and tertiary care treatments.",
                    how_to_apply:
                        "Register at any government hospital or empaneled private hospital. Bring your Aadhaar Card, Ration Card, and RSBY legacy card.",
                    link: "https://sha.kerala.gov.in/",
                });
            }
        } else if (
            normalizedState.includes("andhra pradesh") ||
            normalizedState.includes("telangana")
        ) {
            if (income <= 500000 || has_bpl_card) {
                eligibleSchemes.push({
                    name: "Dr. YSR Aarogyasri Health Scheme",
                    description:
                        "Flagship cashless healthcare scheme targeting poor and middle-income families in Andhra Pradesh/Telangana.",
                    coverage:
                        "Cashless treatment for listed therapies and procedures up to ₹5 Lakh per year per family.",
                    how_to_apply:
                        "Visit any YSR Aarogyasri kiosk at network hospitals. Present your rice card (Ration card) or health card along with your Aadhaar card.",
                    link: "https://www.aarogyasri.ap.gov.in/",
                });
            }
        } else {
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
