import request from "supertest";
import express from "express";
import scanRouter from "../src/routes/scan";
import { dbConfig } from "../src/db/client";

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use("/api/v1/scan", scanRouter);
    return app;
}

describe("Scan API Routes - Offline Mode", () => {
    beforeAll(() => {
        dbConfig.isSupabaseOffline = true;
    });

    afterAll(() => {
        dbConfig.isSupabaseOffline = false;
    });

    it("POST /api/v1/scan/match - should return fuzzy matched results from local fallback", async () => {
        const response = await request(buildApp())
            .post("/api/v1/scan/match")
            .send({ query: "dlo" });

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].name).toBe("Dolo");
        expect(response.body[0].score).toBeGreaterThan(60);
    });

    it("POST /api/v1/scan/verify-brand - should return offline details for matched local medicine", async () => {
        const response = await request(buildApp())
            .post("/api/v1/scan/verify-brand")
            .send({ brandName: "dolo" });

        expect(response.status).toBe(200);
        expect(response.body.verified).toBe(true);
        expect(response.body.medicine.brand_name).toBe("Dolo");
        expect(response.body.medicine.generic_name).toBe("Paracetamol");
        expect(response.body.medicine.manufacturer).toBe("Offline Local Labs Ltd");
    });

    it("POST /api/v1/scan/explain - should return offline explanation for matched local medicine", async () => {
        const response = await request(buildApp())
            .post("/api/v1/scan/explain")
            .send({ medicineName: "dolo" });

        expect(response.status).toBe(200);
        expect(response.body.purpose).toContain("relieve mild to moderate pain");
    });
});
