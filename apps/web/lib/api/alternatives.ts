import { fetchWithRetry } from "../apiWithRetry";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface NearestStore {
    name: string;
    lat: number;
    lng: number;
    distance: string;
}

export interface GenericAlternative {
    brand_name: string;
    generic_name: string;
    brand_price: number;
    jan_aushadhi_price: number;
    savings_percentage: number;
    alternative_name: string;
    nearest_store: NearestStore | null;
}

export interface SchemeEligibilityPayload {
    age: number;
    annual_income: number;
    family_size: number;
    state: string;
    has_bpl_card: boolean;
    has_abha_id: boolean;
}

export interface EligibleScheme {
    name: string;
    description: string;
    coverage: string;
    how_to_apply: string;
    link: string;
}

export interface SchemeEligibilityResponse {
    eligible_schemes: EligibleScheme[];
}

/**
 * Fetches generic alternatives for a medicine from the API.
 */
export async function fetchGenericAlternatives(
    medicineId: string,
    lat?: number,
    lng?: number,
    signal?: AbortSignal
): Promise<GenericAlternative> {
    let url = `${API_BASE}/api/v1/alternatives/${encodeURIComponent(medicineId)}`;
    if (lat !== undefined && lng !== undefined) {
        url += `?lat=${lat}&lng=${lng}`;
    }

    const res = await fetchWithRetry(url, {
        method: "GET",
        timeout: 10000,
        signal,
    });

    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to fetch generic alternatives.");
    }

    return res.json() as Promise<GenericAlternative>;
}

/**
 * Checks Ayushman Bharat / PMJAY eligibility based on demographics.
 */
export async function checkSchemeEligibility(
    payload: SchemeEligibilityPayload,
    signal?: AbortSignal
): Promise<SchemeEligibilityResponse> {
    const res = await fetchWithRetry(`${API_BASE}/api/v1/scheme-eligibility`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        timeout: 10000,
        signal,
    });

    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to check scheme eligibility.");
    }

    return res.json() as Promise<SchemeEligibilityResponse>;
}
