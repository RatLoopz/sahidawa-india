// @ts-nocheck
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost:54321";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "test-anon-key";
process.env.TWILIO_AUTH_TOKEN = "test-auth-token";
process.env.TWILIO_WEBHOOK_PUBLIC_URL = "http://localhost";
process.env.JWT_SECRET = "test-jwt-secret";

// Mock subscriber data. Deliberately includes the sensitive columns
// (user_id, verification_otp, otp_expires_at) so the tests below can assert the
// route never leaks them into a response.
const mockSubscriber = {
    id: "sub-123-uuid",
    user_id: "test-user-uuid",
    phone: "+919876543210",
    country_code: "+91",
    channels: ["sms", "whatsapp"],
    language: "en",
    district: "South West Delhi",
    is_active: true,
    status: "active",
    verification_otp: "123456",
    otp_expires_at: "2999-01-01T00:00:00.000Z",
};

// Fields that must never appear on a subscriber object in any HTTP response.
const SENSITIVE_SUBSCRIBER_FIELDS = ["user_id", "verification_otp", "otp_expires_at"];

let mockAuthenticatedUser: any = {
    id: "test-user-uuid",
    role: "user",
    email: "user@example.com",
};
let mockQueryResult = [mockSubscriber];
const updatePayload = () => mockQueryBuilder.update.mock.calls[0]?.[0];

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
        return Promise.resolve({ data: mockQueryResult, error: null }).then(onfulfilled);
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
        requireAuth: (req: Request, res: Response, next: NextFunction) => {
            if (!mockAuthenticatedUser) {
                res.status(401).json({ error: "Authentication required" });
                return;
            }
            req.user = mockAuthenticatedUser;
            next();
        },
        optionalAuth: (req: Request, res: Response, next: NextFunction) => {
            if (mockAuthenticatedUser) {
                req.user = mockAuthenticatedUser;
            }
            next();
        },
        requireRole: () => (req: Request, res: Response, next: NextFunction) => {
            next();
        },
    };
});

