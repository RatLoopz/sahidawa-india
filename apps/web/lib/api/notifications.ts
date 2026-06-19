import { API_BASE, getCsrfToken } from "../api";
import { fetchWithRetry } from "../apiWithRetry";

export type SubscriberData = {
    phone: string;
    channels: ("sms" | "whatsapp")[];
    language: string;
    district: string;
    is_active: boolean;
};

export type SubscriptionStatusResult =
    | { registered: true; subscriber: SubscriberData }
    | { registered: false };

export async function getSubscriptionStatus(
    phone?: string,
    accessToken?: string,
    signal?: AbortSignal
): Promise<SubscriptionStatusResult> {
    const url = new URL(`${API_BASE}/api/v1/notifications/status`);
    if (phone) {
        url.searchParams.append("phone", phone);
    }

    const res = await fetchWithRetry(url.toString(), {
        method: "GET",
        headers: {
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: "include",
        timeout: 8000,
        signal,
    });

    if (!res.ok) {
        throw new Error("Failed to load notification settings");
    }

    return res.json() as Promise<SubscriptionStatusResult>;
}

export async function registerSubscription(
    payload: {
        phone: string;
        channels: ("sms" | "whatsapp")[];
        language: string;
        district: string;
    },
    accessToken?: string,
    signal?: AbortSignal
): Promise<{ success: boolean; subscriber: SubscriberData }> {
    const csrfToken = await getCsrfToken();
    const res = await fetchWithRetry(`${API_BASE}/api/v1/notifications/register`, {
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
            error?: string | { message?: string };
        };
        const errMsg = typeof body.error === "object" ? body.error?.message : body.error;
        throw new Error(errMsg ?? "Failed to register subscription");
    }

    return res.json() as Promise<{ success: boolean; subscriber: SubscriberData }>;
}

export async function updateSubscription(
    payload: {
        phone: string;
        newPhone?: string;
        channels?: ("sms" | "whatsapp")[];
        language?: string;
        district?: string;
        is_active?: boolean;
    },
    accessToken?: string,
    signal?: AbortSignal
): Promise<{ success: boolean; subscriber: SubscriberData }> {
    const csrfToken = await getCsrfToken();
    const res = await fetchWithRetry(`${API_BASE}/api/v1/notifications/phone`, {
        method: "PATCH",
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
            error?: string | { message?: string };
        };
        const errMsg = typeof body.error === "object" ? body.error?.message : body.error;
        throw new Error(errMsg ?? "Failed to update subscription settings");
    }

    return res.json() as Promise<{ success: boolean; subscriber: SubscriberData }>;
}

export async function optOutSubscription(
    payload: { phone?: string },
    accessToken?: string,
    signal?: AbortSignal
): Promise<{ success: boolean; message: string }> {
    const csrfToken = await getCsrfToken();
    const res = await fetchWithRetry(`${API_BASE}/api/v1/notifications/phone`, {
        method: "DELETE",
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
            error?: string | { message?: string };
        };
        const errMsg = typeof body.error === "object" ? body.error?.message : body.error;
        throw new Error(errMsg ?? "Failed to opt out of notifications");
    }

    return res.json() as Promise<{ success: boolean; message: string }>;
}
