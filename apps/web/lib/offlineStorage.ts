import { openDB, DBSchema, IDBPDatabase } from "idb";
import type { FormValues } from "@/components/reports/ReportWizard";

interface SahiDawaDB extends DBSchema {
    pending_reports: {
        key: number;
        value: {
            id?: number;
            payload: FormValues & {
                city?: string;
                state?: string;
                latitude?: number;
                longitude?: number;
            };
            createdAt: number;
            retries: number;
        };
    };
    draft_form: {
        key: string;
        value: unknown;
    };
}

const DB_NAME = "sahidawa-offline-db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<SahiDawaDB>> | null = null;

function getDB() {
    if (typeof window === "undefined") {
        // SSR guard — never call on server
        throw new Error("offlineStorage can only be used in the browser");
    }
    if (!dbPromise) {
        dbPromise = openDB<SahiDawaDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains("pending_reports")) {
                    db.createObjectStore("pending_reports", {
                        keyPath: "id",
                        autoIncrement: true,
                    });
                }
                if (!db.objectStoreNames.contains("draft_form")) {
                    db.createObjectStore("draft_form");
                }
            },
        });
    }
    return dbPromise;
}

const DRAFT_KEY = "report-form-draft";

export async function saveDraft(data: unknown) {
    try {
        const db = await getDB();
        await db.put("draft_form", data, DRAFT_KEY);
    } catch (err) {
        console.error("saveDraft failed:", err);
    }
}

export async function getDraft<T = unknown>(): Promise<T | undefined> {
    try {
        const db = await getDB();
        return (await db.get("draft_form", DRAFT_KEY)) as T | undefined;
    } catch (err) {
        console.error("getDraft failed:", err);
        return undefined;
    }
}

export async function clearDraft() {
    try {
        const db = await getDB();
        await db.delete("draft_form", DRAFT_KEY);
    } catch (err) {
        console.error("clearDraft failed:", err);
    }
}

export async function queueReport(payload: SahiDawaDB["pending_reports"]["value"]["payload"]) {
    const db = await getDB();
    return db.add("pending_reports", {
        payload,
        createdAt: Date.now(),
        retries: 0,
    });
}

export async function getPendingReports() {
    try {
        const db = await getDB();
        return db.getAll("pending_reports");
    } catch (err) {
        console.error("getPendingReports failed:", err);
        return [];
    }
}

export async function removePendingReport(id: number) {
    const db = await getDB();
    await db.delete("pending_reports", id);
}

export async function incrementRetry(id: number) {
    const db = await getDB();
    const record = await db.get("pending_reports", id);
    if (record) {
        record.retries += 1;
        await db.put("pending_reports", record);
    }
}

export async function getPendingCount() {
    const all = await getPendingReports();
    return all.length;
}
