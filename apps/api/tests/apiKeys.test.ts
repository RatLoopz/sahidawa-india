import express from "express";
import request from "supertest";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Chainable Supabase mock. from/select/update/delete/eq return the chain; the
// terminal methods (order for list, maybeSingle for revoke/delete) resolve to
// values configured per test via mockState. The `mock` prefix lets the hoisted
// jest.mock factory reference these safely.
// ---------------------------------------------------------------------------
const mockState = {
    orderResult: { data: [] as unknown, error: null as unknown },
    maybeSingleResult: { data: null as unknown, error: null as unknown },
    updateResult: { data: null as unknown, error: null as unknown },
};

jest.mock("../src/db/client", () => {
    const mockClient = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn(),
        maybeSingle: jest.fn(),
        then: jest.fn((resolve: (value: typeof mockState.updateResult) => void) =>
            resolve(mockState.updateResult)
        ),
    };
    return { supabase: mockClient };
});

// requireAuth is exercised elsewhere; here it just reflects the x-test-user
// header into req.user so the route handlers can be tested in isolation.
jest.mock("../src/middleware/auth", () => ({
    requireAuth: (
        req: express.Request & { user?: { id: string } },
        _res: express.Response,
        next: express.NextFunction
    ) => {
        const uid = req.headers["x-test-user"];
        if (typeof uid === "string" && uid) {
            req.user = { id: uid };
        }
        next();
    },
}));

