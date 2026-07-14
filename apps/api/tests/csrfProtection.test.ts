import request from "supertest";
import type { Express } from "express";

// Enforcement coverage for #3552.
//
// The fix mounts doubleCsrfProtection in every environment and only skips token
// validation when NODE_ENV === "test". The rest of the suite runs under "test",
// where the skip is active, so nothing there proves the middleware actually
// blocks a forged request. These tests load a fresh app instance with
// NODE_ENV=development (skip inactive, http-safe cookie) and assert the real
// double-submit behaviour: a state-changing request with no token is rejected,
// and the same request carrying a token minted by /api/csrf-token is accepted.
//
// The probe targets a path with no route so the assertion is about the global
// CSRF middleware itself, not any single route's auth or body validation.

// Booting the app under a non-test env would otherwise construct the real BullMQ
// sms queue, whose ioredis connection retries 127.0.0.1:6379 forever and keeps
// jest from exiting. Stub it with the same no-op shape the source uses under
// test so the app still wires the real CSRF middleware — just without the socket.
jest.mock("../src/queues/smsQueue", () => ({
    smsQueue: { add: async () => {}, on: () => {} },
}));

const PROBE = "/api/__csrf_probe__";

describe("CSRF protection enforcement (#3552)", () => {
    const OLD_ENV = process.env.NODE_ENV;
    let app: Express;
    // Intervals the app's module graph registers at load time, captured so they
    // can be cleared after the suite (see beforeAll).
    const bootTimers: NodeJS.Timeout[] = [];

    beforeAll(() => {
        // Load the app under development so SKIP_CSRF_VALIDATION is false and the
        // middleware actually validates. This file imports the app lazily (here,
        // not at top level) precisely so this env is set before the module loads.
        process.env.NODE_ENV = "development";

        // Under NODE_ENV != "test", requiring the app boots db/client.ts, which
        // starts a 30s Supabase probe via setInterval that is never unref'd — it
        // would keep the event loop (and jest) alive after the suite finishes.
        // Capture every interval the load registers so afterAll can clear them;
        // these tests drive the in-memory app directly and need no background probe.
        const realSetInterval = global.setInterval;
        global.setInterval = ((...args: Parameters<typeof setInterval>) => {
            const timer = realSetInterval(...args);
            bootTimers.push(timer);
            return timer;
        }) as typeof global.setInterval;
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            app = require("../src/app").default as Express;
        } finally {
            global.setInterval = realSetInterval;
        }
    });

    afterAll(() => {
        bootTimers.forEach((timer) => clearInterval(timer));
        process.env.NODE_ENV = OLD_ENV;
    });

    it("rejects a state-changing POST that carries no CSRF token", async () => {
        const res = await request(app).post(PROBE).send({ hello: "world" });
        expect(res.status).toBe(403);
    });

    it("accepts the same POST once a token from /api/csrf-token accompanies it", async () => {
        // request.agent keeps the cookie jar (anon id + csrf cookie) across calls.
        const agent = request.agent(app);

        const tokenRes = await agent.get("/api/csrf-token");
        expect(tokenRes.status).toBe(200);
        const token = tokenRes.body.csrfToken as string;
        expect(typeof token).toBe("string");
        expect(token.length).toBeGreaterThan(0);

        const res = await agent.post(PROBE).set("x-csrf-token", token).send({ hello: "world" });

        // Valid token → the CSRF middleware lets the request through; the probe
        // path has no route, so it 404s. The point is it is NOT rejected as 403.
        expect(res.status).not.toBe(403);
        expect(res.status).toBe(404);
    });
});
