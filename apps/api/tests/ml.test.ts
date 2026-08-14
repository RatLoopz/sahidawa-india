// @ts-nocheck
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import mlRouter from "../src/routes/ml";

jest.mock("../src/middleware/auth", () => ({
    requireAuth: (req: Request, res: Response, next: NextFunction) => {
        const token = req.headers.authorization?.slice(7);
        if (!token) {
            return res.status(401).json({ error: "Unauthorized: Missing access token" });
        }
        req.user = { id: "test-user-id", email: "test@example.com", role: "user" };
        next();
    },
    AuthenticatedRequest: Object,
}));

import { Request, Response, NextFunction } from "express";

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use("/api/ml", mlRouter);
    return app;
}

const VALID_TOKEN = "Bearer test-auth-token";
const VALID_CLOUDINARY_URL = "https://res.cloudinary.com/demo/image/upload/medicine.jpg";

describe("ml routes", () => {
    const originalFetch = global.fetch;
    const originalMlServiceUrl = process.env.ML_SERVICE_URL;

    beforeEach(() => {
        process.env.ML_SERVICE_URL = "http://ml-service.test";
        jest.clearAllMocks();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        process.env.ML_SERVICE_URL = originalMlServiceUrl;
    });

    it("rejects unauthenticated requests", async () => {
        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .send({ imageUrl: VALID_CLOUDINARY_URL });

        assert.equal(response.status, 401);
        assert.ok(response.body.error.includes("Unauthorized"));
    });

    it("rejects non-HTTPS image URLs", async () => {
        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .set("Authorization", VALID_TOKEN)
            .send({ imageUrl: "http://example.test/photo.jpg" });

        assert.equal(response.status, 400);
    });

    it("proxies valid Cloudinary URLs to the ML service and falls back to dolo-650 when medicineId is omitted", async () => {
        let requestBody: any = null;
        global.fetch = async (url, options) => {
            if (options && options.body) {
                requestBody = JSON.parse(options.body as string);
            }
            return new globalThis.Response(
                JSON.stringify({
                    isFake: false,
                    confidence: 0.81,
                    verdict: "likely_genuine",
                    details: "Packaging photo passed the preliminary visual quality scan.",
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        };

        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .set("Authorization", VALID_TOKEN)
            .send({ imageUrl: VALID_CLOUDINARY_URL });

        assert.equal(response.status, 200);
        assert.equal(response.body.verdict, "likely_genuine");
        assert.equal(response.body.isFake, false);
        assert.equal(requestBody.medicineId, "dolo-650");
    });

    it("proxies valid Cloudinary URLs to the ML service and forwards medicineId when provided", async () => {
        let requestBody: any = null;
        global.fetch = async (url, options) => {
            if (options && options.body) {
                requestBody = JSON.parse(options.body as string);
            }
            return new globalThis.Response(
                JSON.stringify({
                    isFake: false,
                    confidence: 0.81,
                    verdict: "likely_genuine",
                    details: "Packaging photo passed the preliminary visual quality scan.",
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        };

        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .set("Authorization", VALID_TOKEN)
            .send({ imageUrl: VALID_CLOUDINARY_URL, medicineId: "crocin-500" });

        assert.equal(response.status, 200);
        assert.equal(response.body.verdict, "likely_genuine");
        assert.equal(requestBody.medicineId, "crocin-500");
    });

    it("returns a configuration error when ML_SERVICE_URL is missing", async () => {
        delete process.env.ML_SERVICE_URL;
        global.fetch = async () => {
            throw new Error("fetch should not be called without ML_SERVICE_URL");
        };

        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .set("Authorization", VALID_TOKEN)
            .send({ imageUrl: VALID_CLOUDINARY_URL });

        assert.equal(response.status, 500);
        assert.equal(response.body.code, "ML_SERVICE_URL_MISSING");
    });

    it("rejects requests to private IP addresses (SSRF protection)", async () => {
        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .set("Authorization", VALID_TOKEN)
            .send({ imageUrl: "https://192.168.1.1/admin" });

        assert.equal(response.status, 400);
    });

    it("rejects requests to localhost (SSRF protection)", async () => {
        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .set("Authorization", VALID_TOKEN)
            .send({ imageUrl: "https://localhost:8080/secret" });

        assert.equal(response.status, 400);
    });

    it("rejects requests to 127.0.0.1 (SSRF protection)", async () => {
        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .set("Authorization", VALID_TOKEN)
            .send({ imageUrl: "https://127.0.0.1/internal" });

        assert.equal(response.status, 400);
    });

    it("rejects requests to 10.x.x.x private addresses (SSRF protection)", async () => {
        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .set("Authorization", VALID_TOKEN)
            .send({ imageUrl: "https://10.0.0.1/config" });

        assert.equal(response.status, 400);
    });

    it("rejects requests to .internal hostnames (SSRF protection)", async () => {
        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .set("Authorization", VALID_TOKEN)
            .send({ imageUrl: "https://internal-admin-panel.internal/secret" });

        assert.equal(response.status, 400);
    });

    it("rejects requests to .local hostnames (SSRF protection)", async () => {
        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .set("Authorization", VALID_TOKEN)
            .send({ imageUrl: "https://service.local/api" });

        assert.equal(response.status, 400);
    });

    it("rejects requests to 169.254.169.254 (cloud metadata SSRF)", async () => {
        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .set("Authorization", VALID_TOKEN)
            .send({ imageUrl: "https://169.254.169.254/latest/meta-data/" });

        assert.equal(response.status, 400);
    });

    it("rejects requests to 0.0.0.0 (SSRF protection)", async () => {
        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .set("Authorization", VALID_TOKEN)
            .send({ imageUrl: "https://0.0.0.0/admin" });

        assert.equal(response.status, 400);
    });

    it("rejects requests to carrier-grade NAT ranges (SSRF protection)", async () => {
        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .set("Authorization", VALID_TOKEN)
            .send({ imageUrl: "https://100.64.0.1/internal" });

        assert.equal(response.status, 400);
    });

    it("rejects requests to IPv6 ULA and unspecified addresses (SSRF protection)", async () => {
        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .set("Authorization", VALID_TOKEN)
            .send({ imageUrl: "https://[fd00::1]/internal" });

        assert.equal(response.status, 400);
    });

    it("rejects requests to IPv6-mapped IPv4 literals (SSRF protection)", async () => {
        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .set("Authorization", VALID_TOKEN)
            .send({ imageUrl: "https://[::ffff:7f00:1]/internal" });

        assert.equal(response.status, 400);
    });

    it("rejects .nip.io DNS rebinding domains (SSRF protection)", async () => {
        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .set("Authorization", VALID_TOKEN)
            .send({ imageUrl: "https://127.0.0.1.nip.io/secret" });

        assert.equal(response.status, 400);
    });

    it("rejects non-Cloudinary public hosts (allowlist)", async () => {
        global.fetch = async () => {
            throw new Error("fetch should not be called for non-Cloudinary hosts");
        };

        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .set("Authorization", VALID_TOKEN)
            .send({ imageUrl: "https://public-host.example.test/photo.jpg" });

        assert.equal(response.status, 400);
        assert.match(JSON.stringify(response.body.details), /Cloudinary HTTPS image delivery URL/);
    });

    it("rejects Cloudinary URLs with query strings", async () => {
        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .set("Authorization", VALID_TOKEN)
            .send({ imageUrl: "https://res.cloudinary.com/demo/image/upload/medicine.jpg?x=1" });

        assert.equal(response.status, 400);
    });

    it("rejects Cloudinary URLs that are not image/upload paths", async () => {
        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .set("Authorization", VALID_TOKEN)
            .send({ imageUrl: "https://res.cloudinary.com/demo/raw/upload/file.bin" });

        assert.equal(response.status, 400);
    });
});
