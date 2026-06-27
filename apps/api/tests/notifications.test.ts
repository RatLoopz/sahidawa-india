process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost:54321";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "test-anon-key";
process.env.TWILIO_AUTH_TOKEN = "test-auth-token";
process.env.TWILIO_WEBHOOK_PUBLIC_URL = "http://localhost";

// Mock subscriber data
const mockSubscriber = {
    id: "sub-123-uuid",
    user_id: "test-user-uuid",
    phone: "+919876543210",
    country_code: "+91",
    channels: ["sms", "whatsapp"],
    language: "en",
    district: "South West Delhi",
    is_active: true,
};

// Generic Supabase mock query builder that supports all chaining operations
const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    maybeSingle: jest
        .fn()
        .mockImplementation(() => Promise.resolve({ data: mockSubscriber, error: null })),
    single: jest
        .fn()
        .mockImplementation(() => Promise.resolve({ data: mockSubscriber, error: null })),
    then: jest.fn().mockImplementation((onfulfilled) => {
        return Promise.resolve({ data: [mockSubscriber], error: null }).then(onfulfilled);
    }),
};

jest.mock("../src/db/client", () => {
    return {
        supabase: {
            from: jest.fn().mockImplementation(() => mockQueryBuilder),
        },
    };
});

// Mock authentication
jest.mock("../src/middleware/auth", () => {
    return {
        requireAuth: (req: any, res: any, next: any) => {
            req.user = { id: "test-admin-uuid", role: "admin", email: "admin@example.com" };
            next();
        },
        optionalAuth: (req: any, res: any, next: any) => {
            req.user = { id: "test-user-uuid", role: "user", email: "user@example.com" };
            next();
        },
        requireRole: () => (req: any, res: any, next: any) => {
            next();
        },
    };
});

import express from "express";
import request from "supertest";
import notificationsRouter from "../src/routes/notifications";
import { computeTwilioSignature } from "../src/middleware/twilioSignature";

describe("notifications routes", () => {
    const app = express();

    beforeAll(() => {
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));
        app.use("/api/notifications", notificationsRouter);
    });

    beforeEach(() => {
        jest.clearAllMocks();
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

    it("fetches subscription status successfully", async () => {
        const response = await request(app)
            .get("/api/notifications/status")
            .query({ phone: "9876543210" });

        expect(response.status).toBe(200);
        expect(response.body.registered).toBe(true);
        expect(response.body.subscriber.phone).toBe("+919876543210");
    });

    it("registers a subscriber successfully", async () => {
        const payload = {
            phone: "9876543210",
            channels: ["sms", "whatsapp"],
            language: "hi",
            district: "West Delhi",
        };

        const response = await request(app).post("/api/notifications/register").send(payload);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.subscriber).toBeDefined();
    });

    it("fails registration with invalid payload", async () => {
        const payload = {
            phone: "123", // invalid phone
            channels: [], // empty channels
            district: "",
        };

        const response = await request(app).post("/api/notifications/register").send(payload);

        expect(response.status).toBe(400);
    });

    it("updates subscriber details successfully", async () => {
        const payload = {
            phone: "9876543210",
            district: "South Delhi",
            channels: ["whatsapp"],
        };

        const response = await request(app).patch("/api/notifications/phone").send(payload);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
    });

    it("opts out subscriber successfully", async () => {
        const payload = {
            phone: "9876543210",
        };

        const response = await request(app).delete("/api/notifications/phone").send(payload);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
    });

    it("handles twilio webhook opt-out (STOP command)", async () => {
        const params = { From: "+919876543210", Body: "STOP" };
        const signature = computeTwilioSignature(
            "test-auth-token",
            "http://localhost/api/notifications/twilio-webhook",
            params
        );

        const response = await request(app)
            .post("/api/notifications/twilio-webhook")
            .type("form")
            .set("X-Twilio-Signature", signature)
            .send(params);

        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toContain("text/xml");
        expect(response.text).toContain("unsubscribed");
    });

    it("broadcasts messages to subscribers", async () => {
        const payload = {
            district: "South West Delhi",
            title: "Test Recall",
            message: "Test Message details",
        };

        const response = await request(app).post("/api/notifications/broadcast").send(payload);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.sentCount).toBeDefined();
    });
    it("fails registration when formatPhoneNumber returns null for garbage input", async () => {
        const payload = {
            phone: "abcdefghij", // 10 chars, bypasses zod min(10) but is garbage
            channels: ["sms"],
            district: "West Delhi",
            language: "en",
        };
        const response = await request(app).post("/api/notifications/register").send(payload);
        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Invalid phone number format");
    });

    it("returns 400 for /status with invalid phone number format", async () => {
        const response = await request(app)
            .get("/api/notifications/status")
            .query({ phone: "invalid-phone" });
        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Invalid phone number format");
    });

    it("returns 400 for /phone PATCH with invalid phone format", async () => {
        const payload = {
            phone: "123", // too short
            district: "South Delhi",
            channels: ["whatsapp"],
        };

        // Zod will catch 123 since it's < 10, let's use 10 chars of garbage
        const payload2 = {
            phone: "garbagephn",
            district: "South Delhi",
            channels: ["whatsapp"],
        };

        const response = await request(app).patch("/api/notifications/phone").send(payload2);
        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Invalid phone number format");
    });

    it("returns 400 for /phone DELETE with invalid phone format", async () => {
        const payload = {
            phone: "garbagephn",
        };
        const response = await request(app).delete("/api/notifications/phone").send(payload);
        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Invalid phone number format");
    });
});
