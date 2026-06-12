import { API_BASE, getCsrfToken } from "../api";
import { fetchWithRetry } from "../apiWithRetry";

export type InteractionResult = {
    drugA: string;
    drugAGeneric: string;
    drugB: string;
    drugBGeneric: string;
    severity: "critical" | "serious" | "moderate" | "minor";
    mechanism: string;
    description: string;
    clinical_recommendation: string;
    source: string;
};

export async function checkInteractions(
    medicines: string[],
    signal?: AbortSignal
): Promise<{ interactions: InteractionResult[] }> {
    const csrfToken = await getCsrfToken();
    const res = await fetchWithRetry(`${API_BASE}/api/v1/interactions/check`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
        },
        credentials: "include",
        body: JSON.stringify({ medicines }),
        timeout: 10000,
        signal,
    });

    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
            error?: string | { message?: string };
        };
        const errMsg = typeof body.error === "object" ? body.error?.message : body.error;
        throw new Error(errMsg ?? "Failed to check drug interactions");
    }

    return res.json() as Promise<{ interactions: InteractionResult[] }>;
}
