import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import mlRouter from "../src/routes/ml";

jest.mock("../src/middleware/auth", () => ({
    requireAuth: (req: any, res: any, next: any) => {
        const token = req.headers.authorization?.slice(7);
        if (!token) {
            return res.status(401).json({ error: "Unauthorized: Missing access token" });
        }
        req.user = { id: "test-user-id", email: "test@example.com", role: "user" };
        next();
    },
    AuthenticatedRequest: Object,
}));

jest.mock("node:dns", () => ({
    promises: {
        resolve4: jest.fn(),
    },
}));

import { promises as dnsMock } from "node:dns";

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use("/api/ml", mlRouter);
    return app;
}

const VALID_TOKEN = "Bearer test-auth-token";

describe("ml routes", () => {
    const originalFetch = global.fetch;
    const originalMlServiceUrl = process.env.ML_SERVICE_URL;

    beforeEach(() => {
        process.env.ML_SERVICE_URL = "http://ml-service.test";
        jest.clearAllMocks();
        (dnsMock.resolve4 as jest.Mock).mockResolvedValue(["203.0.113.42"]);
    });

    afterEach(() => {
        global.fetch = originalFetch;
        process.env.ML_SERVICE_URL = originalMlServiceUrl;
    });

    it("rejects unauthenticated requests", async () => {
        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .send({ imageUrl: "https://res.cloudinary.com/demo/image/upload/medicine.jpg" });

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

    it("proxies valid Cloudinary URLs to the ML service", async () => {
        global.fetch = async () =>
            new Response(
                JSON.stringify({
                    isFake: false,
                    confidence: 0.81,
                    verdict: "likely_genuine",
                    details: "Packaging photo passed the preliminary visual quality scan.",
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );

        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .set("Authorization", VALID_TOKEN)
            .send({ imageUrl: "https://res.cloudinary.com/demo/image/upload/medicine.jpg" });

        assert.equal(response.status, 200);
        assert.equal(response.body.verdict, "likely_genuine");
        assert.equal(response.body.isFake, false);
    });

    it("returns a configuration error when ML_SERVICE_URL is missing", async () => {
        delete process.env.ML_SERVICE_URL;
        global.fetch = async () => {
            throw new Error("fetch should not be called without ML_SERVICE_URL");
        };

        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .set("Authorization", VALID_TOKEN)
            .send({ imageUrl: "https://res.cloudinary.com/demo/image/upload/medicine.jpg" });

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

    it("rejects .nip.io DNS rebinding domains (SSRF protection)", async () => {
        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .set("Authorization", VALID_TOKEN)
            .send({ imageUrl: "https://127.0.0.1.nip.io/secret" });

        assert.equal(response.status, 400);
    });

    it("blocks public-looking domains whose DNS resolves to a private IP", async () => {
        (dnsMock.resolve4 as jest.Mock).mockResolvedValueOnce(["10.0.0.5"]);

        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .set("Authorization", VALID_TOKEN)
            .send({ imageUrl: "https://innocent-looking.example.test/data" });

        assert.equal(response.status, 400);
    });

    it("allows domains whose DNS resolves to a public IP", async () => {
        (dnsMock.resolve4 as jest.Mock).mockResolvedValueOnce(["203.0.113.42"]);

        global.fetch = async () =>
            new Response(
                JSON.stringify({
                    isFake: false,
                    confidence: 0.81,
                    verdict: "likely_genuine",
                    details: "Passed visual quality scan.",
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );

        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .set("Authorization", VALID_TOKEN)
            .send({ imageUrl: "https://public-host.example.test/photo.jpg" });

        assert.equal(response.status, 200);
    });

    it("blocks domains when DNS resolution fails (fail closed)", async () => {
        (dnsMock.resolve4 as jest.Mock).mockRejectedValueOnce(new Error("DNS resolution failed"));

        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .set("Authorization", VALID_TOKEN)
            .send({ imageUrl: "https://unresolvable.example.test/img.jpg" });

        assert.equal(response.status, 400);
    });
});
