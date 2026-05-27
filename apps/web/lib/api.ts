import { fetchWithRetry } from "./apiWithRetry";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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

export async function submitReport(
    payload: ReportPayload,
    accessToken?: string,
    signal?: AbortSignal
): Promise<{ report: SubmittedReport }> {
    const res = await fetchWithRetry(`${API_BASE}/reports`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(payload),
        timeout: 10000,
        signal,
    });

    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
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
        // Merge with a 4s timeout if no caller signal is provided or merge them
        if (!abortSignal) {
            abortSignal = AbortSignal.timeout(4000);
        }

        const r = await fetch(url, {
            headers: { "Accept-Language": "en" },
            signal: abortSignal,
        });
        if (!r.ok) return null;
        const arr = (await r.json()) as Array<{ lat: string; lon: string }>;
        if (!arr.length) return null;
        const lat = parseFloat(arr[0].lat);
        const lng = parseFloat(arr[0].lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { latitude: lat, longitude: lng };
    } catch {
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

export type VerifyResult =
    | { verified: true; medicine: VerifiedMedicine }
    | { verified: false; message: string };

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

export async function verifyMedicine(batchNumber: string, signal?: AbortSignal): Promise<VerifyResult> {
    const res = await fetchWithRetry(`${API_BASE}/api/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    const res = await fetchWithRetry(`${API_BASE}/api/v1/scan/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
        timeout: 8000,
        signal,
    });

    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Server error occurred. Please retry.");
    }

    return res.json() as Promise<FuzzyMatch[]>;
}

export async function verifyMedicineByBrand(brandName: string, signal?: AbortSignal): Promise<VerifyResult> {
    const res = await fetchWithRetry(`${API_BASE}/api/v1/scan/verify-brand`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandName }),
        timeout: 10000,
        signal,
    });

    if (!res.ok && res.status !== 404) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
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

export async function checkLasaConflicts(medicineName: string, signal?: AbortSignal): Promise<LasaCheckResult> {
    const res = await fetchWithRetry(`${API_BASE}/api/v1/lasa/check`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ medicineName }),
        timeout: 8000,
        signal,
    });

    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Server error occurred. Please retry.");
    }

    return res.json() as Promise<LasaCheckResult>;
}
