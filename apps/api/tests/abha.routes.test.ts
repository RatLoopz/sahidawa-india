process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost:54321";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "test-anon-key";
(global as any).WebSocket = (global as any).WebSocket || class {};

const mockPkceSessions = new Map<string, { codeVerifier: string; userId: string }>();
const mockStoreAbhaPkceSession = jest.fn(
    async (state: string, session: { codeVerifier: string; userId: string }) => {
        mockPkceSessions.set(state, session);
    }
);
const mockConsumeAbhaPkceSession = jest.fn(async (state: string) => {
    const session = mockPkceSessions.get(state) ?? null;
    mockPkceSessions.delete(state);
    return session;
});
const mockExchangeAuthCode = jest.fn().mockResolvedValue({ success: true });
const mockGetAuthorizationUrl = jest.fn(
    async (_codeChallenge: string, state: string) => `https://abdm.test/authorize?state=${state}`
);

jest.mock("../src/db/client", () => ({
    supabase: {
        from: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(),
    },
}));

jest.mock("../src/middleware/auth", () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: "test-user-uuid", role: "user", email: "user@example.com" };
        next();
    },
    optionalAuth: (_req: any, _res: any, next: any) => next(),
    requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock("../src/services/abha.service", () => ({
    generateOTP: jest.fn().mockResolvedValue({ txnId: "mock-txn-id" }),
    verifyOTP: jest.fn().mockResolvedValue({ token: "mock-token" }),
    uploadVerification: jest.fn().mockResolvedValue({ success: true }),
    getPrescriptions: jest.fn().mockResolvedValue([]),
    unlinkABHA: jest.fn().mockResolvedValue({ success: true }),
    generatePkcePair: jest.fn().mockReturnValue({
        codeVerifier: "test-code-verifier",
        codeChallenge: "test-code-challenge",
    }),
    getAuthorizationUrl: mockGetAuthorizationUrl,
    exchangeAuthCode: mockExchangeAuthCode,
}));

jest.mock("../src/services/abhaPkceSession.service", () => ({
    storeAbhaPkceSession: mockStoreAbhaPkceSession,
    consumeAbhaPkceSession: mockConsumeAbhaPkceSession,
}));

import request from "supertest";
import express from "express";
import abhaRouter from "../src/routes/abha";

const app = express();
app.use(express.json());
app.use("/api/v1/abha", abhaRouter);

beforeEach(() => {
    jest.clearAllMocks();
    mockPkceSessions.clear();
    mockStoreAbhaPkceSession.mockImplementation(async (state, session) => {
        mockPkceSessions.set(state, session);
    });
    mockConsumeAbhaPkceSession.mockImplementation(async (state) => {
        const session = mockPkceSessions.get(state) ?? null;
        mockPkceSessions.delete(state);
        return session;
    });
    mockExchangeAuthCode.mockResolvedValue({ success: true });
    mockGetAuthorizationUrl.mockImplementation(
        async (_codeChallenge, state) => `https://abdm.test/authorize?state=${state}`
    );
});

describe("POST /api/v1/abha/link", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("rejects a missing abhaAddress", async () => {
        const response = await request(app).post("/api/v1/abha/link").send({});
        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Invalid link payload");
    });

    it("rejects a non-string abhaAddress", async () => {
        const response = await request(app).post("/api/v1/abha/link").send({ abhaAddress: 12345 });
        expect(response.status).toBe(400);
    });

    it("accepts a valid abhaAddress", async () => {
        const response = await request(app)
            .post("/api/v1/abha/link")
            .send({ abhaAddress: "testuser@abdm" });
        expect(response.status).toBe(200);
        expect(response.body.txnId).toBe("mock-txn-id");
    });
});

describe("POST /api/v1/abha/verify-otp", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("rejects a malformed otp", async () => {
        const response = await request(app)
            .post("/api/v1/abha/verify-otp")
            .send({ txnId: "txn-1", otp: "abc", abhaAddress: "test@abdm" });
        expect(response.status).toBe(400);
    });

    it("rejects a missing txnId", async () => {
        const response = await request(app)
            .post("/api/v1/abha/verify-otp")
            .send({ otp: "123456", abhaAddress: "test@abdm" });
        expect(response.status).toBe(400);
    });

    it("accepts a valid txnId and otp", async () => {
        const response = await request(app)
            .post("/api/v1/abha/verify-otp")
            .send({ abhaAddress: "testuser@abdm", txnId: "txn-1", otp: "123456" });
        expect(response.status).toBe(200);
        expect(response.body.token).toBe("mock-token");
    });
});

