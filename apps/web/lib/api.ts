import { fetchWithRetry } from "./apiWithRetry";

const DEFAULT_API_ORIGIN = "http://localhost:4000";
const configuredApiUrl = (process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_ORIGIN).trim();
export const API_BASE = configuredApiUrl.replace(/\/+$/, "");

let csrfTokenCache: string | null = null;

export async function getCsrfToken(): Promise<string> {
    if (csrfTokenCache) return csrfTokenCache;
    return refreshCsrfToken();
}

export async function refreshCsrfToken(): Promise<string> {
    csrfTokenCache = null;
    const res = await fetch(`${API_BASE}/api/csrf-token`, {
        credentials: "include",
    });
    if (!res.ok) {
        throw new Error(`Failed to fetch CSRF token: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    if (!data.csrfToken) {
        throw new Error("CSRF token not found in response body");
    }
    csrfTokenCache = data.csrfToken;
    return csrfTokenCache!;
}

async function fetchWithCsrf<T>(
    url: string,
    options: Omit<import("./apiWithRetry").FetchOptions, "headers"> & {
        headers?: Record<string, string>;
    },
    ignore404: boolean = false
): Promise<T> {
    const doFetch = async (token: string) => {
        return fetchWithRetry(url, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                "x-csrf-token": token,
                ...options.headers,
            },
            credentials: "include",
        });
    };

    let res = await doFetch(await getCsrfToken());

    if (res.status === 403) {
        const freshToken = await refreshCsrfToken();
        res = await doFetch(freshToken);
    }

    if (!res.ok && !(ignore404 && res.status === 404)) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Server error occurred. Please retry.");
    }

    return res.json() as Promise<T>;
}

export type ReportPayload = {
    medicineName: string;
    manufacturer: string;
    description: string;
    images: string[];
    pharmacyName: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    latitude?: number;
    longitude?: number;
    scannedBarcode?: string;
    medicineId?: string;
};

export type SubmittedReport = {
    id: string;
    created_at: string;
    reporter_id: string | null;
};

export type MedicineImageAnalysisVerdict = "likely_genuine" | "suspicious" | "likely_fake";

export type MedicineImageAnalysis = {
    isFake: boolean;
    confidence: number;
    verdict: MedicineImageAnalysisVerdict;
    details: string;
};

export async function analyzeMedicineImage(
    imageUrl: string,
    signal?: AbortSignal
): Promise<MedicineImageAnalysis> {
    return fetchWithCsrf<MedicineImageAnalysis>(`${API_BASE}/api/ml/analyze`, {
        method: "POST",
        body: JSON.stringify({ imageUrl }),
        timeout: 10000,
        signal,
    });
}

export async function submitReport(
    payload: ReportPayload,
    accessToken?: string,
    signal?: AbortSignal
): Promise<{ report: SubmittedReport }> {
    const headers: Record<string, string> = {};
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
    return fetchWithCsrf<{ report: SubmittedReport }>(`${API_BASE}/api/reports`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        timeout: 10000,
        signal,
    });
}

type GeocodeResult = {
    latitude: number;
    longitude: number;
    city?: string;
    state?: string;
};

export async function geocodePincode(
    pincode: string,
    signal?: AbortSignal
): Promise<GeocodeResult | null> {
    if (typeof window !== "undefined" && !window.navigator.onLine) {
        return null;
    }
    try {
        const url =
            `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(pincode)}` +
            `&country=IN&format=json&addressdetails=1&limit=1`;

        let abortSignal = signal;
        if (!abortSignal) {
            abortSignal = AbortSignal.timeout(4000);
        }

        const r = await fetch(url, {
            headers: { "Accept-Language": "en" },
            signal: abortSignal,
        });
        if (!r.ok) return null;
        type NominatimResult = {
            lat: string;
            lon: string;
            address: {
                city?: string;
                town?: string;
                village?: string;
                municipality?: string;
                county?: string;
                state?: string;
            };
        };
        const arr = (await r.json()) as NominatimResult[];
        if (!arr.length) return null;
        const entry = arr[0];
        const lat = parseFloat(entry.lat);
        const lng = parseFloat(entry.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const city =
            entry.address?.city ??
            entry.address?.town ??
            entry.address?.village ??
            entry.address?.municipality ??
            entry.address?.county;
        const state = entry.address?.state;
        return { latitude: lat, longitude: lng, city, state };
    } catch (error) {
        if (typeof window !== "undefined") {
            console.warn(
                `[api] Geocoding pincode ${pincode} failed: ${error instanceof Error ? error.message : String(error)}`
            );
        }
        return null;
    }
}

export type VerifiedMedicine = {
    id?: string;
    brand_name: string;
    generic_name: string;
    manufacturer: string;
    batch_number: string;
    expiry_date: string | null;
    cdsco_approval_status: string;
    is_counterfeit_alert: boolean;
    is_cdsco_verified?: boolean;
    cdsco_match_score?: number;
    matched_cdsco_product?: string | null;
    matched_cdsco_manufacturer?: string | null;
    product_match_score?: number;
    manufacturer_match_score?: number;
    dosage_form?: string | null;
    composition?: string | null;
};

export type ScanMeta = {
    recentScanCount24h: number;
    recentScanCount7d: number;
    suspicious: boolean;
    suspicionReasons: string[];
};

export type VerifyResult =
    | {
          verified: true;
          medicine: VerifiedMedicine;
          scanMeta?: ScanMeta;
          batch_status?: "safe" | "recalled" | "unknown";
      }
    | {
          verified: false;
          message: string;
          scanMeta?: ScanMeta;
          batch_status?: "safe" | "recalled" | "unknown";
      };

export type VerifiedPharmacy = {
    id?: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    distance: string;
    phone_number: string | null;
    is_verified: boolean;
    district: string | null;
    state: string | null;
    updated_at?: string;
    is_active?: boolean;
    deleted_at?: string | null;
};

export async function fetchVerifiedPharmacies(
    lat: number,
    lng: number,
    radiusKm: number = 50,
    signal?: AbortSignal
): Promise<VerifiedPharmacy[]> {
    try {
        const res = await fetchWithRetry(
            `${API_BASE}/api/pharmacies/nearest?lat=${lat}&lng=${lng}&radius=${radiusKm}`,
            { timeout: 8000, signal }
        );
        if (!res.ok) return [];
        const body = await res.json();
        return body.pharmacies ?? [];
    } catch {
        return [];
    }
}

/**
 * Response shape for fetchVerifiedPharmaciesInBounds.
 *
 * `syncedAt` is the server's timestamp for this response — store it (per
 * bounding-box / region key) and pass it back as `since` on the next call
 * to the same area to fetch only what changed (delta sync, #2260).
 *
 * `delta` is true when the response only contains changes since `since`
 * (i.e. the caller passed one and the server honoured it). When false, the
 * `pharmacies` array is the full result set for the bounds — callers should
 * replace their local cache for that area rather than merge.
 *
 * Note: deletions are not reported. Pharmacies are hard-deleted today with
 * no tombstone mechanism, so a delta response cannot tell you a previously
 * seen pharmacy was removed. This is a known gap, not an oversight — see
 * the PR description for #2260.
 */
export type PharmaciesInBoundsResult = {
    pharmacies: VerifiedPharmacy[];
    syncedAt: string;
    delta: boolean;
    fromNetwork: boolean;
};

export async function fetchVerifiedPharmaciesInBounds(
    south: number,
    west: number,
    north: number,
    east: number,
    since?: string | number | Date,
    signal?: AbortSignal
): Promise<PharmaciesInBoundsResult> {
    const fallback: PharmaciesInBoundsResult = {
        pharmacies: [],
        syncedAt: new Date().toISOString(),
        delta: false,
        fromNetwork: false,
    };
    try {
        let url = `${API_BASE}/api/pharmacies/in-bounds?south=${south}&west=${west}&north=${north}&east=${east}`;
        if (since) {
            const sinceParam =
                since instanceof Date
                    ? since.toISOString()
                    : typeof since === "number"
                      ? new Date(since).toISOString()
                      : since;
            url += `&since=${encodeURIComponent(sinceParam)}`;
        }
        const res = await fetchWithRetry(url, { timeout: 8000, signal });
        if (!res.ok) return fallback;
        const body = await res.json();
        return {
            pharmacies: body.pharmacies ?? [],
            syncedAt: body.syncedAt ?? fallback.syncedAt,
            delta: Boolean(body.delta),
            fromNetwork: true,
        };
    } catch {
        return fallback;
    }
}

export type ApiAshaWorker = {
    id: number;
    name: string;
    district: string;
    lat: number;
    lng: number;
    contact: string;
    distance_km: number;
};

export async function fetchNearbyAshaWorkers(
    lat: number,
    lng: number,
    radiusKm: number = 10,
    signal?: AbortSignal
): Promise<ApiAshaWorker[]> {
    try {
        const res = await fetchWithRetry(
            `${API_BASE}/api/map/nearby?lat=${lat}&lng=${lng}&radius_km=${radiusKm}`,
            { timeout: 8000, signal }
        );
        if (!res.ok) return [];
        const body = await res.json();
        return body.asha_workers ?? [];
    } catch {
        return [];
    }
}

export async function verifyMedicine(
    batchNumber: string,
    signal?: AbortSignal
): Promise<VerifyResult> {
    const mlUrl = process.env.NEXT_PUBLIC_ML_URL;
    if (mlUrl) {
        try {
            const mlRes = await fetchWithRetry(`${mlUrl.replace(/\/+$/, "")}/verify/batch`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    batch_number: batchNumber,
                }),
                timeout: 8000,
                signal,
            });
            if (mlRes.ok) {
                const mlData = (await mlRes.json()) as {
                    status: string;
                    brand_name?: string;
                    generic_name?: string;
                    manufacturer?: string;
                    expiry_date?: string;
                    cdsco_approval_status?: string;
                    is_counterfeit_alert?: boolean;
                };
                if (mlData.status === "not_found") {
                    return {
                        verified: false,
                        message: "Medicine not found",
                    };
                }
                return {
                    verified: true,
                    medicine: {
                        brand_name: mlData.brand_name ?? "",
                        generic_name: mlData.generic_name ?? "",
                        manufacturer: mlData.manufacturer ?? "",
                        batch_number: batchNumber,
                        expiry_date: mlData.expiry_date ?? null,
                        cdsco_approval_status: mlData.cdsco_approval_status ?? "unknown",
                        is_counterfeit_alert: mlData.is_counterfeit_alert ?? false,
                    },
                };
            }
        } catch {
            console.warn("ML service unavailable, falling back to Node API");
        }
    }
    return fetchWithCsrf<VerifyResult>(
        `${API_BASE}/api/verify`,
        {
            method: "POST",
            body: JSON.stringify({ batchNumber }),
            timeout: 10000,
            signal,
        },
        true
    );
}

export type FuzzyMatch = {
    name: string;
    score: number;
};

export async function fuzzyMatchBrand(query: string, signal?: AbortSignal): Promise<FuzzyMatch[]> {
    return fetchWithCsrf<FuzzyMatch[]>(`${API_BASE}/api/v1/scan/match`, {
        method: "POST",
        body: JSON.stringify({ query }),
        timeout: 8000,
        signal,
    });
}

export async function verifyMedicineByBrand(
    brandName: string,
    signal?: AbortSignal
): Promise<VerifyResult> {
    return fetchWithCsrf<VerifyResult>(
        `${API_BASE}/api/v1/scan/verify-brand`,
        {
            method: "POST",
            body: JSON.stringify({ brandName }),
            timeout: 10000,
            signal,
        },
        true
    );
}

export type LasaMatchType = "sound-alike" | "look-alike";

export interface LasaMatch {
    name: string;
    type: LasaMatchType;
    score: number;
}

export interface LasaCheckResult {
    hasConflicts: boolean;
    matches: LasaMatch[];
}

const lasaCache = new Map<string, LasaCheckResult>();
const inFlightRequests = new Map<string, Promise<LasaCheckResult>>();
const MAX_CACHE_SIZE = 100;

function setCachedLasa(key: string, value: LasaCheckResult): void {
    if (lasaCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = lasaCache.keys().next().value;
        if (oldestKey !== undefined) {
            lasaCache.delete(oldestKey);
        }
    }
    lasaCache.set(key, value);
}

export async function checkLasaConflicts(
    medicineName: string,
    signal?: AbortSignal
): Promise<LasaCheckResult> {
    const query = medicineName.trim();
    if (query.length < 2) {
        return { hasConflicts: false, matches: [] };
    }

    const cacheKey = query.toLowerCase();

    // Check if we have a cached entry
    const cached = lasaCache.get(cacheKey);

    // If there is an in-flight request, we can reuse its promise
    let promise = inFlightRequests.get(cacheKey);
    if (!promise) {
        promise = fetchWithCsrf<LasaCheckResult>(`${API_BASE}/api/v1/lasa/check`, {
            method: "POST",
            body: JSON.stringify({ medicineName: query }),
            timeout: 8000,
            signal,
        })
            .then((data) => {
                setCachedLasa(cacheKey, data);
                return data;
            })
            .finally(() => {
                inFlightRequests.delete(cacheKey);
            });
        inFlightRequests.set(cacheKey, promise);
    }

    if (cached) {
        // Stale-While-Revalidate: return cached data instantly
        // and let the in-flight revalidation promise run in the background.
        // Catch errors silently to prevent unhandled promise rejections.
        promise.catch(() => {});
        return cached;
    }

    // Otherwise, wait for the network request to complete
    return promise;
}
