import { dbConfig } from "../db/client";

/**
 * Detects Supabase/network outage style failures used across auth and route
 * offline fallbacks.
 */
export function isSupabaseConnectionError(message: string | null | undefined): boolean {
    if (!message) return false;
    return (
        message.includes("fetch failed") ||
        message.includes("refused") ||
        message.includes("timeout") ||
        message.includes("connect")
    );
}

/**
 * Runs a primary DB-backed operation, falling back when Supabase is already
 * offline or the primary path hits a connection-style failure.
 */
export async function withDbFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T> | T
): Promise<T> {
    if (dbConfig?.isSupabaseOffline) {
        return await fallback();
    }

    try {
        return await primary();
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (isSupabaseConnectionError(message)) {
            if (dbConfig) {
                if (typeof dbConfig.setOffline === "function") {
                    dbConfig.setOffline();
                } else {
                    dbConfig.isSupabaseOffline = true;
                }
            }
        }
        return await fallback();
    }
}

/**
 * Marks Supabase offline when an error object/message looks like a connection
 * failure. Returns true when the caller should treat the DB as failed.
 */
export function markOfflineOnConnectionError(
    error: { message?: string } | string | null | undefined
): boolean {
    const message = typeof error === "string" ? error : error?.message;
    if (!isSupabaseConnectionError(message)) {
        return Boolean(error);
    }
    if (dbConfig) {
        if (typeof dbConfig.setOffline === "function") {
            dbConfig.setOffline();
        } else {
            dbConfig.isSupabaseOffline = true;
        }
    }
    return true;
}
