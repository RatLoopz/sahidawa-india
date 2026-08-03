import { readFileSync } from "fs";
import { join } from "path";
import vm from "vm";

const workerSource = readFileSync(join(process.cwd(), "worker/index.js"), "utf8");

type WorkerHandler = (event: any) => void;

const MUTATION_URL = "https://sahidawa.test/api/v1/reports";
const QUEUE_DB = "sahidawa-sync-db";

function base64Url(input: string): string {
    return Buffer.from(input, "utf8")
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

/** Minimal Supabase-style JWT with a `sub` claim identifying the user. */
function bearerTokenFor(userId: string): string {
    const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = base64Url(JSON.stringify({ sub: userId, role: "authenticated" }));
    return `${header}.${payload}.signature`;
}

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
        const req = indexedDB.open(QUEUE_DB, 2);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains("requests")) {
                db.createObjectStore("requests", { keyPath: "id", autoIncrement: true });
            }
            if (!db.objectStoreNames.contains("meta")) {
                db.createObjectStore("meta", { keyPath: "key" });
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

async function setRegisteredUser(userId: string | null): Promise<void> {
    const db = await openQueueDb();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("meta", "readwrite");
        tx.objectStore("meta").put({ key: "current-user-id", value: userId });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

async function readCurrentUserId(): Promise<string | null> {
    const db = await openQueueDb();
    const result = await new Promise<string | null>((resolve, reject) => {
        const tx = db.transaction("meta", "readonly");
        const req = tx.objectStore("meta").get("current-user-id");
        req.onsuccess = () => resolve(req.result ? (req.result.value as string) : null);
        req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
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
    dispatch: (event: any) => void;
    fetchMock: jest.Mock;
    client: { postMessage: jest.Mock };
    handlers: Map<string, WorkerHandler>;
}

function createHarness(): Harness {
    const handlers = new Map<string, WorkerHandler>();
    const client = { postMessage: jest.fn() };
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
        registration: { sync: { register: jest.fn().mockResolvedValue(undefined) } },
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
        atob: (s: string) => Buffer.from(s, "base64").toString("binary"),
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

    function dispatch(event: any): void {
        const kind = event.type ?? "message";
        const handler = handlers.get(kind);
        if (!handler) throw new Error(`No handler registered for event ${kind}`);
        handler(event);
    }

    return { sync, dispatch, fetchMock, client, handlers };
}

function mutationEntry(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        url: MUTATION_URL,
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brand: "counterfeit", report: true }),
        timestamp: Date.now(),
        userId: null,
        ...overrides,
    };
}

function jsonResponse(status: number, body: unknown): Response {
    return new Response(typeof body === "string" ? body : JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

async function dispatchFetchSave(harness: Harness, request: Request): Promise<void> {
    const fetchHandler = harness.handlers.get("fetch");
    if (!fetchHandler) throw new Error("fetch handler not registered");
    const respondWith = jest.fn((p: Promise<unknown>) => p);
    fetchHandler({ request, respondWith, waitUntil: jest.fn() });
    await respondWith.mock.calls[0][0];
}
beforeEach(async () => {
    await deleteQueueDb();
});

afterAll(async () => {
    await deleteQueueDb();
});

describe("service worker queue user-scoping", () => {
    describe("saveFailedRequest()", () => {
        it("stamps the userId derived from the Authorization bearer token", async () => {
            const harness = createHarness();
            harness.fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

            const request = new Request(MUTATION_URL, {
                method: "POST",
                headers: { authorization: `Bearer ${bearerTokenFor("user-A")}` },
                body: "{}",
            });
            await dispatchFetchSave(harness, request);

            const queue = await readQueue();
            expect(queue).toHaveLength(1);
            expect(queue[0].userId).toBe("user-A");
        });

        it("falls back to the registered current user when no Authorization header is present", async () => {
            const harness = createHarness();
            harness.fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
            await setRegisteredUser("user-A");

            await dispatchFetchSave(
                harness,
                new Request(MUTATION_URL, { method: "POST", body: "{}" })
            );

            const queue = await readQueue();
            expect(queue).toHaveLength(1);
            expect(queue[0].userId).toBe("user-A");
        });

        it("leaves the entry unbound (null user) when no identity is available", async () => {
            const harness = createHarness();
            harness.fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

            await dispatchFetchSave(
                harness,
                new Request(MUTATION_URL, { method: "POST", body: "{}" })
            );

            const queue = await readQueue();
            expect(queue).toHaveLength(1);
            expect(queue[0].userId).toBeNull();
        });
    });

    describe("SET_CURRENT_USER / CLEAR_SYNC_QUEUE messages", () => {
        it("persists the registered current user and clears the scoping meta", async () => {
            const harness = createHarness();
            harness.dispatch({
                data: { type: "SET_CURRENT_USER", userId: "user-A" },
                waitUntil: jest.fn(),
            });
            // waitUntil is async; give the IDB write a tick.
            await new Promise((r) => setTimeout(r, 0));
            expect(await readCurrentUserId()).toBe("user-A");

            harness.dispatch({
                data: { type: "SET_CURRENT_USER", userId: null },
                waitUntil: jest.fn(),
            });
            await new Promise((r) => setTimeout(r, 0));
            expect(await readCurrentUserId()).toBeNull();
        });

        it("drops all queued mutations on CLEAR_SYNC_QUEUE", async () => {
            const harness = createHarness();
            await seedQueue([
                mutationEntry({ userId: "user-A" }),
                mutationEntry({ userId: "user-A" }),
            ]);
            expect(await readQueue()).toHaveLength(2);

            harness.dispatch({ data: { type: "CLEAR_SYNC_QUEUE" }, waitUntil: jest.fn() });
            await new Promise((r) => setTimeout(r, 0));

            expect(await readQueue()).toHaveLength(0);
        });
    });

    describe("flushMutationsQueue() replay guard", () => {
        it("replays and deletes a queued mutation when the owner matches the current user", async () => {
            const harness = createHarness();
            await seedQueue([mutationEntry({ userId: "user-A" })]);
            await setRegisteredUser("user-A");
            harness.fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

            await harness.sync("sahidawa-sync-mutations");

            expect(await readQueue()).toHaveLength(0);
            expect(harness.fetchMock).toHaveBeenCalledTimes(1);
        });

        it("refuses to replay a mutation owned by a different user", async () => {
            const harness = createHarness();
            await seedQueue([mutationEntry({ userId: "user-A" })]);
            await setRegisteredUser("user-B");
            harness.fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

            await harness.sync("sahidawa-sync-mutations");

            expect(await readQueue()).toHaveLength(1);
            expect(harness.fetchMock).not.toHaveBeenCalled();
        });

        it("refuses to replay a mutation when no current user is registered", async () => {
            const harness = createHarness();
            await seedQueue([mutationEntry({ userId: "user-A" })]);
            harness.fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

            await harness.sync("sahidawa-sync-mutations");

            expect(await readQueue()).toHaveLength(1);
            expect(harness.fetchMock).not.toHaveBeenCalled();
        });

        it("only replays the subset owned by the current user in a mixed queue", async () => {
            const harness = createHarness();
            await seedQueue([
                mutationEntry({ userId: "user-A", url: `${MUTATION_URL}/a` }),
                mutationEntry({ userId: "user-B", url: `${MUTATION_URL}/b` }),
            ]);
            await setRegisteredUser("user-A");
            harness.fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

            await harness.sync("sahidawa-sync-mutations");

            const remaining = await readQueue();
            expect(remaining).toHaveLength(1);
            expect(remaining[0].userId).toBe("user-B");
            expect(harness.fetchMock).toHaveBeenCalledTimes(1);
        });

        it("replays legacy unbound (null-user) entries under any signed-in user", async () => {
            const harness = createHarness();
            await seedQueue([mutationEntry({ userId: null })]);
            await setRegisteredUser("user-B");
            harness.fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

            await harness.sync("sahidawa-sync-mutations");

            expect(await readQueue()).toHaveLength(0);
            expect(harness.fetchMock).toHaveBeenCalledTimes(1);
        });
    });
});
