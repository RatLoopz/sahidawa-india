// The SMS worker creates a real BullMQ Worker + IORedis connection at module
// load, so both are mocked here and the processor is tested in isolation.
jest.mock("ioredis", () => jest.fn().mockImplementation(() => ({})));

jest.mock("bullmq", () => ({
    Worker: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("../src/utils/logger", () => ({
    __esModule: true,
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { processSmsJob } from "../src/workers/smsWorker";

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
    for (const key of CLOUD_PLATFORM_ENV_VARS) {
        delete process.env[key];
    }
}

afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    global.fetch = ORIGINAL_FETCH;
    jest.clearAllMocks();
});

const job = {
    data: { phone: "+919876543210", message: "SahiDawa alert", language: "en" },
};

describe("processSmsJob", () => {
    it("throws when Twilio credentials are missing in production (BullMQ retries)", async () => {
        clearProviderEnv();
        process.env.NODE_ENV = "production";
        await expect(processSmsJob(job as any)).rejects.toThrow(/Twilio credentials missing/i);
    });

    it("mocks (resolves) when Twilio credentials are missing in development", async () => {
        clearProviderEnv();
        process.env.NODE_ENV = "development";
        await expect(processSmsJob(job as any)).resolves.toBeUndefined();
    });

    it("throws on a cloud platform even with NODE_ENV=development", async () => {
        clearProviderEnv();
        process.env.NODE_ENV = "development";
        process.env.RAILWAY_ENVIRONMENT_NAME = "production";
        await expect(processSmsJob(job as any)).rejects.toThrow(/Twilio credentials missing/i);
    });

    it("resolves when Twilio responds ok", async () => {
        clearProviderEnv();
        process.env.NODE_ENV = "production";
        process.env.TWILIO_ACCOUNT_SID = "test-sid";
        process.env.TWILIO_AUTH_TOKEN = "test-token";
        process.env.TWILIO_PHONE_NUMBER = "+15551234567";
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => "ok",
        } as unknown as Response);

        await expect(processSmsJob(job as any)).resolves.toBeUndefined();
    });

    it("throws a rate-limit error on HTTP 429 (BullMQ retries)", async () => {
        clearProviderEnv();
        process.env.NODE_ENV = "production";
        process.env.TWILIO_ACCOUNT_SID = "test-sid";
        process.env.TWILIO_AUTH_TOKEN = "test-token";
        process.env.TWILIO_PHONE_NUMBER = "+15551234567";
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 429,
            text: async () => "",
        } as unknown as Response);

        await expect(processSmsJob(job as any)).rejects.toThrow("Twilio rate limited");
    });

    it("throws a provider error on other non-OK responses", async () => {
        clearProviderEnv();
        process.env.NODE_ENV = "production";
        process.env.TWILIO_ACCOUNT_SID = "test-sid";
        process.env.TWILIO_AUTH_TOKEN = "test-token";
        process.env.TWILIO_PHONE_NUMBER = "+15551234567";
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 500,
            text: async () => "boom",
        } as unknown as Response);

        await expect(processSmsJob(job as any)).rejects.toThrow(/Twilio SMS API error: 500/);
    });
});
