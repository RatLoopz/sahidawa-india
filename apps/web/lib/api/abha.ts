import { API_BASE, getCsrfToken } from "../api";
import { fetchWithRetry } from "../apiWithRetry";

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
        throw new Error("Failed to initiate ABHA linking");
    }

    return res.json() as Promise<ABHALinkResponse>;
}

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
        throw new Error("Failed to verify OTP");
    }

    return res.json() as Promise<ABHAVerifyResponse>;
}

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
        throw new Error("Failed to fetch prescriptions");
    }

    return res.json() as Promise<ABHAPrescription[]>;
}

export async function uploadABHAVerification(
    payload: {
        medicineId: string;
        verificationResult: string;
        scannedAt: string;
    },
    accessToken?: string,
    signal?: AbortSignal
): Promise<{ success: boolean }> {
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
        throw new Error("Failed to upload verification");
    }

    return res.json() as Promise<{ success: boolean }>;
}

export async function unlinkABHA(
    accessToken?: string,
    signal?: AbortSignal
): Promise<{ success: boolean }> {
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
        throw new Error("Failed to unlink ABHA");
    }

    return res.json() as Promise<{ success: boolean }>;
}
