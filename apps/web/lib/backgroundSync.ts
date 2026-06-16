import { getPendingReports, removePendingReport, incrementRetry } from "@/lib/offlineStorage";
import { submitReport } from "@/lib/api";
import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/env";

const MAX_RETRIES = 5;

async function getAuthToken(): Promise<string | undefined> {
    try {
        const supabase = createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
        const {
            data: { session },
        } = await supabase.auth.getSession();
        return session?.access_token;
    } catch {
        return undefined;
    }
}

export async function syncPendingReports(onSynced?: (count: number) => void) {
    if (typeof window === "undefined" || !navigator.onLine) return;

    const pending = await getPendingReports();
    if (pending.length === 0) return;

    const token = await getAuthToken();
    let synced = 0;

    for (const record of pending) {
        if (record.retries >= MAX_RETRIES) continue;

        try {
            await submitReport(record.payload, token);
            if (record.id != null) await removePendingReport(record.id);
            synced++;
        } catch {
            if (record.id != null) await incrementRetry(record.id);
            // If we're offline mid-loop, bail out rather than burn retries
            if (!navigator.onLine) break;
        }
    }

    if (synced > 0 && onSynced) onSynced(synced);
}

let cleanupFn: (() => void) | null = null;

export function initBackgroundSync(onSynced?: (count: number) => void) {
    if (typeof window === "undefined") return () => {};
    if (cleanupFn) cleanupFn();

    const handler = () => void syncPendingReports(onSynced);
    window.addEventListener("online", handler);
    void syncPendingReports(onSynced); // attempt on mount too

    cleanupFn = () => {
        window.removeEventListener("online", handler);
        cleanupFn = null;
    };
    return cleanupFn;
}
