jest.mock("../src/queues/smsQueue", () => ({
    smsQueue: { add: jest.fn().mockResolvedValue(undefined), on: jest.fn() },
}));

jest.mock("../src/utils/logger", () => ({
    __esModule: true,
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { GupshupWhatsAppService } from "../src/services/whatsapp-service";
import { TwilioSMSService } from "../src/services/sms-service";
import { smsQueue } from "../src/queues/smsQueue";
import { isLocalDevelopment } from "../src/utils/env";

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;

const CLOUD_PLATFORM_ENV_VARS = [
    "RAILWAY_ENVIRONMENT_NAME",
    "VERCEL",
    "RENDER",
    "FLY_APP_NAME",
    "AWS_EXECUTION_ENV",
    "KUBERNETES_SERVICE_HOST",
    "DYNO",
];

function clearProviderEnv() {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
    delete process.env.GUPSHUP_API_KEY;
    delete process.env.GUPSHUP_SOURCE_NUMBER;
    for (const key of CLOUD_PLATFORM_ENV_VARS) {
        delete process.env[key];
    }
}

afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    global.fetch = ORIGINAL_FETCH;
    jest.clearAllMocks();
});

describe("isLocalDevelopment", () => {
    it("returns true for NODE_ENV=development without cloud platform vars", () => {
        clearProviderEnv();
        process.env.NODE_ENV = "development";
        expect(isLocalDevelopment()).toBe(true);
    });

    it("returns false for NODE_ENV=production", () => {
        clearProviderEnv();
        process.env.NODE_ENV = "production";
        expect(isLocalDevelopment()).toBe(false);
    });

    it("returns false when NODE_ENV is unset", () => {
        clearProviderEnv();
        delete process.env.NODE_ENV;
        expect(isLocalDevelopment()).toBe(false);
    });

    it("returns false on a cloud platform even with NODE_ENV=development", () => {
        clearProviderEnv();
        process.env.NODE_ENV = "development";
        process.env.RAILWAY_ENVIRONMENT_NAME = "production";
        expect(isLocalDevelopment()).toBe(false);
    });
});

describe("GupshupWhatsAppService", () => {
    it("mocks a successful delivery in development when credentials are missing", async () => {
        clearProviderEnv();
        process.env.NODE_ENV = "development";
        const service = new GupshupWhatsAppService();
        await expect(service.send("+919876543210", "hello", "en")).resolves.toBe(true);
    });

    it("fails delivery in production when credentials are missing", async () => {
        clearProviderEnv();
        process.env.NODE_ENV = "production";
        const service = new GupshupWhatsAppService();
        await expect(service.send("+919876543210", "hello", "en")).resolves.toBe(false);
    });

    it("fails delivery on a cloud platform even with NODE_ENV=development", async () => {
        clearProviderEnv();
        process.env.NODE_ENV = "development";
        process.env.RAILWAY_ENVIRONMENT_NAME = "production";
        const service = new GupshupWhatsAppService();
        await expect(service.send("+919876543210", "hello", "en")).resolves.toBe(false);
    });

    it("sends successfully when credentials are present and the API responds ok", async () => {
        clearProviderEnv();
        process.env.NODE_ENV = "production";
        process.env.GUPSHUP_API_KEY = "test-api-key";
        process.env.GUPSHUP_SOURCE_NUMBER = "+15551234567";
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => "ok",
        } as unknown as Response);

        const service = new GupshupWhatsAppService();
        await expect(service.send("+919876543210", "hello", "en")).resolves.toBe(true);
    });

    it("fails delivery when the Gupshup API returns an error", async () => {
        clearProviderEnv();
        process.env.NODE_ENV = "production";
        process.env.GUPSHUP_API_KEY = "test-api-key";
        process.env.GUPSHUP_SOURCE_NUMBER = "+15551234567";
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 500,
            text: async () => "boom",
        } as unknown as Response);

        const service = new GupshupWhatsAppService();
        await expect(service.send("+919876543210", "hello", "en")).resolves.toBe(false);
    });

    it("delegates sendOtp to send", async () => {
        clearProviderEnv();
        process.env.NODE_ENV = "production";
        const service = new GupshupWhatsAppService();
        await expect(service.sendOtp("+919876543210", "123456", "en")).resolves.toBe(false);
    });
});

describe("TwilioSMSService", () => {
    it("fails delivery in production when credentials are missing and does not enqueue", async () => {
        clearProviderEnv();
        process.env.NODE_ENV = "production";
        const service = new TwilioSMSService();
        await expect(service.send("+919876543210", "hello", "en")).resolves.toBe(false);
        expect(smsQueue.add).not.toHaveBeenCalled();
    });

    it("enqueues (reports queued) in development when credentials are missing", async () => {
        clearProviderEnv();
        process.env.NODE_ENV = "development";
        const service = new TwilioSMSService();
        await expect(service.send("+919876543210", "hello", "en")).resolves.toBe(true);
        expect(smsQueue.add).toHaveBeenCalledTimes(1);
    });

    it("fails delivery on a cloud platform even with NODE_ENV=development", async () => {
        clearProviderEnv();
        process.env.NODE_ENV = "development";
        process.env.RAILWAY_ENVIRONMENT_NAME = "production";
        const service = new TwilioSMSService();
        await expect(service.send("+919876543210", "hello", "en")).resolves.toBe(false);
        expect(smsQueue.add).not.toHaveBeenCalled();
    });

    it("enqueues when credentials are present", async () => {
        clearProviderEnv();
        process.env.NODE_ENV = "production";
        process.env.TWILIO_ACCOUNT_SID = "test-sid";
        process.env.TWILIO_AUTH_TOKEN = "test-token";
        process.env.TWILIO_PHONE_NUMBER = "+15551234567";
        const service = new TwilioSMSService();
        await expect(service.send("+919876543210", "hello", "en")).resolves.toBe(true);
        expect(smsQueue.add).toHaveBeenCalledTimes(1);
    });

    it("fails delivery when enqueuing throws", async () => {
        clearProviderEnv();
        process.env.NODE_ENV = "production";
        process.env.TWILIO_ACCOUNT_SID = "test-sid";
        process.env.TWILIO_AUTH_TOKEN = "test-token";
        process.env.TWILIO_PHONE_NUMBER = "+15551234567";
        (smsQueue.add as jest.Mock).mockRejectedValueOnce(new Error("Redis down"));
        const service = new TwilioSMSService();
        await expect(service.send("+919876543210", "hello", "en")).resolves.toBe(false);
    });

    it("delegates sendOtp to send", async () => {
        clearProviderEnv();
        process.env.NODE_ENV = "production";
        const service = new TwilioSMSService();
        await expect(service.sendOtp("+919876543210", "123456", "en")).resolves.toBe(false);
        expect(smsQueue.add).not.toHaveBeenCalled();
    });
});