describe("POST /api/v1/abha/upload-verification", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("rejects an invalid scannedAt", async () => {
        const response = await request(app)
            .post("/api/v1/abha/upload-verification")
            .send({ medicineId: "med-1", verificationResult: "real", scannedAt: "banana" });
        expect(response.status).toBe(400);
    });

    it("accepts a valid payload", async () => {
        const response = await request(app).post("/api/v1/abha/upload-verification").send({
            medicineId: "med-1",
            verificationResult: "real",
            scannedAt: new Date().toISOString(),
        });
        expect(response.status).toBe(200);
    });
});

describe("ABHA PKCE authorization routes", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPkceSessions.clear();
    });

    it("stores the verifier and authenticated user in shared storage", async () => {
        const response = await request(app).get("/api/v1/abha/authorize");

        expect(response.status).toBe(200);
        expect(response.body.state).toMatch(/^[a-f0-9]{32}$/);
        expect(response.body.url).toBe(`https://abdm.test/authorize?state=${response.body.state}`);
        expect(mockStoreAbhaPkceSession).toHaveBeenCalledWith(response.body.state, {
            codeVerifier: "test-code-verifier",
            userId: "test-user-uuid",
        });
    });

    it("returns the existing server error behavior when shared storage fails", async () => {
        mockStoreAbhaPkceSession.mockRejectedValueOnce(new Error("Redis unavailable"));

        const response = await request(app).get("/api/v1/abha/authorize");

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: "Redis unavailable" });
    });

    it("consumes a shared session and exchanges the authorization code once", async () => {
        const authorizeResponse = await request(app).get("/api/v1/abha/authorize");
        const state = authorizeResponse.body.state as string;

        const callbackResponse = await request(app)
            .get("/api/v1/abha/callback")
            .query({ code: "authorization-code", state });

        expect(callbackResponse.status).toBe(200);
        expect(mockConsumeAbhaPkceSession).toHaveBeenCalledWith(state);
        expect(mockExchangeAuthCode).toHaveBeenCalledWith(
            "test-user-uuid",
            "authorization-code",
            "test-code-verifier"
        );
    });

    it("rejects missing or expired state without exchanging a code", async () => {
        const response = await request(app)
            .get("/api/v1/abha/callback")
            .query({ code: "authorization-code", state: "missing-state" });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: "Stale state transaction configuration or session timeout error",
        });
        expect(mockExchangeAuthCode).not.toHaveBeenCalled();
    });

    it("rejects an invalid stored session without exchanging a code", async () => {
        mockConsumeAbhaPkceSession.mockResolvedValueOnce(null);

        const response = await request(app)
            .get("/api/v1/abha/callback")
            .query({ code: "authorization-code", state: "malformed-state" });

        expect(response.status).toBe(400);
        expect(mockExchangeAuthCode).not.toHaveBeenCalled();
    });

    it("prevents callback replay through atomic shared-session consumption", async () => {
        const authorizeResponse = await request(app).get("/api/v1/abha/authorize");
        const state = authorizeResponse.body.state as string;

        const firstResponse = await request(app)
            .get("/api/v1/abha/callback")
            .query({ code: "authorization-code", state });
        const replayResponse = await request(app)
            .get("/api/v1/abha/callback")
            .query({ code: "authorization-code", state });

        expect(firstResponse.status).toBe(200);
        expect(replayResponse.status).toBe(400);
        expect(mockExchangeAuthCode).toHaveBeenCalledTimes(1);
    });

    it("does not classify a shared-storage outage as expired state", async () => {
        mockConsumeAbhaPkceSession.mockRejectedValueOnce(new Error("Redis unavailable"));

        const response = await request(app)
            .get("/api/v1/abha/callback")
            .query({ code: "authorization-code", state: "valid-state" });

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: "Redis unavailable" });
        expect(mockExchangeAuthCode).not.toHaveBeenCalled();
    });

    it.each([{ code: "authorization-code" }, { state: "state-123" }])(
        "preserves the missing callback parameter response",
        async (query) => {
            const response = await request(app).get("/api/v1/abha/callback").query(query);

            expect(response.status).toBe(400);
            expect(response.body).toEqual({
                error: "Missing authorization code structure or state token mismatch",
            });
            expect(mockConsumeAbhaPkceSession).not.toHaveBeenCalled();
            expect(mockExchangeAuthCode).not.toHaveBeenCalled();
        }
    );
});
