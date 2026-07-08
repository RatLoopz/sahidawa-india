import { openDB, IDBPDatabase } from "idb";

export interface QueuedScan {
    id: string;
    barcode: string;
    timestamp: number;
    locale: string;
    apiUrl: string;
    deviceMetadata?: {
        userAgent: string;
        platform: string;
        language: string;
    };
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

export async function addToSyncQueue(
    barcode: string,
    locale: string,
    apiUrl?: string,
    deviceMetadata?: QueuedScan["deviceMetadata"]
): Promise<QueuedScan> {
    if (!dbPromise) throw new Error("IndexedDB not available");
    const db = await dbPromise;

    const finalApiUrl = apiUrl || (() => {
        const mlUrl = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_ML_URL : undefined;
        const apiBase = (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_URL : undefined) || "http://localhost:4000";
        return mlUrl 
            ? `${mlUrl.replace(/\/+$/, "")}/verify/batch` 
            : `${apiBase.replace(/\/+$/, "")}/api/verify`;
    })();

    const item: QueuedScan = {
        id: crypto.randomUUID(),
        barcode,
        timestamp: Date.now(),
        locale,
        apiUrl: finalApiUrl,
        deviceMetadata,
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
