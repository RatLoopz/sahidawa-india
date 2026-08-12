import { readFileSync } from "fs";
import { join } from "path";
import vm from "vm";
import v8 from "v8";

// fake-indexeddb (v6.2.5) clones stored values with the global
// `structuredClone`. The JSON.stringify-based polyfill installed by
// setupTests.ts turns ArrayBuffers into plain objects, which would silently
// erase the binary body we are testing. Replace it with a binary-safe clone
// (mirroring real browser IndexedDB semantics) for this suite.
const existingClone = (globalThis as any).structuredClone as ((v: any) => any) | undefined;
if (existingClone) {
    try {
        const probe = existingClone(new Uint8Array([1, 2]));
        if (!(probe instanceof Uint8Array)) throw new Error("not binary-safe");
    } catch {
        (globalThis as any).structuredClone = (value: any) => v8.deserialize(v8.serialize(value));
    }
}

const workerSource = readFileSync(join(process.cwd(), "worker/index.js"), "utf8");

type WorkerHandler = (event: any) => void;

const UPLOAD_URL = "https://sahidawa.test/api/upload";
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
    dispatchFetch: (request: Request) => Promise<void>;
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

    async function dispatchFetch(request: Request): Promise<void> {
        const fetchHandler = handlers.get("fetch");
        if (!fetchHandler) throw new Error("fetch handler not registered");
        const respondWith = jest.fn((p: Promise<unknown>) => p);
        fetchHandler({ request, respondWith, waitUntil: jest.fn() });
        await respondWith.mock.calls[0][0];
    }

    return { sync, fetchMock, client, dispatchFetch };
}

function multipartBoundary(): string {
    return "----SahiDawaTestBoundary7MA4YWxkTrZu0gW";
}

