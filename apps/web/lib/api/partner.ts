import { fetchWithRetry } from "../apiWithRetry";
import {
    getCsrfToken,
    refreshCsrfToken,
    invalidateCsrfToken,
    isCsrfError,
    CSRF_HEADER_NAME,
} from "../csrf";
import { parseApiErrorString } from "../apiErrorHandler";
import { PharmacyPartnerRegistrationInput } from "@sahidawa/validators";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function registerPartner(
    data: PharmacyPartnerRegistrationInput,
    signal?: AbortSignal
): Promise<{ success: boolean; message?: string; error?: string }> {
    const url = `${API_BASE}/api/partner/register`;

    const doRequest = (token: string) =>
        fetchWithRetry(url, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                [CSRF_HEADER_NAME]: token,
            },
            body: JSON.stringify(data),
            timeout: 10000,
            signal,
        });

    try {
        let token = await getCsrfToken();
        let res = await doRequest(token);

        if (!res.ok && res.status === 403) {
            const body = await res.json().catch(() => ({}));
            if (isCsrfError(res.status, body)) {
                invalidateCsrfToken();
                token = await refreshCsrfToken();
                res = await doRequest(token);
            } else {
                throw new Error(parseApiErrorString(body, "Failed to register partner."));
            }
        }

        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(parseApiErrorString(body, "Failed to register partner."));
        }

        const json = await res.json();
        return { success: true, message: json.message };
    } catch (err: any) {
        return { success: false, error: err.message || "An unknown error occurred" };
    }
}
