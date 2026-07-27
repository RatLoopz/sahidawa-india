import { API_BASE } from "./apiConfig";

// Must match the header name the backend's CSRF middleware expects
// (csrf-csrf's default is "x-csrf-token").
export const CSRF_HEADER_NAME = "x-csrf-token";

let csrfTokenCache: string | null = null;
let isRefreshingCsrf = false;
let refreshSubscribers: { resolve: (token: string) => void; reject: (err: unknown) => void }[] = [];

function onCsrfRefreshed(token: string) {
    refreshSubscribers.forEach(({ resolve }) => resolve(token));
    refreshSubscribers = [];
}

function onCsrfRefreshFailed(err: unknown) {
    refreshSubscribers.forEach(({ reject }) => reject(err));
    refreshSubscribers = [];
}

export async function getCsrfToken(): Promise<string> {
    if (csrfTokenCache) return csrfTokenCache;
    return refreshCsrfToken();
}

export async function refreshCsrfToken(): Promise<string> {
    if (isRefreshingCsrf) {
        return new Promise((resolve, reject) => {
            refreshSubscribers.push({ resolve, reject });
        });
    }

    isRefreshingCsrf = true;
    csrfTokenCache = null;

    try {
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
        onCsrfRefreshed(data.csrfToken);
        return data.csrfToken;
    } catch (error) {
        onCsrfRefreshFailed(error);
        throw error;
    } finally {
        isRefreshingCsrf = false;
    }
}

/** Drop the cached token so the next getCsrfToken() call forces a refresh. */
export function invalidateCsrfToken(): void {
    csrfTokenCache = null;
}

/**
 * Heuristic for "this failure was a CSRF rejection" so callers can decide
 * whether to refresh the token and retry, vs. surfacing the error as-is.
 */
export function isCsrfError(status: number, body: unknown): boolean {
    if (status !== 403) return false;
    let message = "";
    if (typeof body === "object" && body !== null) {
        const anyBody = body as Record<string, unknown>;
        if (typeof anyBody.error === "string") message = anyBody.error;
        else if (typeof anyBody.message === "string") message = anyBody.message;
        else if (anyBody.error && typeof anyBody.error === "object") {
            message = String((anyBody.error as { message?: unknown }).message ?? "");
        }
    }
    return /csrf/i.test(message);
}