/** Build a realistic multipart/form-data body whose file part contains raw bytes. */
function buildMultipartBody(fileBytes: Uint8Array, filename: string, fileType: string) {
    const boundary = multipartBoundary();
    const prefix = Buffer.from(
        `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
            `Content-Type: ${fileType}\r\n` +
            `\r\n`,
        "utf8"
    );
    const suffix = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
    const body = Buffer.concat([prefix, Buffer.from(fileBytes), suffix]);
    return {
        boundary,
        contentType: `multipart/form-data; boundary=${boundary}`,
        arrayBuffer: () =>
            body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer,
        bytes: new Uint8Array(body),
    };
}

/** Photo/audio bytes that a UTF-8 text() decode would corrupt (e.g. 0xFF, 0x89). */
function evidenceBytes(): Uint8Array {
    return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0xff, 0xfe, 0x00, 0x80, 0x01]);
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

describe("service worker binary multipart sync queue", () => {
    describe("saveFailedRequest()", () => {
        it("persists the body as raw bytes, preserving binary evidence", async () => {
            const harness = createHarness();
            harness.fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

            const body = buildMultipartBody(evidenceBytes());
            const request = new Request(UPLOAD_URL, {
                method: "POST",
                headers: { "content-type": body.contentType },
                body: body.arrayBuffer(),
            });

            await harness.dispatchFetch(request);

            const queue = await readQueue();
            expect(queue).toHaveLength(1);
            // The stored body is an ArrayBuffer whose bytes equal the original
            // multipart payload — nothing was UTF-8-decoded away.
            expect(new Uint8Array(queue[0].body as ArrayBuffer)).toEqual(body.bytes);
            // The multipart boundary is preserved so replay stays valid.
            expect(queue[0].headers["content-type"]).toBe(body.contentType);
        });

        it("strips a stale content-length so fetch can recompute it on replay", async () => {
            const harness = createHarness();
            harness.fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

            const body = buildMultipartBody(evidenceBytes());
            const request = new Request(UPLOAD_URL, {
                method: "POST",
                headers: {
                    "content-type": body.contentType,
                    "content-length": "0",
                },
                body: body.arrayBuffer(),
            });

            await harness.dispatchFetch(request);

            const queue = await readQueue();
            expect(queue[0].headers["content-length"]).toBeUndefined();
        });

        it("stores a plain JSON/FormData text body as its UTF-8 bytes", async () => {
            const harness = createHarness();
            harness.fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

            const payload = JSON.stringify({ brand: "counterfeit", report: true });
            const request = new Request(UPLOAD_URL, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: payload,
            });

            await harness.dispatchFetch(request);

            const queue = await readQueue();
            expect(queue).toHaveLength(1);
            const decoded = new TextDecoder().decode(queue[0].body as ArrayBuffer);
            expect(decoded).toBe(payload);
        });
    });

    describe("flushMutationsQueue() replay", () => {
        it("replays a queued multipart upload with the identical bytes and boundary", async () => {
            const harness = createHarness();
            const body = buildMultipartBody(evidenceBytes());
            await seedQueue([
                {
                    url: UPLOAD_URL,
                    method: "POST",
                    headers: { "content-type": body.contentType },
                    body: body.arrayBuffer(),
                    timestamp: Date.now(),
                },
            ]);
            harness.fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

            await harness.sync("sahidawa-sync-mutations");

            const init = harness.fetchMock.mock.calls[0][1] as RequestInit;
            expect(new Uint8Array(init.body as ArrayBuffer)).toEqual(body.bytes);
            expect((init.headers as Record<string, string>)["content-type"]).toBe(body.contentType);
            expect(await readQueue()).toHaveLength(0);
        });

        it("keeps the entry and does not replay-deliver when the server responds 4xx", async () => {
            const harness = createHarness();
            await seedQueue([
                {
                    url: UPLOAD_URL,
                    method: "POST",
                    headers: { "content-type": "multipart/form-data; boundary=x" },
                    body: buildMultipartBody(evidenceBytes()).arrayBuffer(),
                    timestamp: Date.now(),
                },
            ]);
            harness.fetchMock.mockResolvedValue(jsonResponse(422, { error: "invalid file" }));

            await harness.sync("sahidawa-sync-mutations");

            expect(harness.fetchMock).toHaveBeenCalledTimes(1);
            // Entry is NOT deleted: even a rejected multipart upload must keep
            // its evidence for a later retry rather than being silently dropped.
            expect(await readQueue()).toHaveLength(1);
        });

        it("keeps a queued action when the flush is still offline", async () => {
            const harness = createHarness();
            await seedQueue([
                {
                    url: UPLOAD_URL,
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: new TextEncoder().encode("{}").buffer as ArrayBuffer,
                    timestamp: Date.now(),
                },
            ]);
            harness.fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

            await harness.sync("sahidawa-sync-mutations");

            expect(await readQueue()).toHaveLength(1);
        });

        it("deletes only on confirmed success (2xx)", async () => {
            const harness = createHarness();
            await seedQueue([
                {
                    url: UPLOAD_URL,
                    method: "POST",
                    headers: { "content-type": "multipart/form-data; boundary=x" },
                    body: buildMultipartBody(evidenceBytes()).arrayBuffer(),
                    timestamp: Date.now(),
                },
            ]);
            harness.fetchMock.mockResolvedValue(jsonResponse(201, { ok: true }));

            await harness.sync("sahidawa-sync-mutations");

            expect(await readQueue()).toHaveLength(0);
        });

        it("replays legacy text-body entries (stored by a previous version) unchanged", async () => {
            const harness = createHarness();
            const textBody = JSON.stringify({ report: true });
            await seedQueue([
                {
                    url: UPLOAD_URL,
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: textBody,
                    timestamp: Date.now(),
                },
            ]);
            harness.fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

            await harness.sync("sahidawa-sync-mutations");

            const init = harness.fetchMock.mock.calls[0][1] as RequestInit;
            expect(init.body).toBe(textBody);
            expect(await readQueue()).toHaveLength(0);
        });
    });
});
