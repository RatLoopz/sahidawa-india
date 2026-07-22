import { readFileSync } from "fs";
import { join } from "path";
import vm from "vm";

const workerSource = readFileSync(join(process.cwd(), "worker/index.js"), "utf8");
const nextConfigSource = readFileSync(join(process.cwd(), "next.config.mjs"), "utf8");
const workboxPolicySource = readFileSync(
    join(process.cwd(), "worker/workboxRuntimeCaching.mjs"),
    "utf8"
);

function inspectProductionWorkboxPolicy() {
    const context: Record<string, unknown> = { RegExp };
    vm.runInNewContext(
        workboxPolicySource
            .replace(
                "export function createWorkboxRuntimeCaching",
                "function createWorkboxRuntimeCaching"
            )
            .concat("\nglobalThis.__createWorkboxRuntimeCaching = createWorkboxRuntimeCaching;"),
        context
    );
    const createPolicy = context.__createWorkboxRuntimeCaching as (rules: Array<unknown>) => Array<{
        urlPattern: (context: { sameOrigin: boolean; url: URL }) => boolean;
        options?: { cacheName?: string };
    }>;
    const rules = createPolicy([
        { urlPattern: () => true, options: { cacheName: "apis" } },
        { urlPattern: /\.json$/, options: { cacheName: "static-data-assets" } },
        { urlPattern: /\.js$/, options: { cacheName: "static-js-assets" } },
        { urlPattern: /\.png$/, options: { cacheName: "static-image-assets" } },
    ]);
    const matches = [
        "/api/schedules",
        "/api/private.json",
        "/api/private.js",
        "/api/private.png",
    ].map((pathname) => {
        const url = new URL(pathname, "https://sahidawa.test");
        return rules.some((rule) => rule.urlPattern({ url, sameOrigin: true }));
    });
    const staticUrl = new URL("/public/data.json", "https://sahidawa.test");
    const staticDataStillMatches = rules.some((rule) =>
        rule.urlPattern({ url: staticUrl, sameOrigin: true })
    );
    return {
        cacheNames: rules.map((rule) => rule.options?.cacheName),
        matches,
        staticDataStillMatches,
    };
}

type WorkerHandler = (event: any) => void;

