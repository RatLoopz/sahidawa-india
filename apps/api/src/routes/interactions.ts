import { Router, Request, Response } from "express";
import { z } from "zod";
import { supabase, dbConfig } from "../db/client";
import logger from "../utils/logger";
import { escapePostgrest } from "../utils/db";
import { interactionCheckLimiter } from "../middleware/rateLimit";

const router = Router();

type WarningSeverity = "High Risk" | "Moderate" | "Safe";

interface MedicineLookup {
    id: string;
    brand_name: string | null;
    generic_name: string;
}

type InteractionRecord = LocalInteraction & { id?: string };

const checkSchema = z.object({
    medicines: z
        .array(z.string())
        .min(2, "At least two medicines are required to check interactions")
        .max(20, "A maximum of 20 medicines can be checked at once"),
});

export function buildMedicineResolutionFilter(input: string): string {
    const escaped = escapePostgrest(input);
    return `id.eq."${escaped}",brand_name.ilike."%${escaped}%",generic_name.ilike."%${escaped}%"`;
}

export function buildInteractionPairFilter(a: string, b: string): string {
    const drugA = escapePostgrest(a);
    const drugB = escapePostgrest(b);
    return `and(drug_a_id.eq."${drugA}",drug_b_id.eq."${drugB}"),and(drug_a_id.eq."${drugB}",drug_b_id.eq."${drugA}")`;
}

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

interface MatchedInteraction {
    drugA: string;
    drugAGeneric: string;
    drugB: string;
    drugBGeneric: string;
    severity: string;
    mechanism: string;
    description: string;
    clinical_recommendation: string;
    source: string;
    verified: boolean;
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

function displayMedicineName(medicine: MedicineLookup): string {
    return medicine.brand_name?.trim() || medicine.generic_name;
}

function normalizeGenericName(value: string): string {
    return value.trim().toLowerCase();
}

function mapSeverityTag(severity?: string | null): WarningSeverity {
    switch (severity) {
        case "critical":
        case "serious":
            return "High Risk";
        case "moderate":
        case "minor":
            return "Moderate";
        default:
            return "Safe";
    }
}

function parseIdsParam(ids: unknown): string[] {
    const raw = Array.isArray(ids) ? ids.join(",") : typeof ids === "string" ? ids : "";
    return Array.from(
        new Set(
            raw
                .split(",")
                .map((id) => id.trim())
                .filter(Boolean)
        )
    );
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "object" && error && "message" in error) {
        return String((error as { message?: unknown }).message ?? "");
    }
    return String(error);
}

function isOfflineError(error: unknown): boolean {
    const message = getErrorMessage(error);
    return (
        message.includes("fetch failed") ||
        message.includes("refused") ||
        message.includes("timeout")
    );
}

function getInteractionPairKey(drugA: string, drugB: string): string {
    return [drugA, drugB].sort().join("::");
}

function indexInteractions(interactions: InteractionRecord[]): Map<string, InteractionRecord> {
    const byPair = new Map<string, InteractionRecord>();
    interactions.forEach((interaction) => {
        byPair.set(
            getInteractionPairKey(interaction.drug_a_id, interaction.drug_b_id),
            interaction
        );
    });
    return byPair;
}

function getLocalInteractionsForGenerics(genericNames: string[]): InteractionRecord[] {
    const selectedGenerics = new Set(genericNames);
    return localInteractions.filter(
        (interaction) =>
            selectedGenerics.has(interaction.drug_a_id) &&
            selectedGenerics.has(interaction.drug_b_id)
    );
}

async function loadInteractionsForGenerics(genericNames: string[]): Promise<InteractionRecord[]> {
    if (dbConfig?.isSupabaseOffline) {
        return getLocalInteractionsForGenerics(genericNames);
    }

    let dbFailed = false;

    try {
        const { data, error } = await supabase
            .from("drug_interactions")
            .select("*")
            .in("drug_a_id", genericNames)
            .in("drug_b_id", genericNames);

        if (error) {
            dbFailed = true;
            if (isOfflineError(error)) {
                if (dbConfig) dbConfig.isSupabaseOffline = true;
            }
        } else if (Array.isArray(data)) {
            return data as InteractionRecord[];
        }
    } catch (dbErr: unknown) {
        dbFailed = true;
        if (isOfflineError(dbErr)) {
            if (dbConfig) dbConfig.isSupabaseOffline = true;
        }
    }

    return dbFailed ? getLocalInteractionsForGenerics(genericNames) : [];
}

/**
 * @openapi
 * /api/v1/interactions:
 *   get:
 *     tags:
 *       - Medicine Interactions
 *     summary: Check pairwise interactions for selected medicine IDs
 *     parameters:
 *       - in: query
 *         name: ids
 *         required: true
 *         schema:
 *           type: string
 *         example: med-a,med-b,med-c
 */
