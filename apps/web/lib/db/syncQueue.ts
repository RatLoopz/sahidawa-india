import { openDB, IDBPDatabase } from "idb";

export interface QueuedScan {
    id: string;
    barcode: string;
    timestamp: number;
    locale: string;
}

const DB_NAME = "sahidawa-offline-sync";
const STORE_NAME = "sync-queue";

let dbPromise: Promise<IDBPDatabase<any>> | null = null;

if (typeof window !== "undefined") {
    dbPromise = openDB(DB_NAME, 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id" });
            }
        },
    });
}

export async function addToSyncQueue(barcode: string, locale: string): Promise<QueuedScan> {
    if (!dbPromise) throw new Error("IndexedDB not available");
    const db = await dbPromise;
    const item: QueuedScan = {
        id: crypto.randomUUID(),
        barcode,
        timestamp: Date.now(),
        locale,
    };
    await db.put(STORE_NAME, item);
    return item;
}

export async function getSyncQueue(): Promise<QueuedScan[]> {
    if (!dbPromise) return [];
    const db = await dbPromise;
    return db.getAll(STORE_NAME);
}

export async function removeFromSyncQueue(id: string): Promise<void> {
    if (!dbPromise) return;
    const db = await dbPromise;
    await db.delete(STORE_NAME, id);
}

export async function clearSyncQueue(): Promise<void> {
    if (!dbPromise) return;
    const db = await dbPromise;
    await db.clear(STORE_NAME);
}
