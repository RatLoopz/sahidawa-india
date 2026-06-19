import { openDB } from "idb";

const DB_NAME = "sahidawa-history";
const STORE_NAME = "scan-history";

export interface ScanHistoryEntry {
    id: string;
    timestamp: number;
    medicineName: string;
    status: string;
    scannedAt?: string;
    query?: string;
    source?: string;
}

let dbPromise: ReturnType<typeof openDB> | null = null;

function getDb() {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, 1, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, {
                        keyPath: "id",
                    });
                }
            },
        });
    }

    return dbPromise;
}

export async function saveScanHistory(entry: ScanHistoryEntry) {
    const db = await getDb();

    await db.put(STORE_NAME, entry);
}

export async function getScanHistory() {
    const db = await getDb();

    return db.getAll(STORE_NAME);
}

export async function deleteScanHistory(id: string) {
    const db = await getDb();

    await db.delete(STORE_NAME, id);
}

export async function clearScanHistory() {
    const db = await getDb();

    await db.clear(STORE_NAME);
}

export async function saveScanHistoryEntries(entries: ScanHistoryEntry[]) {
    const db = await getDb();

    for (const entry of entries) {
        await db.put(STORE_NAME, entry);
    }
}
