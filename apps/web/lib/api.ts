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
    const res = await fetch(`${API_BASE}/reports`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(payload),
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

export async function verifyMedicine(batchNumber: string): Promise<VerifyResult> {
    const res = await fetch(`${API_BASE}/api/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchNumber }),
    });

    if (!res.ok && res.status !== 404) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Verification failed (${res.status})`);
    }

    return res.json() as Promise<VerifyResult>;
}
