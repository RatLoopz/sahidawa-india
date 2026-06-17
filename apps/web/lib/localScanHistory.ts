import type { ScanMeta, VerifyResult } from "./api";

export const DEFAULT_LOCAL_SCAN_HISTORY_PAGE_SIZE = 20;
export const MAX_LOCAL_SCAN_HISTORY_PAGE_SIZE = 50;

const DB_NAME = "sahidawa-local-scan-history";
const DB_VERSION = 1;
const STORE_NAME = "scan-history";
const SCANNED_AT_INDEX = "scannedAt";

export type LocalScanHistorySource = "manual" | "barcode" | "photo";
export type LocalScanHistoryStatus =
    | "verified"
    | "suspicious"
    | "counterfeit"
    | "unverified"
    | "error";

export type LocalScanHistoryEntry = {
    id: string;
    scannedAt: string;
    query: string;
    source: LocalScanHistorySource;
    status: LocalScanHistoryStatus;
    brandName?: string;
    genericName?: string;
    manufacturer?: string;
    batchNumber?: string;
    expiryDate?: string | null;
    cdscoApprovalStatus?: string;
    isCounterfeitAlert?: boolean;
    message?: string;
    scanMeta?: ScanMeta;
};

export type LocalScanHistoryPage = {
    entries: LocalScanHistoryEntry[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
};

type PageRequest = {
    page?: number;
    pageSize?: number;
};

export type NormalizedLocalScanHistoryPageRequest = {
    page: number;
    pageSize: number;
    offset: number;
};

export type BuildLocalScanHistoryEntryOptions = {
    query: string;
    source: LocalScanHistorySource;
    result?: VerifyResult;
    errorMessage?: string;
    fallbackBrandName?: string;
    fallbackBatchNumber?: string;
    fallbackExpiryDate?: string | null;
    scannedAt?: string;
    id?: string;
};

export function normalizeLocalScanHistoryPageRequest({
    page,
    pageSize,
}: PageRequest = {}): NormalizedLocalScanHistoryPageRequest {
    const normalizedPage =
        typeof page === "number" && Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;

    const normalizedPageSize =
        typeof pageSize === "number" && Number.isFinite(pageSize) && pageSize > 0
            ? Math.min(MAX_LOCAL_SCAN_HISTORY_PAGE_SIZE, Math.floor(pageSize))
            : DEFAULT_LOCAL_SCAN_HISTORY_PAGE_SIZE;

    return {
        page: normalizedPage,
        pageSize: normalizedPageSize,
        offset: (normalizedPage - 1) * normalizedPageSize,
    };
}

export function createEmptyLocalScanHistoryPage(
    page = 1,
    pageSize = DEFAULT_LOCAL_SCAN_HISTORY_PAGE_SIZE
): LocalScanHistoryPage {
    return {
        entries: [],
        page,
        pageSize,
        total: 0,
        totalPages: 0,
        hasPreviousPage: false,
        hasNextPage: false,
    };
}

export function buildLocalScanHistoryEntry({
    query,
    source,
    result,
    errorMessage,
    fallbackBrandName,
    fallbackBatchNumber,
    fallbackExpiryDate,
    scannedAt = new Date().toISOString(),
    id,
}: BuildLocalScanHistoryEntryOptions): LocalScanHistoryEntry {
    const trimmedQuery = query.trim();
    const baseEntry = {
        id: id ?? createLocalScanHistoryId(scannedAt),
        scannedAt,
        query: trimmedQuery,
        source,
    };

    if (errorMessage) {
        return {
            ...baseEntry,
            status: "error",
            batchNumber: fallbackBatchNumber || trimmedQuery || undefined,
            brandName: fallbackBrandName || undefined,
            expiryDate: fallbackExpiryDate,
            message: errorMessage,
        };
    }

    if (!result) {
        return {
            ...baseEntry,
            status: "error",
            batchNumber: fallbackBatchNumber || trimmedQuery || undefined,
            brandName: fallbackBrandName || undefined,
            expiryDate: fallbackExpiryDate,
            message: "Verification result unavailable",
        };
    }

    if (!result.verified) {
        return {
            ...baseEntry,
            status: "unverified",
            batchNumber: fallbackBatchNumber || trimmedQuery || undefined,
            brandName: fallbackBrandName || undefined,
            expiryDate: fallbackExpiryDate,
            message: result.message,
            scanMeta: result.scanMeta,
        };
    }

    const medicine = result.medicine;
    const status: LocalScanHistoryStatus = medicine.is_counterfeit_alert
        ? "counterfeit"
        : result.scanMeta?.suspicious
          ? "suspicious"
          : "verified";

    return {
        ...baseEntry,
        status,
        brandName: medicine.brand_name || fallbackBrandName || undefined,
        genericName: medicine.generic_name || undefined,
        manufacturer: medicine.manufacturer || undefined,
        batchNumber: medicine.batch_number || fallbackBatchNumber || trimmedQuery || undefined,
        expiryDate: medicine.expiry_date,
        cdscoApprovalStatus: medicine.cdsco_approval_status,
        isCounterfeitAlert: medicine.is_counterfeit_alert,
        scanMeta: result.scanMeta,
    };
}

export async function saveLocalScanHistoryEntry(entry: LocalScanHistoryEntry): Promise<void> {
    const indexedDb = getIndexedDb();
    if (!indexedDb) return;

    const db = await openLocalScanHistoryDb(indexedDb);
    try {
        await putEntry(db, entry);
    } finally {
        db.close();
    }
}

export async function saveLocalScanHistoryEntries(entries: LocalScanHistoryEntry[]): Promise<void> {
    const indexedDb = getIndexedDb();
    if (!indexedDb || entries.length === 0) return;

    const db = await openLocalScanHistoryDb(indexedDb);
    try {
        await putEntries(db, entries);
    } finally {
        db.close();
    }
}

export async function getAllLocalScanHistoryEntries(): Promise<LocalScanHistoryEntry[]> {
    const indexedDb = getIndexedDb();
    if (!indexedDb) return [];

    const db = await openLocalScanHistoryDb(indexedDb);
    try {
        return await readAllEntries(db);
    } finally {
        db.close();
    }
}

export async function replaceLocalScanHistoryEntries(
    entries: LocalScanHistoryEntry[]
): Promise<void> {
    const indexedDb = getIndexedDb();
    if (!indexedDb) return;

    const db = await openLocalScanHistoryDb(indexedDb);
    try {
        await clearEntries(db);
        if (entries.length > 0) {
            await putEntries(db, entries);
        }
    } finally {
        db.close();
    }
}

export async function getLocalScanHistoryPage(
    page = 1,
    pageSize = DEFAULT_LOCAL_SCAN_HISTORY_PAGE_SIZE
): Promise<LocalScanHistoryPage> {
    const request = normalizeLocalScanHistoryPageRequest({ page, pageSize });
    const indexedDb = getIndexedDb();
    if (!indexedDb) {
        return createEmptyLocalScanHistoryPage(request.page, request.pageSize);
    }

    const db = await openLocalScanHistoryDb(indexedDb);
    try {
        const total = await countEntries(db);
        if (total === 0) {
            return createEmptyLocalScanHistoryPage(request.page, request.pageSize);
        }

        const totalPages = Math.ceil(total / request.pageSize);
        const boundedPage = Math.min(request.page, totalPages);
        const boundedRequest = normalizeLocalScanHistoryPageRequest({
            page: boundedPage,
            pageSize: request.pageSize,
        });
        const entries = await readEntriesPage(db, boundedRequest.offset, boundedRequest.pageSize);

        return {
            entries,
            page: boundedPage,
            pageSize: boundedRequest.pageSize,
            total,
            totalPages,
            hasPreviousPage: boundedPage > 1,
            hasNextPage: boundedPage < totalPages,
        };
    } finally {
        db.close();
    }
}

export async function clearLocalScanHistory(): Promise<void> {
    const indexedDb = getIndexedDb();
    if (!indexedDb) return;

    const db = await openLocalScanHistoryDb(indexedDb);
    try {
        await clearEntries(db);
    } finally {
        db.close();
    }
}

function createLocalScanHistoryId(scannedAt: string): string {
    const timestamp = Date.parse(scannedAt);
    const prefix = Number.isFinite(timestamp) ? timestamp : Date.now();

    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return `${prefix}-${crypto.randomUUID()}`;
    }

    return `${prefix}-${Math.random().toString(36).slice(2)}`;
}

