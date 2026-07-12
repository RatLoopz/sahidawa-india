/**
 * governmentEligibility.ts
 *
 * Author note: this file exists so that all direct calls to external
 * government health scheme APIs (PM-JAY, ESIC) live in one place.
 * The route (eligibility.ts) should never talk to these APIs directly.
 * It should only call fetchGovernmentEligibility() and use whatever it
 * gets back, or fall back to the local rule engine if this returns null.
 *
 * Why it is written this way:
 * - Neither PM-JAY nor ESIC currently expose a public/official API for this
 *   kind of eligibility check. The env vars below are placeholders so that
 *   whoever gets real, approved API access later can drop in real base
 *   URLs / keys without touching the route logic at all.
 * - Until those credentials exist, this module safely no-ops (returns null)
 *   so the existing Redis/Supabase + rule-based logic in eligibility.ts
 *   keeps working exactly as before.
 */

import logger from "../utils/logger";

/**
 * Kept in sync with the shape already used in routes/eligibility.ts.
 * If that shape changes, update it here too (or better, move both to a
 * shared types file at some point).
 */
export interface EligibleScheme {
    name: string;
    description: string;
    coverage: string;
    how_to_apply: string;
    link: string;
}

export interface GovernmentEligibilityInput {
    age: number;
    annual_income: number;
    family_size: number;
    state: string;
    has_bpl_card: boolean;
    has_abha_id: boolean;
}

export interface GovernmentEligibilityResult {
    source: "pmjay" | "esic";
    schemes: EligibleScheme[];
}

const DEFAULT_TIMEOUT_MS = Number(process.env.GOVT_API_TIMEOUT) || 10000;
const MAX_RETRIES = 2;

/**
 * Small helper to fetch with a timeout, since native fetch has no timeout
 * option of its own. Uses AbortController.
 */
async function fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number
): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Generic retry wrapper for the government calls below.
 * Retries on network errors / timeouts, not on 4xx responses
 * (a 4xx means our request was bad, retrying won't help).
 */
async function fetchWithRetries(
    url: string,
    init: RequestInit,
    timeoutMs: number,
    retries: number
): Promise<Response | null> {
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await fetchWithTimeout(url, init, timeoutMs);
            if (res.status >= 500 && attempt < retries) {
                // Server-side error on the government API's end, worth a retry.
                logger.warn("Government API returned server error, retrying", {
                    url,
                    status: res.status,
                    attempt,
                });
                continue;
            }
            return res;
        } catch (err) {
            lastError = err;
            logger.warn("Government API call failed, will retry if attempts remain", {
                url,
                attempt,
                error: String(err),
            });
        }
    }

    logger.error("Government API call failed after all retries", {
        url,
        error: String(lastError),
    });
    return null;
}

/**
 * Calls the PM-JAY eligibility endpoint, if configured.
 * Returns null if not configured, or if the call fails / is malformed.
 */
async function fetchPmjayEligibility(
    input: GovernmentEligibilityInput
): Promise<EligibleScheme[] | null> {
    const baseUrl = process.env.PMJAY_BASE_URL;
    const apiKey = process.env.PMJAY_API_KEY;

    if (!baseUrl || !apiKey) {
        // Not configured, this is expected until official access is granted.
        return null;
    }

    try {
        const res = await fetchWithRetries(
            `${baseUrl.replace(/\/$/, "")}/eligibility`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    age: input.age,
                    annual_income: input.annual_income,
                    family_size: input.family_size,
                    state: input.state,
                    has_bpl_card: input.has_bpl_card,
                    has_abha_id: input.has_abha_id,
                }),
            },
            DEFAULT_TIMEOUT_MS,
            MAX_RETRIES
        );

        if (!res || !res.ok) {
            logger.warn("PM-JAY eligibility call did not succeed", {
                status: res?.status,
            });
            return null;
        }

        const data = await res.json().catch(() => null);
        if (!data) {
            logger.warn("PM-JAY eligibility response was not valid JSON");
            return null;
        }

        // NOTE: this mapping is a best-effort guess at a plausible response
        // shape. It must be revisited once real PM-JAY API docs are available;
        // the field names below (schemes, scheme_name, etc.) are placeholders.
        const rawSchemes = Array.isArray(data.schemes) ? data.schemes : [];

        return rawSchemes.map((s: any) => ({
            name: s.scheme_name ?? "Ayushman Bharat - PM-JAY",
            description: s.description ?? "",
            coverage: s.coverage ?? "",
            how_to_apply: s.how_to_apply ?? "",
            link: s.link ?? "https://beneficiary.nha.gov.in/",
        }));
    } catch (err) {
        logger.error("Unexpected error calling PM-JAY eligibility API", {
            error: String(err),
        });
        return null;
    }
}

/**
 * Calls the ESIC eligibility endpoint, if configured.
 * Returns null if not configured, or if the call fails / is malformed.
 */
async function fetchEsicEligibility(
    input: GovernmentEligibilityInput
): Promise<EligibleScheme[] | null> {
    const baseUrl = process.env.ESIC_BASE_URL;
    const apiKey = process.env.ESIC_API_KEY;

    if (!baseUrl || !apiKey) {
        return null;
    }

    try {
        const res = await fetchWithRetries(
            `${baseUrl.replace(/\/$/, "")}/eligibility`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    age: input.age,
                    annual_income: input.annual_income,
                    family_size: input.family_size,
                    state: input.state,
                }),
            },
            DEFAULT_TIMEOUT_MS,
            MAX_RETRIES
        );

        if (!res || !res.ok) {
            logger.warn("ESIC eligibility call did not succeed", {
                status: res?.status,
            });
            return null;
        }

        const data = await res.json().catch(() => null);
        if (!data) {
            logger.warn("ESIC eligibility response was not valid JSON");
            return null;
        }

        // Same caveat as PM-JAY above: placeholder field mapping.
        const rawSchemes = Array.isArray(data.schemes) ? data.schemes : [];

        return rawSchemes.map((s: any) => ({
            name: s.scheme_name ?? "ESIC Health Scheme",
            description: s.description ?? "",
            coverage: s.coverage ?? "",
            how_to_apply: s.how_to_apply ?? "",
            link: s.link ?? "https://www.esic.gov.in/",
        }));
    } catch (err) {
        logger.error("Unexpected error calling ESIC eligibility API", {
            error: String(err),
        });
        return null;
    }
}

/**
 * Main entry point used by the route. Tries PM-JAY and ESIC in parallel.
 * Returns null if neither is configured or neither call produced usable
 * data, so the caller knows to fall back to the local rule engine.
 */
export async function fetchGovernmentEligibility(
    input: GovernmentEligibilityInput
): Promise<GovernmentEligibilityResult[] | null> {
    const [pmjaySchemes, esicSchemes] = await Promise.all([
        fetchPmjayEligibility(input),
        fetchEsicEligibility(input),
    ]);

    const results: GovernmentEligibilityResult[] = [];

    if (pmjaySchemes && pmjaySchemes.length > 0) {
        results.push({ source: "pmjay", schemes: pmjaySchemes });
    }

    if (esicSchemes && esicSchemes.length > 0) {
        results.push({ source: "esic", schemes: esicSchemes });
    }

    if (results.length === 0) {
        // Neither API is configured, or neither returned data.
        // Caller should fall back to the rule-based engine.
        return null;
    }

    return results;
}
