import { openDB, DBSchema, IDBPDatabase } from "idb";

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
}

let dbPromise: Promise<IDBPDatabase<SyncDB>> | null = null;

export function getSyncDB() {
    if (!dbPromise) {
        dbPromise = openDB<SyncDB>("sahidawa-sync", 1, {
            upgrade(db) {
                if (!db.objectStoreNames.contains("pendingScans")) {
                    db.createObjectStore("pendingScans", { keyPath: "idempotencyKey" });
                }
            },
        });
    }
    return dbPromise;
}
