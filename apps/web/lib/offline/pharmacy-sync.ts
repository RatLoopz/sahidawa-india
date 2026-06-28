import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { VerifiedPharmacy } from "../api";

const DB_NAME = "sahidawa_pharmacy_sync";
const DB_VERSION = 1;
const PHARMACY_STORE = "verified-pharmacies";
const META_STORE = "sync-metadata";
const DEFAULT_CACHE_KEY = "global";

export type PharmacySyncRecord = VerifiedPharmacy & {
    is_active?: boolean;
    deleted_at?: string | null;
};

interface PharmacySyncEntry {
    key: string;
    pharmacies: PharmacySyncRecord[];
    updatedAt: number;
}

interface PharmacySyncDB extends DBSchema {
    "verified-pharmacies": {
        key: string;
        value: PharmacySyncEntry;
    };
    "sync-metadata": {
        key: string;
        value: string;
    };
}

let dbPromise: Promise<IDBPDatabase<PharmacySyncDB>> | null = null;

function ensureBrowser() {
    if (typeof window === "undefined") {
        throw new Error("pharmacy sync storage can only be used in the browser");
    }
}

function getDB() {
    ensureBrowser();
    if (!dbPromise) {
        dbPromise = openDB<PharmacySyncDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(PHARMACY_STORE)) {
                    db.createObjectStore(PHARMACY_STORE, { keyPath: "key" });
                }
                if (!db.objectStoreNames.contains(META_STORE)) {
                    db.createObjectStore(META_STORE);
                }
            },
        });
    }
    return dbPromise;
}

function metaKey(cacheKey = DEFAULT_CACHE_KEY) {
    return `${cacheKey}:last-sync`;
}

function pharmacyIdentity(pharmacy: PharmacySyncRecord): string {
    if (pharmacy.id) return `id:${pharmacy.id}`;
    return `coords:${pharmacy.name}:${pharmacy.lat.toFixed(6)}:${pharmacy.lng.toFixed(6)}`;
}

function isDeleted(pharmacy: PharmacySyncRecord): boolean {
    return pharmacy.is_active === false || Boolean(pharmacy.deleted_at);
}

export async function getLastSyncTimestamp(cacheKey = DEFAULT_CACHE_KEY): Promise<string | null> {
    try {
        const db = await getDB();
        return (await db.get(META_STORE, metaKey(cacheKey))) ?? null;
    } catch (err) {
        console.warn("Failed to read pharmacy sync timestamp:", err);
        return null;
    }
}

export async function setLastSyncTimestamp(
    timestamp: string | number | Date,
    cacheKey = DEFAULT_CACHE_KEY
): Promise<void> {
    try {
        const db = await getDB();
        const value =
            timestamp instanceof Date
                ? timestamp.toISOString()
                : typeof timestamp === "number"
                  ? new Date(timestamp).toISOString()
                  : timestamp;
        await db.put(META_STORE, value, metaKey(cacheKey));
    } catch (err) {
        console.warn("Failed to save pharmacy sync timestamp:", err);
    }
}

export async function getCachedPharmacies(
    cacheKey = DEFAULT_CACHE_KEY
): Promise<PharmacySyncRecord[]> {
    try {
        const db = await getDB();
        const entry = await db.get(PHARMACY_STORE, cacheKey);
        return entry?.pharmacies ?? [];
    } catch (err) {
        console.warn("Failed to read cached pharmacies:", err);
        return [];
    }
}

export async function setCachedPharmacies(
    pharmacies: PharmacySyncRecord[],
    cacheKey = DEFAULT_CACHE_KEY
): Promise<void> {
    try {
        const db = await getDB();
        await db.put(PHARMACY_STORE, {
            key: cacheKey,
            pharmacies: pharmacies.filter((pharmacy) => !isDeleted(pharmacy)),
            updatedAt: Date.now(),
        });
    } catch (err) {
        console.warn("Failed to save cached pharmacies:", err);
    }
}

export function mergePharmacyDelta(
    existing: PharmacySyncRecord[],
    delta: PharmacySyncRecord[]
): PharmacySyncRecord[] {
    const merged = new Map<string, PharmacySyncRecord>();

    existing
        .filter((pharmacy) => !isDeleted(pharmacy))
        .forEach((pharmacy) => {
            merged.set(pharmacyIdentity(pharmacy), pharmacy);
        });

    delta.forEach((pharmacy) => {
        const key = pharmacyIdentity(pharmacy);
        if (isDeleted(pharmacy)) {
            merged.delete(key);
            return;
        }
        merged.set(key, pharmacy);
    });

    return Array.from(merged.values());
}
