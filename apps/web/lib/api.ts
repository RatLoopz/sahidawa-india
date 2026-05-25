import { fetchWithRetry } from './apiWithRetry';

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
    accessToken?: string
): Promise<{ report: SubmittedReport }> {
    const res = await fetchWithRetry(`${API_BASE}/reports`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(payload),
        timeout: 10000,
    });

    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Submit failed (${res.status})`);
    }

    return res.json() as Promise<{ report: SubmittedReport }>;
}

export async function geocodePincode(
    pincode: string
): Promise<{ latitude: number; longitude: number } | null> {
    try {
        const url =
            `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(pincode)}` +
            `&country=IN&format=json&limit=1`;
        const r = await fetch(url, {
            headers: { "Accept-Language": "en" },
            signal: AbortSignal.timeout(4000),
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
    radiusKm: number = 50
): Promise<VerifiedPharmacy[]> {
    try {
        const res = await fetchWithRetry(
            `${API_BASE}/api/pharmacies/nearest?lat=${lat}&lng=${lng}&radius=${radiusKm}`,
            { timeout: 8000 }
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
    east: number
): Promise<VerifiedPharmacy[]> {
    try {
        const res = await fetchWithRetry(
            `${API_BASE}/api/pharmacies/in-bounds?south=${south}&west=${west}&north=${north}&east=${east}`,
            { timeout: 8000 }
        );
        if (!res.ok) return [];
        const body = await res.json();
        return body.pharmacies ?? [];
    } catch {
        return [];
    }
}

export async function verifyMedicine(batchNumber: string): Promise<VerifyResult> {
    const res = await fetchWithRetry(`${API_BASE}/api/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchNumber }),
        timeout: 10000,
    });

    if (!res.ok && res.status !== 404) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Verification failed (${res.status})`);
    }

    return res.json() as Promise<VerifyResult>;
}

export type FuzzyMatch = {
    name: string;
    score: number;
};

export async function fuzzyMatchBrand(query: string): Promise<FuzzyMatch[]> {
    const res = await fetchWithRetry(`${API_BASE}/api/v1/scan/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
        timeout: 8000,
    });

    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Fuzzy match failed (${res.status})`);
    }

    return res.json() as Promise<FuzzyMatch[]>;
}

export async function verifyMedicineByBrand(brandName: string): Promise<VerifyResult> {
    const res = await fetchWithRetry(`${API_BASE}/api/v1/scan/verify-brand`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandName }),
        timeout: 10000,
    });

    if (!res.ok && res.status !== 404) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Verification by brand failed (${res.status})`);
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

export async function checkLasaConflicts(medicineName: string): Promise<LasaCheckResult> {
    const res = await fetchWithRetry(`${API_BASE}/api/v1/lasa/check`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ medicineName }),
        timeout: 8000,
    });

    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `LASA check failed (${res.status})`);
    }

    return res.json() as Promise<LasaCheckResult>;
}
