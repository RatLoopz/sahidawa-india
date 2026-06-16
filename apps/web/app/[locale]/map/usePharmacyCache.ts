import type { Pharmacy } from "./PharmacyMap";
import type { AshaWorker } from "./PharmacyMap";

const DB_NAME = "sahidawa_offline_cache";
const STORE = "pharmacy-results";
const LAST_SEARCH_KEY = "last-search";
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
    pharmacies: Pharmacy[];
    ashaWorkers: AshaWorker[];
    timestamp: number;
}

function isFresh(entry: CacheEntry | undefined): entry is CacheEntry {
    if (!entry) return false;
    return Date.now() - entry.timestamp <= TTL_MS;
}

async function getDB() {
    const { openDB } = await import("idb");
    return openDB(DB_NAME, 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE)) {
                db.createObjectStore(STORE);
            }
        },
    });
}

export function buildCacheKey(lat: number, lng: number): string {
    // Round to 2 decimal places (~1km precision)
    return `${lat.toFixed(2)}_${lng.toFixed(2)}`;
}

export async function saveToCache(
    key: string,
    pharmacies: Pharmacy[],
    ashaWorkers: AshaWorker[]
): Promise<void> {
    try {
        const db = await getDB();
        const entry: CacheEntry = { pharmacies, ashaWorkers, timestamp: Date.now() };
        await db.put(STORE, entry, key);
        await db.put(STORE, entry, LAST_SEARCH_KEY);
    } catch (err) {
        console.warn("Failed to save pharmacy cache:", err);
    }
}

export async function loadFromCache(key: string): Promise<CacheEntry | null> {
    try {
        const db = await getDB();
        const entry: CacheEntry | undefined = await db.get(STORE, key);
        if (isFresh(entry)) return entry;

        const lastSearchEntry: CacheEntry | undefined = await db.get(STORE, LAST_SEARCH_KEY);
        if (isFresh(lastSearchEntry)) return lastSearchEntry;

        return null;
    } catch (err) {
        console.warn("Failed to load pharmacy cache:", err);
        return null;
    }
}