router.get("/", interactionCheckLimiter, async (req: Request, res: Response) => {
    const ids = parseIdsParam(req.query.ids);

    if (ids.length < 2) {
        res.status(400).json({ error: "At least two medicine ids are required" });
        return;
    }

    if (ids.length > 20) {
        res.status(400).json({ error: "At most 20 medicine ids are allowed" });
        return;
    }

    try {
        const { data, error } = await supabase
            .from("medicines")
            .select("id, brand_name, generic_name")
            .in("id", ids);

        if (error) {
            throw error;
        }

        const medicineById = new Map<string, MedicineLookup>();
        ((data ?? []) as MedicineLookup[]).forEach((medicine: MedicineLookup) => {
            medicineById.set(medicine.id, medicine);
        });

        const medicines = ids
            .map((id) => medicineById.get(id))
            .filter((medicine): medicine is MedicineLookup => medicine != null);

        if (medicines.length < 2) {
            res.status(400).json({ error: "At least two valid medicines are required" });
            return;
        }

        const selectedGenerics = Array.from(
            new Set(medicines.map((medicine) => normalizeGenericName(medicine.generic_name)))
        );
        const interactionByPair = indexInteractions(
            await loadInteractionsForGenerics(selectedGenerics)
        );
        const isFallback = dbConfig?.isSupabaseOffline ?? true;
        const interactions = [];

        for (let i = 0; i < medicines.length; i++) {
            for (let j = i + 1; j < medicines.length; j++) {
                const medicineA = medicines[i];
                const medicineB = medicines[j];
                const drugA = normalizeGenericName(medicineA.generic_name);
                const drugB = normalizeGenericName(medicineB.generic_name);
                const match = interactionByPair.get(getInteractionPairKey(drugA, drugB));
                const severity = mapSeverityTag(match?.severity);

                interactions.push({
                    medicineAId: medicineA.id,
                    medicineBId: medicineB.id,
                    drugA: displayMedicineName(medicineA),
                    drugAGeneric: drugA,
                    drugB: displayMedicineName(medicineB),
                    drugBGeneric: drugB,
                    severity,
                    sideEffects:
                        match?.description ||
                        "No known harmful interaction found between these medicines.",
                    description:
                        match?.description ||
                        "No known harmful interaction found between these medicines.",
                    precautions:
                        match?.clinical_recommendation ||
                        "Follow the prescribed dosage and consult a clinician if symptoms change.",
                    mechanism: match?.mechanism || "No interaction mechanism is documented.",
                    source: match?.source || "SahiDawa interaction checker",
                    verified: !isFallback,
                });
            }
        }

        res.status(200).json({ interactions });
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        logger.error(`Error checking interaction ids: ${msg}`);
        res.status(500).json({ error: "Failed to check medicine interactions", details: msg });
    }
});

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
            const { data, error } = await supabase
                .from("medicines")
                .select("brand_name, generic_name")
                .or(buildMedicineResolutionFilter(cleanInput))
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
        } catch (dbErr: unknown) {
            dbFailed = true;
            const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
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
router.post("/check", interactionCheckLimiter, async (req: Request, res: Response) => {
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
        const resolvedList: Array<{ input: string; generic: string }> = await Promise.all(
            medicines.map((medicine) => resolveToGeneric(medicine))
        );

        const genericToOriginalMap = new Map<string, string>();
        resolvedList.forEach((r) => {
            genericToOriginalMap.set(r.generic.toLowerCase(), r.input);
        });

        const resolvedGenerics = Array.from(
            new Set(resolvedList.map((r) => r.generic.toLowerCase()))
        );

        // 2. Fetch all potential interactions in one batched query
        const allInteractions = await loadInteractionsForGenerics(resolvedGenerics);
        const interactionByPair = indexInteractions(allInteractions);
        const isFallback = dbConfig?.isSupabaseOffline ?? true;

        const matchedInteractions: MatchedInteraction[] = [];

        // 3. Generate all unique pairs and check against the batched results in-memory
        for (let i = 0; i < resolvedGenerics.length; i++) {
            for (let j = i + 1; j < resolvedGenerics.length; j++) {
                const a = resolvedGenerics[i];
                const b = resolvedGenerics[j];

                const match = interactionByPair.get(getInteractionPairKey(a, b));

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
                        verified: !isFallback,
                    });
                }
            }
        }

        res.status(200).json({ interactions: matchedInteractions });
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        logger.error(`Error checking drug interactions: ${msg}`);
        res.status(500).json({ error: "Failed to check drug interactions", details: msg });
    }
});

export default router;
