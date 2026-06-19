import { API_BASE, getCsrfToken } from "../api";
import { fetchWithRetry } from "../apiWithRetry";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ABHALinkResponse {
    txnId: string;
}

export interface ABHAVerifyResponse {
    token: string;
}

export interface ABHAPrescription {
    id: string;
    title: string;
    issuedAt: string;
}

export interface ABHAUploadResponse {
    success: boolean;
}

export interface ABHAUnlinkResponse {
    success: boolean;
}

// ─── Link ABHA ────────────────────────────────────────────────────────────────

export async function linkABHA(
    payload: {
        abhaAddress: string;
    },
    accessToken?: string,
    signal?: AbortSignal
): Promise<ABHALinkResponse> {
    const csrfToken = await getCsrfToken();

    const res = await fetchWithRetry(`${API_BASE}/api/v1/abha/link`, {
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
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to initiate ABHA linking");
    }

    return res.json() as Promise<ABHALinkResponse>;
}

// ─── Verify OTP ───────────────────────────────────────────────────────────────

export async function verifyABHAOtp(
    payload: {
        txnId: string;
        otp: string;
    },
    accessToken?: string,
    signal?: AbortSignal
): Promise<ABHAVerifyResponse> {
    const csrfToken = await getCsrfToken();

    const res = await fetchWithRetry(`${API_BASE}/api/v1/abha/verify-otp`, {
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
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to verify OTP");
    }

    return res.json() as Promise<ABHAVerifyResponse>;
}

// ─── Get Prescriptions ────────────────────────────────────────────────────────

export async function getABHAPrescriptions(
    accessToken?: string,
    signal?: AbortSignal
): Promise<ABHAPrescription[]> {
    const res = await fetchWithRetry(`${API_BASE}/api/v1/abha/prescriptions`, {
        method: "GET",
        headers: {
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: "include",
        timeout: 10000,
        signal,
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to fetch prescriptions");
    }

    return res.json() as Promise<ABHAPrescription[]>;
}

// ─── Upload Verification ──────────────────────────────────────────────────────

export async function uploadABHAVerification(
    payload: {
        medicineId: string;
        verificationResult: string;
        scannedAt: string;
    },
    accessToken?: string,
    signal?: AbortSignal
): Promise<ABHAUploadResponse> {
    const csrfToken = await getCsrfToken();

    const res = await fetchWithRetry(`${API_BASE}/api/v1/abha/upload-verification`, {
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

        throw new Error(body.error ?? "Failed to upload verification");
    }

    return res.json() as Promise<ABHAUploadResponse>;
}

// ─── Unlink ABHA ──────────────────────────────────────────────────────────────

export async function unlinkABHA(
    accessToken?: string,
    signal?: AbortSignal
): Promise<ABHAUnlinkResponse> {
    const csrfToken = await getCsrfToken();

    const res = await fetchWithRetry(`${API_BASE}/api/v1/abha/unlink`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: "include",
        timeout: 10000,
        signal,
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to unlink ABHA");
    }

    return res.json() as Promise<ABHAUnlinkResponse>;
}
