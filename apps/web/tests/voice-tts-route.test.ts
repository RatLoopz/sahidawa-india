import {
    describe,
    it,
    expect,
    jest,
    beforeEach,
    afterEach,
    beforeAll,
    afterAll,
} from "@jest/globals";
const mockRateLimit = jest.fn();

jest.mock("@/lib/rateLimit", () => ({
    rateLimit: {
        limit: mockRateLimit,
    },
}));

import { POST } from "../app/api/voice/tts/route";

describe("POST /api/voice/tts", () => {
    const originalFetch = global.fetch;
    const originalMlServiceUrl = process.env.ML_SERVICE_URL;

    beforeEach(() => {
        jest.resetAllMocks();
        mockRateLimit.mockResolvedValue({ success: true });
        process.env.ML_SERVICE_URL = "https://ml-service.example.com";
    });

    afterAll(() => {
        global.fetch = originalFetch;
        process.env.ML_SERVICE_URL = originalMlServiceUrl;
    });

    it("returns 500 without fetching when ML_SERVICE_URL is unsafe", async () => {
        process.env.ML_SERVICE_URL = "http://192.168.1.10:8000";
        global.fetch = jest.fn() as unknown as typeof fetch;

        const response = await POST(
            new Request("http://localhost/api/voice/tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: "Take rest and drink water.",
                    languageCode: "en-IN",
                }),
            })
        );
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data).toEqual({
            error: "Server configuration error: text-to-speech service URL is missing.",
            code: "ML_SERVICE_URL_MISSING",
        });
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
