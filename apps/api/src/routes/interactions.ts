import { Router, Request, Response } from "express";
import { z } from "zod";
import { supabase, dbConfig } from "../db/client";
import logger from "../utils/logger";
import { escapeIlike } from "../utils/db";

const router = Router();

const checkSchema = z.object({
    medicines: z
        .array(z.string())
        .min(2, "At least two medicines are required to check interactions"),
});

// Brand name to generic name static mapping for local offline fallback
const localBrandMap: Record<string, string> = {
    crocin: "paracetamol",
    calpol: "paracetamol",
    dolo: "paracetamol",
    dolo650: "paracetamol",
    paracetamol: "paracetamol",
    coumadin: "warfarin",
    warfarin: "warfarin",
    aspirin: "aspirin",
    disprin: "aspirin",
    ibuprofen: "ibuprofen",
    brufen: "ibuprofen",
    viagra: "sildenafil",
    sildenafil: "sildenafil",
    nitroglycerin: "nitroglycerin",
    angised: "nitroglycerin",
    lipitor: "atorvastatin",
    atorvastatin: "atorvastatin",
    clarithromycin: "clarithromycin",
};

// Common clinical drug-drug interactions for offline fallback
interface LocalInteraction {
    drug_a_id: string;
    drug_b_id: string;
    severity: "critical" | "serious" | "moderate" | "minor";
    mechanism: string;
    description: string;
    clinical_recommendation: string;
    source: string;
}

const localInteractions: LocalInteraction[] = [
    {
        drug_a_id: "paracetamol",
        drug_b_id: "warfarin",
        severity: "serious",
        mechanism:
            "Prolonged regular use of paracetamol may enhance the anticoagulant effect of warfarin, increasing the risk of bleeding.",
        description: "Paracetamol may increase the blood-thinning effect of Warfarin.",
        clinical_recommendation:
            "Monitor INR closely if paracetamol is used regularly. Limit paracetamol use to short durations or lower doses if possible.",
        source: "DrugBank",
    },
    {
        drug_a_id: "aspirin",
        drug_b_id: "ibuprofen",
        severity: "moderate",
        mechanism:
            "NSAIDs like ibuprofen can interfere with the antiplatelet effect of low-dose aspirin and increase risk of gastrointestinal toxicity.",
        description: "Concomitant use increases risk of stomach ulcers and bleeding.",
        clinical_recommendation:
            "Avoid concurrent use or take ibuprofen at least 8 hours after or 30 minutes before immediate-release aspirin.",
        source: "NLM RxNav",
    },
    {
        drug_a_id: "sildenafil",
        drug_b_id: "nitroglycerin",
        severity: "critical",
        mechanism:
            "Co-administration of sildenafil with organic nitrates can cause severe, life-threatening hypotension.",
        description:
            "Nitroglycerin and Sildenafil combination can cause life-threatening drop in blood pressure.",
        clinical_recommendation:
            "Do NOT take Sildenafil if you are using nitroglycerin or any other nitrate medications.",
        source: "CDSCO Safety Alert",
    },
    {
        drug_a_id: "atorvastatin",
        drug_b_id: "clarithromycin",
        severity: "serious",
        mechanism:
            "Clarithromycin is a strong CYP3A4 inhibitor that can significantly increase atorvastatin concentration, raising risk of myopathy/rhabdomyolysis.",
        description:
            "Clarithromycin can significantly increase Atorvastatin levels, increasing risk of muscle toxicity.",
        clinical_recommendation:
            "Suspend Atorvastatin therapy during Clarithromycin treatment or use a lower dose of Atorvastatin.",
        source: "DrugBank",
    },
];

/**
 * Resolves a medicine input string (brand name, generic name, or ID) to its generic name.
 */
async function resolveToGeneric(input: string): Promise<{ input: string; generic: string }> {
    const cleanInput = input.trim();
    const lowerInput = cleanInput.toLowerCase();

    let dbFailed = dbConfig?.isSupabaseOffline;
    let genericName = cleanInput;

    if (!dbFailed) {
        try {
            const escaped = escapeIlike(cleanInput);
            const { data, error } = await supabase
                .from("medicines")
                .select("brand_name, generic_name")
                .or(
                    `id.eq.${escaped},brand_name.ilike.%${escaped}%,generic_name.ilike.%${escaped}%`
                )
                .limit(1)
                .maybeSingle();

            if (error) {
                dbFailed = true;
                if (
                    error.message?.includes("fetch failed") ||
                    error.message?.includes("refused") ||
                    error.message?.includes("timeout")
                ) {
                    if (dbConfig) dbConfig.isSupabaseOffline = true;
                }
            } else if (data && data.generic_name) {
                genericName = data.generic_name;
            }
        } catch (dbErr: any) {
            dbFailed = true;
            const msg = dbErr?.message || String(dbErr);
            if (
                msg.includes("fetch failed") ||
                msg.includes("refused") ||
                msg.includes("timeout")
            ) {
                if (dbConfig) dbConfig.isSupabaseOffline = true;
            }
        }
    }

    if (dbFailed) {
        // Fallback to local static map
        const mapped = localBrandMap[lowerInput.replace(/\s+/g, "")];
        if (mapped) {
            genericName = mapped;
        }
    }

    return { input: cleanInput, generic: genericName };
}

