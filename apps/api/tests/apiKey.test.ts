import { Request, Response } from "express";
import { requireApiKey } from "../src/middleware/apiKey";

function createMockReq(headers: Record<string, string> = {}): Request {
    return { headers } as unknown as Request;
}

function createMockRes(): Response & { statusCode: number; body: unknown } {
    const res = {
        statusCode: 200,
        body: undefined as unknown,
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        json(data: unknown) {
            this.body = data;
            return this;
        },
    };
    return res as unknown as Response & { statusCode: number; body: unknown };
}

describe("requireApiKey middleware", () => {
    const originalEnv = process.env;
    let next: jest.Mock;

    beforeEach(() => {
        process.env = { ...originalEnv };
        next = jest.fn();
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it("allows all requests when API_KEYS is not set", () => {
        delete process.env.API_KEYS;
        const req = createMockReq();
        const res = createMockRes();

        requireApiKey(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.statusCode).toBe(200);
    });

    it("allows requests with a valid API key", () => {
        process.env.API_KEYS = "key-abc,key-def";
        const req = createMockReq({ "x-api-key": "key-abc" });
        const res = createMockRes();

        requireApiKey(req, res, next);

        expect(next).toHaveBeenCalled();
    });

    it("rejects requests with no API key when keys are configured", () => {
        process.env.API_KEYS = "key-abc";
        const req = createMockReq();
        const res = createMockRes();

        requireApiKey(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
        expect((res.body as any).error).toBe("Unauthorized");
    });

    it("rejects requests with an incorrect API key", () => {
        process.env.API_KEYS = "key-abc";
        const req = createMockReq({ "x-api-key": "wrong-key" });
        const res = createMockRes();

        requireApiKey(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
    });

    it("allows requests from a trusted origin without API key", () => {
        process.env.API_KEYS = "key-abc";
        const req = createMockReq({ origin: "http://localhost:3000" });
        const res = createMockRes();

        requireApiKey(req, res, next);

        expect(next).toHaveBeenCalled();
    });

    it("allows requests from a custom ALLOWED_ORIGINS without API key", () => {
        process.env.API_KEYS = "key-abc";
        process.env.ALLOWED_ORIGINS = "https://sahidawa.in";
        const req = createMockReq({ origin: "https://sahidawa.in" });
        const res = createMockRes();

        requireApiKey(req, res, next);

        expect(next).toHaveBeenCalled();
    });
});
