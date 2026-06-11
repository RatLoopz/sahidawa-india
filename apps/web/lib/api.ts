import { fetchWithRetry } from "./apiWithRetry";

const DEFAULT_API_ORIGIN = "http://localhost:4000";
const configuredApiUrl = (process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_ORIGIN).trim();
export const API_BASE = configuredApiUrl.replace(/\/+$/, "");

let csrfTokenCache: string | null = null;

export async function getCsrfToken(): Promise<string> {
    if (csrfTokenCache) return csrfTokenCache;
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
    const csrfToken = await getCsrfToken();
    const res = await fetchWithRetry(`${API_BASE}/api/ml/analyze`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ imageUrl }),
        timeout: 10000,
        signal,
    });

    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
            error?: string;
        };
        throw new Error(body.error ?? "Image analysis is unavailable. Please retry.");
    }

    return res.json() as Promise<MedicineImageAnalysis>;
}

export async function submitReport(
    payload: ReportPayload,
    accessToken?: string,
    signal?: AbortSignal
): Promise<{ report: SubmittedReport }> {
    const csrfToken = await getCsrfToken();
    const res = await fetchWithRetry(`${API_BASE}/api/reports`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify(payload),
        timeout: 10000,
        signal,
    });

    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
            error?: string;
        };
        throw new Error(body.error ?? "Server error occurred. Please retry.");
    }

    return res.json() as Promise<{ report: SubmittedReport }>;
}

export async function geocodePincode(
    pincode: string,
    signal?: AbortSignal
): Promise<{ latitude: number; longitude: number } | null> {
    if (typeof window !== "undefined" && !window.navigator.onLine) {
        return null;
    }
    try {
        const url =
            `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(pincode)}` +
            `&country=IN&format=json&limit=1`;

        let abortSignal = signal;
        if (!abortSignal) {
            abortSignal = AbortSignal.timeout(4000);
        }

        const r = await fetch(url, {
            headers: { "Accept-Language": "en" },
            signal: abortSignal,
        });
        if (!r.ok) return null;
        const arr = (await r.json()) as Array<{
            lat: string;
            lon: string;
        }>;
        if (!arr.length) return null;
        const lat = parseFloat(arr[0].lat);
        const lng = parseFloat(arr[0].lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { latitude: lat, longitude: lng };
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
    brand_name: string;
    generic_name: string;
    manufacturer: string;
    batch_number: string;
    expiry_date: string | null;
    cdsco_approval_status: string;
    is_counterfeit_alert: boolean;
};

export type ScanMeta = {
    recentScanCount24h: number;
    recentScanCount7d: number;
    suspicious: boolean;
    suspicionReasons: string[];
};

export type VerifyResult =
    | { verified: true; medicine: VerifiedMedicine; scanMeta?: ScanMeta }
    | { verified: false; message: string; scanMeta?: ScanMeta };

export type VerifiedPharmacy = {
    name: string;
    address: string;
    lat: number;
    lng: number;
    distance: string;
    phone_number: string | null;
    is_verified: boolean;
    district: string | null;
    state: string | null;
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

export async function fetchVerifiedPharmaciesInBounds(
    south: number,
    west: number,
    north: number,
    east: number,
    signal?: AbortSignal
): Promise<VerifiedPharmacy[]> {
    try {
        const res = await fetchWithRetry(
            `${API_BASE}/api/pharmacies/in-bounds?south=${south}&west=${west}&north=${north}&east=${east}`,
            { timeout: 8000, signal }
        );
        if (!res.ok) return [];
        const body = await res.json();
        return body.pharmacies ?? [];
    } catch {
        return [];
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
    const csrfToken = await getCsrfToken();
    const res = await fetchWithRetry(`${API_BASE}/api/verify`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
        },
        credentials: "include",
        body: JSON.stringify({ batchNumber }),
        timeout: 10000,
        signal,
    });
    if (!res.ok && res.status !== 404) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Server error occurred. Please retry.");
    }
    return res.json() as Promise<VerifyResult>;
}

export type FuzzyMatch = {
    name: string;
    score: number;
};

export async function fuzzyMatchBrand(query: string, signal?: AbortSignal): Promise<FuzzyMatch[]> {
    const csrfToken = await getCsrfToken();
    const res = await fetchWithRetry(`${API_BASE}/api/v1/scan/match`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ query }),
        timeout: 8000,
        signal,
    });

    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
            error?: string;
        };
        throw new Error(body.error ?? "Server error occurred. Please retry.");
    }

    return res.json() as Promise<FuzzyMatch[]>;
}

export async function verifyMedicineByBrand(
    brandName: string,
    signal?: AbortSignal
): Promise<VerifyResult> {
    const csrfToken = await getCsrfToken();
    const res = await fetchWithRetry(`${API_BASE}/api/v1/scan/verify-brand`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ brandName }),
        timeout: 10000,
        signal,
    });

    if (!res.ok && res.status !== 404) {
        const body = (await res.json().catch(() => ({}))) as {
            error?: string;
        };
        throw new Error(body.error ?? "Server error occurred. Please retry.");
    }

    return res.json() as Promise<VerifyResult>;
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

export async function checkLasaConflicts(
    medicineName: string,
    signal?: AbortSignal
): Promise<LasaCheckResult> {
    const csrfToken = await getCsrfToken();
    const res = await fetchWithRetry(`${API_BASE}/api/v1/lasa/check`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ medicineName }),
        timeout: 8000,
        signal,
    });

    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
            error?: string;
        };
        throw new Error(body.error ?? "Server error occurred. Please retry.");
    }

    return res.json() as Promise<LasaCheckResult>;
}