/**
 * @openapi
 * /api/v1/interactions/check:
 *   post:
 *     tags:
 *       - Medicine Interactions
 *     summary: Check for drug-drug interactions between multiple medicines
 *     description: >
 *       Accepts a list of medicines, resolves each to its generic name,
 *       and queries the interactions database to detect any harmful drug-drug interactions.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - medicines
 *             properties:
 *               medicines:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Crocin", "Warfarin"]
 *     responses:
 *       200:
 *         description: Check completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 interactions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       drugA:
 *                         type: string
 *                       drugAGeneric:
 *                         type: string
 *                       drugB:
 *                         type: string
 *                       drugBGeneric:
 *                         type: string
 *                       severity:
 *                         type: string
 *                       mechanism:
 *                         type: string
 *                       description:
 *                         type: string
 *                       clinical_recommendation:
 *                         type: string
 *                       source:
 *                         type: string
 */
router.post("/check", async (req: Request, res: Response) => {
    const parsed = checkSchema.safeParse(req.body);

    if (!parsed.success) {
        res.status(400).json({
            error: "Invalid request body",
            details: parsed.error.issues,
        });
        return;
    }

    const { medicines } = parsed.data;

    try {
        // 1. Resolve all inputs to generic names in parallel
        const resolvedList = await Promise.all(medicines.map((m) => resolveToGeneric(m)));

        const genericToOriginalMap = new Map<string, string>();
        resolvedList.forEach((r) => {
            genericToOriginalMap.set(r.generic.toLowerCase(), r.input);
        });

        const resolvedGenerics = Array.from(
            new Set(resolvedList.map((r) => r.generic.toLowerCase()))
        );

        // 2. Generate all unique pairs
        const pairs: [string, string][] = [];
        for (let i = 0; i < resolvedGenerics.length; i++) {
            for (let j = i + 1; j < resolvedGenerics.length; j++) {
                pairs.push([resolvedGenerics[i], resolvedGenerics[j]]);
            }
        }

        const matchedInteractions: any[] = [];
        let dbFailed = dbConfig?.isSupabaseOffline;

        // 3. Query interactions for each pair
        await Promise.all(
            pairs.map(async ([a, b]) => {
                let match = null;

                if (!dbFailed) {
                    try {
                        const { data, error } = await supabase
                            .from("drug_interactions")
                            .select("*")
                            .or(
                                `and(drug_a_id.eq.${a},drug_b_id.eq.${b}),and(drug_a_id.eq.${b},drug_b_id.eq.${a})`
                            )
                            .maybeSingle();

                        if (error) {
                            dbFailed = true;
                            if (
                                error.message?.includes("fetch failed") ||
                                error.message?.includes("refused") ||
                                error.message?.includes("timeout")
                            ) {
                                if (dbConfig) dbConfig.isSupabaseOffline = true;
                            }
                        } else if (data) {
                            match = data;
                        }
                    } catch (dbErr: any) {
                        dbFailed = true;
                        const msg = dbErr?.message || String(dbErr);
                        if (
                            msg.includes("fetch failed") ||
                            msg.includes("refused") ||
                            msg.includes("timeout")
                        ) {
                            if (dbConfig) dbConfig.isSupabaseOffline = true;
                        }
                    }
                }

                if (dbFailed || !match) {
                    // Fallback to local static check
                    const found = localInteractions.find(
                        (li) =>
                            (li.drug_a_id === a && li.drug_b_id === b) ||
                            (li.drug_a_id === b && li.drug_b_id === a)
                    );
                    if (found) {
                        match = found;
                    }
                }

                if (match) {
                    // Map back generic names to the original user input strings for display
                    const originalA = genericToOriginalMap.get(match.drug_a_id) || match.drug_a_id;
                    const originalB = genericToOriginalMap.get(match.drug_b_id) || match.drug_b_id;

                    matchedInteractions.push({
                        drugA: originalA,
                        drugAGeneric: match.drug_a_id,
                        drugB: originalB,
                        drugBGeneric: match.drug_b_id,
                        severity: match.severity,
                        mechanism: match.mechanism || "No specific mechanism details available.",
                        description: match.description,
                        clinical_recommendation:
                            match.clinical_recommendation ||
                            "Consult a physician before combining.",
                        source: match.source || "Clinical Literature",
                    });
                }
            })
        );

        res.status(200).json({ interactions: matchedInteractions });
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        logger.error(`Error checking drug interactions: ${msg}`);
        res.status(500).json({ error: "Failed to check drug interactions", details: msg });
    }
});

export default router;
