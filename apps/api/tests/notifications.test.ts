import express from "express";
import request from "supertest";
import notificationsRouter from "../src/routes/notifications";

describe("notifications routes", () => {
    const app = express();

    beforeAll(() => {
        app.use(express.json());
        app.use("/api/notifications", notificationsRouter);
    });

    it("returns vapid public key payload", async () => {
        const response = await request(app).get("/api/notifications/vapid-public-key");

        expect(response.status).toBe(200);
    });

    it("returns mock recall feed", async () => {
        const response = await request(app).get("/api/notifications/recalls/mock");

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("recalls");
    });

    it("returns vapid configuration status", async () => {
        const response = await request(app).get("/api/notifications/vapid-public-key");

        expect(response.body).toHaveProperty("publicKey");
        expect(response.body).toHaveProperty("configured");
    });

    it("returns recalls array", async () => {
        const response = await request(app).get("/api/notifications/recalls/mock");

        expect(Array.isArray(response.body.recalls)).toBe(true);
    });

    it("vapid endpoint returns configured field as boolean", async () => {
        const response = await request(app).get("/api/notifications/vapid-public-key");

        expect(typeof response.body.configured).toBe("boolean");
    });

    it("vapid endpoint contains publicKey field", async () => {
        const response = await request(app).get("/api/notifications/vapid-public-key");

        expect(response.body).toHaveProperty("publicKey");
    });
});
