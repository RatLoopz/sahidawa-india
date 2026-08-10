/**
 * Session access token helpers.
 *
 * Tokens live in memory (and Supabase's own session store) only.
 * Never mirror them into localStorage — XSS can otherwise steal the
 * full bearer for health data via a well-known key like `sb-access-token`.
 */

const LEGACY_ACCESS_TOKEN_KEY = "sb-access-token";

let memoryAccessToken: string | null = null;

export function clearLegacyAccessTokenStorage(): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
    } catch {
        // Private mode / disabled storage — nothing else to do.
    }
}

export function setSessionAccessToken(token: string | null): void {
    memoryAccessToken = token && token.length > 0 ? token : null;
    clearLegacyAccessTokenStorage();
}

export function getSessionAccessToken(): string {
    if (typeof window === "undefined") return "";
    return memoryAccessToken ?? "";
}
