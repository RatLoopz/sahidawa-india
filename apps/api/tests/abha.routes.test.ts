process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost:54321";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "test-anon-key";
(global as any).WebSocket = (global as any).WebSocket || class {};

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
}));

import request from "supertest";
import app from "../src/app";

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
            .send({ txnId: "txn-1", otp: "123456", abhaAddress: "test@abdm" });
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
