import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import mlRouter from "../src/routes/ml";

jest.mock("../src/middleware/auth", () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: "test-user", email: "test@example.com", role: "user" };
        next();
    },
    AuthenticatedRequest: Object,
}));

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use("/api/ml", mlRouter);
    return app;
}

describe("ml routes", () => {
    const originalFetch = global.fetch;
    const originalMlServiceUrl = process.env.ML_SERVICE_URL;

    beforeEach(() => {
        process.env.ML_SERVICE_URL = "http://ml-service.test";
    });

    afterEach(() => {
        global.fetch = originalFetch;
        process.env.ML_SERVICE_URL = originalMlServiceUrl;
    });

    it("rejects non-HTTPS image URLs", async () => {
        const response = await request(buildApp())
            .post("/api/ml/analyze")
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
            .send({ imageUrl: "https://res.cloudinary.com/demo/image/upload/medicine.jpg" });

        assert.equal(response.status, 500);
        assert.equal(response.body.code, "ML_SERVICE_URL_MISSING");
    });

    it("rejects requests to private IP addresses (SSRF protection)", async () => {
        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .send({ imageUrl: "https://192.168.1.1/admin" });

        assert.equal(response.status, 400);
    });

    it("rejects requests to localhost (SSRF protection)", async () => {
        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .send({ imageUrl: "https://localhost:8080/secret" });

        assert.equal(response.status, 400);
    });

    it("rejects requests to 127.0.0.1 (SSRF protection)", async () => {
        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .send({ imageUrl: "https://127.0.0.1/internal" });

        assert.equal(response.status, 400);
    });

    it("rejects requests to 10.x.x.x private addresses (SSRF protection)", async () => {
        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .send({ imageUrl: "https://10.0.0.1/config" });

        assert.equal(response.status, 400);
    });

    it("rejects requests to .internal hostnames (SSRF protection)", async () => {
        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .send({ imageUrl: "https://internal-admin-panel.internal/secret" });

        assert.equal(response.status, 400);
    });

    it("rejects requests to .local hostnames (SSRF protection)", async () => {
        const response = await request(buildApp())
            .post("/api/ml/analyze")
            .send({ imageUrl: "https://service.local/api" });

        assert.equal(response.status, 400);
    });
});
