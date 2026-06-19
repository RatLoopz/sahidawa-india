import { z } from "zod";
import { anonSupabase } from "../db/supabase";
import logger from "../utils/logger";
import { escapeIlike, escapePostgrest } from "../utils/db";

// ── Constants ────────────────────────────────────────────────────────────────

/** Dimensionality of Google's text-embedding-004 model (matches the DB column). */
const EMBEDDING_DIMENSIONS = 768;

/** Google Generative Language embedding endpoint (REST — no SDK dependency). */
const EMBEDDING_MODEL = "text-embedding-004";
const EMBEDDING_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`;
const EMBEDDING_TIMEOUT_MS = 6000;

/** Default number of medicines returned by a retrieval call. */
export const DEFAULT_MATCH_COUNT = 5;

/**
 * Standard safety reminder appended to every triage response. Mirrors the
 * disclaimer used by the voice-triage chat route so the wording stays consistent
 * across the app.
 */
export const MEDICINE_RAG_DISCLAIMER =
    "This guidance is for informational use only and is not a diagnosis or a prescription. " +
    "Consult a doctor or pharmacist before taking any medicine, especially for severe or persistent symptoms.";

/**
 * Symptom keywords that indicate the user should seek urgent care rather than
 * self-medicate. Kept intentionally small and language-light; the voice flow
 * already runs richer multilingual emergency detection on the client.
 */
const EMERGENCY_KEYWORDS = [
    "chest pain",
    "heart attack",
    "stroke",
    "unconscious",
    "not breathing",
    "difficulty breathing",
    "shortness of breath",
    "severe bleeding",
    "suicide",
    "seizure",
    "paralysis",
    "fainting",
    "high fever",
];

// ── Types ────────────────────────────────────────────────────────────────────

/** Raw medicine row as returned by the retrieval RPCs / table fallback. */
export interface MedicineRow {
    id: string;
    brand_name: string | null;
    generic_name: string;
    manufacturer: string | null;
    composition?: string | null;
    strength?: string | null;
    dosage_form?: string | null;
    schedule?: string | null;
    mrp?: number | string | null;
    jan_aushadhi_price?: number | string | null;
    similarity?: number | null;
    batch_number?: string | null;
    barcode_id?: string | null;
    manufacturing_date?: string | null;
    expiry_date?: string | null;
    cdsco_approval_status?: string | null;
    is_counterfeit_alert?: boolean | null;
    is_cdsco_verified?: boolean | null;
    cdsco_match_score?: number | null;
    matched_cdsco_product?: string | null;
    matched_cdsco_manufacturer?: string | null;
    product_match_score?: number | null;
    manufacturer_match_score?: number | null;
    manufacturer_id?: string | null;
}

/** Formatted medicine returned in API responses. */
export interface MedicineMatch {
    id: string;
    brand_name: string | null;
    generic_name: string;
    manufacturer: string | null;
    composition: string | null;
    strength: string | null;
    dosage_form: string | null;
    schedule: string | null;
    mrp: number | null;
    jan_aushadhi_price: number | null;
    monograph: string;
    similarity: number | null;
}

/** Result of the lightweight urgency classification step. */
export interface UrgencyAssessment {
    emergency: boolean;
    matched: string[];
}

// ── Zod request schemas ──────────────────────────────────────────────────────

export const medicineQuerySchema = z.object({
    query: z.string().trim().min(2).max(500),
    limit: z.coerce.number().int().min(1).max(20).default(DEFAULT_MATCH_COUNT),
});

export const recommendSchema = z.object({
    symptoms: z.string().trim().min(2).max(500),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radius: z.coerce.number().min(1).max(200).default(50),
    limit: z.coerce.number().int().min(1).max(20).default(DEFAULT_MATCH_COUNT),
});

// ── Pure helpers ─────────────────────────────────────────────────────────────

function toNumberOrNull(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Builds the human-readable monograph text for a medicine. This is the text
 * that an embedding/indexing job would encode, and it is also returned to the
 * client so the retrieval result is self-explanatory.
 */
export function buildMedicineMonograph(row: MedicineRow): string {
    const parts: string[] = [];

    const name = row.brand_name?.trim()
        ? `${row.brand_name.trim()} (${row.generic_name.trim()})`
        : row.generic_name.trim();
    parts.push(name);

    if (row.strength?.trim()) parts.push(`Strength: ${row.strength.trim()}`);
    if (row.dosage_form?.trim()) parts.push(`Form: ${row.dosage_form.trim()}`);
    if (row.composition?.trim()) parts.push(`Composition: ${row.composition.trim()}`);
    if (row.manufacturer?.trim()) parts.push(`Manufacturer: ${row.manufacturer.trim()}`);
    if (row.schedule?.trim()) parts.push(`Schedule: ${row.schedule.trim()}`);

    return parts.join(". ");
}

/** Formats a raw medicine row into the API response shape. */
export function formatMedicineMatch(row: MedicineRow): MedicineMatch {
    return {
        id: row.id,
        brand_name: row.brand_name ?? null,
        generic_name: row.generic_name,
        manufacturer: row.manufacturer ?? null,
        composition: row.composition ?? null,
        strength: row.strength ?? null,
        dosage_form: row.dosage_form ?? null,
        schedule: row.schedule ?? null,
        mrp: toNumberOrNull(row.mrp),
        jan_aushadhi_price: toNumberOrNull(row.jan_aushadhi_price),
        monograph: buildMedicineMonograph(row),
        similarity:
            typeof row.similarity === "number" && Number.isFinite(row.similarity)
                ? row.similarity
                : null,
    };
}

/**
 * Flags whether a free-text symptom description contains urgent-care keywords.
 * When emergency is true, callers should advise the user to seek immediate
 * medical attention instead of self-medicating.
 */
export function assessUrgency(text: string): UrgencyAssessment {
    const normalized = text.toLowerCase();
    const matched = EMERGENCY_KEYWORDS.filter((keyword) => normalized.includes(keyword));
    return { emergency: matched.length > 0, matched };
}

// ── Query embedding (optional) ───────────────────────────────────────────────

/**
 * Embeds a query string with Google's text-embedding-004 model via REST.
 * Returns null when GEMINI_API_KEY is unset or the request fails, so callers
 * can fall back to text retrieval. Never throws.
 */
export async function embedQuery(text: string): Promise<number[] | null> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
        return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS);

    try {
        const response = await fetch(`${EMBEDDING_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: `models/${EMBEDDING_MODEL}`,
                content: { parts: [{ text }] },
            }),
            signal: controller.signal,
        });

        if (!response.ok) {
            logger.warn("Medicine embedding request failed", { status: response.status });
            return null;
        }

        const body = (await response.json().catch(() => null)) as {
            embedding?: { values?: unknown };
        } | null;
        const values = body?.embedding?.values;

        if (
            Array.isArray(values) &&
            values.length === EMBEDDING_DIMENSIONS &&
            values.every((value) => typeof value === "number")
        ) {
            return values as number[];
        }

        logger.warn("Medicine embedding response had unexpected shape");
        return null;
    } catch (error) {
        logger.warn("Medicine embedding request errored", {
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

// ── Retrieval ────────────────────────────────────────────────────────────────

/**
 * Retrieves the medicines most relevant to a free-text query, using a tiered
 * strategy that degrades gracefully:
 *
 *   1. pgvector semantic search (match_medicines) when the query can be embedded.
 *   2. pg_trgm fuzzy search (search_medicines_text) RPC.
 *   3. In-memory ILIKE filter over the medicines table.
 *
 * This mirrors the "RPC primary, JS fallback" pattern used by the pharmacy
 * search route. Always resolves to an array (never throws).
 */
export async function retrieveRelevantMedicines(
    query: string,
    limit: number = DEFAULT_MATCH_COUNT
): Promise<MedicineMatch[]> {
    // Tier 1 — semantic vector search.
    const embedding = await embedQuery(query);
    if (embedding) {
        const { data, error } = await anonSupabase.rpc("match_medicines", {
            query_embedding: embedding,
            match_count: limit,
        });

        if (!error && Array.isArray(data) && data.length > 0) {
            return (data as MedicineRow[]).map(formatMedicineMatch);
        }

        if (error) {
            logger.warn("match_medicines RPC failed, falling back to text search", {
                error: error.message,
            });
        }
    }

    // Tier 2 — trigram fuzzy search RPC.
    const { data: trgmData, error: trgmError } = await anonSupabase.rpc("search_medicines_text", {
        query_text: query,
        match_count: limit,
    });

    if (!trgmError && Array.isArray(trgmData)) {
        return (trgmData as MedicineRow[]).map(formatMedicineMatch);
    }

    logger.warn("search_medicines_text RPC unavailable, falling back to ILIKE query", {
        error: trgmError?.message,
    });

    // Tier 3 — in-memory ILIKE filter over the table.
    const pattern = `%${escapeIlike(query)}%`;
    const { data: tableData, error: tableError } = await anonSupabase
        .from("medicines")
        .select(
            "id, brand_name, generic_name, manufacturer, composition, strength, dosage_form, schedule, mrp, jan_aushadhi_price"
        )
        .or(
            `generic_name.ilike."${escapePostgrest(pattern)}",brand_name.ilike."${escapePostgrest(pattern)}",composition.ilike."${escapePostgrest(pattern)}"`
        )
        .limit(limit);

    if (tableError) {
        logger.error("Medicine retrieval fallback query failed", { error: tableError.message });
        return [];
    }

    return ((tableData ?? []) as MedicineRow[]).map(formatMedicineMatch);
}