function createWorkerHarness() {
    const handlers = new Map<string, WorkerHandler>();
    const match = jest.fn<Promise<Response | undefined>, [Request]>().mockResolvedValue(undefined);
    const put = jest.fn<Promise<void>, [Request, Response]>().mockResolvedValue(undefined);
    const cache = { addAll: jest.fn().mockResolvedValue(undefined), match, put };
    const caches = {
        open: jest.fn().mockResolvedValue(cache),
        keys: jest.fn().mockResolvedValue([]),
        delete: jest.fn().mockResolvedValue(true),
    };
    const fetchMock = jest.fn<Promise<Response>, [Request, RequestInit?]>();
    const self = {
        location: new URL("https://sahidawa.test"),
        addEventListener: jest.fn((type: string, handler: WorkerHandler) => {
            handlers.set(type, handler);
        }),
        skipWaiting: jest.fn(),
        clients: {
            claim: jest.fn(),
            matchAll: jest.fn().mockResolvedValue([]),
        },
        crypto: globalThis.crypto,
        registration: { showNotification: jest.fn() },
    };

    vm.runInNewContext(workerSource, {
        self,
        caches,
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

    async function dispatch(request: Request): Promise<Response> {
        const fetchHandler = handlers.get("fetch");
        if (!fetchHandler) throw new Error("Service worker fetch handler was not registered");

        let responsePromise: Promise<Response> | undefined;
        fetchHandler({
            request,
            respondWith(response) {
                responsePromise = response;
            },
        });

        if (!responsePromise) throw new Error("Service worker did not handle the request");
        return responsePromise;
    }

    async function activate(): Promise<void> {
        const activateHandler = handlers.get("activate");
        if (!activateHandler) throw new Error("Service worker activate handler was not registered");

        let activation: Promise<unknown> | undefined;
        activateHandler({
            waitUntil(promise: Promise<unknown>) {
                activation = promise;
            },
        });
        if (!activation) throw new Error("Service worker activation did not register work");
        await activation;
    }

    return { activate, cache, caches, dispatch, fetchMock, match, put };
}

describe("production Workbox API cache boundary", () => {
    it("contains no broad API cache and no runtime rule matches same-origin API URLs", () => {
        const inspection = inspectProductionWorkboxPolicy();

        expect(nextConfigSource).toContain("createWorkboxRuntimeCaching(defaultRuntimeCaching)");
        expect(nextConfigSource).toContain("runtimeCaching: workboxRuntimeCaching");
        expect(inspection.cacheNames).not.toContain("apis");
        expect(inspection.matches).toEqual([false, false, false, false]);
        expect(inspection.staticDataStillMatches).toBe(true);
    });
});

describe("service worker shared API cache security", () => {
    it("bypasses shared caches for Authorization requests, including offline fallback", async () => {
        const harness = createWorkerHarness();
        harness.match.mockResolvedValue(new Response("another user's schedule"));
        harness.fetchMock.mockRejectedValue(new TypeError("offline"));

        const response = await harness.dispatch(
            new Request("https://sahidawa.test/api/schedules", {
                headers: { Authorization: "Bearer test-token" },
            })
        );

        expect(harness.fetchMock).toHaveBeenCalledTimes(1);
        expect(harness.caches.open).not.toHaveBeenCalled();
        expect(harness.match).not.toHaveBeenCalled();
        expect(harness.put).not.toHaveBeenCalled();
        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toMatchObject({ offline: true });
    });

    it("caches an allowlisted public GET without forwarding ambient credentials", async () => {
        const harness = createWorkerHarness();
        harness.fetchMock.mockResolvedValue(
            new Response(JSON.stringify({ data: [] }), {
                headers: { "Content-Type": "application/json" },
            })
        );

        const response = await harness.dispatch(
            new Request("https://sahidawa.test/api/v1/alerts?page=1")
        );

        expect(response.status).toBe(200);
        expect(harness.put).toHaveBeenCalledTimes(1);
        const networkRequest = harness.fetchMock.mock.calls[0][0];
        const cachedRequest = harness.put.mock.calls[0][0];
        expect(networkRequest.credentials).toBe("omit");
        expect(cachedRequest.credentials).toBe("omit");
    });

    it("uses a cached allowlisted public GET when the network fails", async () => {
        const harness = createWorkerHarness();
        harness.fetchMock.mockRejectedValue(new TypeError("offline"));
        harness.match.mockResolvedValue(new Response("public alerts"));

        const response = await harness.dispatch(
            new Request("https://sahidawa.test/api/v1/alerts?page=1")
        );

        expect(await response.text()).toBe("public alerts");
        expect(harness.match).toHaveBeenCalledTimes(1);
    });

    it.each(["POST", "PATCH", "PUT", "DELETE"])(
        "never reads or writes shared caches for %s API requests",
        async (method) => {
            const harness = createWorkerHarness();
            harness.fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

            await harness.dispatch(new Request("https://sahidawa.test/api/v1/alerts", { method }));

            expect(harness.caches.open).not.toHaveBeenCalled();
            expect(harness.match).not.toHaveBeenCalled();
            expect(harness.put).not.toHaveBeenCalled();
        }
    );

    it.each(["private, max-age=60", "no-store"])(
        "does not cache public responses marked Cache-Control: %s",
        async (cacheControl) => {
            const harness = createWorkerHarness();
            harness.fetchMock.mockResolvedValue(
                new Response("public", { headers: { "Cache-Control": cacheControl } })
            );

            await harness.dispatch(new Request("https://sahidawa.test/api/stats"));

            expect(harness.put).not.toHaveBeenCalled();
        }
    );

    it("does not cache responses that set cookies", async () => {
        const harness = createWorkerHarness();
        harness.fetchMock.mockResolvedValue(
            new Response("public", { headers: { "Set-Cookie": "session=secret; HttpOnly" } })
        );

        await harness.dispatch(new Request("https://sahidawa.test/api/stats"));

        expect(harness.put).not.toHaveBeenCalled();
    });

    it("does not cache redirected public responses", async () => {
        const harness = createWorkerHarness();
        const response = new Response("redirected content");
        Object.defineProperty(response, "redirected", { value: true });
        harness.fetchMock.mockResolvedValue(response);

        await harness.dispatch(new Request("https://sahidawa.test/api/stats"));

        expect(harness.put).not.toHaveBeenCalled();
    });

    it.each(["/api/stats-private", "/api/verify/batch-private/BN"])(
        "does not let the allowlist match the private sibling %s",
        async (pathname) => {
            const harness = createWorkerHarness();
            harness.fetchMock.mockResolvedValue(new Response("private"));

            await harness.dispatch(new Request(`https://sahidawa.test${pathname}`));

            expect(harness.caches.open).not.toHaveBeenCalled();
            expect(harness.match).not.toHaveBeenCalled();
            expect(harness.put).not.toHaveBeenCalled();
        }
    );

    it("matches and caches the intended batch path boundary", async () => {
        const harness = createWorkerHarness();
        harness.fetchMock.mockResolvedValue(new Response("public batch"));

        await harness.dispatch(new Request("https://sahidawa.test/api/verify/batch/BN?page=2"));

        expect(harness.put).toHaveBeenCalledTimes(1);
        expect(harness.put.mock.calls[0][0].url).toBe(
            "https://sahidawa.test/api/verify/batch/BN?page=2"
        );
    });

    it("bypasses shared caches for a private route without an Authorization header", async () => {
        const harness = createWorkerHarness();
        harness.fetchMock.mockResolvedValue(new Response(JSON.stringify({ schedules: [] })));

        await harness.dispatch(new Request("https://sahidawa.test/api/schedules"));

        expect(harness.caches.open).not.toHaveBeenCalled();
        expect(harness.match).not.toHaveBeenCalled();
        expect(harness.put).not.toHaveBeenCalled();
    });

    it("bypasses shared caches when credentials are explicitly included", async () => {
        const harness = createWorkerHarness();
        harness.fetchMock.mockResolvedValue(new Response("alerts"));

        await harness.dispatch(
            new Request("https://sahidawa.test/api/v1/alerts", { credentials: "include" })
        );

        expect(harness.caches.open).not.toHaveBeenCalled();
        expect(harness.put).not.toHaveBeenCalled();
    });

    it("cannot use the CSRF cached fallback for an authenticated request", async () => {
        const harness = createWorkerHarness();
        harness.match.mockResolvedValue(new Response("cached private content"));
        harness.fetchMock.mockResolvedValue(new Response("CSRF token invalid", { status: 403 }));

        const response = await harness.dispatch(
            new Request("https://sahidawa.test/api/schedules", {
                headers: { Authorization: "Bearer test-token" },
            })
        );

        expect(response.status).toBe(403);
        expect(harness.caches.open).not.toHaveBeenCalled();
        expect(harness.match).not.toHaveBeenCalled();
    });

    it("deletes legacy API caches while preserving unrelated Workbox caches", async () => {
        const harness = createWorkerHarness();
        harness.caches.keys.mockResolvedValue([
            "apis",
            "sahidawa-api-old-version",
            "sahidawa-api-3816-public-api-only",
            "workbox-precache-v2-https://sahidawa.test/",
            "pages",
            "static-image-assets",
            "google-fonts-webfonts",
        ]);

        await harness.activate();

        expect(harness.caches.delete.mock.calls.map(([name]) => name)).toEqual([
            "apis",
            "sahidawa-api-old-version",
        ]);
    });
});
