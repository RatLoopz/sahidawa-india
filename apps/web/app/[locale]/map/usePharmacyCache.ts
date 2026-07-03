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

interface PharmacyBounds {
    south: number;
    west: number;
    north: number;
    east: number;
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

function normalizeRadiusKm(radiusMeters: number): number {
    const radiusKm = Math.round(radiusMeters / 1000);
    return Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : 10;
}

export function buildNearbyCacheKey(lat: number, lng: number, radiusMeters: number): string {
    // Round coordinates consistently while keeping radius-specific searches isolated.
    return `nearby:${lat.toFixed(2)}:${lng.toFixed(2)}:r:${normalizeRadiusKm(radiusMeters)}`;
}

export function buildBoundsCacheKey(bounds: PharmacyBounds): string {
    return [
        "bounds",
        bounds.south.toFixed(3),
        bounds.west.toFixed(3),
        bounds.north.toFixed(3),
        bounds.east.toFixed(3),
    ].join(":");
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

        return null;
    } catch (err) {
        console.warn("Failed to load pharmacy cache:", err);
        return null;
    }
}
