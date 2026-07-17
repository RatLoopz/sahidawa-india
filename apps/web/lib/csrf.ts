import { API_BASE } from "./apiConfig";

let csrfTokenCache: string | null = null;
let isRefreshingCsrf = false;
let refreshSubscribers: { resolve: (token: string) => void; reject: (err: any) => void }[] = [];

function onCsrfRefreshed(token: string) {
    refreshSubscribers.forEach(({ resolve }) => resolve(token));
    refreshSubscribers = [];
}

function onCsrfRefreshFailed(err: any) {
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
