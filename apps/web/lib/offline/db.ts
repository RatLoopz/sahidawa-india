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
        key: string; // `${baseKey}:${userId}`
        value: {
            cacheKey: string;
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
 * Namespace a cache entry by its owning user. IndexedDB is shared across the
 * whole origin and survives logout, so read-cache entries MUST be scoped to the
 * authenticated user — otherwise a second person on a shared device could be
 * served the first user's cached PHI while offline.
 */
function scopedCacheKey(baseKey: ReadCacheKey, userId: string): string {
    return `${baseKey}:${userId}`;
}

/**
 * Persist the latest successful response for a read endpoint, scoped to the
 * given user. No-ops when the user is unknown (nothing is cached un-attributed).
 * Best-effort: a caching failure (e.g. IndexedDB unavailable) is swallowed so
 * it never disrupts the request that produced the data.
 */
export async function readCachePut(
    baseKey: ReadCacheKey,
    userId: string,
    data: unknown
): Promise<void> {
    if (!userId) return;
    try {
        const db = await getSyncDB();
        await db.put("readCache", {
            cacheKey: scopedCacheKey(baseKey, userId),
            data,
            cachedAt: Date.now(),
        });
    } catch {
        // Ignore — the network response has already been returned to the caller.
    }
}

/**
 * Read this user's cached response for a read endpoint, or null when there is
 * nothing cached for them (or the user is unknown / IndexedDB is unavailable).
 */
export async function readCacheGet<T>(baseKey: ReadCacheKey, userId: string): Promise<T | null> {
    if (!userId) return null;
    try {
        const db = await getSyncDB();
        const entry = await db.get("readCache", scopedCacheKey(baseKey, userId));
        return entry ? (entry.data as T) : null;
    } catch {
        return null;
    }
}

/**
 * Wipe every cached read-endpoint response. Called on explicit sign-out so a
 * user's cached schedule/summary never lingers on the device for whoever signs
 * in next. Best-effort — a cleanup failure must not block sign-out.
 */
export async function clearReadCache(): Promise<void> {
    try {
        const db = await getSyncDB();
        await db.clear("readCache");
    } catch {
        // Ignore — sign-out proceeds regardless.
    }
}