jest.mock("../src/middleware/rateLimit", () => ({
    notificationRegisterLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
    authTargetLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
    // /status and DELETE /phone were put behind the shared `limiter` in
    // 35cf49f4. It was missing here, so the router got `undefined` as a handler
    // and the whole suite died on import with "argument handler must be a
    // function" before a single test ran.
    limiter: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

jest.mock("../src/utils/phone", () => ({
    formatPhoneNumber: (phone: string) => {
        if (/^\d{10}$/.test(phone)) return `+91${phone}`;
        if (/^\+91\d{10}$/.test(phone)) return phone;
        return null;
    },
}));

// Mock sms + whatsapp services to prevent BullMQ/Redis connection attempts in CI
jest.mock("../src/services/sms-service", () => ({
    smsService: {
        send: jest.fn().mockResolvedValue(true),
        sendOtp: jest.fn().mockResolvedValue(true),
    },
}));

jest.mock("../src/services/whatsapp-service", () => ({
    whatsappService: {
        send: jest.fn().mockResolvedValue(true),
        sendOtp: jest.fn().mockResolvedValue(true),
    },
}));

jest.mock("../src/services/otpStore", () => ({
    otpStore: {
        store: jest.fn().mockResolvedValue(undefined),
        verify: jest.fn().mockResolvedValue(false),
        hasPending: jest.fn().mockResolvedValue(false),
        clear: jest.fn().mockResolvedValue(undefined),
    },
}));

// In-memory store to simulate Redis for pending phone changes in tests
const mockPendingPhoneChanges = new Map<string, string>();

jest.mock("../src/utils/redis", () => ({
    redisClient: {
        get isOpen() {
            return true;
        },
        get: jest.fn().mockImplementation(async (key: string) => {
            return mockPendingPhoneChanges.get(key) ?? null;
        }),
        setEx: jest.fn().mockImplementation(async (key: string, _ttl: number, value: string) => {
            mockPendingPhoneChanges.set(key, value);
        }),
        del: jest.fn().mockImplementation(async (key: string) => {
            mockPendingPhoneChanges.delete(key);
        }),
    },
}));

import express from "express";
import request from "supertest";
import notificationsRouter from "../src/routes/notifications";
import { computeTwilioSignature } from "../src/middleware/twilioSignature";
import { signGuestToken, verifyGuestPhone } from "../src/utils/guestToken";
import { Request, Response, NextFunction } from "express";
import { otpStore } from "../src/services/otpStore";
import { smsService } from "../src/services/sms-service";
import { whatsappService } from "../src/services/whatsapp-service";

const mockOtpStore = otpStore as any;
const smsServiceMock = smsService as any;
const whatsappServiceMock = whatsappService as any;

describe("notifications routes", () => {
    let app: express.Express;
    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));
        app.use("/api/notifications", notificationsRouter);
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockAuthenticatedUser = {
            id: "test-user-uuid",
            role: "user",
            email: "user@example.com",
        };
        mockQueryResult = [mockSubscriber];
        // Reset otpStore mocks to safe defaults
        mockOtpStore.store.mockResolvedValue(undefined);
        mockOtpStore.verify.mockResolvedValue(false);
        mockOtpStore.hasPending.mockResolvedValue(false);
        mockOtpStore.clear.mockResolvedValue(undefined);
    });

    it("returns vapid public key payload", async () => {
        const response = await request(app).get("/api/notifications/vapid-public-key");
        expect(response.status).toBe(200);
    });

    it("returns Cache-Control header for vapid public key", async () => {
        const response = await request(app).get("/api/notifications/vapid-public-key");
        expect(response.headers["cache-control"]).toContain("public");
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

    it("never leaks OTP or user_id from /status for an authenticated user", async () => {
        const response = await request(app)
            .get("/api/notifications/status")
            .query({ phone: "9876543210" });

        expect(response.status).toBe(200);
        expect(response.body.registered).toBe(true);
        for (const field of SENSITIVE_SUBSCRIBER_FIELDS) {
            expect(response.body.subscriber).not.toHaveProperty(field);
        }
    });

    it("rejects a guest /status call that has no guest token", async () => {
        mockAuthenticatedUser = null;

        const response = await request(app)
            .get("/api/notifications/status")
            .query({ phone: "9876543210" });

        expect(response.status).toBe(401);
        expect(mockQueryBuilder.eq).not.toHaveBeenCalled();
    });

    it("scopes a guest /status lookup to the token's phone, ignoring any query phone", async () => {
        mockAuthenticatedUser = null;
        const token = signGuestToken("+919876543210");

        const response = await request(app)
            .get("/api/notifications/status")
            .set("X-Guest-Token", token)
            .query({ phone: "+910000000000" }); // attacker-supplied, must be ignored

        expect(response.status).toBe(200);
        expect(response.body.registered).toBe(true);
        // The lookup is driven by the token, not the query string.
        expect(mockQueryBuilder.eq).toHaveBeenCalledWith("phone", "+919876543210");
        expect(mockQueryBuilder.eq).not.toHaveBeenCalledWith("phone", "+910000000000");
        for (const field of SENSITIVE_SUBSCRIBER_FIELDS) {
            expect(response.body.subscriber).not.toHaveProperty(field);
        }
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
        for (const field of SENSITIVE_SUBSCRIBER_FIELDS) {
            expect(response.body.subscriber).not.toHaveProperty(field);
        }
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
        for (const field of SENSITIVE_SUBSCRIBER_FIELDS) {
            expect(response.body.subscriber).not.toHaveProperty(field);
        }
        expect(mockQueryBuilder.update).toHaveBeenCalledWith({
            channels: ["whatsapp"],
            district: "South Delhi",
        });
        expect(mockQueryBuilder.eq).toHaveBeenCalledWith("user_id", "test-user-uuid");
        expect(mockQueryBuilder.eq).not.toHaveBeenCalledWith("phone", "+919876543210");
    });

    it("returns 401 for unauthenticated subscriber updates without updating by phone", async () => {
        mockAuthenticatedUser = null;

        const response = await request(app).patch("/api/notifications/phone").send({
            phone: "9876543210",
            district: "South Delhi",
        });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe(
            "A valid guest token is required to update settings without signing in."
        );
        expect(mockQueryBuilder.update).not.toHaveBeenCalled();
        expect(mockQueryBuilder.eq).not.toHaveBeenCalledWith("phone", "+919876543210");
    });

    it("returns 404 when an authenticated user submits another subscriber's phone number", async () => {
        mockAuthenticatedUser = {
            id: "different-user-uuid",
            role: "user",
            email: "other@example.com",
        };
        mockQueryResult = [];

        const response = await request(app)
            .patch("/api/notifications/phone")
            .send({
                phone: "9876543210",
                channels: ["sms"],
            });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe("Subscriber not found");
        expect(mockQueryBuilder.eq).toHaveBeenCalledWith("user_id", "different-user-uuid");
        expect(mockQueryBuilder.eq).not.toHaveBeenCalledWith("phone", "+919876543210");
    });

    it("keeps PATCH /phone updates partial", async () => {
        const response = await request(app).patch("/api/notifications/phone").send({
            phone: "9876543210",
            language: "hi",
        });

        expect(response.status).toBe(200);
        expect(mockQueryBuilder.update).toHaveBeenCalledWith({ language: "hi" });
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

    // #3956: POST /register looked an existing subscriber up by phone number
    // alone and then rewrote the row. A caller who knew the number could flip a
    // verified subscriber back to "pending" (which drops them out of the admin
    // broadcast, filtered on status = "active"), replace their district, and,
    // if signed in, take over the row through user_id.
    describe("register against an existing subscriber (#3956)", () => {
        // A verified subscriber that belongs to somebody else.
        const activeVictimRow = {
            ...mockSubscriber,
            user_id: "victim-user-uuid",
            district: "South West Delhi",
            channels: ["sms", "whatsapp"],
            language: "en",
            status: "active",
        };

        const attackerPayload = {
            phone: "9876543210",
            channels: ["sms"] as const,
            language: "ta",
            district: "Attacker Chosen District",
        };

        it("does NOT write OTP columns into the DB for a caller who has proven nothing (OTP goes to otpStore)", async () => {
            // Since PR #3928 OTPs are stored in an isolated otpStore (Redis / in-memory)
            // rather than written as plaintext columns on the subscriber row.
            // The heldForVerification path therefore makes NO supabase.update() call.
            mockAuthenticatedUser = null;
            mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
                data: activeVictimRow,
                error: null,
            });

            const response = await request(app)
                .post("/api/notifications/register")
                .send(attackerPayload);

            // Nothing is written to the DB row — the victim's settings stay intact.
            expect(mockQueryBuilder.update).not.toHaveBeenCalled();

            // The caller gets a 202 challenge, no subscriber data.
            expect(response.status).toBe(202);
            expect(response.body.success).toBe(true);
            expect(response.body.preferencesApplied).toBe(false);
            // And the response must not read the victim's row back to the caller.
            expect(response.body.subscriber).toBeUndefined();
            expect(JSON.stringify(response.body)).not.toContain("South West Delhi");
        });

        it("does not reassign user_id to a signed-in caller who does not own the row", async () => {
            mockAuthenticatedUser = {
                id: "attacker-user-uuid",
                role: "user",
                email: "attacker@example.com",
            };
            mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
                data: activeVictimRow,
                error: null,
            });

            const response = await request(app)
                .post("/api/notifications/register")
                .send(attackerPayload);

            // Since the caller doesn't own the row, no DB update happens at all
            // (OTP goes to otpStore, not to the subscriber row).
            expect(response.status).toBe(202);
            expect(mockQueryBuilder.update).not.toHaveBeenCalled();
        });

        it("still registers a brand-new number exactly as before", async () => {
            mockAuthenticatedUser = null;
            mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

            const response = await request(app)
                .post("/api/notifications/register")
                .send(attackerPayload);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(mockQueryBuilder.update).not.toHaveBeenCalled();
            expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
                expect.objectContaining({
                    phone: "+919876543210",
                    district: "Attacker Chosen District",
                    status: "pending",
                    is_active: true,
                })
            );
            for (const field of SENSITIVE_SUBSCRIBER_FIELDS) {
                expect(response.body.subscriber).not.toHaveProperty(field);
            }
        });

        it("lets a guest holding a token for that number change its settings", async () => {
            mockAuthenticatedUser = null;
            mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
                data: activeVictimRow,
                error: null,
            });

            const response = await request(app)
                .post("/api/notifications/register")
                .set("X-Guest-Token", signGuestToken("+919876543210"))
                .send(attackerPayload);

            expect(response.status).toBe(201);
            expect(updatePayload()).toMatchObject({
                channels: ["sms"],
                language: "ta",
                district: "Attacker Chosen District",
                is_active: true,
            });
            // A guest token proves the number, not the account behind the row.
            expect(updatePayload().user_id).toBe("victim-user-uuid");
        });

        it("lets the signed-in owner of the row change its settings", async () => {
            mockAuthenticatedUser = {
                id: "victim-user-uuid",
                role: "user",
                email: "owner@example.com",
            };
            mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
                data: activeVictimRow,
                error: null,
            });

            const response = await request(app)
                .post("/api/notifications/register")
                .send(attackerPayload);

            expect(response.status).toBe(201);
            expect(updatePayload()).toMatchObject({
                user_id: "victim-user-uuid",
                district: "Attacker Chosen District",
            });
        });

        it("ignores a guest token that was minted for a different number", async () => {
            mockAuthenticatedUser = null;
            mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
                data: activeVictimRow,
                error: null,
            });

            const response = await request(app)
                .post("/api/notifications/register")
                .set("X-Guest-Token", signGuestToken("+910000000000"))
                .send(attackerPayload);

            expect(response.status).toBe(202);
            // Token doesn't match: treated as unproven caller — no DB update
            // (OTP stored in otpStore, not DB columns).
            expect(mockQueryBuilder.update).not.toHaveBeenCalled();
        });
    });

    describe("guest token flow", () => {
        it("issues a guest token when a guest verifies a valid OTP", async () => {
            // OTP is now in otpStore (Redis/memory), not in the subscriber row (#3928).
            const pending = {
                ...mockSubscriber,
                status: "pending",
                verification_otp: null,
                otp_expires_at: null,
            };
            mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: pending, error: null });
            mockOtpStore.hasPending.mockResolvedValueOnce(true);
            mockOtpStore.verify.mockResolvedValueOnce(true);

            const response = await request(app)
                .post("/api/notifications/verify-otp")
                .send({ phone: "9876543210", otp: "654321" });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(typeof response.body.guestToken).toBe("string");
            // The token must resolve back to the number that was just verified.
            expect(verifyGuestPhone(response.body.guestToken)).toBe("+919876543210");
        });

        it("does not issue a token when an active row has no OTP challenge pending", async () => {
            // Active and nothing outstanding in otpStore: short-circuit to plain ack.
            // mockOtpStore.hasPending defaults to false in beforeEach.
            mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
                data: { ...mockSubscriber, verification_otp: null, otp_expires_at: null },
                error: null,
            });

            const response = await request(app)
                .post("/api/notifications/verify-otp")
                .send({ phone: "9876543210", otp: "000000" });

            expect(response.status).toBe(200);
            expect(response.body.guestToken).toBeUndefined();
        });

        it("mints a token when an active row's outstanding OTP is answered correctly", async () => {
            // A guest re-registering a number that is already active gets an OTP
            // stored in otpStore (#3928). The row stays active (#3956). Answering
            // that OTP is how they prove the number is theirs; it must mint a token.
            mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
                data: { ...mockSubscriber, status: "active", verification_otp: null },
                error: null,
            });
            mockOtpStore.hasPending.mockResolvedValueOnce(true);
            mockOtpStore.verify.mockResolvedValueOnce(true);

            const response = await request(app)
                .post("/api/notifications/verify-otp")
                .send({ phone: "9876543210", otp: "654321" });

            expect(response.status).toBe(200);
            expect(verifyGuestPhone(response.body.guestToken)).toBe("+919876543210");
        });

        it("rejects a wrong OTP against an active row instead of reporting success", async () => {
            // Active row has a pending OTP challenge in otpStore but the client
            // sends the wrong code — must reject, never short-circuit to success.
            mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
                data: { ...mockSubscriber, status: "active", verification_otp: null },
                error: null,
            });
            // hasPending = true → does NOT short-circuit; verify = false → reject
            mockOtpStore.hasPending.mockResolvedValueOnce(true);
            mockOtpStore.verify.mockResolvedValueOnce(false);

            const response = await request(app)
                .post("/api/notifications/verify-otp")
                .send({ phone: "9876543210", otp: "000000" });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe("Invalid or expired OTP");
            expect(response.body.guestToken).toBeUndefined();
        });

        it("rejects a guest opt-out that has no token", async () => {
            mockAuthenticatedUser = null;

            const response = await request(app)
                .delete("/api/notifications/phone")
                .send({ phone: "9876543210" });

            expect(response.status).toBe(401);
            expect(mockQueryBuilder.delete).not.toHaveBeenCalled();
        });

        it("opts a guest out scoped to the token's phone", async () => {
            mockAuthenticatedUser = null;
            const token = signGuestToken("+919876543210");

            const response = await request(app)
                .delete("/api/notifications/phone")
                .set("X-Guest-Token", token)
                .send({ phone: "+910000000000" }); // body is ignored

            expect(response.status).toBe(200);
            expect(mockQueryBuilder.eq).toHaveBeenCalledWith("phone", "+919876543210");
            expect(mockQueryBuilder.eq).not.toHaveBeenCalledWith("phone", "+910000000000");
        });

        it("rejects a guest settings update that has no token", async () => {
            mockAuthenticatedUser = null;

            const response = await request(app)
                .patch("/api/notifications/phone")
                .send({ phone: "9876543210", district: "South Delhi" });

            expect(response.status).toBe(401);
            expect(mockQueryBuilder.update).not.toHaveBeenCalled();
        });

        it("lets a guest with a valid token update their own settings", async () => {
            mockAuthenticatedUser = null;
            const token = signGuestToken("+919876543210");

            const response = await request(app)
                .patch("/api/notifications/phone")
                .set("X-Guest-Token", token)
                .send({ phone: "9876543210", district: "South Delhi", channels: ["sms"] });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(mockQueryBuilder.eq).toHaveBeenCalledWith("phone", "+919876543210");
            expect(mockQueryBuilder.eq).not.toHaveBeenCalledWith("user_id", expect.anything());
        });

        it("stops a guest from moving their subscription to a new number", async () => {
            mockAuthenticatedUser = null;
            const token = signGuestToken("+919876543210");

            const response = await request(app)
                .patch("/api/notifications/phone")
                .set("X-Guest-Token", token)
                .send({ phone: "9876543210", newPhone: "9123456789" });

            expect(response.status).toBe(400);
            expect(mockQueryBuilder.update).not.toHaveBeenCalled();
        });

        it("rejects a guest update that carries no changed fields", async () => {
            mockAuthenticatedUser = null;
            const token = signGuestToken("+919876543210");

            const response = await request(app)
                .patch("/api/notifications/phone")
                .set("X-Guest-Token", token)
                .send({ phone: "9876543210" });

            expect(response.status).toBe(400);
            expect(mockQueryBuilder.update).not.toHaveBeenCalled();
        });

        it("rejects a tampered or unsigned guest token", async () => {
            mockAuthenticatedUser = null;

            const response = await request(app)
                .get("/api/notifications/status")
                .set("X-Guest-Token", "not.a.real.token");

            expect(response.status).toBe(401);
            expect(mockQueryBuilder.eq).not.toHaveBeenCalled();
        });
    });

    describe("authenticated phone change via OTP verification", () => {
        beforeEach(() => {
            mockPendingPhoneChanges.clear();
            // Default: subscriber exists with phone +919876543210
            mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
                data: { ...mockSubscriber, phone: "+919876543210" },
                error: null,
            });
        });

        it("returns 200 with verificationRequired and current subscriber when phone change requested", async () => {
            const response = await request(app)
                .patch("/api/notifications/phone")
                .send({ phone: "9876543210", newPhone: "9123456789" });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.verificationRequired).toBe(true);
            expect(response.body.subscriber).toBeDefined();
            // Returns the CURRENT phone, not the new one (not yet verified)
            expect(response.body.subscriber.phone).toBe("+919876543210");
            // Must NOT update the DB directly
            expect(mockQueryBuilder.update).not.toHaveBeenCalled();
        });

        it("sends OTP to the new phone number via sms and whatsapp", async () => {
            const response = await request(app)
                .patch("/api/notifications/phone")
                .send({ phone: "9876543210", newPhone: "9123456789" });

            expect(response.status).toBe(200);
            expect(smsServiceMock.sendOtp).toHaveBeenCalledWith(
                "+919123456789",
                expect.any(String),
                "en"
            );
            expect(whatsappServiceMock.sendOtp).toHaveBeenCalledWith(
                "+919123456789",
                expect.any(String),
                "en"
            );
        });

        it("stores the OTP in otpStore for the new phone", async () => {
            await request(app)
                .patch("/api/notifications/phone")
                .send({ phone: "9876543210", newPhone: "9123456789" });

            expect(mockOtpStore.store).toHaveBeenCalledWith(
                "+919123456789",
                expect.stringMatching(/^\d{6}$/),
                expect.any(String)
            );
        });

        it("returns 400 when changing to the same phone number", async () => {
            const response = await request(app)
                .patch("/api/notifications/phone")
                .send({ phone: "9876543210", newPhone: "9876543210" });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe("New phone number is the same as the current one.");
        });

        it("returns 404 when authenticated user has no subscriber", async () => {
            mockQueryBuilder.maybeSingle.mockReset();
            // First call: phone change lookup returns no subscriber
            mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

            const response = await request(app)
                .patch("/api/notifications/phone")
                .send({ phone: "9876543210", newPhone: "9123456789" });

            expect(response.status).toBe(404);
            expect(response.body.error).toBe("Subscriber not found");
        });

        it("completes phone change when OTP is valid", async () => {
            // Request phone change first
            mockQueryBuilder.maybeSingle.mockReset();
            mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
                data: { ...mockSubscriber, phone: "+919876543210" },
                error: null,
            });
            await request(app)
                .patch("/api/notifications/phone")
                .send({ phone: "9876543210", newPhone: "9123456789" });

            // Now verify OTP
            mockQueryBuilder.maybeSingle.mockReset();
            mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
                data: { ...mockSubscriber, phone: "+919123456789", status: "pending" },
                error: null,
            });
            mockOtpStore.hasPending.mockResolvedValueOnce(true);
            mockOtpStore.verify.mockResolvedValueOnce(true);

            const response = await request(app)
                .post("/api/notifications/verify-otp")
                .send({ phone: "9123456789", otp: "123456" });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe("Phone number changed successfully");
            // The DB should have been updated with the new phone
            expect(mockQueryBuilder.update).toHaveBeenCalledWith({ phone: "+919123456789" });
            expect(mockQueryBuilder.eq).toHaveBeenCalledWith("user_id", "test-user-uuid");
        });

        it("does not complete phone change with invalid OTP", async () => {
            // Request phone change first
            mockQueryBuilder.maybeSingle.mockReset();
            mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
                data: { ...mockSubscriber, phone: "+919876543210" },
                error: null,
            });
            await request(app)
                .patch("/api/notifications/phone")
                .send({ phone: "9876543210", newPhone: "9123456789" });

            // Verify OTP with wrong code
            mockQueryBuilder.maybeSingle.mockReset();
            mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
                data: { ...mockSubscriber, phone: "+919123456789", status: "pending" },
                error: null,
            });
            mockOtpStore.hasPending.mockResolvedValueOnce(true);
            mockOtpStore.verify.mockResolvedValueOnce(false);

            const response = await request(app)
                .post("/api/notifications/verify-otp")
                .send({ phone: "9123456789", otp: "000000" });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe("Invalid or expired OTP");
            // Phone should NOT have been updated
            expect(mockQueryBuilder.update).not.toHaveBeenCalledWith(
                expect.objectContaining({ phone: expect.anything() })
            );
        });

        it("allows updating other fields without triggering OTP flow", async () => {
            mockQueryBuilder.maybeSingle.mockReset();

            const response = await request(app)
                .patch("/api/notifications/phone")
                .send({ phone: "9876543210", district: "New District", channels: ["sms"] });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(mockQueryBuilder.update).toHaveBeenCalledWith({
                district: "New District",
                channels: ["sms"],
            });
        });

        it("guest phone change is still blocked", async () => {
            mockAuthenticatedUser = null;
            const token = signGuestToken("+919876543210");

            const response = await request(app)
                .patch("/api/notifications/phone")
                .set("X-Guest-Token", token)
                .send({ phone: "9876543210", newPhone: "9123456789" });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe(
                "Changing your number requires verifying the new number first."
            );
        });

        it("scopes pending phone change to the authenticated user (not the phone number)", async () => {
            // User A requests phone change
            mockAuthenticatedUser = {
                id: "user-a-uuid",
                role: "user",
                email: "a@example.com",
            };
            mockQueryBuilder.maybeSingle.mockReset();
            mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
                data: { ...mockSubscriber, user_id: "user-a-uuid", phone: "+919876543210" },
                error: null,
            });
            await request(app)
                .patch("/api/notifications/phone")
                .send({ phone: "9876543210", newPhone: "9123456789" });

            // User B also requests change to same newPhone
            mockAuthenticatedUser = {
                id: "user-b-uuid",
                role: "user",
                email: "b@example.com",
            };
            mockQueryBuilder.maybeSingle.mockReset();
            mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
                data: { ...mockSubscriber, user_id: "user-b-uuid", phone: "+919876543211" },
                error: null,
            });
            await request(app)
                .patch("/api/notifications/phone")
                .send({ phone: "9876543211", newPhone: "9123456789" });

            // Now verify OTP as User A — should succeed (pending change is under user-a-uuid)
            mockAuthenticatedUser = {
                id: "user-a-uuid",
                role: "user",
                email: "a@example.com",
            };
            mockQueryBuilder.maybeSingle.mockReset();
            mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
                data: {
                    ...mockSubscriber,
                    user_id: "user-a-uuid",
                    phone: "+919123456789",
                    status: "pending",
                },
                error: null,
            });
            mockOtpStore.hasPending.mockResolvedValueOnce(true);
            mockOtpStore.verify.mockResolvedValueOnce(true);

            const response = await request(app)
                .post("/api/notifications/verify-otp")
                .send({ phone: "9123456789", otp: "123456" });

            expect(response.status).toBe(200);
            expect(response.body.message).toBe("Phone number changed successfully");
            // DB update is scoped to User A
            expect(mockQueryBuilder.update).toHaveBeenCalledWith({ phone: "+919123456789" });
            expect(mockQueryBuilder.eq).toHaveBeenCalledWith("user_id", "user-a-uuid");
        });
    });
});
