import { fetchWithRetry } from "../apiWithRetry";
import {
    getCsrfToken,
    refreshCsrfToken,
    invalidateCsrfToken,
    isCsrfError,
    CSRF_HEADER_NAME,
} from "../csrf";
import { parseApiErrorString } from "../apiErrorHandler";

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
    usage?: string;
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
): Promise<GenericAlternative | null> {
    let url = `${API_BASE}/api/v1/alternatives/${encodeURIComponent(medicineId)}`;
    if (lat !== undefined && lng !== undefined) {
        url += `?lat=${lat}&lng=${lng}`;
    }

    const res = await fetchWithRetry(url, {
        method: "GET",
        timeout: 10000,
        signal,
    });
    // A 404 means no generic alternative exists for this medicine — a normal,
    // expected outcome, not a network/server failure. Let the caller render
    // a neutral empty state instead of a hard error.
    if (res.status === 404) {
        return null;
    }

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(parseApiErrorString(body, "Failed to fetch generic alternatives."));
    }

    return res.json() as Promise<GenericAlternative>;
}

/**
 * Checks Ayushman Bharat / PMJAY eligibility based on demographics.
 *
 * Attaches the CSRF token as both a header and (via credentials: "include")
 * the accompanying cookie. If the server rejects the token as invalid or
 * expired, the token is refreshed once and the request is retried
 * transparently before surfacing an error to the caller.
 */
export async function checkSchemeEligibility(
    payload: SchemeEligibilityPayload,
    signal?: AbortSignal
): Promise<SchemeEligibilityResponse> {
    const url = `${API_BASE}/api/v1/scheme-eligibility`;

    const doRequest = (token: string) =>
        fetchWithRetry(url, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                [CSRF_HEADER_NAME]: token,
            },
            body: JSON.stringify(payload),
            timeout: 10000,
            signal,
        });

    let token = await getCsrfToken();
    let res = await doRequest(token);

    if (!res.ok && res.status === 403) {
        const body = await res.json().catch(() => ({}));
        if (isCsrfError(res.status, body)) {
            // Token was invalid/expired — refresh once and retry silently.
            invalidateCsrfToken();
            token = await refreshCsrfToken();
            res = await doRequest(token);
        } else {
            throw new Error(parseApiErrorString(body, "Failed to check scheme eligibility."));
        }
    }

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(parseApiErrorString(body, "Failed to check scheme eligibility."));
    }

    return res.json() as Promise<SchemeEligibilityResponse>;
}
