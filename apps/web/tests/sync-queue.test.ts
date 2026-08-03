import { readFileSync } from "fs";
import { join } from "path";
import vm from "vm";

const workerSource = readFileSync(join(process.cwd(), "worker/index.js"), "utf8");

type WorkerHandler = (event: any) => void;

const MUTATION_URL = "https://sahidawa.test/api/v1/reports";
const QUEUE_DB = "sahidawa-sync-db";

async function deleteQueueDb(): Promise<void> {
    await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(QUEUE_DB);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
    });
}

async function openQueueDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(QUEUE_DB, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains("requests")) {
                db.createObjectStore("requests", { keyPath: "id", autoIncrement: true });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function seedQueue(entries: Array<Record<string, unknown>>): Promise<void> {
    const db = await openQueueDb();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("requests", "readwrite");
        for (const entry of entries) tx.objectStore("requests").add(entry);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

async function readQueue(): Promise<Array<Record<string, unknown> & { id: number }>> {
    const db = await openQueueDb();
    const result = await new Promise<any[]>((resolve, reject) => {
        const tx = db.transaction("requests", "readonly");
        const req = tx.objectStore("requests").getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
}

interface Harness {
    sync: (tag: string) => Promise<void>;
    fetchMock: jest.Mock;
    client: { postMessage: jest.Mock };
    registration: { sync: { register: jest.Mock } };
}

function createHarness(): Harness {
    const handlers = new Map<string, WorkerHandler>();
    const client = { postMessage: jest.fn() };
    const registration = { sync: { register: jest.fn().mockResolvedValue(undefined) } };
    const fetchMock = jest.fn();

    const self = {
        location: new URL("https://sahidawa.test"),
        addEventListener: jest.fn((type: string, handler: WorkerHandler) => {
            handlers.set(type, handler);
        }),
        skipWaiting: jest.fn(),
        clients: {
            claim: jest.fn(),
            matchAll: jest.fn().mockResolvedValue([client]),
        },
        crypto: globalThis.crypto,
        registration,
    };

    vm.runInNewContext(workerSource, {
        self,
        caches: {
            open: jest.fn(),
            keys: jest.fn().mockResolvedValue([]),
            delete: jest.fn().mockResolvedValue(true),
        },
        fetch: fetchMock,
        Request,
        Response,
        Headers,
        URL,
        AbortController,
        setTimeout,
        clearTimeout,
        console,
        indexedDB,
        Promise,
        JSON,
        Date,
        Uint8Array,
    });

    async function sync(tag: string): Promise<void> {
        const syncHandler = handlers.get("sync");
        if (!syncHandler) throw new Error("Service worker sync handler was not registered");
        let done: Promise<unknown> | undefined;
        syncHandler({
            tag,
            waitUntil(promise: Promise<unknown>) {
                done = promise;
            },
        });
        if (!done) throw new Error("Sync handler did not register work");
        await done;
    }

    return { sync, fetchMock, client, registration };
}

function mutationEntry(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        url: MUTATION_URL,
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brand: "counterfeit", report: true }),
        timestamp: Date.now(),
        ...overrides,
    };
}

function jsonResponse(status: number, body: unknown): Response {
    return new Response(typeof body === "string" ? body : JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

beforeEach(async () => {
    await deleteQueueDb();
});

afterAll(async () => {
    await deleteQueueDb();
});

describe("service worker flushMutationsQueue()", () => {
    it("removes a queued action only after a confirmed 2xx response", async () => {
        const harness = createHarness();
        await seedQueue([mutationEntry()]);
        harness.fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

        await harness.sync("sahidawa-sync-mutations");

        expect(await readQueue()).toHaveLength(0);
        expect(harness.client.postMessage).toHaveBeenCalledWith({
            type: "SYNC_QUEUE_FLUSHED",
        });
    });

    it.each([401, 403, 409, 422, 500])(
        "keeps a queued action when the server responds %s",
        async (status) => {
            const harness = createHarness();
            await seedQueue([mutationEntry()]);
            harness.fetchMock.mockResolvedValue(jsonResponse(status, { error: "rejected" }));

            await harness.sync("sahidawa-sync-mutations");

            expect(await readQueue()).toHaveLength(1);
            expect(harness.client.postMessage).not.toHaveBeenCalledWith({
                type: "SYNC_QUEUE_FLUSHED",
            });
            const rejectedMsg = harness.client.postMessage.mock.calls.find(
                ([msg]: any) => msg.type === "SYNC_QUEUE_REJECTED"
            );
            expect(rejectedMsg).toBeDefined();
            expect(rejectedMsg[0].entries[0]).toMatchObject({
                status,
                method: "POST",
                url: MUTATION_URL,
                authFailure: status === 401 || status === 403,
            });
        }
    );

    it("reports validation error bodies so the user sees an actionable error", async () => {
        const harness = createHarness();
        await seedQueue([mutationEntry()]);
        harness.fetchMock.mockResolvedValue(
            jsonResponse(422, { error: "Batch number is invalid" })
        );

        await harness.sync("sahidawa-sync-mutations");

        const rejectedMsg = harness.client.postMessage.mock.calls.find(
            ([msg]: any) => msg.type === "SYNC_QUEUE_REJECTED"
        );
        expect(rejectedMsg[0].entries[0].error).toContain("Batch number is invalid");
    });

    it("refreshes the CSRF token and retries on a 403, deleting on retry success", async () => {
        const harness = createHarness();
        await seedQueue([mutationEntry({ headers: { "x-csrf-token": "stale-token" } })]);
        let mutationAttempts = 0;
        harness.fetchMock.mockImplementation((input: unknown) => {
            const url = typeof input === "string" ? input : (input as Request).url;
            if (url === "/api/csrf-token") {
                return Promise.resolve(jsonResponse(200, { csrfToken: "fresh-token" }));
            }
            mutationAttempts += 1;
            if (mutationAttempts === 1) {
                return Promise.resolve(jsonResponse(403, { error: "CSRF token invalid" }));
            }
            return Promise.resolve(jsonResponse(200, { ok: true }));
        });

        await harness.sync("sahidawa-sync-mutations");

        expect(await readQueue()).toHaveLength(0);
        expect(mutationAttempts).toBe(2);
        const retryCall = harness.fetchMock.mock.calls[2];
        expect(retryCall[1].headers["x-csrf-token"]).toBe("fresh-token");
        expect(harness.client.postMessage).toHaveBeenCalledWith({
            type: "SYNC_QUEUE_FLUSHED",
        });
    });

    it("keeps the entry and surfaces authFailure when a retry after credential refresh still fails", async () => {
        const harness = createHarness();
        await seedQueue([mutationEntry()]);
        harness.fetchMock.mockImplementation((input: unknown) => {
            const url = typeof input === "string" ? input : (input as Request).url;
            if (url === "/api/csrf-token") {
                return Promise.resolve(jsonResponse(200, { csrfToken: "fresh-token" }));
            }
            return Promise.resolve(jsonResponse(401, { error: "session expired" }));
        });

        await harness.sync("sahidawa-sync-mutations");

        expect(await readQueue()).toHaveLength(1);
        const rejectedMsg = harness.client.postMessage.mock.calls.find(
            ([msg]: any) => msg.type === "SYNC_QUEUE_REJECTED"
        );
        expect(rejectedMsg[0].entries[0]).toMatchObject({
            status: 401,
            authFailure: true,
        });
        expect(harness.client.postMessage).toHaveBeenCalledWith({
            type: "CSRF_REFRESH_NEEDED",
        });
    });

    it("keeps the entry when the flush is still offline", async () => {
        const harness = createHarness();
        await seedQueue([mutationEntry()]);
        harness.fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

        await harness.sync("sahidawa-sync-mutations");

        expect(await readQueue()).toHaveLength(1);
    });

    it("processes each queued request independently when results mix", async () => {
        const harness = createHarness();
        await seedQueue([
            mutationEntry(),
            mutationEntry({ url: `${MUTATION_URL}/validation` }),
            mutationEntry({ url: `${MUTATION_URL}/offline` }),
        ]);
        harness.fetchMock.mockImplementation((input: unknown) => {
            const url = typeof input === "string" ? input : (input as Request).url;
            if (url.includes("/validation")) {
                return Promise.resolve(jsonResponse(422, { error: "invalid data" }));
            }
            if (url.includes("/offline")) {
                return Promise.reject(new TypeError("Failed to fetch"));
            }
            return Promise.resolve(jsonResponse(200, { ok: true }));
        });

        await harness.sync("sahidawa-sync-mutations");

        const remaining = await readQueue();
        expect(remaining).toHaveLength(2);
        expect(remaining.map((r) => r.url)).not.toContain(MUTATION_URL);

        const rejectedMsg = harness.client.postMessage.mock.calls.find(
            ([msg]: any) => msg.type === "SYNC_QUEUE_REJECTED"
        );
        expect(rejectedMsg[0].entries).toHaveLength(1);
        expect(rejectedMsg[0].entries[0].status).toBe(422);

        const flushedMsg = harness.client.postMessage.mock.calls.find(
            ([msg]: any) => msg.type === "SYNC_QUEUE_FLUSHED"
        );
        expect(flushedMsg).toBeDefined();
    });
});
