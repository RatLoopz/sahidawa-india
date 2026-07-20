/**
 * openfda.service.ts
 *
 * Lightweight client for the FREE OpenFDA Drug Label API.
 * Used to retrieve grounding context (RAG) for the medicine safety LLM pipeline.
 *
 * Docs: https://open.fda.gov/apis/drug/label/
 * No API key required — completely free and open.
 */

import logger from "../utils/logger";

const OPENFDA_BASE = "https://api.fda.gov/drug/label.json";
const TIMEOUT_MS = 8_000;

/** The minimal subset of an openFDA label response we actually need. */
interface OpenFdaLabelResult {
    openfda?: {
        generic_name?: string[];
        brand_name?: string[];
    };
    warnings?: string[];
    warnings_and_cautions?: string[];
    dosage_and_administration?: string[];
    drug_interactions?: string[];
    pregnancy?: string[];
    nursing_mothers?: string[];
    contraindications?: string[];
    adverse_reactions?: string[];
    use_in_specific_populations?: string[];
    information_for_patients?: string[];
}

interface OpenFdaResponse {
    results?: OpenFdaLabelResult[];
    error?: { code: string; message: string };
}

/**
 * Builds a short, token-efficient RAG context string from an FDA label entry.
 * We deliberately truncate each section to keep the LLM prompt lean.
 */
function buildRagContext(result: OpenFdaLabelResult): string {
    const sections: string[] = [];

    const pick = (arr: string[] | undefined, maxLen = 600) => {
        const text = arr?.[0]?.trim();
        if (!text) return null;
        return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
    };

    const warnings = pick(result.warnings ?? result.warnings_and_cautions);
    if (warnings) sections.push(`WARNINGS: ${warnings}`);

    const dosage = pick(result.dosage_and_administration);
    if (dosage) sections.push(`DOSAGE: ${dosage}`);

    const adverse = pick(result.adverse_reactions);
    if (adverse) sections.push(`ADVERSE REACTIONS: ${adverse}`);

    const interactions = pick(result.drug_interactions);
    if (interactions) sections.push(`DRUG INTERACTIONS: ${interactions}`);

    const pregnancy = pick(result.pregnancy ?? result.nursing_mothers);
    if (pregnancy) sections.push(`PREGNANCY/NURSING: ${pregnancy}`);

    const populations = pick(result.use_in_specific_populations);
    if (populations) sections.push(`SPECIAL POPULATIONS: ${populations}`);

    return sections.join("\n\n");
}

/**
 * Fetches a RAG context string for a generic drug name from the OpenFDA API.
 * Returns an empty string (rather than throwing) when the API is unavailable or
 * the drug is not found — the LLM will then generate from its own training data.
 *
 * @param genericName  The INN / generic name (e.g. "telmisartan", "paracetamol").
 */
export async function fetchOpenFdaContext(genericName: string): Promise<string> {
    if (!genericName?.trim()) return "";

    const normalized = genericName.trim().toLowerCase();
    const url = `${OPENFDA_BASE}?search=openfda.generic_name:"${encodeURIComponent(normalized)}"&limit=1`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            headers: { Accept: "application/json" },
            signal: controller.signal,
        });

        if (!response.ok) {
            logger.warn(`[OpenFDA] Non-OK response ${response.status} for "${genericName}"`);
            return "";
        }

        const body = (await response.json()) as OpenFdaResponse;

        if (body.error || !body.results?.length) {
            logger.info(
                `[OpenFDA] No label found for "${genericName}" — LLM will use training knowledge`
            );
            return "";
        }

        const context = buildRagContext(body.results[0]);
        logger.info(`[OpenFDA] Fetched RAG context (${context.length} chars) for "${genericName}"`);
        return context;
    } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        logger.warn(`[OpenFDA] Fetch failed for "${genericName}": ${reason}`);
        return "";
    } finally {
        clearTimeout(timer);
    }
}
