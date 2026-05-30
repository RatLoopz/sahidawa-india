import { openDB, type IDBPDatabase } from "idb";

export type ScanStatus = "verified" | "counterfeit" | "not-found";

export interface ScanHistoryEntry {
    id: string;
    timestamp: number;
    barcode: string;
    medicineName: string;
    genericName: string;
    manufacturer: string;
    batchNumber: string;
    expiryDate: string | null;
    cdscoStatus: string;
    status: ScanStatus;
}

const DB_NAME = "sahidawa-scan-history";
const STORE_NAME = "scans";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
                    store.createIndex("timestamp", "timestamp");
                }
            },
        });
    }
    return dbPromise;
}

export async function saveScanToHistory(entry: ScanHistoryEntry): Promise<void> {
    const db = await getDb();
    await db.put(STORE_NAME, entry);
}

export async function getAllScans(): Promise<ScanHistoryEntry[]> {
    const db = await getDb();
    const all = await db.getAllFromIndex(STORE_NAME, "timestamp");
    return all.reverse(); // newest first
}

export async function deleteScan(id: string): Promise<void> {
    const db = await getDb();
    await db.delete(STORE_NAME, id);
}

export async function clearAllScans(): Promise<void> {
    const db = await getDb();
    await db.clear(STORE_NAME);
}

export async function getScanCount(): Promise<number> {
    const db = await getDb();
    return db.count(STORE_NAME);
}
