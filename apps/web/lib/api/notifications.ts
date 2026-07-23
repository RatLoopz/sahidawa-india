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
    { registered: true; subscriber: SubscriberData } | { registered: false };

// Guests present the short-lived token that proves they own their number in a
// dedicated header, kept separate from Authorization so it never collides with a
// logged-in user's Supabase session token.
const GUEST_TOKEN_HEADER = "x-guest-token";

function guestHeader(guestToken?: string): Record<string, string> {
    return guestToken ? { [GUEST_TOKEN_HEADER]: guestToken } : {};
}

export async function getSubscriptionStatus(
    accessToken?: string,
    guestToken?: string,
    signal?: AbortSignal
): Promise<SubscriptionStatusResult> {
    const res = await fetchWithRetry(`${API_BASE}/api/v1/notifications/status`, {
        method: "GET",
        headers: {
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : guestHeader(guestToken)),
        },
        credentials: "include",
        timeout: 8000,
        signal,
    });

    // No session and no valid guest token: nothing to prefill. Treat it as
    // "not registered" so the page can offer a fresh subscribe flow instead of
    // surfacing an error.
    if (res.status === 401) {
        return { registered: false };
    }

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

/**
 * Verify the OTP a guest received by SMS/WhatsApp. On success the API returns a
 * short-lived guest token the caller should store and send on later guest
 * requests to prove ownership of the number.
 */
export async function verifyGuestOtp(
    payload: { phone: string; otp: string },
    signal?: AbortSignal
): Promise<{ success: boolean; message: string; guestToken?: string }> {
    const csrfToken = await getCsrfToken();
    const res = await fetchWithRetry(`${API_BASE}/api/v1/notifications/verify-otp`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
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
        throw new Error(errMsg ?? "Failed to verify the code");
    }

    return res.json() as Promise<{ success: boolean; message: string; guestToken?: string }>;
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
    guestToken?: string,
    signal?: AbortSignal
): Promise<{ success: boolean; subscriber: SubscriberData }> {
    const csrfToken = await getCsrfToken();
    const res = await fetchWithRetry(`${API_BASE}/api/v1/notifications/phone`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : guestHeader(guestToken)),
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
    guestToken?: string,
    signal?: AbortSignal
): Promise<{ success: boolean; message: string }> {
    const csrfToken = await getCsrfToken();
    const res = await fetchWithRetry(`${API_BASE}/api/v1/notifications/phone`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : guestHeader(guestToken)),
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