function getIndexedDb(): IDBFactory | null {
    if (typeof window === "undefined") return null;
    return window.indexedDB ?? null;
}

function openLocalScanHistoryDb(indexedDb: IDBFactory): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDb.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            const store = db.objectStoreNames.contains(STORE_NAME)
                ? request.transaction?.objectStore(STORE_NAME)
                : db.createObjectStore(STORE_NAME, { keyPath: "id" });

            if (store && !store.indexNames.contains(SCANNED_AT_INDEX)) {
                store.createIndex(SCANNED_AT_INDEX, SCANNED_AT_INDEX, { unique: false });
            }
        };
        request.onerror = () => reject(request.error ?? new Error("Unable to open scan history"));
        request.onsuccess = () => resolve(request.result);
    });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
        request.onsuccess = () => resolve(request.result);
    });
}

function putEntry(db: IDBDatabase, entry: LocalScanHistoryEntry): Promise<IDBValidKey> {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    return requestToPromise(store.put(entry));
}

function putEntries(db: IDBDatabase, entries: LocalScanHistoryEntry[]): Promise<IDBValidKey[]> {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    return Promise.all(entries.map((entry) => requestToPromise(store.put(entry))));
}

function clearEntries(db: IDBDatabase): Promise<undefined> {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    return requestToPromise(store.clear());
}

function countEntries(db: IDBDatabase): Promise<number> {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    return requestToPromise(store.count());
}

function readEntriesPage(
    db: IDBDatabase,
    offset: number,
    pageSize: number
): Promise<LocalScanHistoryEntry[]> {
    return new Promise((resolve, reject) => {
        const entries: LocalScanHistoryEntry[] = [];
        const transaction = db.transaction(STORE_NAME, "readonly");
        const index = transaction.objectStore(STORE_NAME).index(SCANNED_AT_INDEX);
        const request = index.openCursor(null, "prev");
        let advancedToOffset = offset === 0;
        let settled = false;

        const settle = (value: LocalScanHistoryEntry[]) => {
            if (!settled) {
                settled = true;
                resolve(value);
            }
        };

        request.onerror = () => {
            if (!settled) {
                settled = true;
                reject(request.error ?? new Error("Unable to read scan history"));
            }
        };
        transaction.onerror = () => {
            if (!settled) {
                settled = true;
                reject(transaction.error ?? new Error("Unable to read scan history"));
            }
        };
        transaction.oncomplete = () => settle(entries);

        request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) {
                settle(entries);
                return;
            }

            if (!advancedToOffset) {
                advancedToOffset = true;
                cursor.advance(offset);
                return;
            }

            entries.push(cursor.value as LocalScanHistoryEntry);
            if (entries.length >= pageSize) {
                settle(entries);
                return;
            }
            cursor.continue();
        };
    });
}

function readAllEntries(db: IDBDatabase): Promise<LocalScanHistoryEntry[]> {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onerror = () => reject(request.error ?? new Error("Unable to read scan history"));
        request.onsuccess = () => resolve(request.result as LocalScanHistoryEntry[]);
    });
}
