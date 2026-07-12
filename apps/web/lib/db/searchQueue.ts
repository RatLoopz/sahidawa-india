import { openDB, IDBPDatabase } from "idb";

export interface QueuedSearch {
    id: string;
    query: string;
    timestamp: number;
}

const DB_NAME = "sahidawa-offline-search";
const STORE_NAME = "search-queue";

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

export async function addToSearchQueue(query: string): Promise<QueuedSearch> {
    if (!dbPromise) throw new Error("IndexedDB not available");
    const db = await dbPromise;

    const item: QueuedSearch = {
        id: crypto.randomUUID(),
        query,
        timestamp: Date.now(),
    };
    await db.put(STORE_NAME, item);
    return item;
}

export async function getSearchQueue(): Promise<QueuedSearch[]> {
    if (!dbPromise) return [];
    const db = await dbPromise;
    return db.getAll(STORE_NAME);
}

export async function removeFromSearchQueue(id: string): Promise<void> {
    if (!dbPromise) return;
    const db = await dbPromise;
    await db.delete(STORE_NAME, id);
}

export async function clearSearchQueue(): Promise<void> {
    if (!dbPromise) return;
    const db = await dbPromise;
    await db.clear(STORE_NAME);
}
