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
}

let dbPromise: Promise<IDBPDatabase<SyncDB>> | null = null;

export function getSyncDB() {
    if (!dbPromise) {
        // Changed version from 1 to 2 to trigger the upgrade
        dbPromise = openDB<SyncDB>("sahidawa-sync", 2, {
            upgrade(db) {
                if (!db.objectStoreNames.contains("pendingScans")) {
                    db.createObjectStore("pendingScans", { keyPath: "idempotencyKey" });
                }
                // Add our new pendingReports store
                if (!db.objectStoreNames.contains("pendingReports")) {
                    db.createObjectStore("pendingReports", { keyPath: "idempotencyKey" });
                }
            },
        });
    }
    return dbPromise;
}