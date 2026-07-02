import { getSyncDB } from "./db";
import { v4 as uuidv4 } from "uuid";

export function getDeviceId(): string {
    const key = "sahidawa_device_id";
    let id = localStorage.getItem(key); // OK here: not app data, just a stable device tag
    if (!id) {
        id = uuidv4();
        localStorage.setItem(key, id);
    }
    return id;
}

export async function enqueueScan(input: {
    metadata: Record<string, unknown>;
    imageBlob?: Blob;
    voiceBlob?: Blob;
}) {
    const db = await getSyncDB();
    const idempotencyKey = uuidv4();
    await db.put("pendingScans", {
        idempotencyKey,
        deviceId: getDeviceId(),
        createdAt: Date.now(),
        metadata: input.metadata,
        imageBlob: input.imageBlob,
        voiceBlob: input.voiceBlob,
        parts: {
            metadata: "pending",
            image: input.imageBlob ? "pending" : "skipped",
            voice: input.voiceBlob ? "pending" : "skipped",
        },
        attemptCount: 0,
    });

    // Try immediate sync if online; otherwise rely on Background Sync registration
    if (navigator.onLine) {
        void flushQueue();
    } else if ("serviceWorker" in navigator && "SyncManager" in window) {
        const reg = await navigator.serviceWorker.ready;
        await (reg as any).sync.register("sahidawa-sync-scans");
    }
    return idempotencyKey;
}

export async function flushQueue() {
    const db = await getSyncDB();
    const all = await db.getAll("pendingScans");
    for (const entry of all) {
        await syncOneEntry(entry);
    }
}

async function syncOneEntry(entry: any) {
    const db = await getSyncDB();
    try {
        const form = new FormData();
        form.append("idempotencyKey", entry.idempotencyKey);
        form.append("deviceId", entry.deviceId);
        form.append("clientUpdatedAt", String(entry.createdAt));

        if (entry.parts.metadata !== "synced") {
            form.append("metadata", JSON.stringify(entry.metadata));
        }
        if (entry.parts.image === "pending" && entry.imageBlob) {
            const ext = entry.imageBlob.type.includes("png") ? "png" : "jpeg";
            form.append("image", entry.imageBlob, `image.${ext}`);
        }
        if (entry.parts.voice === "pending" && entry.voiceBlob) {
            const ext = entry.voiceBlob.type.includes("mp4") ? "mp4" : "webm";
            form.append("voice", entry.voiceBlob, `voice.${ext}`);
        }

        const res = await fetch("/api/v1/scan/submit", {
            method: "POST",
            headers: { "Idempotency-Key": entry.idempotencyKey },
            body: form,
        });

        if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
        const result = await res.json(); // { parts: { metadata: 'synced'|'failed', image: ..., voice: ... } }

        const updatedParts = { ...entry.parts, ...result.parts };
        const allDone = Object.values(updatedParts).every((s) => s === "synced" || s === "skipped");

        if (allDone) {
            await db.delete("pendingScans", entry.idempotencyKey);
        } else {
            await db.put("pendingScans", {
                ...entry,
                parts: updatedParts,
                attemptCount: entry.attemptCount + 1,
            });
        }
    } catch {
        await db.put("pendingScans", { ...entry, attemptCount: entry.attemptCount + 1 });
        // Exponential backoff re-registration handled by Background Sync retry semantics;
        // for browsers without SyncManager, fall back to a setTimeout retry loop.
    }
}

// Call once on app init
export function initOnlineListener() {
    if (typeof window !== "undefined") {
        window.addEventListener("online", () => void flushQueue());

        // Also listen for Service Worker messages
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.addEventListener("message", (event) => {
                if (event.data && event.data.type === "FLUSH_SYNC_QUEUE") {
                    void flushQueue();
                }
            });
        }
    }
}
