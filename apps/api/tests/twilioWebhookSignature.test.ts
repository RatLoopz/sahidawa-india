process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost:54321";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "test-anon-key";

const AUTH_TOKEN = "test-auth-token";
const PUBLIC_BASE = "http://localhost";
const WEBHOOK_PATH = "/api/notifications/twilio-webhook";

// Supabase is mocked so the opt-out/opt-in handler never touches the network.
const mockQueryBuilder = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockImplementation(() => Promise.resolve({ error: null })),
};

jest.mock("../src/db/client", () => ({
    supabase: {
        from: jest.fn(() => mockQueryBuilder),
    },
}));

import express from "express";
import request from "supertest";
import notificationsRouter from "../src/routes/notifications";
import { computeTwilioSignature } from "../src/middleware/twilioSignature";

function signatureFor(params: Record<string, string>): string {
    return computeTwilioSignature(AUTH_TOKEN, `${PUBLIC_BASE}${WEBHOOK_PATH}`, params);
}

describe("Twilio webhook signature verification", () => {
    const app = express();
    app.use("/api/notifications", notificationsRouter);

    beforeEach(() => {
        process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;
        process.env.TWILIO_WEBHOOK_PUBLIC_URL = PUBLIC_BASE;
        jest.clearAllMocks();
    });

    afterAll(() => {
        delete process.env.TWILIO_AUTH_TOKEN;
        delete process.env.TWILIO_WEBHOOK_PUBLIC_URL;
    });

    it("matches Twilio's published signature test vector", () => {
        // Reference vector from Twilio's own webhook-validation documentation/SDK,
        // proving our HMAC-SHA1 reconstruction matches what Twilio actually sends.
        const url = "https://mycompany.com/myapp.php?foo=1&bar=2";
        const params = {
            CallSid: "CA1234567890ABCDE",
            Caller: "+14158675309",
            Digits: "1234",
            From: "+14158675309",
            To: "+18005551212",
        };

        expect(computeTwilioSignature("12345", url, params)).toBe("RSOYDt4T1cUTdK1PDd93/VVr8B8=");
    });

    it("processes a request carrying a valid signature", async () => {
        const params = { From: "+919876543210", Body: "STOP" };

        const response = await request(app)
            .post(WEBHOOK_PATH)
            .type("form")
            .set("X-Twilio-Signature", signatureFor(params))
            .send(params);

        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toContain("text/xml");
        expect(response.text).toContain("unsubscribed");
        expect(mockQueryBuilder.update).toHaveBeenCalledWith({ is_active: false });
    });

    it("rejects a request with a forged signature", async () => {
        const params = { From: "+919876543210", Body: "STOP" };

        const response = await request(app)
            .post(WEBHOOK_PATH)
            .type("form")
            .set("X-Twilio-Signature", "Zm9yZ2VkLXNpZ25hdHVyZQ==")
            .send(params);

        expect(response.status).toBe(403);
        expect(mockQueryBuilder.update).not.toHaveBeenCalled();
    });

    it("rejects a request whose body was tampered with after signing", async () => {
        const signedParams = { From: "+919876543210", Body: "HELLO" };
        const signature = signatureFor(signedParams);

        // Attacker keeps the captured signature but swaps the command to STOP.
        const response = await request(app)
            .post(WEBHOOK_PATH)
            .type("form")
            .set("X-Twilio-Signature", signature)
            .send({ From: "+919876543210", Body: "STOP" });

        expect(response.status).toBe(403);
        expect(mockQueryBuilder.update).not.toHaveBeenCalled();
    });

    it("rejects a request missing the X-Twilio-Signature header", async () => {
        const response = await request(app)
            .post(WEBHOOK_PATH)
            .type("form")
            .send({ From: "+919876543210", Body: "STOP" });

        expect(response.status).toBe(403);
        expect(mockQueryBuilder.update).not.toHaveBeenCalled();
    });

    it("accepts an https-signed request when TLS is terminated upstream of the proxy", async () => {
        // No public-URL override: simulate a load balancer that terminates TLS
        // and forwards plain http to the app (X-Forwarded-Proto: http), while
        // Twilio signed the external https URL it actually called.
        delete process.env.TWILIO_WEBHOOK_PUBLIC_URL;

        const proxiedApp = express();
        proxiedApp.set("trust proxy", true);
        proxiedApp.use("/api/notifications", notificationsRouter);

        const host = "api.sahidawa.in";
        const params = { From: "+919876543210", Body: "STOP" };
        const httpsSignature = computeTwilioSignature(
            AUTH_TOKEN,
            `https://${host}${WEBHOOK_PATH}`,
            params
        );

        const response = await request(proxiedApp)
            .post(WEBHOOK_PATH)
            .type("form")
            .set("Host", host)
            .set("X-Forwarded-Proto", "http")
            .set("X-Twilio-Signature", httpsSignature)
            .send(params);

        expect(response.status).toBe(200);
        expect(response.text).toContain("unsubscribed");
    });

    it("fails closed when TWILIO_AUTH_TOKEN is not configured", async () => {
        delete process.env.TWILIO_AUTH_TOKEN;
        const params = { From: "+919876543210", Body: "STOP" };

        const response = await request(app)
            .post(WEBHOOK_PATH)
            .type("form")
            .set("X-Twilio-Signature", signatureFor(params))
            .send(params);

        expect(response.status).toBe(403);
        expect(mockQueryBuilder.update).not.toHaveBeenCalled();
    });
});
