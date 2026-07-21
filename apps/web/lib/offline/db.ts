import { openDB, DBSchema, IDBPDatabase } from "idb";

/** Read endpoints whose latest successful response we cache for offline reads. */
export type ReadCacheKey = "schedules" | "todaySummary";

interface SyncDB extends DBSchema {
    pendingScans: {
        key: string; // idempotencyKey
        value: {
            idempotencyKey: string;
            deviceId: string;
            createdAt: number;
            metadata: Record<string, unknown>;
            imageBlob?: Blob;
            voiceBlob?: Blob;
            parts: {
                metadata: "pending" | "synced" | "failed";
                image: "pending" | "synced" | "failed" | "skipped";
                voice: "pending" | "synced" | "failed" | "skipped";
            };
            attemptCount: number;
        };
    };
    pendingReports: {
        key: string; // idempotencyKey
        value: {
            idempotencyKey: string;
            deviceId: string;
            createdAt: number;
            reportData: Record<string, any>;
            imageBlob?: Blob;
        };
    };
    readCache: {
        key: string; // cacheKey
        value: {
            cacheKey: ReadCacheKey;
            data: unknown;
            cachedAt: number;
        };
    };
}

let dbPromise: Promise<IDBPDatabase<SyncDB>> | null = null;

export function getSyncDB() {
    if (!dbPromise) {
        // Version 3 adds the readCache store (offline read caching for schedules).
        dbPromise = openDB<SyncDB>("sahidawa-sync", 3, {
            upgrade(db) {
                if (!db.objectStoreNames.contains("pendingScans")) {
                    db.createObjectStore("pendingScans", { keyPath: "idempotencyKey" });
                }
                // Add our new pendingReports store
                if (!db.objectStoreNames.contains("pendingReports")) {
                    db.createObjectStore("pendingReports", { keyPath: "idempotencyKey" });
                }
                // Read-cache for offline viewing of medication schedules / today summary
                if (!db.objectStoreNames.contains("readCache")) {
                    db.createObjectStore("readCache", { keyPath: "cacheKey" });
                }
            },
        });
    }
    return dbPromise;
}

/**
 * Persist the latest successful response for a read endpoint. Best-effort: a
 * caching failure (e.g. IndexedDB unavailable) is swallowed so it never
 * disrupts the request that produced the data.
 */
export async function readCachePut(cacheKey: ReadCacheKey, data: unknown): Promise<void> {
    try {
        const db = await getSyncDB();
        await db.put("readCache", { cacheKey, data, cachedAt: Date.now() });
    } catch {
        // Ignore — the network response has already been returned to the caller.
    }
}

/**
 * Read a previously cached response for a read endpoint, or null when there is
 * nothing cached (or IndexedDB is unavailable).
 */
export async function readCacheGet<T>(cacheKey: ReadCacheKey): Promise<T | null> {
    try {
        const db = await getSyncDB();
        const entry = await db.get("readCache", cacheKey);
        return entry ? (entry.data as T) : null;
    } catch {
        return null;
    }
}