jest.mock("../src/utils/logger", () => ({
    __esModule: true,
    default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock("../src/services/notifications", () => ({
    sendNotificationToUser: jest.fn().mockResolvedValue({
        configured: false,
        attempted: 0,
        sent: 0,
        failed: 0,
    }),
}));

jest.mock("../src/services/sms-service", () => ({
    smsService: { send: jest.fn().mockResolvedValue(true) },
}));

jest.mock("../src/repositories/subscriber.repository", () => ({
    subscriberRepository: {
        findByUserId: jest.fn().mockResolvedValue(null),
    },
}));

// The mocked db/client module is required through apiKeysRouter and
// requireApiKey. Use require() instead of ESM import: babel-jest hoists ESM
// imports above the const declarations, so the jest.mock factory for db/client
// would run while `mockSupabase` is still in its temporal dead zone. require()
// stays in place and runs after the consts above are initialized.
const apiKeysRouter = require("../src/routes/apiKeys").default;
const { requireApiKey } = require("../src/middleware/apiKeyAuth");
const { sendNotificationToUser } = require("../src/services/notifications");
const { smsService } = require("../src/services/sms-service");
const { subscriberRepository } = require("../src/repositories/subscriber.repository");
import type { Response } from "express";
import { supabase } from "../src/db/client";
import type { ApiKeyRequest } from "../src/middleware/apiKeyAuth";

const mockSupabase = supabase as any;

const app = express();
app.use(express.json());
app.use("/api/keys", apiKeysRouter);

// A canonical uuid — the `id` column is a Postgres uuid, so the revoke/delete
// routes reject anything that isn't one before touching the database.
const VALID_ID = "11111111-1111-1111-1111-111111111111";

// A key whose hash/salt let the real requireApiKey middleware validate the
// secret presented in the x-api-secret header (same scheme as the API key auth
// middleware: `keyId.secret` with a pbkdf2-sha512 hash).
const ROTATE_KEY_ID = VALID_ID;
const ROTATE_SECRET = "rotate-test-secret";
const ROTATE_SALT = "rotate-testsalt";
const ROTATE_HASH = crypto
    .pbkdf2Sync(ROTATE_SECRET, ROTATE_SALT, 100000, 64, "sha512")
    .toString("hex");

beforeEach(() => {
    jest.clearAllMocks();
    mockState.orderResult = { data: [], error: null };
    mockState.maybeSingleResult = { data: null, error: null };
    mockState.updateResult = { data: null, error: null };
    mockSupabase.order.mockImplementation(() => Promise.resolve(mockState.orderResult));
    mockSupabase.maybeSingle.mockImplementation(() => Promise.resolve(mockState.maybeSingleResult));
});

describe("GET /api/keys", () => {
    it("returns the caller's keys scoped to their user_id", async () => {
        mockState.orderResult = {
            data: [{ id: "k1", scopes: [], is_active: true }],
            error: null,
        };

        const res = await request(app).get("/api/keys").set("x-test-user", "user-1");

        expect(res.status).toBe(200);
        expect(res.body.keys).toHaveLength(1);
        expect(mockSupabase.eq).toHaveBeenCalledWith("user_id", "user-1");
        // Secrets/hashes must never be selected.
        const selected = mockSupabase.select.mock.calls[0][0] as string;
        expect(selected).not.toContain("key_hash");
        expect(selected).not.toContain("key_salt");
    });

    it("rejects an unauthenticated caller", async () => {
        const res = await request(app).get("/api/keys");
        expect(res.status).toBe(401);
    });
});

describe("POST /api/keys/:id/revoke", () => {
    it("marks the key inactive, scoped to the caller", async () => {
        mockState.maybeSingleResult = { data: { id: VALID_ID }, error: null };

        const res = await request(app)
            .post(`/api/keys/${VALID_ID}/revoke`)
            .set("x-test-user", "user-1");

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ message: "API key revoked", keyId: VALID_ID });
        expect(mockSupabase.update).toHaveBeenCalledWith({ is_active: false });
        expect(mockSupabase.eq).toHaveBeenCalledWith("id", VALID_ID);
        expect(mockSupabase.eq).toHaveBeenCalledWith("user_id", "user-1");
    });

    it("returns 404 when the key is not the caller's", async () => {
        mockState.maybeSingleResult = { data: null, error: null };

        const res = await request(app)
            .post(`/api/keys/${VALID_ID}/revoke`)
            .set("x-test-user", "user-1");

        expect(res.status).toBe(404);
    });

    it("returns 404 for a malformed id without querying the database", async () => {
        const res = await request(app)
            .post("/api/keys/not-a-uuid/revoke")
            .set("x-test-user", "user-1");

        expect(res.status).toBe(404);
        // The bad id must never reach Postgres (where it would 500 on the uuid cast).
        expect(mockSupabase.update).not.toHaveBeenCalled();
    });
});

describe("DELETE /api/keys/:id", () => {
    it("deletes the caller's key", async () => {
        mockState.maybeSingleResult = { data: { id: VALID_ID }, error: null };

        const res = await request(app).delete(`/api/keys/${VALID_ID}`).set("x-test-user", "user-1");

        expect(res.status).toBe(200);
        expect(mockSupabase.delete).toHaveBeenCalled();
        expect(mockSupabase.eq).toHaveBeenCalledWith("user_id", "user-1");
    });

    it("returns 404 when the key does not belong to the caller", async () => {
        mockState.maybeSingleResult = { data: null, error: null };

        const res = await request(app).delete(`/api/keys/${VALID_ID}`).set("x-test-user", "user-1");

        expect(res.status).toBe(404);
    });

    it("returns 404 for a malformed id without querying the database", async () => {
        const res = await request(app).delete("/api/keys/not-a-uuid").set("x-test-user", "user-1");

        expect(res.status).toBe(404);
        expect(mockSupabase.delete).not.toHaveBeenCalled();
    });
});

describe("POST /api/keys/rotate", () => {
    const setValidKeyRow = () => {
        mockState.maybeSingleResult = {
            data: {
                id: ROTATE_KEY_ID,
                user_id: "user-1",
                scopes: [],
                expires_at: new Date(Date.now() + 60_000).toISOString(),
                key_hash: ROTATE_HASH,
                key_salt: ROTATE_SALT,
                is_active: true,
            },
            error: null,
        };
    };

    const rotationUpdateCalled = () =>
        mockSupabase.update.mock.calls.some(
            (call: unknown[]) =>
                typeof call[0] === "object" &&
                call[0] !== null &&
                "key_hash" in (call[0] as Record<string, unknown>)
        );

    beforeEach(() => {
        setValidKeyRow();
    });

    it("rotates the key when the session matches the key owner", async () => {
        const res = await request(app)
            .post("/api/keys/rotate")
            .set("x-test-user", "user-1")
            .set("x-api-secret", `${ROTATE_KEY_ID}.${ROTATE_SECRET}`);

        expect(res.status).toBe(200);
        expect(res.body.keyId).toBe(ROTATE_KEY_ID);
        expect(typeof res.body.newSecret).toBe("string");
        expect(res.body.newSecret.length).toBeGreaterThan(0);
        // The rotation update must be scoped to the session owner.
        expect(mockSupabase.eq).toHaveBeenCalledWith("user_id", "user-1");
        // The owner is notified of the rotation.
        expect(sendNotificationToUser).toHaveBeenCalledWith("user-1", expect.anything());
    });

    it("also sends an SMS when the owner has an SMS subscriber on file", async () => {
        (subscriberRepository.findByUserId as jest.Mock).mockResolvedValue({
            phone: "+919999999999",
            channels: ["sms"],
            language: "en",
        });

        await request(app)
            .post("/api/keys/rotate")
            .set("x-test-user", "user-1")
            .set("x-api-secret", `${ROTATE_KEY_ID}.${ROTATE_SECRET}`);

        expect(smsService.send).toHaveBeenCalledWith(
            "+919999999999",
            expect.stringContaining("API key was rotated"),
            "en"
        );
    });

    it("does not rotate a key the session user does not own", async () => {
        const res = await request(app)
            .post("/api/keys/rotate")
            .set("x-test-user", "user-2")
            .set("x-api-secret", `${ROTATE_KEY_ID}.${ROTATE_SECRET}`);

        expect(res.status).toBe(403);
        expect(rotationUpdateCalled()).toBe(false);
        expect(sendNotificationToUser).not.toHaveBeenCalled();
    });

    it("rejects a request without a user session", async () => {
        const res = await request(app)
            .post("/api/keys/rotate")
            .set("x-api-secret", `${ROTATE_KEY_ID}.${ROTATE_SECRET}`);

        expect(res.status).toBe(401);
        expect(rotationUpdateCalled()).toBe(false);
        expect(sendNotificationToUser).not.toHaveBeenCalled();
    });

    it("returns 500 when the database update fails", async () => {
        mockState.updateResult = { data: null, error: { message: "DB error" } };

        const res = await request(app)
            .post("/api/keys/rotate")
            .set("x-test-user", "user-1")
            .set("x-api-secret", `${ROTATE_KEY_ID}.${ROTATE_SECRET}`);

        expect(res.status).toBe(500);
    });
});

describe("requireApiKey rejects revoked keys", () => {
    const createRes = () => {
        const res = {
            statusCode: 200,
            body: undefined as unknown,
            status(code: number) {
                this.statusCode = code;
                return this;
            },
            json(payload: unknown) {
                this.body = payload;
                return this;
            },
        };
        return res as unknown as Response & { statusCode: number; body: unknown };
    };

    it("returns 401 for a key whose is_active is false, before hashing", async () => {
        const future = new Date(Date.now() + 60_000).toISOString();
        mockState.maybeSingleResult = {
            data: {
                id: "k1",
                user_id: "user-1",
                scopes: [],
                expires_at: future,
                key_hash: "unused",
                key_salt: "unused",
                is_active: false,
            },
            error: null,
        };

        const req = { headers: { "x-api-secret": "k1.some-secret" } } as unknown as ApiKeyRequest;
        const res = createRes();
        const next = jest.fn();

        await requireApiKey(req, res, next);

        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual({ error: "API key has been revoked" });
        expect(next).not.toHaveBeenCalled();
    });
});
