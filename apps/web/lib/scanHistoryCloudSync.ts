import { supabase } from "@/lib/supabase";
import {
    clearScanHistory,
    getScanHistory,
    saveScanHistoryEntries,
    type ScanHistoryEntry,
} from "@/lib/db/scanHistory";

type CloudScanHistoryRow = {
    id: string;
    user_id: string;
    medicine_name: string;
    status: string;
    timestamp: number;
    scanned_at: string;
    query: string;
    source: string;
    updated_at?: string;
};

export async function syncScanHistoryWithCloud(): Promise<{
    localCount: number;
    cloudCount: number;
}> {
    const {
        data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
        throw new Error("You must be signed in to sync scan history.");
    }

    const localEntries = await getScanHistory();
    if (localEntries.length > 0) {
        const rows = localEntries.map((entry) => ({
            id: entry.id,
            user_id: session.user.id,
            medicine_name: entry.medicineName,
            status: entry.status,
            timestamp: entry.timestamp,
            scanned_at: entry.scannedAt || new Date(entry.timestamp).toISOString(),
            query: entry.query || entry.medicineName,
            source: entry.source || "offline",
        }));

        const { error: upsertError } = await supabase
            .from("user_scan_history")
            .upsert(rows, { onConflict: "id" });

        if (upsertError) {
            throw upsertError;
        }
    }

    const { data, error: fetchError } = await supabase
        .from("user_scan_history")
        .select("*")
        .order("timestamp", { ascending: false });

    if (fetchError) {
        throw fetchError;
    }

    const cloudEntries = (data ?? []).map(fromCloudRow);
    await clearScanHistory();
    await saveScanHistoryEntries(cloudEntries);

    return { localCount: localEntries.length, cloudCount: cloudEntries.length };
}

function fromCloudRow(row: CloudScanHistoryRow): ScanHistoryEntry {
    return {
        id: row.id,
        medicineName: row.medicine_name,
        status: row.status,
        timestamp: row.timestamp,
        scannedAt: row.scanned_at,
        query: row.query,
        source: row.source,
    };
}
